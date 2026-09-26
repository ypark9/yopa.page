#!/bin/bash
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
unset AWS_CREDENTIAL_EXPIRATION
export AWS_PROFILE="${AWS_PROFILE:?set AWS_PROFILE to your test account profile}"
cd "$(dirname "$0")"
[ -n "${EXPECTED_ACCOUNT:-}" ] && [ "$(aws sts get-caller-identity --query Account --output text)" != "$EXPECTED_ACCOUNT" ] && { echo "WRONG ACCOUNT, stop"; exit 2; }
.venv/bin/python -u race.py --table sandbox-race-test --rounds "$1" --threads "$2" --out "$3" || echo "RUN FAILED, stop"
echo "## done"
