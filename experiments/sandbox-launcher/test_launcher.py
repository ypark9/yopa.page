"""Tests for the launcher's verification and deduplication logic.

Every claim about "how many sandboxes started" is asserted against
``fleet.launch_count``. No test reads a log line, and no test trusts the
launcher's own report of what it did.

Run: pytest experiments/sandbox-launcher/ -q
"""

from __future__ import annotations

import json

import pytest

from fixtures import (
    DEFAULT_SIGNING_SECRET,
    FakeParameterStore,
    IdempotencyStore,
    InMemoryIdempotencyStore,
    SandboxFleet,
    make_event_body,
    sign,
    signed_delivery,
)
from launcher import Launcher, LauncherConfig, Outcome


@pytest.fixture
def config():
    return LauncherConfig()


@pytest.fixture
def store(config):
    return FakeParameterStore({config.signing_secret_parameter: DEFAULT_SIGNING_SECRET})


@pytest.fixture
def fleet():
    return SandboxFleet()


@pytest.fixture
def idempotency():
    return IdempotencyStore()


@pytest.fixture
def launcher(store, idempotency, fleet, config):
    return Launcher(
        parameter_store=store, idempotency=idempotency, fleet=fleet, config=config
    )


# ==========================================================================
# State 1 of 4 — valid and new
# ==========================================================================


def test_valid_new_event_launches_exactly_one_sandbox(launcher, fleet):
    body, headers = signed_delivery()

    response = launcher.handle(body, headers)

    assert response.outcome is Outcome.LAUNCHED
    assert response.status == 202
    assert fleet.launch_count == 1


def test_launch_carries_the_session_id(launcher, fleet):
    body, headers = signed_delivery(session_id="sess_analytics_42")

    launcher.handle(body, headers)

    assert fleet.last_payload["session_id"] == "sess_analytics_42"


def test_two_genuinely_different_events_launch_two_sandboxes(launcher, fleet):
    """The counter is not stuck at one.

    Without this, a launcher that never launches anything after the first
    call would pass every deduplication test in the file.
    """
    for event_id in ("evt_aaa", "evt_bbb"):
        body, headers = signed_delivery(event_id=event_id)
        assert launcher.handle(body, headers).outcome is Outcome.LAUNCHED

    assert fleet.launch_count == 2


# ==========================================================================
# State 2 of 4 — valid and duplicate
# ==========================================================================


def test_replaying_the_identical_delivery_launches_nothing_new(launcher, fleet):
    """The spec item: the same signed event, twice, byte for byte."""
    body, headers = signed_delivery()

    first = launcher.handle(body, headers)
    second = launcher.handle(body, headers)

    assert first.outcome is Outcome.LAUNCHED
    assert second.outcome is Outcome.DUPLICATE
    assert second.status == 200
    assert fleet.launch_count == 1


def test_duplicate_reports_the_original_sandbox(launcher):
    body, headers = signed_delivery()

    first = launcher.handle(body, headers)
    second = launcher.handle(body, headers)

    assert second.sandbox_id == first.sandbox_id


def test_ten_replays_still_launch_one(launcher, fleet):
    body, headers = signed_delivery()

    outcomes = [launcher.handle(body, headers).outcome for _ in range(10)]

    assert outcomes[0] is Outcome.LAUNCHED
    assert set(outcomes[1:]) == {Outcome.DUPLICATE}
    assert fleet.launch_count == 1


def test_dedup_survives_a_cold_start(store, idempotency, fleet, config):
    """A new Launcher object, the same durable store.

    Retries arrive minutes apart, so the process that handled the original
    delivery is usually gone. If dedup lived in the Launcher this would
    launch twice.
    """
    body, headers = signed_delivery()

    first = Launcher(parameter_store=store, idempotency=idempotency, fleet=fleet, config=config)
    assert first.handle(body, headers).outcome is Outcome.LAUNCHED

    del first  # cold start
    second = Launcher(parameter_store=store, idempotency=idempotency, fleet=fleet, config=config)
    assert second.handle(body, headers).outcome is Outcome.DUPLICATE

    assert fleet.launch_count == 1


def test_in_memory_dedup_fails_the_same_cold_start(store, fleet, config):
    """The negative control for the test above.

    This asserts the *broken* behaviour on purpose. If this test ever starts
    passing with one launch, the cold-start simulation stopped simulating
    anything and the test above proves nothing.
    """
    volatile = InMemoryIdempotencyStore()
    body, headers = signed_delivery()

    first = Launcher(parameter_store=store, idempotency=volatile, fleet=fleet, config=config)
    assert first.handle(body, headers).outcome is Outcome.LAUNCHED

    volatile.simulate_cold_start()

    second = Launcher(parameter_store=store, idempotency=volatile, fleet=fleet, config=config)
    assert second.handle(body, headers).outcome is Outcome.LAUNCHED

    assert fleet.launch_count == 2


