"""The launcher's verification and deduplication logic, isolated.

This is the part of the control plane described in
"Who Is Allowed to Start Your Agent's Sandbox?" under Decisions 2 and 4:
HMAC verification against a signing secret from Parameter Store, then an
idempotency claim keyed on the webhook event ID, and only then a launch.

Nothing here imports boto3 or opens a socket. The three services it talks to
are injected, and ``fixtures.py`` supplies local stand-ins for them.

Ordering is the whole design, so it is stated once here and enforced once
below:

    1. read the signing secret        - cannot authenticate without it
    2. check the delivery is fresh    - a valid old signature is still a replay
    3. verify the signature           - this is the authentication boundary
    4. claim the event ID             - conditional write, wins exactly once
    5. launch                         - the first billable step

Steps 1 through 4 cost nothing. Step 5 costs money for as long as the MicroVM
runs, which is why it is last.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from fixtures import LaunchFailed, ParameterNotFound

# A delivery signed more than this many seconds ago is refused even if the
# signature is valid. Without it, a captured delivery is replayable forever
# against any event ID the idempotency table has since expired.
DEFAULT_TOLERANCE_SECONDS = 300


class Outcome(str, Enum):
    """Every way a delivery can end. Distinct values, deliberately.

    The four the experiment is built around are LAUNCHED, DUPLICATE,
    BAD_SIGNATURE and SECRET_UNAVAILABLE. The rest exist so that those four
    stay unambiguous — a malformed body must not be counted as a forged one.
    """

    LAUNCHED = "launched"
    DUPLICATE = "duplicate"
    BAD_SIGNATURE = "bad_signature"
    SECRET_UNAVAILABLE = "secret_unavailable"
    STALE = "stale"
    MALFORMED = "malformed"
    LAUNCH_FAILED = "launch_failed"


#: HTTP status per outcome.
#:
#: SECRET_UNAVAILABLE is 500 and not 401, and the difference is operational,
#: not cosmetic. 401 tells the sender its signature was rejected, and a
#: well-behaved sender stops retrying deliveries it believes are forged. Our
#: own missing configuration would then silently discard real events. 500
#: says "my fault, retry", which is true.
STATUS = {
    Outcome.LAUNCHED: 202,
    Outcome.DUPLICATE: 200,
    Outcome.BAD_SIGNATURE: 401,
    Outcome.STALE: 401,
    Outcome.MALFORMED: 400,
    Outcome.SECRET_UNAVAILABLE: 500,
    Outcome.LAUNCH_FAILED: 503,
}


@dataclass
class Response:
    outcome: Outcome
    detail: str
    sandbox_id: str | None = None

    @property
    def status(self) -> int:
        return STATUS[self.outcome]

    @property
    def ok(self) -> bool:
        return self.status < 400


@dataclass
class LauncherConfig:
    #: Parameter the launcher reads. It holds the webhook signing secret.
    signing_secret_parameter: str = "/agent-sandbox/webhook/signing-secret"
    #: Parameter the *worker* reads. The launcher passes this name onward and
    #: never calls get_parameter on it. See ``_dispatch_payload``.
    environment_key_parameter: str = "/agent-sandbox/worker/environment-key"
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS


@dataclass
class Launcher:
    """Holds no state of its own between deliveries.

    Everything durable lives in the injected stores. That is what lets a test
    throw the Launcher away and build a new one to simulate a cold start —
    if dedup still holds, it held because of the store and not because of a
    dict that happened to survive.
    """

    parameter_store: Any
    idempotency: Any
    fleet: Any
    config: LauncherConfig = field(default_factory=LauncherConfig)
    #: Injectable clock so freshness can be tested without sleeping.
    now: Any = time.time

    # -- step 1 ------------------------------------------------------------

    def _load_signing_secret(self) -> str:
        return self.parameter_store.get_parameter(self.config.signing_secret_parameter)

    # -- steps 2 and 3 -----------------------------------------------------

    def _verify(self, body: bytes, headers: dict[str, str], secret: str) -> Response | None:
        """Return a failure Response, or None if the delivery is authentic."""
        lowered = {k.lower(): v for k, v in headers.items()}
        supplied = lowered.get("x-webhook-signature")
        raw_ts = lowered.get("x-webhook-timestamp")

        if not supplied or not raw_ts:
            return Response(Outcome.BAD_SIGNATURE, "missing signature or timestamp header")

        try:
            ts = int(raw_ts)
        except ValueError:
            return Response(Outcome.BAD_SIGNATURE, "timestamp header is not an integer")

        age = abs(self.now() - ts)
        if age > self.config.tolerance_seconds:
            return Response(Outcome.STALE, f"delivery is {int(age)}s old")

        # Recompute over the exact bytes received. Parsing the body and
        # re-serialising it before hashing is the classic way to make this
        # check pass locally and fail against a real sender.
        signed_payload = f"{ts}.".encode() + body
        expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()

        candidate = supplied.split("=", 1)[1] if supplied.startswith("sha256=") else supplied
        # compare_digest, not ==, so the comparison does not leak the correct
        # prefix length through timing.
        if not hmac.compare_digest(expected, candidate):
            return Response(Outcome.BAD_SIGNATURE, "signature mismatch")

        return None

    # -- step 5 ------------------------------------------------------------

    def _dispatch_payload(self, event: dict[str, Any]) -> dict[str, Any]:
        """What gets handed to the sandbox.

        A *name*, never a value. The launcher cannot read this parameter and
        does not try; the worker's execution role can. Whether that role scope
        actually holds is an IAM question this experiment cannot answer — see
        the README.
        """
        return {
            "session_id": event["session_id"],
            "event_id": event["event_id"],
            "environment_key_parameter": self.config.environment_key_parameter,
        }

    # -- the pipeline ------------------------------------------------------

    def handle(self, body: bytes, headers: dict[str, str]) -> Response:
        # 1. Without the secret there is no authentication decision to make.
        #    Failing open here would be the whole vulnerability, so this is a
        #    hard stop before anything else is examined.
        try:
            secret = self._load_signing_secret()
        except ParameterNotFound as exc:
            return Response(
                Outcome.SECRET_UNAVAILABLE,
                f"cannot read {self.config.signing_secret_parameter}: {exc.reason}",
            )

        # 2 and 3.
        failure = self._verify(body, headers, secret)
        if failure is not None:
            return failure

        try:
            event = json.loads(body)
            event_id = event["event_id"]
            event["session_id"]
        except (ValueError, KeyError, TypeError) as exc:
            # Authentic but unusable. Distinct from forged: the sender is who
            # it claims to be and retrying will not help.
            return Response(Outcome.MALFORMED, f"body verified but unusable: {exc}")

        # 4. Conditional write. Whoever wins this launches; everyone else is
        #    a retry of that same delivery.
        if not self.idempotency.claim(event_id):
            record = self.idempotency.get(event_id) or {}
            existing = (record.get("result") or {}).get("sandbox_id")
            return Response(
                Outcome.DUPLICATE,
                f"event {event_id} already handled",
                sandbox_id=existing,
            )

        # 5. First and only billable step.
        try:
            sandbox_id = self.fleet.launch(self._dispatch_payload(event))
        except LaunchFailed as exc:
            # Give the key back. A remembered failure is a session that never
            # starts, because every retry would be answered "already handled".
            self.idempotency.release(event_id)
            return Response(Outcome.LAUNCH_FAILED, str(exc))

        self.idempotency.complete(event_id, {"sandbox_id": sandbox_id})
        return Response(Outcome.LAUNCHED, f"started {sandbox_id}", sandbox_id=sandbox_id)
