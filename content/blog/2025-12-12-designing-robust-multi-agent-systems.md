---
title: Designing Multi-Agent Systems Only When One Agent Is Not Enough
date: 2025-12-12
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
series: AWS re:Invent 2025
description: "Choose single-agent, supervisor, peer delegation, or deterministic workflow patterns using measurable boundaries, failure handling, security, and evaluation."
categories:
  - AI Agents
  - System Design
  - Architecture
tags:
  - AI Agents
  - Multi-Agent Systems
  - A2A
  - AI Evaluation
  - Reliability
  - Security
---

Multiple agents add coordination; they do not automatically add intelligence. Begin with one agent and a small typed tool set. Add another agent only when an explicit boundary—context, skill evaluation, security, ownership, or parallelism—improves a measured outcome.

## Four useful structures

### Single agent with tools

This is the baseline. One policy, one context owner, and one trace make failures easier to understand. It often beats a multi-agent design for short tasks and shared context.

### Supervisor and specialists

A supervisor decomposes work and delegates to specialists with narrow contracts. It is useful when specialists need distinct context or tools. The supervisor should receive structured results and evidence, not every raw page or tool trace. “Context hiding” is not deleting relevant facts; it is deliberate summarization with source references and uncertainty.

Failure modes include a weak decomposition, repeated delegation, lossy summaries, and a supervisor accepting an invalid result. Set delegation depth, time/token/tool budgets, schemas, and a fallback to human review.

### Peer-to-peer A2A

Peer agents expose capabilities and communicate through a protocol such as A2A. This fits independently owned services, but discovery, authentication, authorization, version compatibility, deadlines, and audit are platform responsibilities. Do not let a caller's text claim establish user identity.

### Deterministic workflow or DAG

When dependencies and transitions are known, a workflow engine should own them. It provides durable state, retries, timeouts, compensation, and approval. Model steps can classify, draft, or recommend within nodes. This is usually more reliable than asking an LLM to remember the workflow.

ReWOO and plan-then-execute techniques can reduce repeated observation and model calls, but a precomputed plan can become stale. Add checkpoints that revalidate assumptions before consequential actions.

## Contract for every delegation

Define objective, allowed inputs, tool authority, output schema, evidence, deadline, idempotency key, and failure behavior. A specialist should return `status`, result, sources, uncertainty, and safe retry information. Treat its output as untrusted at the next boundary.

Propagate authenticated identity separately from model content. Re-authorize tool calls at the target. Give specialists only their needed tools, and keep write operations behind human or policy gates.

## Evaluate the system, not the conversation

Create a single-agent baseline and compare:

- end-to-end task success and factual grounding;
- incorrect delegation and invalid handoff rate;
- unauthorized or unnecessary tool attempts;
- latency, token/tool cost, and retry amplification;
- recovery from timeout, duplicate message, partial result, and unavailable specialist;
- reviewer correction and escalation quality.

Run adversarial tests with prompt injection in retrieved content and agent messages. Test cyclic delegation, conflicting specialists, stale memory, budget exhaustion, and one agent returning a syntactically valid but false result.

## Operational pattern

Store durable task state outside prompts. Use correlation IDs and traces across hops, redact sensitive content, and record model/tool/config versions. Cap concurrency to protect downstream services. Make actions idempotent. Provide cancellation and a kill switch. A session that times out must be resumable from durable state or fail explicitly.

## Migration checklist

- Measure the current single-agent baseline.
- Identify the precise boundary each proposed agent owns.
- Replace free-form handoffs with versioned schemas and evidence.
- Put known sequencing in a workflow engine.
- Add hop-by-hop identity and authorization.
- Set delegation, time, cost, and tool budgets.
- Add fault injection and security evaluation.
- Remove agents that do not improve success enough to justify complexity.

Verified against the [A2A specification](https://a2a-protocol.org/latest/specification/), [MCP specification](https://modelcontextprotocol.io/specification/), and [AWS Step Functions guidance](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html) on **2026-08-01**.
