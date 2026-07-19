#!/usr/bin/env bash
# Fail if any given OpenTofu plan text describes a destructive action
# (resource destroy or replace). Used as the auto-deploy safety gate:
# non-destructive plans apply automatically, destructive plans halt CI and
# require a manual, separately-approved apply.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: check-plan-safety.sh <plan.txt> [<plan.txt> ...]" >&2
  exit 2
fi

destructive_pattern='will be destroyed|must be replaced|Plan: [0-9]+ to add, [0-9]+ to change, [1-9][0-9]* to destroy'
found=0

for plan_file in "$@"; do
  if [ ! -f "$plan_file" ]; then
    echo "::error::Plan file not found: $plan_file" >&2
    exit 2
  fi
  if grep -Eq "$destructive_pattern" "$plan_file"; then
    echo "::error::Destructive action detected in $plan_file. Halting auto-deploy; apply requires a manual, separately-approved run."
    grep -nE "$destructive_pattern" "$plan_file" || true
    found=1
  else
    echo "No destructive actions in $plan_file."
  fi
done

exit "$found"
