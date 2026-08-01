---
title: Designing Reliable Work Queues with Amazon SQS
date: 2023-06-12T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A current reliability guide to SQS delivery semantics, idempotency, visibility timeouts, retries, dead-letter queues, and monitoring."
categories:
  - AWS
tags:
  - Amazon SQS
  - Messaging
  - Reliability
  - Security
---

Amazon SQS decouples producers from consumers, absorbs bursts, and retains work during temporary consumer failures. Reliability still depends on the consumer design. SQS does not by itself guarantee that a business operation happens exactly once.

## Choose Standard or FIFO

**Standard queues** provide very high throughput, at-least-once delivery, and best-effort ordering. A message can be delivered more than once, so consumers must be idempotent.

**FIFO queues** preserve order within a message group and provide SQS deduplication semantics. They are useful when order is a real invariant, but message-group design affects concurrency. FIFO does not make an external database charge or API call exactly once; the consumer still needs an idempotency key or transactional boundary.

## The processing contract

Receiving a message makes it temporarily invisible. Delete it only after the business operation commits. Set the visibility timeout longer than normal processing plus a margin, and extend it with `ChangeMessageVisibility` for legitimately long work. If it is too short, another worker can process the same message concurrently; if too long, recovery from a crashed worker is delayed.

Use an immutable message ID or business idempotency key. Store the result atomically where possible, or make the target API accept the key. Retries must use backoff and distinguish transient errors from permanent invalid input.

Configure a dead-letter queue with a deliberate `maxReceiveCount`. A DLQ is not a trash can: alarm on it, preserve enough context to diagnose safely, and define a reviewed redrive procedure. Redriving without fixing the cause can repeat side effects or create another outage.

## Efficient consumers

Use long polling to reduce empty receives and batch receive/delete operations where failure handling remains correct. Scale consumers on queue depth and age of oldest message, not CPU alone. Cap concurrency to protect databases and downstream APIs. For Lambda event source mappings, understand partial batch responses so one failed record does not force successful records through unnecessary retries.

Encrypt queues when required, use TLS, and scope producer/consumer IAM permissions to specific queues and actions. Avoid sensitive payloads when a reference to encrypted storage is sufficient. Remember retention and DLQ retention in privacy and deletion policies.

## Order example

Do not represent an entire order workflow as unrelated messages that can independently charge, reserve inventory, and notify without coordination. Publish a durable order identifier, make each step idempotent, record state transitions, and use a workflow or saga when compensation and ordering matter. SQS transports work; it is not the system of record.

## Verification checklist

- Deliver the same message twice and confirm one business effect.
- Kill a worker after commit but before delete.
- Run longer than the visibility timeout and test extension.
- Trigger transient retries and poison-message DLQ routing.
- Test partial batch failure and redrive.
- Alarm on age, visible/not-visible count, DLQ depth, consumer errors, and throttling.
- Load test with downstream concurrency limits in place.

Official documentation reviewed on **2026-08-01**:

- [Amazon SQS delivery semantics](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html)
- [Visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [Lambda partial batch responses](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html)
