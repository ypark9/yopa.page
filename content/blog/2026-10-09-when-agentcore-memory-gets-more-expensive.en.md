---
title: "AgentCore Memory's New Pricing Is Cheaper Until Your Agent Rereads Its History"
date: 2026-10-09T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore short-term memory moved from per-event to per-GB pricing on October 6. I modeled when the new price is cheaper and when it gets more expensive than the old one."
categories:
  - AI Agents
  - AWS
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Memory
  - Cost Optimization
  - Pricing
---

On October 2, my AWS account received a Health notice. Amazon Bedrock AgentCore short-term memory was changing its pricing. The old rate was a flat **$0.25 per 1,000 new events**. Starting **October 6, 2026**, it bills three things separately:

| Dimension | New price | How size is counted |
|---|---|---|
| Ingestion | $1.00 per GB | Each event clamped to 12 KB min, 64 KB max |
| Retrieval | $0.20 per GB | Each event clamped to 12 KB min, 64 KB max |
| Storage | $0.10 per GB-month | Actual size, prorated hourly over the event's TTL |

AWS says more than 95% of customers will pay less. It also names the exceptions: large payloads, extended TTL, and frequent retrieval. Credits cover any increase through December 31, 2026.

"Frequent retrieval" was the part I could not size from the notice. So my question was:

**At what point does my agent's memory pattern make the new price more expensive than the old one?**

## Short answer

For small events that are read once, the new pricing costs about **5% of the old price**. That matches the AWS claim.

The risk is one common pattern: **reloading the full conversation history on every turn**. That makes retrieval grow quadratically with session length. Under my assumptions:

- With events of 12 KB or less, full-history reload passes the old price at about **200 turns**.
- With 64 KB events (tool output, documents, screenshots as text), it passes the old price at **30 turns**.
- Reading only the last 10 events, or not reading back at all, **never** crossed the old price in my sweep.
- Very large events (256 KB) kept for **365 days** cost more than the old price even if they are never read back. That is storage alone.