def test_dedup_is_keyed_on_event_id_not_on_body_hash(launcher, fleet):
    """Two deliveries, identical session, different event IDs.

    These are two events, not one retried event, and both should launch.
    A launcher that deduplicated on a body digest would wrongly collapse
    them and lose the second session.
    """
    for event_id in ("evt_first", "evt_second"):
        body, headers = signed_delivery(event_id=event_id, session_id="sess_same")
        launcher.handle(body, headers)

    assert fleet.launch_count == 2


def test_a_failed_launch_is_not_remembered_as_a_success(launcher, fleet):
    """A transient fleet error must leave the key claimable.

    Otherwise the retry — the thing retries exist for — is answered
    "already handled" and the session never starts.
    """
    body, headers = signed_delivery()
    fleet.fail_next = True

    failed = launcher.handle(body, headers)
    assert failed.outcome is Outcome.LAUNCH_FAILED
    assert fleet.launch_count == 0

    retried = launcher.handle(body, headers)
    assert retried.outcome is Outcome.LAUNCHED
    assert fleet.launch_count == 1


# ==========================================================================
# State 3 of 4 — bad signature
# ==========================================================================


def test_tampered_body_returns_401_and_launches_nothing(launcher, fleet):
    """The spec item: signature computed over the original body, body edited."""
    body, headers = signed_delivery(session_id="sess_mine")
    tampered = body.replace(b"sess_mine", b"sess_other")
    assert tampered != body

    response = launcher.handle(tampered, headers)

    assert response.outcome is Outcome.BAD_SIGNATURE
    assert response.status == 401
    assert fleet.launch_count == 0


def test_nothing_is_written_to_the_idempotency_table_on_a_bad_signature(
    launcher, idempotency, fleet
):
    """Verification precedes every side effect, not just the billable one.

    An unauthenticated caller who can write rows into the idempotency table
    can pre-claim the event IDs of real sessions and suppress them.
    """
    body, headers = signed_delivery()
    tampered = body.replace(b"session.ready", b"session.readx")

    launcher.handle(tampered, headers)

    assert idempotency.size == 0
    assert idempotency.claim_attempts == 0
    assert fleet.launch_count == 0


def test_signature_from_the_wrong_secret_is_rejected(launcher, fleet):
    body = make_event_body()
    headers = sign(body, "whsec_attacker_guess")

    assert launcher.handle(body, headers).outcome is Outcome.BAD_SIGNATURE
    assert fleet.launch_count == 0


def test_forged_event_id_on_a_captured_body_is_rejected(launcher, fleet):
    """Dedup alone would not stop this; the signature does.

    An attacker who captured one valid delivery and could swap in a fresh
    event ID would get a new sandbox on every send. The event ID is inside
    the signed bytes, so editing it breaks the signature.
    """
    body, headers = signed_delivery(event_id="evt_original")
    forged = body.replace(b"evt_original", b"evt_forged001")

    assert launcher.handle(forged, headers).outcome is Outcome.BAD_SIGNATURE
    assert fleet.launch_count == 0


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"x-webhook-timestamp": "1790000000"},
        {"x-webhook-signature": "sha256=deadbeef"},
        {"x-webhook-signature": "sha256=deadbeef", "x-webhook-timestamp": "not-a-number"},
        {"x-webhook-signature": "", "x-webhook-timestamp": "1790000000"},
        {"x-webhook-signature": "garbage", "x-webhook-timestamp": "1790000000"},
        {"x-webhook-signature": "sha256=zzzz", "x-webhook-timestamp": "1790000000"},
    ],
    ids=[
        "no-headers",
        "timestamp-only",
        "signature-only",
        "non-numeric-timestamp",
        "empty-signature",
        "no-algorithm-prefix",
        "non-hex-digest",
    ],
)
def test_malformed_signature_headers_are_rejected_not_crashed(launcher, fleet, headers):
    body = make_event_body()

    response = launcher.handle(body, headers)

    assert response.status == 401
    assert fleet.launch_count == 0


def test_header_casing_does_not_matter(launcher, fleet):
    """API Gateway and a local test harness disagree about header case.

    A launcher that only reads lowercase keys rejects every real delivery.
    """
    body, headers = signed_delivery()
    upper = {k.upper(): v for k, v in headers.items()}

    assert launcher.handle(body, upper).outcome is Outcome.LAUNCHED
    assert fleet.launch_count == 1


