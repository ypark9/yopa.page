---
title: "TOLAP: Enforcing Data-Object Policy at the Source, and the Four Layers That Cannot Do It"
date: 2026-09-23T09:00:00-04:00
author: Yoonsoo Park
description: "AWS open-sourced TOLAP, an object-level access control protocol for AI agent tools that enforces column, row, field, and result-limit policy where the data originates. Here is why RBAC, ABAC, database row-level security, and content guardrails each miss the same gap, what the resolve-sign-enforce pattern buys you, and the limitations the project documents itself."
categories:
  - AWS
  - Security
tags:
  - ai-agents
  - access-control
  - authorization
  - security
  - zero-trust
---

An agent answers a question about a patient population. To do it, it calls a tool, and the tool queries a clinical database. IAM said the agent may invoke the tool. OAuth scopes checked out. The gateway logged the call. Every authorization decision in the path was correct, and none of them decided **which rows and which columns this user should see through this call**.

That is the gap AWS is addressing with TOLAP (Tool-Object Level Access Protocol), now open source under Apache-2.0 at [github.com/awslabs/tolap](https://github.com/awslabs/tolap): a versioned policy schema, enforcement SDKs for .NET, Python, and TypeScript, a reference policy server, and fourteen worked integrations with agent frameworks. This post is about the architectural claim underneath it, because that claim is the part worth arguing with.

## Why the layers you already run do not close it

The instinct is to reuse an access-control model you already trust. AWS's own explanation of why each one fails is the most useful part of the announcement, and it is worth restating in decision form.

| Layer | The question it answers | Why it misses this gap |
|-------|------------------------|------------------------|
| Role-based access control | Can this user reach this resource? | No vocabulary for which columns of the resource are visible, or which rows to filter |
| Attribute-based access control | Does policy permit this request? | Evaluates at a central engine; a tool holding a direct database connection composes a query that never passes through it |
| Database row-level security | Which rows of this table? | Genuine source enforcement, but confined to databases, while agents also read REST APIs, vector stores, and object storage |
| Content guardrails | What did the model say? | Operate on output, after the unrestricted data is already in the context window |

That last row is the one that gets misread as coverage, and it is the sharpest argument in the post. Guardrails constrain what the model *says*. By the time they run, the data is already in the context window, and data in the context window is available to summarization, reasoning, follow-up questions, and extraction through a prompt injection. Redacting a field from one response does not remove it from the conversation the model is holding. If your data-object policy is a guardrail, your enforcement point sits after the leak.

## Three principles

TOLAP's design reduces to three claims.

**Source-point enforcement.** Policy is applied where the data originates, not in a layer above it. The tool wraps the data source and enforces before anything crosses the boundary. There is no path to the data that skips enforcement, because the wrapper *is* the path.

**Object granularity.** Policies name individual data objects: columns, rows, fields, tags, endpoints, HTTP methods, similarity thresholds, storage prefixes, result limits. One policy can say this user may query the patients table, may not see the SSN column, sees only rows from assigned regions, and receives the email field as a hash.

**Agent transparency.** The calling agent needs no security-aware code. Restricted data simply does not appear in what it receives. AWS frames this as the reason the defense holds under prompt injection: it is architectural rather than behavioral, so there is nothing in context to extract.

That third principle is the real test of whether a control is a control. If your enforcement depends on the model obeying an instruction, it is a behavioral control, and behavioral controls degrade exactly when an adversary is talking to your agent.

## What a policy does

A healthcare analyst policy that allows the patients, encounters, and diagnoses tables while hiding the internal billing and audit tables, hiding SSN and date of birth outright, returning email as a hash and the name with only its first character, restricting rows to two named regions, and capping any result set. What the agent receives is a table with no SSN column in it at all, a name reading `J*********`, a hash where the email was, and rows from only the permitted regions. A query against the billing table is refused before it reaches the database.

When several policies apply to one user they merge **most-restrictive-wins**: allowed sets intersect, denied sets union, booleans AND, numeric limits resolve to the stricter value, and where two policies mask the same field differently the more restrictive mask wins. The practical consequence is worth stating plainly, because it inverts the usual intuition about granting access: **adding a policy to someone can only ever reduce what they can see, never expand it.**

## The mechanism: resolve, sign, enforce

The pattern has three steps, and the middle one is what makes it more than a filter function.

1. **Resolve** a policy for a user against a data source, merging every assignment that user holds into one effective policy.
2. **Sign** it, producing a tamper-evident, time-bound envelope.
3. **Enforce** it on every tool call.

Because the signature covers a canonical form of the whole envelope, including the identifier of the source it was issued for and its expiry, a context cannot be edited, cannot have its lifetime extended without the signing key, and cannot be replayed against a different data source. It also verifies across languages: a context signed by one SDK verifies in the other two. That cross-language property is pinned by shared test fixtures rather than three independent readings of a spec, which is the right call for a security boundary.

One design detail is easy to skim past and worth keeping: for SQL sources, the .NET SDK can push row filters into a `WHERE` clause and the limit into a `LIMIT`, so the database returns less data. AWS is explicit that this is a **resource optimization, not the enforcement boundary**. The post-execution pass still runs, because field masking, hash transformations, and complex filters cannot be reliably expressed in portable SQL. If you take one implementation lesson from the post, it is that one: optimization and enforcement can share a computation, but they must not be the same line of code.

## Purpose-binding and delegation chains

Object-level enforcement answers which data an agent may see. It does not answer why this agent is accessing this data right now, and on whose authority. The additions that close that gap are the interesting part of the release.

**Purpose-binding** adds a declared purpose to the security context. Assignments carry a `purposeProfile` tag, and resolution includes a purpose-tagged policy only if the declared purpose matches. The obvious objection is that a stated purpose is not a trustworthy signal, and AWS's answer reframes it usefully: purpose is not a trust claim, it is a constraint selector. An administrator defines a set of purpose profiles, each mapping to a specific locked-down policy. The agent picks from that menu. If it selects "campaign-overlap" while actually wanting billing data, it gets campaign-overlap's constraints, which do not include billing tables. The lie is self-defeating because purpose determines what you *can* do, not what you *say* you are doing.

**Delegation chains** carry the authority path from human to agent: an ordered list of hops, each recording a principal identifier, a principal type (user, agent, or service), an optional declared purpose, and optional scope-narrowing. Each hop may only narrow scope, never widen it, enforced with glob matching. This addresses a specific frustration with IAM-based systems, and it is one I have hit repeatedly: when an agent calls a tool, the service sees a single IAM principal, usually a service role, and the delegation path that produced it is invisible. A human delegated to an orchestrator, which delegated to an agent, which delegated to a sub-agent, and the access decision is evaluated against the terminal identity only.

**Action validation** adds a deterministic check against the purpose's allowed and prohibited actions, independent of the object-level pass and running after it. The three additions compose: resolution-time purpose filtering decides which policy applies, action validation confirms the call is in scope, delegation validation confirms the path is legitimate and narrowing, and object-level enforcement hides the columns and rows.

The **optional LLM judge** handles semantic drift within an allowed scope: queries that individually comply but collectively form a re-identification pattern. Two deliberate design decisions make it defensible. It is **layer two, not layer one**, so it only sees queries that already passed deterministic checks and an agent cannot talk its way past a column restriction. And the **judge prompt is admin-controlled**: the agent never sees it and cannot influence it. It is off by default.

## Limitations the project documents itself

The announcement's known-limitations section is unusually honest, and these are the constraints that decide whether TOLAP fits you.

- **Enforcement only applies where the wrapper is used.** Direct database access bypasses it entirely. TOLAP cannot protect a path it does not sit on, which means adoption is all-or-nothing per data source, and a single un-wrapped connection is a hole.
- **Signed contexts are replay-bounded, not replay-proof.** The expiry is inside the signature and cannot be extended, but without the optional replay guard a valid context is replayable until it expires. Keep the lifetime short, and treat that as a requirement rather than a default.
- **Hash masking prevents rainbow-table attacks only with a configured salt.** Without one, the same input produces the same hash in every installation. Keyed hashing (HMAC) is the stronger option but requires the signing key to verify correctness.
- **The LLM judge is non-deterministic by nature.** The same query can receive different alignment scores across evaluations. AWS says directly that this is appropriate for an advisory layer and inappropriate for a compliance gate. That is the correct framing, and it should survive contact with your security review.
- **You are adding a component to the data path.** A policy server, a store, and enforcement in each tool. The core SDKs have zero external dependencies in all three languages specifically because that code has to be embeddable in a Lambda, an edge worker, or a plugin without dragging a dependency tree into the security path.

## Where this fits against what you already have

If you already enforce at the gateway, TOLAP does not replace it, and the layering is the point:

| Concern | Enforced today by | TOLAP's layer |
|---------|-------------------|---------------|
| May the agent invoke the tool? | Agent framework, IAM, OAuth scopes | Unchanged; TOLAP assumes this passed |
| May it call this endpoint with this method? | Gateway policy, action validation | Action validation |
| Which columns and rows come back? | Often unenforced | Object enforcement at the source |
| Under whose authority, and for what purpose? | Usually invisible | Delegation chain and purpose-binding |
| Is the model's output safe? | Content guardrails | Out of scope, and deliberately after the fact |

## What to do

Three questions the post ends with are worth taking to your own architecture, and they are the reason I would keep this on the reading list even if I never adopt the SDK:

1. Where does data-object policy enforcement live today, and if the answer is the gateway or the prompt, what stops a query the application never anticipated?
2. Would your enforcement hold under prompt injection if the tool received unfiltered data?
3. When an autonomous agent accesses data on behalf of a user, does anyone record why and on whose authority, and could the agent drift from that purpose without detection?

This is the same boundary-setting instinct as designing [zero-trust agent systems](/blog/2026-08-01-zero-trust-agent-systems-on-aws.html), pushed one layer closer to the data. Identity and authorization decide whether the call is allowed. Whether the *data* that comes back was ever permitted is a separate question, and until recently it was usually nobody's explicit job.

## References

- [Introducing TOLAP: object-level access control for AI agent tools](https://aws.amazon.com/blogs/opensource/introducing-tolap-object-level-access-control-for-ai-agent-tools/) (AWS Open Source Blog)
- [github.com/awslabs/tolap](https://github.com/awslabs/tolap) (Apache-2.0)
