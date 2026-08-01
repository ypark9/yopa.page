---
title: How to Clean Up Inaccessible Scratch Org Authorizations
date: 2023-09-12T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Learn how to remove inaccessible or problematic scratch orgs from your local Salesforce DX configuration."
categories:
    - Salesforce
    - Development
    - Troubleshooting
tags:
  - Salesforce CLI
  - Scratch Orgs
  - OAuth
---

## Introduction

An expired or already-deleted scratch org can leave a stale local authorization. Use supported CLI commands to diagnose and remove it; don't edit Salesforce CLI's internal files by hand.

## Identifying the Problem

Start with `sf org list auth` and `sf org display --target-org <alias>`. If display fails because the remote org no longer exists, remove only the local authorization.

**Symptoms:**

1. Running `sfdx force:org:list` displays the problematic scratch org.
    ```
    force-nforce-003jsL test-ry0x7ndfdivv@example.com 00D040000003jsLEAQ DomainNotFoundError
    ```
2. Attempting to delete the org results in an error.
    ```
    ERROR running force:org:delete:  The org cannot be found
    ```

## Supported cleanup flow

```bash
sf org list auth
sf org logout --target-org stale-alias
```

If the scratch org still exists and you intend to dispose of it, use `sf org delete scratch --target-org <alias>` instead. This updates the Dev Hub as well as local state.

### Reauthenticate only when the org still exists

If the org still exists on the Salesforce server, sometimes re-authenticating can resolve these issues.

```bash
sf org login web --instance-url https://test.salesforce.com --alias my-scratch
```

After re-authenticating, try to delete the org again.

### Move the project default

Set another default org to potentially resolve some edge cases.

```bash
sf config set target-org=my-new-default
```

Do not edit `~/.sfdx/orgs.json` or other internal state: storage formats change, and hand edits can corrupt unrelated authorizations. If supported logout fails, run `sf doctor`, preserve its sanitized diagnostics, and use Salesforce CLI support guidance. Reviewed against the [org command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html) on 2026-08-01.
