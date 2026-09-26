"""Local stand-ins for the three AWS services the launcher touches.

Parameter Store, the idempotency table, and the sandbox fleet. Each one is a
plain object holding a dict, so the whole experiment runs offline with the
standard library only. No boto3, no moto, no network, no credentials.

The point of these is not fidelity. It is that each one carries a *counter*,
so a test can assert on how many times the launcher actually reached for the
service instead of reading it out of a log line.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any


# --------------------------------------------------------------------------
# Parameter Store
# --------------------------------------------------------------------------


class ParameterNotFound(Exception):
    """Raised by the store when a parameter name does not exist.

    The real ``ssm:GetParameter`` raises ``ParameterNotFound`` and an IAM
    denial raises ``AccessDeniedException``. Both arrive at the launcher as
    "I could not read my secret", which is the state this experiment cares
    about, so the fake collapses them into one class and records which it was.
    """

    def __init__(self, name: str, reason: str = "not_found") -> None:
        super().__init__(f"parameter {name!r}: {reason}")
        self.name = name
        self.reason = reason


class FakeParameterStore:
    """A dict with a read counter and per-name denial.

    ``denied`` models the IAM side of a read failure so the launcher's
    missing-secret path can be exercised for both causes without an account.
    """

    def __init__(self, params: dict[str, str] | None = None) -> None:
        self._params: dict[str, str] = dict(params or {})
        self.denied: set[str] = set()
        self.reads: list[str] = []

    def get_parameter(self, name: str) -> str:
        self.reads.append(name)
        if name in self.denied:
            raise ParameterNotFound(name, reason="access_denied")
        if name not in self._params:
            raise ParameterNotFound(name, reason="not_found")
        return self._params[name]

    def put_parameter(self, name: str, value: str) -> None:
        self._params[name] = value

    def deny(self, name: str) -> None:
        """Make reads of ``name`` fail as an IAM denial would."""
        self.denied.add(name)

    @property
    def read_count(self) -> int:
        return len(self.reads)


# --------------------------------------------------------------------------
# Idempotency table
# --------------------------------------------------------------------------


class IdempotencyStore:
    """Conditional-write store keyed on the webhook event ID.

    ``claim`` is the whole mechanism: it returns True exactly once per key,
    for the caller that got there first. Everyone else gets False and the
    record that the winner wrote. This is the local shape of a DynamoDB
    ``PutItem`` with ``attribute_not_exists(pk)``.

    ``persist_across_cold_start`` is what separates a record from a cache.
    The launcher object is thrown away and rebuilt between invocations; this
    store is not, which is the only reason dedup survives.
    """

    persists_across_cold_start = True

    def __init__(self) -> None:
        self._records: dict[str, dict[str, Any]] = {}
        self.claim_attempts = 0

    def claim(self, key: str) -> bool:
        self.claim_attempts += 1
        if key in self._records:
            return False
        self._records[key] = {"status": "in_progress", "result": None}
        return True

    def complete(self, key: str, result: dict[str, Any]) -> None:
        self._records[key] = {"status": "complete", "result": result}

    def release(self, key: str) -> None:
        """Drop a claim whose launch failed, so a retry may try again.

        Without this a transient fleet error would be remembered as a
        successful launch and the session would never start.
        """
        self._records.pop(key, None)

    def get(self, key: str) -> dict[str, Any] | None:
        return self._records.get(key)

    def __contains__(self, key: str) -> bool:
        return key in self._records

    @property
    def size(self) -> int:
        return len(self._records)


class InMemoryIdempotencyStore(IdempotencyStore):
    """The wrong implementation, kept so a test can show it is wrong.

    Identical behaviour within one process lifetime. The difference only
    appears at a cold start, which is precisely when webhook retries arrive.
    ``simulate_cold_start`` is what a process restart does to it.
    """

    persists_across_cold_start = False

    def simulate_cold_start(self) -> None:
        self._records.clear()


# --------------------------------------------------------------------------
# Sandbox fleet
# --------------------------------------------------------------------------


class LaunchFailed(Exception):
    """The fleet refused or failed to start a sandbox."""


class SandboxFleet:
    """Counts launches. This counter is the experiment's only real assertion.

    Every test that claims "exactly one sandbox" reads ``launch_count``, not
    a log line and not a return value the launcher chose to emit.
    """

    def __init__(self) -> None:
        self.launches: list[dict[str, Any]] = []
        self.fail_next = False

    def launch(self, payload: dict[str, Any]) -> str:
        if self.fail_next:
            self.fail_next = False
            raise LaunchFailed("fleet rejected the launch")
        sandbox_id = f"mv-{len(self.launches):04d}"
        # Record a deep copy so a later mutation of the payload by the caller
        # cannot retroactively change what the test sees.
        self.launches.append(
            {"sandbox_id": sandbox_id, "payload": json.loads(json.dumps(payload))}
        )
        return sandbox_id

    @property
    def launch_count(self) -> int:
        return len(self.launches)

    @property
    def last_payload(self) -> dict[str, Any] | None:
        return self.launches[-1]["payload"] if self.launches else None


# --------------------------------------------------------------------------
# Event construction
# --------------------------------------------------------------------------

DEFAULT_SIGNING_SECRET = "whsec_local_fixture_not_a_real_secret"


def make_event_body(
    event_id: str = "evt_01HQ8SESSION",
    session_id: str = "sess_analytics_42",
    **extra: Any,
) -> bytes:
    """Serialise a webhook body once, to bytes.

    Bytes, not a dict, on purpose: the signature covers the exact octets the
    sender hashed. A launcher that re-serialises a parsed dict before hashing
    will pass its own tests and fail against a real sender whose key order or
    separators differ.
    """
    payload: dict[str, Any] = {
        "event_id": event_id,
        "type": "session.ready",
        "session_id": session_id,
    }
    payload.update(extra)
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()


def sign(body: bytes, secret: str, timestamp: int | None = None) -> dict[str, str]:
    """Produce the headers a correctly-behaving sender would send.

    The signed string is ``{timestamp}.{body}`` so that the timestamp cannot
    be edited without invalidating the signature. Signing the body alone would
    let anyone replay an old delivery with a fresh timestamp.
    """
    ts = int(time.time()) if timestamp is None else timestamp
    signed_payload = f"{ts}.".encode() + body
    digest = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return {"x-webhook-timestamp": str(ts), "x-webhook-signature": f"sha256={digest}"}


def signed_delivery(
    secret: str = DEFAULT_SIGNING_SECRET,
    timestamp: int | None = None,
    **event_kwargs: Any,
) -> tuple[bytes, dict[str, str]]:
    """A complete, valid delivery: the body and its headers."""
    body = make_event_body(**event_kwargs)
    return body, sign(body, secret, timestamp)
