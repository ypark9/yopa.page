# Deployment recovery runbook

This runbook covers the V1 production recovery path. It assumes that the
static draw editor is the desired application and that the V2 API resources
are intentionally retired.

## Current recovery model

The recovery has three separate operations:

1. Reconcile the website infrastructure while keeping the currently served
   CloudFront path unchanged.
2. Verify the standby static content and the reconciled distribution.
3. Promote the standby path with a separately reviewed `live_path` plan.

The `promote` target must execute OpenTofu apply. The safety boundary is the
reviewed same-commit plan and explicit production approval, not removing the
apply from promotion.

The CloudFront Function `yopa-draw-index-rewrite` remains part of the V1
website infrastructure because it routes `/draw` and `/draw/` to
`/draw/index.html`. The retired API origin and `/draw-api/*` behavior are not
part of the V1 configuration.

## Read-only audit

Use the local AWS profile and pinned OpenTofu version:

```sh
AWS_PROFILE=aws-dimly TOFU=tofu ./scripts/audit-infrastructure.sh
```

The command captures the caller identity, KMS alias, service inventories,
remote state, refresh-only plans, and normal plans for `global` and `prod`.
Audit output can contain account metadata and must not be committed.

Do not retry a failed apply until the succeeded resources and current remote
state have been recorded. Stop on an unexplained destroy, replacement, invalid
`live_path`, or a state/output mismatch that has not been explained.

## Recovery gates

1. Run the static site checks and `tofu fmt -check -recursive terraform`.
2. Run locked `init` and `validate` for `global` and `prod`.
3. Confirm the global plan is `No changes`.
4. Review the production reconciliation plan. It may remove the stale API
   origin and behavior and restore website-only state, but it must retain the
   CloudFront Function and must not replace the distribution, bucket, OAI, or
   certificate.
5. Apply the reviewed reconciliation plan with the current live path.
6. Wait for CloudFront to reach `Deployed` and verify the website and state.
7. Create and review a separate promotion plan. For the V1 promotion it must
   change only the S3 origin path from `green` to `blue`.
8. Apply the approved promotion plan, invalidate the cache, and run smoke
   checks for `/`, `/draw`, `/draw/`, and `/draw/index.html`.
9. Confirm final global and production plans are `No changes`.

## Destructive changes

The V2 API, Lambda, Cognito, DynamoDB, and private scene storage resources are
intentionally absent from the V1 configuration. Their destruction is expected
only as part of the explicitly approved V2 retirement. It must not be hidden
inside an unrelated content promotion or performed from an ad-hoc local
apply.
