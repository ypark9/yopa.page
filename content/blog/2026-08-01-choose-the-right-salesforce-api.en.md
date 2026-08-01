---
title: "Choose the Right Salesforce API"
date: 2024-05-05
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-05-05-understanding-salesforce-apis-metadata-tooling-and-bulk.html"
author: Yoonsoo Park
description: "Choose Salesforce APIs by resource, lifecycle, volume, and latency rather than by a three-API shortlist."
categories:
  - Salesforce
tags:
  - Salesforce APIs
  - Metadata API
  - Tooling API
  - Bulk API 2.0
---

Verified on 2026-08-01.

## Why the old guide changed

Metadata, Tooling, and Bulk aren't interchangeable sizes of one API. They address configuration, developer tooling, and high-volume data. A useful chooser must also include REST, SOAP, Composite, GraphQL, and UI API.

## Decision matrix

| Need | Start with | Reason |
|---|---|---|
| CRUD/query business records | REST API | Direct synchronous resource model |
| Several dependent REST operations | Composite API | Fewer round trips and optional transactional grouping |
| Large asynchronous ingest/extract | Bulk API 2.0 | Job-based CSV processing and partial-result handling |
| Deploy/retrieve configuration | Metadata API | Metadata lifecycle and package manifests |
| Tests, traces, coverage, dev artifacts | Tooling API | Developer-tool objects |
| Flexible graph-shaped reads | GraphQL API | Client-selected related fields |
| Salesforce-shaped UI data | UI API | Layout, metadata, data, and user context |
| Existing enterprise WSDL contract | SOAP API | Strong generated contract and mature integrations |

Choose first by resource: records, metadata, tooling, or UI. Then consider volume, latency, transaction boundaries, supported objects, API version, limits, and client capability.

## Safe examples

For a small synchronous query, use REST through the authenticated CLI without exposing a token:

```bash
sf data query --target-org integration-test \
  --query "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 10" --json
```

For a large CSV upsert, use Bulk API 2.0 and reconcile every result category:

```bash
sf data upsert bulk --target-org integration-test \
  --sobject Account --file accounts.csv --external-id External_Id__c --wait 10
```

Use OAuth with least scopes, an External Client App for new Salesforce OAuth integrations where applicable, TLS, secret rotation, timeouts, idempotency keys or stable external IDs, bounded retries, and structured logs without payloads or credentials.

## Tradeoffs

REST is simple but chatty. Composite reduces calls but creates larger failure surfaces. GraphQL avoids over-fetching but isn't a replacement for every mutation or metadata operation. UI API respects Salesforce UI semantics but couples clients to that model. Bulk API 2.0 scales but is asynchronous and can partially succeed. SOAP provides a rigid contract at the cost of XML and generated-client complexity.

## Migration checklist

1. Inventory endpoints by resource, call volume, latency, and failure semantics.
2. Remove claims that Bulk API is for reporting or Tooling API is a general refactoring engine.
3. Move large record jobs to Bulk API 2.0 only when asynchronous partial results are acceptable.
4. Keep configuration delivery on Metadata API and developer observations on documented Tooling objects.
5. Pin an API version and test the next version before upgrading.
6. Add limit, timeout, retry, duplicate, permission, and partial-failure tests.
7. Verify record counts, metadata component sets, and final business state—not only HTTP success.

## Official sources

- [Salesforce Platform APIs](https://developer.salesforce.com/docs/apis)
- [REST API Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Bulk API 2.0 Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm)
- [GraphQL API](https://developer.salesforce.com/docs/platform/graphql/guide)
- [UI API](https://developer.salesforce.com/docs/platform/lwc/guide/reference-ui-api.html)
