#!/usr/bin/env python3
"""Replay the fixture and print the state table.

Standard library only, so this runs on a bare python3 with nothing installed.
It is the same four states the test suite asserts on, printed rather than
asserted, for when you want to look at them instead of trusting a green dot.

    python3 run.py

Exit code is 0 if every state produced its expected launch count, 1 otherwise,
so this is usable as a smoke check on its own.
"""

from __future__ import annotations

import sys

from fixtures import (
    DEFAULT_SIGNING_SECRET,
    FakeParameterStore,
    IdempotencyStore,
    InMemoryIdempotencyStore,
    SandboxFleet,
    signed_delivery,
)
from launcher import Launcher, LauncherConfig, Outcome

CONFIG = LauncherConfig()


def _rig(secret_present: bool = True, idempotency=None):
    params = FakeParameterStore(
        {CONFIG.signing_secret_parameter: DEFAULT_SIGNING_SECRET} if secret_present else {}
    )
    fleet = SandboxFleet()
    store = idempotency if idempotency is not None else IdempotencyStore()
    launcher = Launcher(
        parameter_store=params, idempotency=store, fleet=fleet, config=CONFIG
    )
    return launcher, fleet, params


# Each scenario returns (final response, fleet) so the row can report both
# what the launcher said and what the fleet actually did.


def valid_new():
    launcher, fleet, _ = _rig()
    body, headers = signed_delivery()
    return launcher.handle(body, headers), fleet


def valid_duplicate():
    launcher, fleet, _ = _rig()
    body, headers = signed_delivery()
    launcher.handle(body, headers)
    return launcher.handle(body, headers), fleet  # byte-identical replay


def bad_signature():
    launcher, fleet, _ = _rig()
    body, headers = signed_delivery(session_id="sess_mine")
    tampered = body.replace(b"sess_mine", b"sess_other")
    return launcher.handle(tampered, headers), fleet


def missing_secret():
    launcher, fleet, _ = _rig(secret_present=False)
    body, headers = signed_delivery()
    return launcher.handle(body, headers), fleet


def stale_delivery():
    launcher, fleet, _ = _rig()
    body, headers = signed_delivery(timestamp=int(launcher.now()) - 3600)
    return launcher.handle(body, headers), fleet


def replay_across_cold_start():
    """Same durable store, a second Launcher object."""
    shared = IdempotencyStore()
    first, fleet, params = _rig(idempotency=shared)
    body, headers = signed_delivery()
    first.handle(body, headers)
    second = Launcher(
        parameter_store=params, idempotency=shared, fleet=fleet, config=CONFIG
    )
    return second.handle(body, headers), fleet


def replay_with_volatile_store():
    """The negative control: dedup in memory, then the process restarts."""
    volatile = InMemoryIdempotencyStore()
    first, fleet, params = _rig(idempotency=volatile)
    body, headers = signed_delivery()
    first.handle(body, headers)
    volatile.simulate_cold_start()
    second = Launcher(
        parameter_store=params, idempotency=volatile, fleet=fleet, config=CONFIG
    )
    return second.handle(body, headers), fleet


#: label, scenario, expected outcome, expected total launches
SCENARIOS = [
    ("valid + new", valid_new, Outcome.LAUNCHED, 1),
    ("valid + duplicate", valid_duplicate, Outcome.DUPLICATE, 1),
    ("bad signature", bad_signature, Outcome.BAD_SIGNATURE, 0),
    ("missing secret", missing_secret, Outcome.SECRET_UNAVAILABLE, 0),
    ("stale (valid sig)", stale_delivery, Outcome.STALE, 0),
    ("replay, cold start", replay_across_cold_start, Outcome.DUPLICATE, 1),
    ("replay, in-memory dedup", replay_with_volatile_store, Outcome.LAUNCHED, 2),
]


def main() -> int:
    header = f"{'state':<26} {'outcome':<20} {'status':>6} {'launches':>9}   ok"
    print(header)
    print("-" * len(header))

    failures = 0
    for label, scenario, expected_outcome, expected_launches in SCENARIOS:
        response, fleet = scenario()
        passed = (
            response.outcome is expected_outcome
            and fleet.launch_count == expected_launches
        )
        failures += not passed
        print(
            f"{label:<26} {response.outcome.value:<20} {response.status:>6} "
            f"{fleet.launch_count:>9}   {'ok' if passed else 'FAIL'}"
        )

    print()
    print(
        "The last row is a deliberate failure: it is what deduplicating in\n"
        "memory does to a retry that arrives after a cold start."
    )
    if failures:
        print(f"\n{failures} scenario(s) did not match expectations.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
