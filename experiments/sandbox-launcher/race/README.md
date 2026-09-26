# Does exactly one launch win when the same webhook arrives 50 times at once?

The gap the local fixture in `../` names in its own "does not prove" list, point 4:
the fixture's `claim` is a check-then-set on a dict in one thread, and the property that
matters, exactly one winner among callers at the same moment, belongs to DynamoDB.

Run 2026-09-26 in a dev AWS account, `us-east-1`, one on-demand DynamoDB
table `sandbox-race-test` (key `id`, string).

## What it does

Three ways of claiming an event ID. For each: 20 rounds, and in each round 50 threads use the
**same** new event ID, released together by a barrier. "Launch" is a local counter. Nothing is
started. The only AWS calls are item reads and writes on that one table.

| Arm | How it claims |
| --- | --- |
| `check_then_set` | `GetItem`, then `PutItem` with no condition. A 10 ms sleep sits between them, the gap a real launcher has. **Negative control**: it should let more than one win |
| `conditional` | `PutItem` with `ConditionExpression="attribute_not_exists(id)"` |
| `powertools` | `@idempotent_function` from AWS Lambda Powertools 3.35.0 with `DynamoDBPersistenceLayer`, the utility the reference solution uses. The function sleeps 200 ms. After each burst, one more call arrives late |

## Result

| Arm | Launches per burst of 50 | Rounds with exactly 1 launch |
| --- | --- | --- |
| `check_then_set` | 9 to 21 (210 total) | 0 / 20 |
| `conditional` | 1 | 20 / 20 |
| `powertools` | 1 | 20 / 20 |

What the other 49 callers got:

- `conditional`: 980 `ConditionalCheckFailedException`, which the arm reads as "duplicate".
- `powertools`: 946 `IdempotencyAlreadyInProgressError` (they arrived while the first was
  still running), 54 got the stored result (they arrived after it finished), and every late
  retry (20/20) got the stored result with no new launch.

The negative control is why the other two rows mean something. The same harness, the same
table and the same 50 threads produce 9 to 21 launches when the claim is not atomic.

## The design point this surfaces

Under Powertools, most concurrent duplicates do not get "duplicate". They get an **exception**.
If the launcher lets it escape, the webhook sender sees a 5xx for a delivery that is actually
being handled. It will retry (fine, the retry gets the stored result), but your error rate and
alarms count every one of those as a failure. Catch `IdempotencyAlreadyInProgressError` and
answer with a status that means "being handled, try later" (409 or 429, whatever your sender
retries on) instead of 500.

## What this does not prove

- One region, one table, 50 threads from one laptop. Not a load test.
- Not the reference solution's handler code, only the same utility and the same DynamoDB primitive.
- The 10 ms sleep in the negative control widens the race on purpose. Without it the race is
  smaller, not gone.
- The `register_lambda_context` warning from Powertools is expected outside Lambda. It means the
  in-progress record uses the default expiry instead of the function's remaining time.

## Files

| File | |
| --- | --- |
| `race.py` | the three arms |
| `setup.sh` | creates the table (the only AWS change) and the venv |
| `go.sh` | runs `race.py` after checking the account |
| `results.jsonl` | 60 rounds, raw |
| `summary.txt` | the table above, computed from `results.jsonl` |

Cost: about 4,000 item reads and writes, under $0.01. The table still exists after the run.
Deleting it is a separate, approved step.
