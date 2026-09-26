#!/bin/bash
# Approved 2026-09-26: create ONE table. Stops on any failure, no workaround.
set -u
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
unset AWS_CREDENTIAL_EXPIRATION
export AWS_PROFILE="${AWS_PROFILE:?set AWS_PROFILE to your test account profile}"
cd "$(dirname "$0")"
echo "## sts"; aws sts get-caller-identity --query '[Account,Arn]' --output text || exit 1
ACC=$(aws sts get-caller-identity --query Account --output text)
[ -z "${EXPECTED_ACCOUNT:-}" ] || [ "$ACC" = "$EXPECTED_ACCOUNT" ] || { echo "WRONG ACCOUNT $ACC, stop"; exit 2; }
echo "## create-table"
aws dynamodb create-table --region us-east-1 --table-name sandbox-race-test \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Lifecycle,Value=disposable Key=Purpose,Value=yopa-blog-pr97 \
  --query 'TableDescription.[TableName,TableStatus,TableArn]' --output text || { echo "CREATE FAILED, stop"; exit 3; }
aws dynamodb wait table-exists --region us-east-1 --table-name sandbox-race-test || { echo "WAIT FAILED, stop"; exit 4; }
aws dynamodb describe-table --region us-east-1 --table-name sandbox-race-test --query 'Table.[TableStatus,BillingModeSummary.BillingMode,ItemCount]' --output text
echo "## venv"
/opt/homebrew/bin/python3 -m venv .venv && .venv/bin/pip install -q boto3 aws-lambda-powertools && .venv/bin/python -c 'import aws_lambda_powertools as p;print("powertools",p.__version__)'
echo "## done"
