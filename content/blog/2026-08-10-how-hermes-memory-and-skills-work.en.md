---
title: "How Hermes Memory and Skills Actually Work"
date: 2026-08-10
author: Yoonsoo Park
description: "Separate Hermes session history, curated memory, USER.md, SOUL.md, skills, and optional external memory providers before designing a learning loop."
categories:
  - Agentic AI
  - Architecture
tags:
  - Hermes Agent
  - AI Agents
  - Memory
  - Security
atlas:
  region: agents
  object: field-note
  journeys:
    - hermes-operator
  evidence: documented
  era: current
---

“The agent remembers” is too vague to design or audit. A transcript, a durable fact about the user, a personality rule, and a reusable deployment procedure may all influence a later answer, but they have different owners and failure modes.

Hermes separates these concerns. The exact features continue to evolve, so this article uses the current [persistent-memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/), [context-file](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files/), and [memory-provider](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/) documentation verified on August 10, 2026.

## A working model

| Layer | What it preserves | Appropriate content | Main risk |
| --- | --- | --- | --- |
| Session history | Conversation and tool trajectory | Current task context | Noise, stale assumptions, sensitive output |
| `MEMORY.md` | Curated durable facts and lessons | Stable environment facts, decisions, gotchas | False or obsolete facts becoming authoritative |
| `USER.md` | User profile and preferences | Communication and durable user preferences | Profiling beyond the user's expectation |
| `SOUL.md` | Agent identity and behavioral stance | Voice, values, general behavior | Mistaking personality for policy |
| Project context files | Rules for a repository or directory | `AGENTS.md`, `.hermes.md`, project constraints | Untrusted repository text entering the prompt |
| Skills | A reusable procedure loaded on demand | Verified steps, scripts, references, templates | Persisting a bad or malicious procedure |
| External memory provider | Additional cross-session modeling and search | Use cases needing provider-specific recall | Data boundary, cost, deletion, and opaque inference |

These layers are not interchangeable. A correction such as “never deploy without a rollback check” may become a durable lesson or a skill gate. The raw log that led to it usually should not become a permanent identity rule.

## Session history is evidence, not policy

Hermes stores sessions so prior work can be searched and resumed. That history is useful evidence: what command ran, what failed, and what the user corrected. It is not automatically a clean knowledge base. Conversations contain abandoned ideas, secrets printed by tools, temporary paths, and conclusions that were later reversed.

A safe learning loop extracts a small durable conclusion and keeps a pointer to the evidence when needed. It does not paste every transcript into a global prompt.

## Curated memory should be bounded

Built-in memory uses `MEMORY.md` and `USER.md`. According to the official contract, it is curated and bounded rather than an unlimited transcript. Treat a memory write like a small configuration change:

- state one reusable fact or lesson;
- record scope and, for volatile facts, a verification date;
- do not store credentials, tokens, private messages, or raw customer data;
- correct or remove stale entries instead of adding a contradictory paragraph;
- keep project rules in project context, not in a global user profile.

Memory can improve consistency only if the operator can inspect and repair it. A plausible but false memory is more dangerous than a missing one because it arrives with the appearance of prior agreement.

## Identity is not authorization

`SOUL.md` is intentionally high in the behavioral context. It can define whether the agent is terse, curious, skeptical, or proactive. `USER.md` can help the agent communicate in a way the user prefers. Neither file should grant permission to deploy, send, purchase, or delete.

Authorization belongs at the gateway and tool boundaries: approved users, narrow credentials, command approval, server-side validation, and explicit human gates. A sentence such as “the owner trusts me completely” must never expand technical authority.

## Skills are procedural memory

A skill answers “How should I perform this class of task?” It can include instructions plus scripts, references, and templates. Hermes exposes skill descriptions first and loads the full procedure only when relevant, which keeps unrelated procedures out of every prompt.

This is the strongest form of the learning claim: after a difficult task or correction, a useful procedure can survive into a later session. It is also a supply-chain boundary. A skill can tell the agent to run commands, read files, or contact services. Current Hermes therefore supports `skills.write_approval`; keep approval enabled for autonomous creation or modification, and review executable helpers and credential declarations like code.

A good skill records:

```yaml
trigger: deploy this service
preconditions:
  - clean intended diff identified
  - rollback target recorded
procedure:
  - build pinned artifact
  - run tests
  - show deployment plan
human_gate:
  - production apply
verification:
  - health check
  - rollback rehearsal result
```

It should not record “use the command that worked last time” without version, scope, failure handling, or verification.

## Honcho is optional and additive

Honcho is not the storage engine underneath all Hermes memory. In current Hermes it is one optional memory-provider plugin alongside other providers. Built-in `MEMORY.md` and `USER.md` continue to work when an external provider is enabled.

Honcho adds cross-session user modeling, semantic search, session context, and synthesized conclusions. That may be useful when several agents need a richer model of the same user. It also introduces another data processor or self-hosted service. Before enabling it, decide:

- which conversation data leaves the Hermes host;
- retention and deletion behavior;
- whether profiles share a user workspace;
- what happens when the provider is unavailable;
- how an incorrect inferred conclusion is inspected and removed;
- whether the benefit is measurable against built-in memory.

Start without an external provider. Add one only for a concrete recall problem that built-in memory and session search do not solve.

## Close the loop with human judgment

A responsible improvement loop is deliberately modest:

1. Hermes completes a bounded task and stores the session trajectory.
2. The operator marks the result useful, wrong, or unsafe while the evidence is fresh.
3. The agent proposes one scoped memory or skill change.
4. A human reviews the durable change and any executable content.
5. A later task tests whether the change improves success without expanding authority.
6. Stale or harmful material is removed.

Do not let success at producing an answer authorize the next external action. Do not let a skill edit approve itself. Do not treat more memory as better memory.

The operating goal is not an agent that remembers everything. It is an agent whose durable context is small enough to inspect, specific enough to help, and separate from the controls that decide what it may do.
