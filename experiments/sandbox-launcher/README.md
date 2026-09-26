# Does the launcher's gate actually hold?

The first of the two things named in
[Who Is Allowed to Start Your Agent's Sandbox?](../../content/blog/2026-09-26-who-can-start-your-agent-sandbox.en.md)
under "What I have not run":

> I would need the launcher's verification and deduplication logic running
> against a local fixture that replays a signed event and a duplicate of it
> [...] The first is a two-hour job with no AWS dependency.

This is that fixture. No AWS account, no deploy, no network, no boto3, no
credentials. Standard library and pytest.

The article's Decisions 2 and 4 make two operational claims: that an invalid
delivery is refused *before* anything billable starts, and that a retried
delivery does not start a second sandbox. Both are the kind of claim that
reads as obviously true and is wrong in production for reasons that only
appear when you write the states down.

## The four states

`run.py` prints this; `test_launcher.py` asserts it.

| State | Outcome | Status | Sandboxes started |
| --- | --- | --- | --- |
| valid + new | `launched` | 202 | **1** |
| valid + duplicate | `duplicate` | 200 | **1** |
| bad signature | `bad_signature` | 401 | **0** |
| missing secret | `secret_unavailable` | 500 | **0** |

The launch column is read off `SandboxFleet.launch_count`. No assertion in
this experiment reads a log line, and none trusts the launcher's own report
of what it did — the launcher can claim whatever it likes about having
refused; the counter is what the bill would have been.

### Why the fourth state is a separate row and a separate status

A missing secret is not a failed signature check. It is the *absence* of a
check, and the two most common ways to write it are both wrong:

- Crash, and the sender sees a 502 with no signal about what broke.
- Return 401, and the sender — behaving correctly — concludes its deliveries
  are being rejected as forged and backs off. Real sessions then vanish
  because of our configuration, and the logs say "unauthorized".

So it is a 500 with the parameter name and the reason in the detail string,
and `test_missing_secret_never_fails_open` checks the third failure mode: a
lookup that returns `None` and a comparison that then short-circuits into
accepting everything.

## What is actually being tested

Ordering, not arithmetic. HMAC-SHA256 is not in question. These are:

**Verification precedes every side effect, not just the billable one.**
`test_nothing_is_written_to_the_idempotency_table_on_a_bad_signature` asserts
`claim_attempts == 0`. An unauthenticated caller who can write rows into the
idempotency table can pre-claim the event IDs of real sessions and suppress
them, without ever launching anything.

**The signature covers the bytes on the wire.** A launcher that parses the
body and re-serialises it before hashing passes its own tests and fails
against any sender whose JSON separators differ from Python's.
`test_verification_is_over_raw_bytes_not_a_reserialised_dict` sends the same
JSON object with different octets and requires a 401.

**The timestamp is inside the signed string.** Signing the body alone lets
anyone replay a captured delivery forever by editing the timestamp header.
`test_timestamp_cannot_be_refreshed_without_resigning` covers it.

**Dedup is keyed on the event ID, and the event ID is signed.** Keying on a
body digest would collapse two real sessions into one. Leaving the event ID
outside the signature would let a captured delivery become a fresh launch on
every send.

**Dedup is a record, not a cache.** `test_dedup_survives_a_cold_start` throws
the `Launcher` away and builds a new one against the same store.
`test_in_memory_dedup_fails_the_same_cold_start` is its negative control: it
asserts the *broken* behaviour on purpose, so if the cold-start simulation
ever stops simulating anything, that test goes green with one launch and the
suite says so.

**A failed launch is not remembered as a success.** The idempotency claim is
released when the fleet errors, or the retry is answered "already handled"
and the session never starts.

## What this does **not** prove

The list matters more than the passing tests.

1. **It is not the reference solution's code.** This is the described logic,
   reimplemented from the article and the architecture it reads. It does not
   exercise `aws-samples/sample-lambda-microvm-claude-managed-agents`, and it
   does not exercise the Powertools idempotency utility. If that utility has
   a behaviour this hand-rolled `claim` does not, this fixture will not find
   it.

2. **The signature scheme is invented.** `{timestamp}.{body}`, HMAC-SHA256,
   hex, `sha256=` prefix. That shape is conventional, and it is not sourced
   from the platform's webhook documentation. Every test here would pass
   against a scheme the real sender does not use. Confirming the actual
   scheme is the first thing to do before any of this maps onto a deployment.

3. **No IAM is tested here.** (The sibling `iam-boundary/` experiment covers
   it against real AWS; this paragraph is about the local fixture only.)
   Two tests touch the credential split —
   `test_no_secret_read_reaches_the_workers_parameter` asserts the launcher
   calls `get_parameter` exactly once, on its own parameter, and
   `test_dispatch_payload_carries_a_reference_not_a_value` asserts the
   dispatch payload carries the worker parameter's *name* and no secret
   value. Both are statements about what the launcher's code does. Neither
   says anything about whether an IAM policy would stop it if the code
   changed. That is the article's second item, below.

4. **Concurrency is not tested.** `IdempotencyStore.claim` is a
   check-then-set on a dict, run sequentially in one thread. The real
   mechanism is a DynamoDB conditional write, and the property that matters —
   exactly one winner among simultaneous callers — is a property of DynamoDB,
   not of this fake. Two webhook deliveries racing is the case this fixture
   most conspicuously does not cover.

5. **Nothing above the launcher exists here.** No API Gateway, no WAF, no
   request validation, no payload size limits, no real event envelope. The
   header dict is a plain dict, not an API Gateway proxy event, so the
   mapping from one to the other is untested.

6. **The 300-second tolerance is a guess.** It is not derived from the
   sender's documented retry schedule. A tolerance shorter than the retry
   interval rejects legitimate retries.

7. **Nothing about the sandbox.** Decisions 1 and 5 of the article — idle
   policy, suspension, resource growth — need a running MicroVM and are
   entirely outside this fixture.

8. **Timing safety is asserted by reading, not by testing.** The comparison
   uses `hmac.compare_digest`, and replacing it with `==` leaves all 38 tests
   green — see the mutation results below. A behavioural suite cannot see the
   difference; only reading the line can.

### The suite was checked against deliberate regressions

A green suite against correct code says nothing about whether it would catch
a bug. Ten mutations were applied one at a time to a copy and the suite re-run:
signature check short-circuited, idempotency claimed before verification,
missing secret downgraded to 401, body canonicalised before hashing (both the
naive and the self-consistent version), timestamp left outside the signed
string, freshness check removed, dedup moved onto the `Launcher` object, a
failed launch's claim retained, the launcher reading the worker's parameter,
and the secret value placed in the dispatch payload.

All ten were caught. The eleventh — `compare_digest` replaced with `==` —
survived, which is point 8 above.

In the article's own terms: this moves the deduplication and verification
claims from documentation-derived to locally-verified *for this
implementation of the described design*. It does not make the reference
solution verified, and it does not make my stack verified.

## The second item, which is now in `iam-boundary/`

The article's other condition:

> I would need one end-to-end session to confirm that the worker's role
> really cannot read the launcher's parameter.

This was run on 2026-09-23 against real AWS. See
[`iam-boundary/`](iam-boundary/README.md) for the full result.

The article priced it as needing "an account and the platform's self-hosted
environment configured". That conflated the claim with the platform: the claim
is about IAM and SSM, and observing it needs neither MicroVMs nor the
reference solution deployed. Four parameters, two roles, eight calls, $0.

**Result: the worker role is refused the launcher's parameter by AWS**, with
all four own-reads succeeding as the positive control. The denial is a real
`AccessDeniedException` naming `ssm:GetParameter` on the exact ARN.

One finding came out of the half that was measured rather than predicted: with
the AWS-managed `alias/aws/ssm` key, **SecureString adds no second
authorization boundary.** A role holding no KMS permission at all — confirmed
by `kms:DescribeKey` being denied to it — read a SecureString back decrypted,
because the key policy delegates to SSM via `kms:ViaService`. Every cross-read
denial was attributed to SSM; KMS was never a gate.

Point 3 above still stands in one respect: nothing proves a *running* sandbox
executes under the role that was tested. That is the part that genuinely needs
the platform, and it is still not done.

## Running it

```bash
cd experiments/sandbox-launcher

# The state table, standard library only, nothing to install.
python3 run.py

# The full suite.
pytest . -q
```

`run.py` exits non-zero if any state departs from its expected launch count,
so it works as a smoke check without pytest installed. Its last row is a
deliberate `launched / 2` — the in-memory dedup control.

## Layout

| File | |
| --- | --- |
| `launcher.py` | the pipeline under test: read secret, check freshness, verify, claim, launch |
| `fixtures.py` | Parameter Store, idempotency table and sandbox fleet as local objects with counters; event construction and signing |
| `test_launcher.py` | 38 tests |
| `run.py` | prints the state table, no pytest required |

## Scope

The launcher here starts nothing. `SandboxFleet.launch` appends a dict to a
list and returns a string. There is no VM, no container, no subprocess, and
no code execution of any kind — the "sandbox" in this experiment is a counter,
which is the only property the experiment needed it to have.

The signing secret in `fixtures.py` is a literal string in the source,
`whsec_local_fixture_not_a_real_secret`, and exists so the fixture can sign
its own events. It is not a credential for anything.
