---
title: "Inspect Salesforce Orgs Without Exposing Secrets"
date: 2026-08-01
author: Yoonsoo Park
description: "Inspect org identity and scratch-org status while keeping access tokens out of output."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - Scratch Orgs
  - OAuth
---

Verified on 2026-08-01. The old article used unsupported `sfdx` syntax and printed an access-token-shaped value.

```bash
sf org display --target-org my-scratch
sf org list --json >orgs.json
```

Prefer the human-readable display when sharing output, and filter JSON to the fields you need before attaching it to a ticket. Access tokens, auth URLs, client secrets, and private keys are secrets even when emitted by a developer tool. If a token has entered Git or a public log, remove the value from the visible document and revoke the corresponding session; rewriting a file alone does not invalidate it.

Migration is a command rename plus a data-handling change: use `sf org display --target-org`, stop requesting verbose auth fields, sanitize retained logs, and verify the alias, org ID, instance URL, status, and scratch-org expiration.

Reference: [Salesforce CLI org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html).

## Decide what the reader needs

Most diagnostics need an alias, org ID, instance URL, connection status, edition, or scratch-org expiration. None requires a bearer token. Separate identity/status inspection from the exceptional act of revealing authentication material.

## Safe inspection workflow

```bash
sf org list --json >org-list.json
jq '.result.scratchOrgs[] | {alias, orgId, instanceUrl, status, expirationDate}' org-list.json
sf org display --target-org my-scratch
```

Write diagnostics to a permission-controlled temporary location and delete them when the incident ends. Before sharing, inspect the original JSON because plugin versions can add fields. Avoid `--verbose` unless the exact additional field is understood. For CI, emit a small allowlisted object rather than applying a blacklist after the fact.

If access-token use is genuinely required, call the purpose-built command only inside a controlled session. Never paste its output into chat, issues, screenshots, or build artifacts. A token already committed to Git must be revoked even after history cleanup; coordinate repository history rewriting because it affects collaborators.

## Alternatives and tradeoffs

Human-readable output is safest for an operator but harder to automate. JSON is stable enough for scripts and exit-code checks but can carry more detail than expected. Salesforce Setup offers a visual view but is slower and difficult to capture reproducibly.

## Migration and verification

Replace `sfdx force:org:display --verbose`, remove token fields from examples and fixtures, rotate any plausible real token, and add allowlist-based redaction. Verify with a scratch org and sandbox, review the produced artifact manually, run a secret scanner, and confirm that aliases and expiration are sufficient for the operational task.
