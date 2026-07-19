#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly OUT="${AUDIT_DIR:-$ROOT/audit/$(date -u +%Y%m%dT%H%M%SZ)}"
readonly TOFU_BIN="${TOFU:-tofu}"
export AWS_PROFILE="${AWS_PROFILE:-aws-dimly}"

mkdir -p "$OUT"
aws sts get-caller-identity > "$OUT/caller-identity.json"
aws kms describe-key --key-id alias/aws/dynamodb > "$OUT/kms-dynamodb-alias.json"

aws dynamodb list-tables > "$OUT/dynamodb-tables.json"
aws s3api list-buckets > "$OUT/s3-buckets.json"
aws lambda list-functions > "$OUT/lambda-functions.json"
aws apigatewayv2 get-apis > "$OUT/apigatewayv2-apis.json"
aws cognito-idp list-user-pools --max-results 60 > "$OUT/cognito-user-pools.json"
aws cloudfront list-distributions > "$OUT/cloudfront-distributions.json"

for env in global prod; do
  dir="$ROOT/terraform/env/$env"
  "$TOFU_BIN" -chdir="$dir" init -lockfile=readonly
  "$TOFU_BIN" -chdir="$dir" state pull > "$OUT/$env.state.json"
  if [[ "$env" == global ]]; then
    "$TOFU_BIN" -chdir="$dir" plan -refresh-only -no-color > "$OUT/$env.refresh-only.txt"
    "$TOFU_BIN" -chdir="$dir" plan -no-color > "$OUT/$env.plan.txt"
  else
    live_path="$($TOFU_BIN -chdir="$dir" output -raw live_path 2>/dev/null)"
    [[ "$live_path" == blue || "$live_path" == green ]] || { echo "Invalid $env live_path: $live_path" >&2; exit 1; }
    "$TOFU_BIN" -chdir="$dir" plan -refresh-only -no-color -var="live_path=$live_path" > "$OUT/$env.refresh-only.txt"
    "$TOFU_BIN" -chdir="$dir" plan -no-color -var="live_path=$live_path" > "$OUT/$env.plan.txt"
  fi
done

echo "Read-only audit written to $OUT"
echo "Do not apply if any plan contains an unexpected destroy or replacement."
