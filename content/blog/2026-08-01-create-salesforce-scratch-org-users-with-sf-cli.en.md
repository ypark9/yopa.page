---
title: "Create Salesforce Scratch Org Users with sf CLI"
date: 2023-06-02T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-02-using-sfdx-cli-command-to-insert-user-to-org.html"
author: Yoonsoo Park
description: "Create scratch-org users with supported CLI commands and explicit permission setup."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - Scratch Orgs
  - Security
---

Verified on 2026-08-01. Generic `User` DML assembled through shell substitution is fragile and unsafe; required fields, profiles, and licenses vary by org.

For a scratch org, use the purpose-built command:

```bash
sf org create user --target-org scratch \
  --set-alias qa-user email=qa@example.invalid lastname=Tester
sf org assign permset --name App_Tester --target-org qa-user
```

Keep user definitions free of real personal data and grant permissions through reviewed permission sets. Scratch-user creation is reproducible and scoped to disposable development orgs. Production user provisioning is a different administrative lifecycle: use your identity/provisioning system or a reviewed API integration with license, profile, MFA, deactivation, and audit controls.

Migration: delete `jq` command substitution, move nonsecret defaults to a user definition, create in a fresh scratch org, verify `sf org list users`, then test the intended permission set.

Reference: [Salesforce CLI org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html).

## Current mental model

A scratch-org user is a disposable test identity derived from licenses and profiles available in that org. It is not a shortcut for production identity lifecycle management. The CLI command understands scratch-user defaults and avoids turning JSON into unquoted shell arguments.

## Step-by-step safe example

Confirm the org, inspect existing users, create a narrowly scoped identity, and assign permission sets separately:

```bash
sf org display --target-org scratch
sf org list users --target-org scratch
sf org create user --target-org scratch --set-alias qa-user \
  email=qa@example.invalid lastname=Tester
sf org assign permset --name App_Tester --target-org qa-user
sf org display user --target-org qa-user
```

Use reserved invalid domains for synthetic addresses unless email delivery is part of the test. Never place real employee details or passwords in a committed definition. Permission sets make intent reviewable and avoid cloning an overprivileged profile. If the requested license or profile is unavailable, change the scratch definition or test design rather than borrowing an administrator identity.

## Alternatives and tradeoffs

Inline attributes are quick for one user. A versioned user-definition file is reproducible for a team but must contain only nonsecret synthetic data. Apex or REST creation offers custom logic, yet it exposes org-specific required fields and licensing rules. Production and long-lived sandbox users should come from an identity governance or provisioning process with approval, MFA, deactivation, and auditability.

## Migration and verification checklist

1. Remove `$(jq ...)` and other shell-expanded field lists.
2. Separate identity creation from permission assignment.
3. Replace personal sample data with synthetic values.
4. Recreate the user in a fresh scratch org to test reproducibility.
5. Log in as that user and exercise the intended feature, including denied actions.
6. Delete the scratch org at the end rather than carrying test identities forward.

Verification is behavioral: listing the user proves creation, while tests under that identity prove the permission boundary.