def test_a_stale_but_validly_signed_delivery_is_refused(launcher, fleet):
    """Correct signature, six minutes old, tolerance five."""
    body, headers = signed_delivery(timestamp=int(launcher.now()) - 360)

    response = launcher.handle(body, headers)

    assert response.outcome is Outcome.STALE
    assert response.status == 401
    assert fleet.launch_count == 0


def test_a_delivery_inside_the_tolerance_is_accepted(launcher, fleet):
    body, headers = signed_delivery(timestamp=int(launcher.now()) - 60)

    assert launcher.handle(body, headers).outcome is Outcome.LAUNCHED
    assert fleet.launch_count == 1


def test_timestamp_cannot_be_refreshed_without_resigning(launcher, fleet):
    """The signature covers ``{timestamp}.{body}``, so this is detected.

    Had it covered the body alone, editing the header would turn any captured
    delivery into a live one.
    """
    body, headers = signed_delivery(timestamp=int(launcher.now()) - 3600)
    headers["x-webhook-timestamp"] = str(int(launcher.now()))

    assert launcher.handle(body, headers).outcome is Outcome.BAD_SIGNATURE
    assert fleet.launch_count == 0


def test_verification_is_over_raw_bytes_not_a_reserialised_dict(launcher, fleet):
    """Same JSON object, different octets: key order and spacing.

    The signature belongs to the bytes on the wire. A launcher that parses
    then re-dumps before hashing would accept this, and would reject real
    deliveries whose sender formats JSON differently from Python.
    """
    body, headers = signed_delivery()
    reordered = json.dumps(json.loads(body), indent=2).encode()
    assert json.loads(reordered) == json.loads(body)
    assert reordered != body

    assert launcher.handle(reordered, headers).outcome is Outcome.BAD_SIGNATURE
    assert fleet.launch_count == 0


# ==========================================================================
# State 4 of 4 — missing secret
# ==========================================================================


def test_missing_parameter_gives_a_clear_error_not_a_crash(idempotency, fleet, config):
    launcher = Launcher(
        parameter_store=FakeParameterStore({}),  # parameter was never created
        idempotency=idempotency,
        fleet=fleet,
        config=config,
    )
    body, headers = signed_delivery()

    response = launcher.handle(body, headers)

    assert response.outcome is Outcome.SECRET_UNAVAILABLE
    assert config.signing_secret_parameter in response.detail
    assert "not_found" in response.detail
    assert fleet.launch_count == 0


def test_denied_parameter_read_is_the_same_clear_error(store, idempotency, fleet, config):
    """IAM denial, not absence. Same state, different reason string."""
    store.deny(config.signing_secret_parameter)
    launcher = Launcher(
        parameter_store=store, idempotency=idempotency, fleet=fleet, config=config
    )
    body, headers = signed_delivery()

    response = launcher.handle(body, headers)

    assert response.outcome is Outcome.SECRET_UNAVAILABLE
    assert "access_denied" in response.detail
    assert fleet.launch_count == 0


def test_missing_secret_never_fails_open(idempotency, fleet, config):
    """The state that matters most: no secret must not mean no checking.

    A launcher whose secret lookup returns None and whose comparison then
    short-circuits would launch here.
    """
    launcher = Launcher(
        parameter_store=FakeParameterStore({}),
        idempotency=idempotency,
        fleet=fleet,
        config=config,
    )

    for body, headers in (
        signed_delivery(),
        (make_event_body(), {}),
        (make_event_body(), sign(make_event_body(), "any-secret-at-all")),
    ):
        assert launcher.handle(body, headers).outcome is Outcome.SECRET_UNAVAILABLE

    assert fleet.launch_count == 0
    assert idempotency.size == 0


def test_missing_secret_is_500_and_not_401(idempotency, fleet, config):
    """Distinct from a forged event, on purpose.

    401 tells the sender to stop; a sender that stops retrying because of
    our missing configuration drops real sessions on the floor. 500 is
    honest and retryable.
    """
    launcher = Launcher(
        parameter_store=FakeParameterStore({}),
        idempotency=idempotency,
        fleet=fleet,
        config=config,
    )
    body, headers = signed_delivery()

    response = launcher.handle(body, headers)

    assert response.status == 500
    assert response.status != 401


