---
title: "Use Salesforce Record Types Without Hard-Coded IDs"
date: 2024-06-04
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-06-04-understanding-record-types-and-recordtypeid-in-salesforce-for-beginners.html"
author: Yoonsoo Park
description: "Decide when record types fit, handle Person Accounts, and resolve portable RecordTypeIds safely."
categories:
  - Salesforce
tags:
  - Salesforce
  - Record Types
  - Data Migration
---

Verified against Salesforce documentation on 2026-08-01.

## Why the old example was archived

Record Type IDs differ between orgs, so a map containing `012...` values isn't portable. The earlier Business Account versus Individual Account example also implied that an ordinary Account record type turns an Account into a person. Salesforce **Person Accounts** are a distinct feature and data model combining Account and Contact behavior; enabling them is an organizational decision, not a record-type label.

## Decide whether a record type is needed

Use a record type when one object supports materially different business processes, picklist value sets, or page-layout experiences. Don't add one for a conditional field, security boundary, or reporting label. Dynamic Forms can handle presentation; permission sets handle access; a picklist may be enough for classification.

For Accounts, decide first whether the business manages organizations only or requires Person Accounts. Confirm edition, feature implications, integrations, sharing, duplicate management, and reporting before enabling Person Accounts. Don't simulate a person with a custom “Individual Account” record type unless that is an intentional custom model.

## Resolve IDs in each org

In Apex, use describe metadata rather than SOQL or a hard-coded ID:

```apex
Schema.RecordTypeInfo info = Account.SObjectType
    .getDescribe()
    .getRecordTypeInfosByDeveloperName()
    .get('Business_Account');

if (info == null || !info.isAvailable()) {
    throw new IllegalArgumentException('Business_Account is unavailable');
}
Id businessRecordTypeId = info.getRecordTypeId();
```

Check `isAvailable()` because profile and permission assignments affect what the current user can use. In integration preprocessing, query by `SObjectType` and `DeveloperName` in the target org, cache only for that run, and fail if the result is absent or ambiguous:

```bash
sf data query --target-org staging --use-tooling-api --query \
  "SELECT Id, DeveloperName, Name, IsActive
   FROM RecordType
   WHERE SObjectType = 'Account' AND DeveloperName = 'Business_Account'"
```

## Safe import and upsert

CSV tools generally need the resolved `RecordTypeId`, not a relationship column invented by the client. Keep `RecordTypeDeveloperName` in the source export, resolve it against the target org, produce a temporary transformed CSV, and inspect unmapped values before loading.

```text
External_Id__c,Name,RecordTypeDeveloperName
ORG-100,Acme Corp,Business_Account
```

Load with a stable external ID only after transformation:

```bash
sf data upsert bulk --target-org staging --sobject Account \
  --file accounts-resolved.csv --external-id External_Id__c --wait 10
```

Never copy RecordTypeIds or record IDs between environments. Protect input files containing customer data and reconcile successful, failed, and unprocessed results.

## Tradeoffs and migration checklist

Record types give administrators a supported process boundary but multiply layouts, assignments, tests, and migration mappings. A single record type is simpler where behavior doesn't truly diverge.

1. Inventory record types by object, developer name, purpose, assignments, and active use.
2. Separate real business-process differences from UI, access, and reporting concerns.
3. Decide explicitly whether Person Accounts are part of the model.
4. Replace hard-coded IDs with describe or target-org lookup.
5. Assign record types through profiles or permission sets and test least-privileged personas.
6. Transform a small synthetic CSV, validate mapping counts, and upsert into a sandbox.
7. Test create, edit, automation, integrations, duplicate rules, and reports for every supported type.
8. Monitor failures after release and retain a rollback mapping.

## Official sources

- [Record Type information in Apex Schema](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_sobject_describe.htm)
- [Person Accounts](https://help.salesforce.com/s/articleView?id=sf.account_person.htm&type=5)
- [Salesforce CLI data commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html)
