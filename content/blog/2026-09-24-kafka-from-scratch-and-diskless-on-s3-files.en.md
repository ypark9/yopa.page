---
title: "Kafka From Scratch, and Running It Without Local Disks"
date: 2026-09-24T09:00:00-04:00
author: Yoonsoo Park
description: "A from-zero explanation of Kafka, from topics and partitions to consumer groups and replay, plus the newer trick of running it with no local disk by mounting an S3 bucket as a file system with Amazon S3 Files, and what that costs in latency."
categories:
  - AWS
  - Architecture
tags:
  - kafka
  - event-streaming
  - amazon-s3-files
  - storage
---

Kafka throws a wall of unfamiliar words at you the first time: topic, partition, offset, broker, consumer group. This post unpacks them one at a time, then goes somewhere more useful. Where Kafka earns its keep, where it does not, and the recent shift that lets you run it with no local disk at all.

## The one-sentence version

Kafka is a distributed system that lets many programs read the same never-deleted log at their own pace. It is not a mailbox that hands a message to one consumer and forgets it. It is closer to a ledger that keeps everything in order so different readers can each pick their own place.

## Why you would want that: queue versus stream

A traditional message queue works like this. A producer puts a message in, a consumer takes one out, and it is gone. That fits work you only do once, like a worker processing a payment.

The trouble starts when several systems need the same data. The same order event has to reach the payments service, the notification service, and the analytics pipeline. A queue is awkward here, because whoever takes it first is the only one who sees it.

Kafka keeps events around instead of deleting them. Each consumer remembers its own position, so consumers do not interfere with each other. The same stream can be read twice, three times, or by a service you build next year that reads it from the very beginning. That difference, one reader versus many independent readers, is what separates a queue from Kafka.

## The parts

A **topic** is the named stream, like `orders` or `clicks`.

A **partition** is a slice of a topic, and it is the unit of parallelism. More partitions mean more consumers reading at once and higher throughput.

An **offset** is the sequence number inside a partition. A consumer remembers "I have read through 105," which is why it resumes after a restart instead of replaying everything.

A **broker** is one Kafka server. Several brokers form a cluster, and partitions are spread across them.

**Replication** keeps copies of a partition on more than one broker. If a broker dies, a follower is promoted to leader and the data survives.

Producers write, consumers read.

## Ordering holds inside a partition, not across them

This is where people get surprised. Kafka guarantees order within a partition, and only within a partition. Add partitions for parallelism and the global order can scatter.

That is what keys are for. Give a message a key, say an order ID, and every event for that order lands on the same partition, so its order is preserved. Without a key, Kafka spreads messages round-robin, which balances load well and gives up ordering. Deciding what you need ordered is a design decision, not a default.

## Consumer groups

A consumer group is a set of consumers that split one stream. Three partitions and three consumers in the group means each consumer takes one partition and they process in parallel. When consumers join or leave, partitions get redistributed, a process called rebalancing, and reads pause while it happens. Churning groups hurt throughput.

Separately, different groups read the same topic independently. One group processes payments while another runs analytics, on the same data, without either knowing about the other.

## What the log gives you: retention and replay

Kafka keeps messages for a configurable retention window. Set it to two days and you can still read yesterday's messages. Two things fall out of that.

Replay: if a consumer had a bug and processed events wrong, you can rewind its offset and process again, or replay the whole topic from the start.

Late subscribers: a service you build later can read the full history from the beginning and build up its own state.

## When to use it, and when not to

Kafka is not the right answer to every message question, especially inside AWS.

If you process a job once and move on, SQS is simpler and cheaper. If you want simple real-time ingestion inside AWS with no cluster to run, Kinesis is serverless and has no brokers to operate. If you just need a fan-out notification, SNS is enough. Kafka earns its complexity for large, multi-region pipelines, long retention, and replay. Netflix running thousands of brokers across data centers for billions of events a day is the canonical example.

The short version: one-and-done is a queue, keep-and-reread is Kafka.

## Now the newer part: no local disk

Everything above is the value Kafka hands you: a log that is not erased, that many readers walk at their own pace, and that you can rewind and replay. The cost of that value is storage. Where the log lives decides how expensive keeping it is.

Kafka traditionally writes its log to local disk. Keeping a long history means provisioning that much volume up front. When that disk fills, you offload old segments to long-term storage like S3 and build custom tooling to move, track, and reclaim them. That is operational work with nothing to do with streaming.

[Amazon S3 Files](https://aws.amazon.com/s3/features/files/) changes the storage underneath. You mount an S3 file system backed by an S3 bucket and point Kafka's log directories at it. Kafka writes to the file system instead of a local disk, and all the data lives in the bucket. There is no volume to size, no manual offload, no reclaim tooling. Because S3 Files supports the file semantics Kafka expects, append, rename, and locking, you do not have to change Kafka configuration at all. Retention is now priced as S3 objects instead of provisioned volumes, so keeping the log long enough for replay and late subscribers stops being a cost decision.

The mechanics: a producer sends a message, the broker appends it to the active segment file on the file system, and the acknowledgement comes back at low latency. When the segment rolls, it becomes immutable, and after 60 seconds of write inactivity S3 Files exports it to the bucket as a single complete object. On the read side, recent data is served from cache at millisecond latency, and evicted older data is fetched back from S3 transparently. Kafka never sees that caching layer.

The measured numbers from the AWS walkthrough: broker acknowledgement around 10 milliseconds for a 200-byte message and 15 for 10 KB, with `acks=all`. Cross-region replication ran around 155 to 165 milliseconds. Slower than local disk, and a fair price for deleting capacity planning and offload tooling.

One trap. If writes are bursty, a burst followed by more than 60 seconds of quiet can export the same segment as several versions before it rolls. The final version holds the complete data, so the earlier ones are waste. An S3 Lifecycle rule that expires non-current versions after a day keeps the latest and cuts the cost. Aligning the segment roll interval with the export trigger is the whole game in this setup.

## Where Kafka shows up

Log aggregation from many servers into one searchable stream. Event-driven microservices, where a service publishes an event and inventory, shipping, and notifications subscribe instead of calling each other directly. Event sourcing, storing state as an ordered list of events you can replay. Real-time analytics and stream processing with Kafka Streams or Flink. Change data capture, streaming database changes into a search index or a data lake. Feature supply for ML models. Location matching, where ride locations and rider requests are joined in real time.

The example closest to this blog's readers: the event backbone for an agent. Everything a session produces (user messages, tool calls, their results) goes onto a topic with the session ID as the message key, so one session's events land in a single partition in order. An audit trail, a judge model, and a memory summarizer each read the same stream as their own consumer group, at their own pace, and one slow consumer never blocks the rest. When the memory or verification logic changes, you rewind the offsets and run the old history through the new logic. [AgentCore Memory](/blog/2026-08-01-agentcore-memory-events-strategies-and-isolation.html) already manages session history itself, so this is not a replacement for it. It is the place where what the agent did is written once and read by many.

## The takeaway

The fastest way to understand Kafka is to hold one picture: a never-deleted log that many readers walk through at their own position. Topic and partition are the scaling unit, offset is the read position, consumer group is the parallelism unit. Everything else follows. And the newest turn, swapping local disk for S3 Files, takes the most annoying part of running Kafka, capacity management, off the table.

The numbers here come from the AWS Storage Blog walkthrough and AWS launch material. I have not re-measured them.
