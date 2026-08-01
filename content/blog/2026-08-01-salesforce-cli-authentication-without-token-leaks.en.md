---
title: "Salesforce CLI Authentication Without Token Leaks"
date: 2026-08-01
author: Yoonsoo Park
description: "Authenticate Salesforce CLI safely and avoid leaking bearer tokens into logs or shell pipelines."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - OAuth
  - Security
---

Verified on 2026-08-01. Scraping an access token from verbose org output is unsafe: a bearer token grants access to whoever obtains it.

For interactive work, authenticate and use the alias directly:

```bash
sf org login web --alias dev --instance-url https://login.salesforce.com
sf org display --target-org dev
```

Most CLI commands use the stored authorization without exposing a token. Only for a controlled diagnostic that truly needs a token, use `sf org auth show-access-token --target-org dev`, keep it out of terminal recording and CI logs, and revoke or rotate it after exposure. Automation should use an approved noninteractive OAuth flow and a secret manager; do not commit auth URLs, private keys, or tokens.

Migration means deleting token-scraping pipelines, passing `--target-org` instead, checking log history for leakage, and revoking affected sessions. Web login is convenient for people; JWT or workload-oriented federation is more repeatable for CI but requires key and policy management.

References: [org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html), [CLI migration](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html).

## Threat model and current practice

An access token is a short-lived credential, not harmless diagnostic text. Shell history, CI annotations, screen recordings, support bundles, and copied JSON can turn a momentary display into durable exposure. The safest workflow is to let the CLI use its authorization store and pass an alias instead of moving tokens between processes.

## Safe step-by-step workflow

```bash
sf org login web --alias dev --instance-url https://login.salesforce.com
sf org display --target-org dev
sf data query --query "SELECT Id FROM Organization" --target-org dev --json
```

The ordinary command proves the session works without revealing the bearer token. Use a sandbox or developer org for troubleshooting. Redact org usernames and IDs when they are sensitive to your organization. If a raw token is unavoidable for a controlled interoperability test, disable command tracing, avoid pipes and temporary files, limit scope and lifetime where the authorization method allows it, and revoke the session afterward.

## Automation alternatives

Interactive web login is easiest for a person but unsuitable for headless CI. JWT bearer flow is repeatable but requires protecting and rotating a private key. An approved workload identity or secret-manager-backed OAuth setup can reduce long-lived secrets, though availability depends on your Salesforce and CI architecture. SFDX auth URLs are credentials too; never commit them.

## Incident and migration checklist

1. Remove token extraction from scripts and pass `--target-org` to downstream CLI commands.
2. Search Git history, CI logs, tickets, and artifacts for exposed values without echoing them again.
3. Revoke affected sessions and rotate related credentials.
4. Review the connected or external client application's scopes and policies.
5. Add log masking and a secret scanner, then test with synthetic values.
6. Verify the replacement flow using a least-privileged nonproduction identity.

Deleting a visible token from a document does not revoke it. Revocation is the containment step; redaction prevents further disclosure.
