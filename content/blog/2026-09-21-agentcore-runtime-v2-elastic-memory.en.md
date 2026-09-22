---
title: "AgentCore Runtime V2: Elastic Memory, Flat Cold Start, and What Changes in Your Design"
date: 2026-09-21T09:00:00-04:00
author: Yoonsoo Park
description: "The second-generation serverless AgentCore runtime starts each session with a small memory profile, reclaims what it does not use, and holds cold start near two seconds regardless of image size. Here is what that changes in your agent design, and the migration pitfalls."
categories:
  - AWS
  - AI Agents
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Cold Start
  - Cost Optimization
  - Serverless
---

Two numbers quietly shaped how everyone built on the serverless AgentCore runtime. The memory you reserved for a session, and the cold start you paid because your image was large. Neither was a design choice you made on the merits. They were fixed costs you designed *around*. The second-generation runtime moves both, and that is worth a closer look than most "what's new" notes.

On September 18, 2026 AWS announced the next generation of [AgentCore Runtime](https://aws.amazon.com/about-aws/whats-new/2026/09/new-agentcore-runtime-generally-available), the serverless microVM compute inside Amazon Bedrock AgentCore. The serverless model is unchanged: no pre-provisioning, scale to zero, hardware-enforced session isolation, pay only for what you use. What changed is how memory and startup are priced and timed.

## What V2 actually changes

Strip the announcement down to the mechanics:

- **Memory is now elastic.** A session starts with a small profile, memory is allocated on demand as the workload needs it, and memory that is no longer actively used is *reclaimed* during the session instead of being held until it ends. You are billed for actual usage rather than the peak you reserved.
- **Cold start is now flat.** The runtime prepares the agent environment once and snapshots it. Every new instance restores from that snapshot instead of repeating the full startup sequence, so start time no longer tracks image size.
- **The serverless contract holds.** No instances to pre-warm, scale to zero, hardware-enforced isolation between sessions, per-use billing.
- **You opt in per runtime.** Not an automatic upgrade: set `platformVersion` to `V2` when creating or updating a runtime.

The two numbers that matter: in testing, V2 delivered a **P75 cold start of 1.9 to 2.0 seconds for container images from 200 MB to 2 GB**, against **5.4 to 30 seconds with V1**. And the memory you are billed for now follows the session's real footprint, not its reserved ceiling.

```text
V1 (reserve for peak, rebuild on every start)
  start: full init sequence every instance  -> cold start scales with image size
  memory:  reserve peak for whole session    -> you pay the peak, even for a burst

V2 (snapshot restore, elastic memory)
  start: restore from prepared snapshot      -> ~2s P75, flat across 200MB-2GB
  memory: small profile -> grow on demand    -> reclaim what goes idle, pay actual use
```

## Why the cold-start change matters more than it reads

Under V1 the startup sequence repeated on every new instance, so cold start scaled with how much was in your image. That turned image size into a latency lever, and people pulled it hard. You trimmed the ML SDK you barely used, dropped the headless browser, split a monolith service into two just to keep the import graph short. Those were real engineering decisions made to protect p95, not because the architecture wanted them.

Snapshot restore decouples start time from image size. That quietly makes the dependency diet **optional**. If shipping one fat image keeps the agent simpler to reason about and deploy, V2 removes the main reason you were fighting it. This is the classic trade: V1 made you trade code clarity for startup speed; V2 mostly removes the trade.

## The memory change is a billing change first

Under V1 you reserved memory for the session's peak and paid it for the whole session. A workload that spikes to 2 GB for a few seconds of embedding work, then idles at 200 MB for twenty minutes, still carried the peak cost the entire time.

V2 starts each session small and grows on demand, reclaiming what goes idle. So the parameter you once sized against your worst-case instant is no longer the dominant cost driver. Two consequences follow immediately:

1. Your **cost model changes shape.** The line item that used to be "memory × session duration at peak" becomes something closer to "integrated memory usage over the session". A V1-shaped budget alarm will fire on the wrong signal.
2. Your **sizing instinct changes meaning.** The memory you set is no longer "the thing you pay for"; it is a ceiling you should verify, not a dial you tune for cost.

## Which agents actually gain

| Your agent today | What V2 does |
|---|---|
| Fat image (ML libs, browser, big SDKs) trimmed only to protect cold start | Big win: start time flattens, the trimming pressure mostly disappears |
| Bursty memory (heavy context or embeddings, then idle) | Win: you stop paying the peak for the quiet stretch |
| Small image, steady memory, short sessions | Modest: correct, but not the reason to migrate |
| GPU or a session longer than 8 hours | Not this path: that is runtime instances, not the serverless microVM |

## Pitfalls

- **`platformVersion` is per runtime, and there is no auto-upgrade.** Existing runtimes keep running V1 until you change them. Roll it through one non-critical runtime first and measure, then apply it everywhere through your IaC rather than clicking through the console.
- **Regional coverage is partial.** V2 is available in **us-east-1, us-east-2, us-west-2, eu-west-1, and ap-northeast-1** at launch. Confirm your region before you design around it, the same way you would for any new AgentCore capability.
- **Elastic is not unlimited.** A session still *starts* from a small profile and grows on demand, so a workload whose instantaneous peak is genuinely large still runs into whatever ceiling you can configure. Confirm the maximum and the behavior when you hit it before you delete the memory you carefully sized. The reclaim model changes what you pay for, not necessarily how much a spike can hold at once.
- **Retune your dashboards and alarms.** The memory dimension changes meaning between V1 and V2, so a cost or utilization alarm tuned against reserved-peak billing will read wrong after the switch. Re-baseline instead of assuming continuity.
- **This is the microVM path, not runtime instances.** If you moved an agent to runtime instances for a GPU or a session past eight hours, nothing here applies. V1 and V2 are two generations of the serverless runtime.

## What to do

1. **Switch one runtime.** Set `platformVersion` to `V2` on a non-critical agent and measure cold start and billed memory for a week before you touch production.
2. **Re-derive the cost model** from observed usage, not from the reserved-peak formula you carried over from V1. Update the alarms to match.
3. **Re-examine the dependency trims** you made purely for cold start. If a fatter image is simpler to maintain, V2 gives you back that choice.
4. **Confirm region and ceiling** before you standardize, and keep the V2 region list in your deployment matrix.

The throughline is that V2 removes two constraints that used to masquerade as architectural decisions. If you read my [AgentCore runtime instances](/blog/2026-08-06-agentcore-runtime-instances.html) post, that one was about *what the agent runs on* once the serverless microVM no longer fits. This is about the serverless microVM itself getting cheaper and faster, which changes the calculus for staying on it. For the surrounding boundaries, see the [AgentCore service map](/blog/2026-08-01-agentcore-service-map-and-production-boundaries.html) and the [durable long-running jobs](/blog/2026-08-01-durable-long-running-jobs-with-agentcore.html) pattern.