def test_recovering_the_parameter_recovers_the_launcher(idempotency, fleet, config):
    """The failure is transient in the way the 500 promises it is."""
    store = FakeParameterStore({})
    launcher = Launcher(
        parameter_store=store, idempotency=idempotency, fleet=fleet, config=config
    )
    body, headers = signed_delivery()

    assert launcher.handle(body, headers).outcome is Outcome.SECRET_UNAVAILABLE

    store.put_parameter(config.signing_secret_parameter, DEFAULT_SIGNING_SECRET)

    assert launcher.handle(body, headers).outcome is Outcome.LAUNCHED
    assert fleet.launch_count == 1


# ==========================================================================
# Ordering — verification before anything billable
# ==========================================================================


def test_no_secret_read_reaches_the_workers_parameter(launcher, store, config):
    """Decision 3, but only the half that is local.

    The launcher reads exactly one parameter: its own. It never calls
    get_parameter on the worker's environment key.

    This asserts the launcher's *code* does not reach for it. It says nothing
    about whether IAM would stop it if it did. See the README.
    """
    body, headers = signed_delivery()

    launcher.handle(body, headers)

    assert store.reads == [config.signing_secret_parameter]
    assert config.environment_key_parameter not in store.reads


def test_dispatch_payload_carries_a_reference_not_a_value(launcher, fleet, config):
    """The worker is told where its credential is, not what it is."""
    body, headers = signed_delivery()

    launcher.handle(body, headers)

    payload = fleet.last_payload
    assert payload["environment_key_parameter"] == config.environment_key_parameter
    serialised = json.dumps(payload)
    assert DEFAULT_SIGNING_SECRET not in serialised
    assert "whsec" not in serialised


@pytest.mark.parametrize(
    "mutate,expected",
    [
        (lambda b, h: (b.replace(b"session.ready", b"nope.nope"), h), Outcome.BAD_SIGNATURE),
        (lambda b, h: (b, {}), Outcome.BAD_SIGNATURE),
    ],
    ids=["tampered", "unsigned"],
)
def test_rejected_deliveries_touch_neither_the_table_nor_the_fleet(
    launcher, idempotency, fleet, mutate, expected
):
    body, headers = signed_delivery()
    body, headers = mutate(body, headers)

    assert launcher.handle(body, headers).outcome is expected
    assert idempotency.claim_attempts == 0
    assert fleet.launch_count == 0


def test_authentic_but_unusable_body_is_400_not_401(launcher, fleet):
    """Signed by the real sender, missing a field we need.

    Counting this as a forged event would send an operator hunting for an
    attacker instead of a schema change.
    """
    body = json.dumps({"event_id": "evt_x"}).encode()  # no session_id
    headers = sign(body, DEFAULT_SIGNING_SECRET)

    response = launcher.handle(body, headers)

    assert response.outcome is Outcome.MALFORMED
    assert response.status == 400
    assert fleet.launch_count == 0


def test_non_json_body_with_a_valid_signature_does_not_crash(launcher, fleet):
    body = b"<html>not json</html>"
    headers = sign(body, DEFAULT_SIGNING_SECRET)

    assert launcher.handle(body, headers).outcome is Outcome.MALFORMED
    assert fleet.launch_count == 0


# ==========================================================================
# The four states, side by side
# ==========================================================================


def test_the_four_states_are_four_distinct_outcomes(store, config):
    """One table, so a regression that collapses two states is visible.

    Each row gets a fresh fleet, and the launch column is read off the
    counter.
    """
    rows = []

    for label in ("valid+new", "valid+duplicate", "bad-signature", "missing-secret"):
        fleet = SandboxFleet()
        idempotency = IdempotencyStore()
        params = (
            FakeParameterStore({})
            if label == "missing-secret"
            else FakeParameterStore({config.signing_secret_parameter: DEFAULT_SIGNING_SECRET})
        )
        launcher = Launcher(
            parameter_store=params, idempotency=idempotency, fleet=fleet, config=config
        )

        body, headers = signed_delivery()
        if label == "bad-signature":
            body = body.replace(b"session.ready", b"session.forged")
        if label == "valid+duplicate":
            launcher.handle(body, headers)

        response = launcher.handle(body, headers)
        rows.append((label, response.outcome, response.status, fleet.launch_count))

    assert rows == [
        ("valid+new", Outcome.LAUNCHED, 202, 1),
        ("valid+duplicate", Outcome.DUPLICATE, 200, 1),
        ("bad-signature", Outcome.BAD_SIGNATURE, 401, 0),
        ("missing-secret", Outcome.SECRET_UNAVAILABLE, 500, 0),
    ]

    outcomes = [r[1] for r in rows]
    assert len(set(outcomes)) == 4
