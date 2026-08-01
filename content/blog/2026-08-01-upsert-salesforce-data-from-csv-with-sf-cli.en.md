---
title: "Upsert Salesforce Data from CSV with sf CLI"
date: 2023-05-16T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-16-sfdx-deploy-record-using-csv.html"
author: Yoonsoo Park
description: "Load records safely with Bulk API 2.0 through the current Salesforce CLI."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Bulk API 2.0
  - Data Migration
---

Verified on 2026-08-01. Records are loaded, not deployed, and the retired command's mapping-file flag is not part of the current bulk upsert workflow.

Prepare UTF-8 CSV with a stable external ID, then use the current command and inspect the job result:

```bash
sf data upsert bulk --sobject Widget__c --file widgets.csv \
  --external-id External_Id__c --target-org staging --wait 10
```

Test a small file first. Keep failed and unprocessed result files, avoid logging sensitive rows, and respect field-level access and validation rules. Bulk is efficient for large asynchronous loads; `sf data upsert record` or an API client is simpler for a handful of records and easier to handle transaction by transaction.

Migration: remove `mapping.json`, make CSV headers match API field names, confirm the external-ID field, run in a sandbox, reconcile counts, then promote the same reviewed file and command to the intended org.

References: [Salesforce CLI data commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html), [Bulk API 2.0](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm).

## Current mental model

Metadata deployment changes schema and configuration. Data loading creates or changes records and triggers validation rules, Flows, Apex, duplicate rules, sharing, and downstream integrations. An upsert chooses insert or update by an external ID, so the stability and uniqueness of that key determine whether reruns are safe.

## Prepare and execute safely

Start with a representative sample that contains no unnecessary sensitive columns. Confirm field API names, data types, picklist values, locale-sensitive dates, UTF-8 encoding, and the external-ID field. Query a few keys first to understand collision behavior.

```bash
sf data query --target-org staging \
  --query "SELECT Id, External_Id__c FROM Widget__c LIMIT 5" --json
sf data upsert bulk --sobject Widget__c --file widgets-sample.csv \
  --external-id External_Id__c --target-org staging --wait 10
```

Reconcile successful, failed, and unprocessed counts with the input. Read failure files instead of blindly rerunning the whole batch. When lookup relationships are involved, load parents first or resolve stable external IDs; do not copy Salesforce record IDs between environments.

## Alternatives and tradeoffs

Bulk API 2.0 minimizes client orchestration for large files but is asynchronous and can produce partial success. Record commands are clearer for small operational changes. A purpose-built integration can provide transformations, retries, and observability but requires ownership and testing. Data Loader remains useful for supervised admin work, though its configuration must be reviewed like code.

## Migration and verification checklist

Remove the obsolete mapping flag, rename “deploy” jobs to “load” or “upsert,” and version-control a schema-only sample rather than customer data. Test automation and validation side effects in a sandbox, define retry rules for failed rows, take an appropriate backup, and document rollback. After loading, compare counts, sample fields by external ID, inspect automation failures, and rerun the sample to prove idempotency.
