---
title: "AgentCore Runtime Instances: When Your Agent Outgrows the MicroVM"
date: 2026-08-06T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore now runs agents on managed EC2 instances with sessions up to 14 days and GPU/memory/compute families. Here is when to reach for it instead of the serverless microVM runtime."
categories:
  - AWS
  - AI Agents
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - EC2
  - GPU
  - Long-running Agents
---

On August 6, 2026 AWS made [AgentCore runtime instances](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-bedrock-agentcore-runtime-instances-generally-available/) generally available. Until now AgentCore Runtime gave you one shape of compute: a serverless microVM, fast to start, capped at an eight-hour session. That covers most request-response agents. It does not cover an agent that needs a GPU, or one that has to stay alive for two days.

Runtime instances add a second shape. You still deploy and invoke the agent the same way, but now it can run on a managed EC2 instance you selected, for a session up to 14 days.

If you read my [Durable Long-Running Jobs with AgentCore](/blog/2026-08-01-durable-long-running-jobs-with-agentcore.html), that post argued the eight-hour ceiling is a hard boundary you design around. The ceiling just moved, and for a subset of workloads that changes the design.

## One running example

Take a document-intelligence agent. It ingests a few hundred contracts, runs a local vision-language model to extract clauses, and produces a structured report. Two properties break the default runtime:

1. It wants a GPU for the local model. The serverless microVM has no GPU.
2. A full batch takes closer to a day than an hour.

Carry this example through both approaches.

## Where it fits

```
Request  ->  AgentCore Runtime  ->  your agent code
                    |
        +-----------+-----------+
        |                       |
   microVM (serverless)    runtime instance (EC2)
   fast start, <= 8h       your instance type, <= 14d
```

AgentCore still owns provisioning, patching, scaling, and lifecycle. The choice is only *what the agent runs on*, and you can run a mix: latency-sensitive agents on microVMs, the heavy batch agent on an instance.

## Before: bending the microVM to fit

With only the serverless runtime, the document agent forces two workarounds.

For the GPU, you leave AgentCore Runtime entirely. You stand up your own ECS or EKS service on GPU instances, wire the networking and IAM yourself, and now you own patching and scaling for that fleet.

For the duration, you chop the day-long batch into eight-hour-safe chunks behind a durable orchestrator, the exact pattern from the long-running-jobs post:

```
Step Functions
   -> SQS work item (batch of 20 contracts)
      -> AgentCore Runtime (bounded, < 8h)
         -> S3 artifact + DynamoDB checkpoint
   -> loop until done
```

That orchestration is still good design for genuinely durable business processes with approvals and money movement. But here it exists only to dodge a compute limit, not because the business process is durable. That is the tell.

## After: pick the compute, attach, done

With runtime instances the two workarounds collapse into configuration. You create a **capacity provider** that names the EC2 instance types your agent needs, GPU-accelerated in this case, and attach the agent to it.

```
capacity provider:
  instance types: [ g6.xlarge, g6.2xlarge ]   # GPU family
  ->
agent: document-intelligence
  runtime: instance
  session: up to 14 days
```

The GPU is now first-class, no side ECS fleet. The day-long batch runs in a single session instead of a Step Functions chunking loop. Deploy and invoke are unchanged, so the calling code from the microVM era still works.

You still pay for the compute AgentCore manages on top of the underlying EC2 cost, so an instance sitting idle is real money in a way an autoscaled-to-zero microVM is not.

## Which one

| Signal | Reach for |
|---|---|
| Request-response, spiky, sub-8h | microVM (serverless) |
| Fast cold start matters | microVM |
| Needs GPU or memory/compute-optimized hardware | runtime instance |
| Single session must exceed 8h (up to 14d) | runtime instance |
| Sustained, always-warm workload | runtime instance |
| Genuinely durable process (approvals, days of waiting) | still a durable orchestrator, not one long session |

That last row matters. A 14-day session is not a durable workflow. If your process waits two days for a human to approve something, a single long-lived session is a fragile place to park that state. Persist it in a transactional store and let Step Functions own the wait. Runtime instances raise the ceiling for *continuous* work; they do not turn one invocation into a saga.

## Pitfalls

- **Idle instances bill.** The serverless runtime scales to zero. A capacity provider holding instances for a bursty agent burns money between bursts. Match the runtime to the traffic shape, not to the peak.
- **14 days is a maximum, not a target.** Reaching for a multi-day session is usually a sign the work should be checkpointed and made restart-safe anyway, the same as under the eight-hour cap.
- **Regional availability is partial.** At GA: US East (N. Virginia, Ohio), US West (Oregon), Asia Pacific (Mumbai, Singapore, Sydney, Tokyo), Europe (Frankfurt, Ireland). Confirm your region before you design around it.
- **Instance selection is your call.** The capacity provider is only as right-sized as the instance families you list. Over-provisioning a GPU family for an agent that never touches the GPU is the classic waste.

## What to do

Keep the default. Most agents are request-response and belong on the serverless microVM, where scale-to-zero and fast start are free wins. Reach for a runtime instance only when a specific agent hits a wall the microVM can't clear: a GPU requirement, memory/compute-optimized hardware, or a session that genuinely runs longer than eight hours of continuous work. And when you catch yourself wanting a 14-day session to hold a business process open, that is still the signal to reach for a durable orchestrator, as covered in the [long-running jobs post](/blog/2026-08-01-durable-long-running-jobs-with-agentcore.html) and the broader [AgentCore service map](/blog/2026-08-01-agentcore-service-map-and-production-boundaries.html).
