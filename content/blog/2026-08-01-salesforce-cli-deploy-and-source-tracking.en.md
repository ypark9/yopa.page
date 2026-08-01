---
title: "Salesforce CLI Deployment and Source Tracking"
date: 2026-08-01
author: Yoonsoo Park
description: "Choose current sf CLI deployment and source-tracking workflows without relying on retired push commands."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Metadata API
  - CI/CD
---

Verified on 2026-08-01. The old `sfdx force:source:push` comparison is obsolete because the `sfdx` CLI has been unsupported since April 2023.

Use one supported deployment surface:

```bash
sf project deploy preview --source-dir force-app --target-org dev
sf project deploy start --source-dir force-app --target-org dev --dry-run
sf project deploy start --source-dir force-app --target-org dev
```

Source tracking tells the CLI which local and org changes differ; it is not a substitute for Git. Scratch orgs commonly support tracking, while production delivery should be explicit and repeatable. In CI, pin the CLI version, pass `--target-org`, choose an appropriate test level, validate first, and keep authentication outside the repository.

Migration is mechanical: replace `force:source:push` and `force:source:deploy` scripts with `sf project deploy start`, then verify the selected metadata using preview or dry-run. Direct source-format deployment is the default; convert to Metadata API format only for a consumer that requires it.

References: [Salesforce CLI migration](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html), [CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html).

## Current mental model

Git answers what the team approved. Source tracking answers what differs between one local workspace and one tracking-enabled org. Deployment moves an explicitly selected set of metadata. Keeping those responsibilities separate prevents “push whatever changed” from becoming a release strategy.

## A safe release path

Start by confirming the identity and inspecting conflicts:

```bash
sf org display --target-org dev
sf project deploy preview --source-dir force-app --target-org dev
sf project deploy start --source-dir force-app --target-org dev \
  --dry-run --test-level RunLocalTests --json >deploy-validation.json
```

Review the component set and test result before running the same selection without `--dry-run`. For a curated release, use `--manifest manifest/package.xml`; for a small fix, use repeated `--metadata` or an exact source directory. Keep destructive changes in their supported manifest and require a separate approval. Never infer a production target from a developer's default config.

## Alternatives and tradeoffs

Source tracking is convenient in scratch orgs but can be confusing after manual changes or team sharing. An explicit manifest is auditable but must be maintained. Directory deployment is simple but may select more components than intended. DevOps Center or another delivery platform can add governance, yet the underlying scope, tests, identity, and rollback decisions remain.

## Migration checklist and verification

1. Inventory every legacy `push`, `pull`, `source:deploy`, and `source:retrieve` command.
2. Map each to deploy/retrieve behavior; don't translate names blindly.
3. Make target org and test level explicit in CI.
4. Validate in a representative nonproduction org and retain the report.
5. Compare deployed component IDs with the reviewed manifest or directory.
6. Test failure, conflict, and rollback procedures before production.

After deployment, query the deployment result, run relevant smoke tests, and confirm that Git is still the source of truth rather than retrieving unreviewed org changes back over it.
