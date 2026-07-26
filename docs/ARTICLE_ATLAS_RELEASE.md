# Article Atlas release checklist

Article Atlas ships as a fully usable static experience. Live presence is an
optional production capability and must remain disabled until the static
release and the AWS cost/privacy gates below pass.

## 1. Static release

Keep this setting in `config.yaml`:

```yaml
articleAtlasPresenceEnabled: false
```

Run the deterministic checks:

```sh
python3 scripts/validate_frontmatter.py
python3 -m unittest discover -s tests
hugo --gc --minify
tofu fmt -check -recursive terraform
for env in global prod; do
  tofu -chdir="terraform/env/$env" init -backend=false -lockfile=readonly
  tofu -chdir="terraform/env/$env" validate
done
```

Review plans with the current production `live_path`. Stop on any unexplained
destroy, replacement, WebSocket limit change, or CloudFront behavior change.
After deployment, verify `/`, `/explore/`, a valid article deep link, an invalid
`?article=` fallback, an article read, and the return-to-Atlas link. Browser
network tools must show no `/presence` connection while the switch is off.

Manual performance gates are at least 50 fps during ten seconds of continuous
desktop movement and at least 30 fps on a representative mobile device. Repeat
the exploration flow with reduced motion, keyboard navigation, and touch.

## 2. Presence activation

Use read-only AWS commands or the Billing console to confirm the existing
account-level Budgets and their notification recipients. Do not create another
Budget. Treat notification addresses as private operational data and do not
copy them into commits or CI logs.

Before enabling the client:

1. Confirm the API Gateway stage rate is at most 12 messages per second with a
   burst of at most 24.
2. Confirm Lambda reserved concurrency is at most five and the room cap is 20.
3. Confirm move and snapshot intervals are five seconds and heartbeat is 30
   seconds.
4. Connect two production browsers directly during the smoke window and verify
   country cursors, movement convergence, pause/resume, and stale removal.
5. Check CloudWatch logs for aggregate errors only. No IP, header dump, complete
   event, or message body may appear.

Enable `articleAtlasPresenceEnabled` in a separate settings-only commit and
deploy it through the normal blue/green workflow. This commit is the rollback
unit; reverting it must leave the static Atlas available.

## 3. Observation and rollback

Review API Gateway messages, Lambda invocations/errors/throttles, DynamoDB
requests, and Cost Explorer after one hour, 24 hours, and seven days.

Disable presence immediately if any of these occurs:

- Lambda error rate exceeds 1% during the observation window.
- reconnects repeat continuously for healthy browsers;
- route traffic exceeds the documented throttle or callback behavior;
- DynamoDB writes occur on snapshot reads;
- cost growth is unexplained or exceeds the owner's expected test traffic;
- logs expose data outside the documented privacy boundary.

Rollback by returning `articleAtlasPresenceEnabled` to `false` and deploying
that settings-only change. Do not remove the Atlas or perform an infrastructure
destroy as part of the kill-switch response.
