---
title: "Check Salesforce Object Availability with sf CLI"
date: 2023-04-25T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-04-25-checking-if-an-sobject-exists-in-a-salesforce-scratch-org.html"
author: Yoonsoo Park
description: "A reliable JSON and exit-code check for object availability in a Salesforce org."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Scratch Orgs
  - Metadata API
---

Verified on 2026-08-01. The old schema-list flags did not provide a dependable existence test.

Ask the target org to describe the exact API name:

```bash
if sf sobject describe --sobject MyObject__c --target-org test --json >describe.json; then
  echo "object is available"
else
  echo "object is absent or inaccessible" >&2
fi
```

A failed describe can also mean the authenticated user lacks access. That distinction is important: object metadata, licensing, installed packages, and permissions all affect visibility. For automation, inspect the JSON status and error code without printing credentials. For Apex runtime logic, use schema describe methods and enforce CRUD/FLS rather than shelling out.

Migrate by replacing `sfdx force:schema:*` calls with the current `sf sobject describe` command and by testing both an existing and deliberately missing object in the intended org.

Reference: [Salesforce CLI command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html).

## Current mental model

“Exists” can mean three things: the metadata type exists in the org, the authenticated principal can see it, and the object is usable for the intended operation. A describe request answers the first two together; a permission or license difference can therefore look like absence.

## Step-by-step verification

First prove the target identity, then describe the exact API name and retain only nonsensitive fields:

```bash
sf org display --target-org test
sf sobject describe --sobject MyObject__c --target-org test --json >describe.json
jq '{status, name: .result.name, queryable: .result.queryable,
     createable: .result.createable, updateable: .result.updateable}' describe.json
```

Do not use a partial label or `DeveloperName` where an object API name is required. Standard, custom, namespaced, and external objects have different suffixes. If the command fails, save the structured error, check the package/license, and compare with an administrator only to distinguish absence from permissions—do not simply grant broad access.

## Alternatives and tradeoffs

- `sf sobject describe` is ideal for scripts and local diagnosis.
- Apex `Schema.getGlobalDescribe()` keeps runtime feature detection inside the transaction but consumes describe resources and still requires security enforcement.
- Metadata listing helps inventory components but is heavier than an exact describe.

## Migration checklist

Replace legacy schema commands, make `--target-org` mandatory, parse JSON rather than human text, and treat nonzero exit status as “unknown until classified,” not automatically “missing.” Test with an available object, an unavailable API name, and a user without access. Pin the CLI in CI and delete diagnostic JSON if it contains organization details.