This is a cost model, not a bill. I did not call AgentCore, because measuring real traffic would itself be billed. The code and raw output are in [yopa-experiments](https://github.com/ypark9/yopa-experiments/tree/experiment/when-agentcore-memory-gets-more-expensive-20261009/2026-10-09-when-agentcore-memory-gets-more-expensive).

## Setup

I wrote a small Python model (`model.py`, standard library only, no AWS calls). It does three things:

1. **Reproduces the AWS pricing example** as a sanity check. The example is 100,000 events of 3 KB, each read once, with a 30-day TTL.
2. **Computes per-event unit costs** at different event sizes, using the 12 KB / 64 KB clamp.
3. **Sweeps a session** across event size (1, 12, 64, 256 KB), TTL (7, 30, 90, 365 days), events per turn (2 and 4), and read pattern. It then finds the turn count where the new price passes the old one.

The read patterns:

| Pattern | What the agent does each turn |
|---|---|
| `full_history` | Lists every prior event in the session |
| `last_40` | Lists the most recent 40 events |
| `last_10` | Lists the most recent 10 events |
| `no_readback` | Writes events, never lists them in-session |

Assumptions I could not verify from the pricing page are listed under [Limits](#limits).

## Results

### 1. The AWS example reproduces

| Line item | AWS example | My model |
|---|---|---|
| Ingestion | $1.20 | $1.2000 |
| Retrieval | $0.24 | $0.2400 |
| Storage | $0.03 | $0.0296 (730-hour month) |

The storage line only matches if units are decimal (1 GB = 10^9 bytes). I used decimal units everywhere. The $0.0004 gap comes from hourly proration over 720 hours against a 730-hour month. If you bill 30 days as one full month, you get exactly $0.03.

### 2. Per-event unit costs

| Event size | Old (per event) | New ingestion | New retrieval (each read) |
|---|---|---|---|
| ≤ 12 KB | $0.00025 | $0.000012 | $0.0000024 |
| 64 KB+ | $0.00025 | $0.000064 | $0.0000128 |

Writing a small event is about 20x cheaper than before. Writing a large one is still about 4x cheaper. The new cost is in reading. Every read is billed again, while the old price included reads.

### 3. Where the new price passes the old one

30-day TTL, 2 events per turn (user message plus agent response):

| Event size | `full_history` | `last_40` | `last_10` | `no_readback` |
|---|---|---|---|---|
| 1 KB | 200 turns | never | never | never |
| 12 KB | 199 turns | never | never | never |
| 64 KB | **30 turns** | 36 turns | never | never |
| 256 KB | **27 turns** | 29 turns | never | never |

At 4 events per turn, the `full_history` crossovers stayed the same: 200, 199, 30 and 27 turns. `last_40` never crossed.

"Never" means "not within the sweep range." It does not mean "cannot happen."

### 4. A 50-turn session, side by side

30-day TTL, 2 events per turn, 100 events in total. The old price for this session is $0.025.

| Event size | `full_history` | `last_40` | `last_10` | `no_readback` |
|---|---|---|---|---|
| 12 KB | $0.00720 | — | $0.00245 | $0.00132 |
| 64 KB | **$0.03839** | $0.02726 | $0.01305 | $0.00703 |

At 64 KB, full-history reload costs **1.5x the old price** after 50 turns. Reading the last 10 events costs about half the old price. Not reading back costs about a quarter.

The full-history case makes 2,450 event retrievals in a 50-turn session. Turn N reads all 2(N-1) prior events, so total reads grow as N². That is where the cost comes from.

### 5. TTL alone can do it for very large events

Write-only, no readback. The ratio is new cost divided by old cost:

| Event size | 7d | 30d | 90d | 365d |
|---|---|---|---|---|
| 1 KB | 0.048 | 0.048 | 0.049 | 0.053 |
| 12 KB | 0.049 | 0.053 | 0.062 | 0.106 |
| 64 KB | 0.262 | 0.281 | 0.332 | 0.563 |
| 256 KB | 0.280 | 0.357 | 0.559 | **1.485** |

Storage uses actual size, not the 64 KB cap. A 256 KB event kept for a year costs about 1.5x the old flat price. **TTL cannot be changed after the event is created**, so you choose this when you write the event.

## Why

The old price charged **per write**. Reads were free, and event size did not matter. The new price charges **per byte, per read, per hour kept**.

That changes which design is cheap:

- **Before:** Many small events were the expensive pattern. Reloading full history cost nothing extra.
- **After:** Small events are almost free. Rereading large events every turn is the expensive pattern.

The 12 KB minimum adds one more effect. Four 3 KB events are billed as 48 KB for ingestion and for every retrieval. One 12 KB event with the same content is billed as 12 KB. That is plain arithmetic from the clamp, and I did not test it against a real bill. If your agent writes many tiny events and rereads them, batching them up to about 12 KB cuts both lines by up to 4x.

## Pros and cons of the new pricing

**Pros**

- Typical chat traffic gets much cheaper: about 5% of the old price for small, read-once events.
- Event size now matters, so cost follows the actual workload.
- Credits cover increases through 2026-12-31, which gives time to change read patterns.

**Cons**

- Cost now depends on retrieval behavior. That is code, so the same feature can cost very different amounts depending on how the agent loads context.
- Full-history reload grows quadratically and can pass the old price within a normal session at large event sizes.
- TTL is fixed at write time. A long TTL chosen today for large events will still be billed after you change your mind.

## Limits

What I did not verify, and what this model does not cover:

- **Retrieval billing granularity.** I assumed retrieval is billed per event returned, with the same 12 KB / 64 KB clamp. The pricing page clamps "per event," but I did not confirm how list and paginate calls are metered.
- **Decimal units.** I used 1 GB = 10^9 bytes because that is the only way the AWS example's storage line comes out to $0.03.
- **No real event sizes.** I did not measure my own event sizes on AWS. That would itself make billed calls, and this run had a zero-cost boundary.
- **Not modeled:** long-term memory (extraction and records), the storage exemption for events created before October 6, and the credits.
- **Model, not invoice.** These numbers come from published rates and my assumptions, not from a Cost Explorer line.

## What to do

1. **Find out how your agent loads context.** If it lists every prior event each turn, that is the pattern to change first.
2. **Cap readback.** Use a last-K window (K = 10 stayed below the old price in every case I swept) or switch to summaries in long-term memory.
3. **Keep large payloads out of short-term events.** Store tool output and documents in S3 and write a reference instead.
4. **Pick TTL deliberately for large events.** You can't change it after the write.
5. **Batch tiny events** toward 12 KB if you reread them.
6. **Check the bill before the credits end.** Look at AgentCore Memory usage types in Cost Explorer before December 31, 2026, when they stop masking an increase.

## Related posts

- [AgentCore Memory Events, Strategies, and Isolation](/blog/2026-08-01-agentcore-memory-events-strategies-and-isolation.html)
- [AgentCore Runtime V2: Elastic Memory, Flat Cold Start, and What Changes in Your Design](/blog/2026-09-21-agentcore-runtime-v2-elastic-memory.html)
- [Tokenomics on AWS: Attribution Grain, Optimization Levers, and Where Enforcement Belongs](/blog/2026-09-23-tokenomics-on-aws-attribution-decisions.html)
- [Personal AWS Cost Guardrails: Budget Alerts, Auto-Stop, and Anomaly Detection on a Hobby Account](/blog/2026-03-30-personal-aws-cost-guardrails.html)

## References

- [Amazon Bedrock AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/)
- AWS Health notice for AgentCore short-term memory pricing changes, received October 2, 2026
- [Experiment code and raw output (yopa-experiments)](https://github.com/ypark9/yopa-experiments/tree/experiment/when-agentcore-memory-gets-more-expensive-20261009/2026-10-09-when-agentcore-memory-gets-more-expensive)
