# How to Build and Deploy `yopa.page`

`yopa.page` is a Hugo site with a static V1 draw editor. The production
website uses blue/green S3 prefixes behind CloudFront. OpenTofu manages the
website infrastructure; content upload and live-path promotion are separate
operations.

## Prerequisites

- Hugo 0.155.1
- OpenTofu 1.12.3
- AWS CLI
- Make
- `exiftool`, `jpegoptim`, `optipng`, `mogrify`, and `cwebp`
- AWS credentials configured for the intended read-only or deployment role

## Local development

```sh
make serve
```

## Read-only checks

Run these before any production operation:

```sh
tofu fmt -check -recursive terraform
for env in global prod; do
  tofu -chdir="terraform/env/$env" init -backend=false -lockfile=readonly
  tofu -chdir="terraform/env/$env" validate
done
AWS_PROFILE=aws-dimly TOFU=tofu ./scripts/audit-infrastructure.sh
```

Do not continue if the audit shows an unexplained destroy, replacement, invalid
`live_path`, or a mismatch between Terraform state and the actual CloudFront
origin.

## Deployment model

`make deploy` builds the Hugo output and uploads it to the inactive S3 prefix.
It does not switch live traffic.

```sh
make ENV=prod deploy
```

`make promote` applies the reviewed production OpenTofu plan with the next
`live_path`. This apply is intentional: it changes the CloudFront origin path
and is the production promotion operation.

```sh
make ENV=prod promote
```

`make release` runs promotion followed by CloudFront invalidation. Use it only
from the approved deployment workflow after the same-commit plan has been
reviewed and the production approval gate has passed.

```sh
make ENV=prod release
```

For the V1 recovery, infrastructure reconciliation and the final `green` to
`blue` live-path switch are separate approvals. The V2 API, Lambda, Cognito,
DynamoDB, and private scene storage resources are intentionally absent from
the V1 configuration.
