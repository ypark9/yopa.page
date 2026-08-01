---
title: "Debug Flow-Invoked Queueable Apex with Correlated Logs"
date: 2024-04-28
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-04-28-how-to-debug-salesforce-flows-with-asynchronous-apex-methods.html"
author: Yoonsoo Park
description: "Trace a Salesforce Flow through invocable and Queueable Apex without leaking credentials or losing the asynchronous job boundary."
categories:
  - Salesforce
  - Debugging
tags:
  - Salesforce Flow
  - Apex
  - Asynchronous Apex
  - Debug Logs
---

This guide was verified against Salesforce documentation on 2026-08-01.

## Why the old debugging flow changed

The archived article started with a Flow invoking an `@future` method. Salesforce now recommends Queueable Apex for production asynchronous work: it returns a job ID, accepts structured state, supports chaining, and is easier to monitor. A more important debugging detail was also missing. The Flow transaction and Queueable transaction are separate executions. Their logs can have different traced entities, timestamps, and governor-limit contexts.

A useful trace must connect those transactions without logging an access token, Named Credential secret, customer payload, or full HTTP response.

## Current mental model

Treat the path as three observable boundaries:

1. **Flow interview** validates inputs and invokes a bulk-safe Apex action.
2. **Invocable Apex** creates a correlation ID, enqueues one or more jobs within limits, and returns or persists the job ID.
3. **Queueable Apex** runs later, under its own transaction and limits, and can be found through `AsyncApexJob`.

The Flow debugger proves the synchronous path. Apex debug logs and `AsyncApexJob` prove the asynchronous path. Neither alone proves the complete business outcome.

## A correlation-friendly implementation

Keep the invocable method bulk-safe. Don't enqueue one job per record without considering the per-transaction queueable limit. The example groups the inputs into one job and generates a nonsecret correlation value.

```apex
public with sharing class SyncAccountsAction {
    public class Request {
        @InvocableVariable(required=true)
        public Id accountId;
    }

    @InvocableMethod(label='Queue Account Sync')
    public static void enqueue(List<Request> requests) {
        Set<Id> accountIds = new Set<Id>();
        for (Request request : requests) {
            if (request != null && request.accountId != null) {
                accountIds.add(request.accountId);
            }
        }
        if (accountIds.isEmpty()) return;

        String correlationId = Crypto.getRandomUUID();
        Id jobId = System.enqueueJob(
            new SyncAccountsJob(new List<Id>(accountIds), correlationId)
        );
        System.debug(LoggingLevel.INFO,
            'account-sync queued correlation=' + correlationId + ' job=' + jobId);
    }
}
```

```apex
public with sharing class SyncAccountsJob
        implements Queueable, Database.AllowsCallouts {
    private final List<Id> accountIds;
    private final String correlationId;

    public SyncAccountsJob(List<Id> accountIds, String correlationId) {
        this.accountIds = accountIds;
        this.correlationId = correlationId;
    }

    public void execute(QueueableContext context) {
        System.debug(LoggingLevel.INFO,
            'account-sync started correlation=' + correlationId
            + ' job=' + context.getJobId() + ' count=' + accountIds.size());

        // Query only required fields. Use a Named Credential for callouts.
        // Log status, duration, and a provider request ID—not secrets or bodies.
    }
}
```

If the correlation must survive log expiration, store a minimal status record containing the correlation ID, Queueable job ID, state, timestamps, and a sanitized error code. Apply retention and sharing rules; an observability object must not become a second store for customer payloads.

## Set the right trace flags

Reproduce in a sandbox or scratch org with the smallest useful log window.

- Trace the user who launches the Flow for the synchronous interview and invocable call.
- When automation runs as **Automated Process**, add a trace flag for Automated Process as well.
- Keep Apex Code at a useful level such as `FINE` or `FINEST` only during the short diagnostic period. Raising every category to the maximum creates truncation and hides the useful sequence.
- If a scheduled or platform-event path starts the work, identify its actual execution user instead of assuming it matches the browser user.

Trigger one known record and note the start time and correlation ID. Then query the job:

```bash
sf data query --target-org sandbox --use-tooling-api --query \
  "SELECT Id, Status, JobType, ApexClass.Name, CreatedDate, CompletedDate,
   NumberOfErrors, ExtendedStatus
   FROM AsyncApexJob
   WHERE ApexClass.Name = 'SyncAccountsJob'
   ORDER BY CreatedDate DESC LIMIT 10"
```

Use the returned job ID and timestamps to locate the Queueable log. A `Completed` job means the Queueable transaction completed; it does not necessarily mean the remote system accepted or applied the business operation. Verify the external outcome through a safe provider request ID or a business-state query.

## Secret-safe logging

Log identifiers that help correlation: job ID, correlation ID, record count, sanitized error category, HTTP status, duration, and an upstream request ID. Do not log:

- access or refresh tokens;
- Named Credential material or authorization headers;
- full request or response bodies;
- customer fields not required for diagnosis;
- stack traces in user-visible Flow errors.

Catch expected integration failures, persist a sanitized operational status, and let unexpected exceptions fail the Queueable so `AsyncApexJob` records the failure. Avoid swallowing an exception after printing it.

## Limits and tradeoffs

Queueable Apex is the default choice for single-shot asynchronous production work, but it still shares daily asynchronous capacity and has enqueue limits. Batch Apex is more appropriate for very large query-driven datasets. Platform Events can decouple producers and consumers, at the cost of event delivery and monitoring complexity. A synchronous invocable action is simplest when the work is quick and does not require a callout after DML.

Chaining can express ordered stages, but every link needs an idempotency and stop strategy. Don't build an unbounded retry loop. Use a bounded retry count, backoff appropriate to the external service, and a terminal failure state that an operator can inspect.

## Migration checklist

1. Inventory each Flow that calls `@future` and document its inputs and side effects.
2. Create a bulk-safe invocable boundary and a Queueable class with focused tests.
3. Add a correlation ID and retain the `System.enqueueJob` job ID.
4. Replace raw endpoints and secrets with a Named Credential.
5. Define sanitized success, retryable failure, and terminal failure states.
6. Test one record, a Flow-sized batch, callout failure, permission failure, and limit behavior.
7. Deploy to a sandbox, add short-lived trace flags for the real execution identities, and compare business outcomes.
8. Activate the revised Flow through a controlled release and remove obsolete trace flags.

## Verification

A complete verification connects the Flow interview to the invocable log, the Queueable job ID, its asynchronous log, and the final business result. Tests should assert that inputs are bulked, the Queueable is enqueued, callouts are mocked, errors are classified without secrets, and retries terminate.

## Official sources

- [Leveling Up Your Apex Skills: Queueable over future methods](https://developer.salesforce.com/blogs/2023/05/leveling-up-your-apex-skills)
- [Queueable Apex](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_queueing_jobs.htm)
- [InvocableMethod Annotation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm)
- [Salesforce CLI data query reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html)
