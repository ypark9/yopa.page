---
title: "Choose the Right Salesforce Configuration Tool"
date: 2023-06-21T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-21-record-based-configuration-in-salesforce.html"
author: Yoonsoo Park
description: "A practical decision guide for record types, Dynamic Forms, custom metadata, and Flow."
categories:
  - Salesforce
tags:
  - Salesforce Flow
  - Record Types
  - Custom Metadata
---

Verified on 2026-08-01. “Record-based configuration” is not one Salesforce feature, and Workflow Rules are a legacy automation path.

Choose by responsibility:

- Record types select business processes, picklist values, and experiences for materially different processes.
- Page layouts and Dynamic Forms control presentation; they are not authorization.
- Custom metadata stores deployable application configuration.
- Flow is the strategic declarative automation tool; Apex remains appropriate for logic that needs code-level control, testing, or scale.
- Permission sets control access.

Avoid a record type for every minor variation. Start with the business process and security boundary, then select the smallest mechanism. The tradeoff is governance: declarative tools are approachable but still need source control, tests, owners, and limits.

Migration: inventory Workflow Rules and overloaded record types, add regression tests, migrate automation through Salesforce's supported Flow tooling, activate in a controlled release, and monitor failed Flow interviews.

References: [Migrate to Flow](https://help.salesforce.com/s/articleView?id=sf.flow_migrate_to_flow.htm&type=5), [Custom Metadata Types](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_custommetadatatypes.htm).

## Start with the decision, not the feature

Write down what varies, who may change it, whether it moves between orgs, and whether it affects UI, access, or automation. A record type is appropriate only when one object supports materially different processes. It should not become a generic flag for every conditional.

## Step-by-step example

Suppose Projects have Internal and Client delivery processes. Use record types only if picklist values or process stages truly differ. Use Dynamic Forms for conditional field visibility, permission sets for access, custom metadata for deployable thresholds, and a record-triggered Flow for automation. Then:

1. Define developer names and ownership in source control.
2. Build permission sets before page visibility rules so hidden UI is never mistaken for security.
3. Put environment-independent policy in custom metadata, not hard-coded record IDs.
4. Bulk-test the Flow, including update recursion and failure paths.
5. Deploy to a sandbox, assign to a pilot permission-set group, and inspect failed interviews.

## Alternatives and tradeoffs

One record type plus Dynamic Forms reduces administrative branching but cannot represent different sales/support business processes by itself. Custom settings can hold runtime configuration, while custom metadata is generally better for deployable configuration. Apex provides transaction control and reusable abstractions but requires code ownership. Flow is accessible and observable, yet large monolithic flows become as difficult to maintain as monolithic code.

## Migration checklist

Inventory record types, layouts, Workflow Rules, Process Builder processes, validation rules, permissions, and hard-coded IDs together. Map each behavior to an owner and test. Use the supported migration tooling as a starting point, not proof of equivalence. Disable old automation only after side-by-side tests show that ordering, recursion, scheduled paths, and error handling match. Keep rollback artifacts until production monitoring is clean.

## Verification

Test each persona, record type, create/update/bulk transaction, and denied field. Confirm metadata deploys without org-specific IDs. Monitor Flow errors and business outcomes after release. The best configuration is the smallest set of mechanisms whose responsibilities a future maintainer can explain.
