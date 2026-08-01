---
title: "Zero-Trust Agent Systems on AWS"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Design hop-by-hop identity, user delegation, authorization, private connectivity, audit, and recovery for consequential agent workloads on AWS."
categories:
  - AWS
  - Security
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Zero Trust
  - Security
  - AWS PrivateLink
  - AWS IAM
---

An agent calling another agent is a distributed-system request, not an implicit continuation of user trust. Each hop needs an authenticated workload, an explicit representation of user delegation where required, authorization at the resource, and an auditable decision.

This is especially important in finance, healthcare, and other consequential systems, but compliance labels do not determine the architecture by themselves. Build from the actual data, action, threat, and regulatory requirements.

## Separate the identities

There are at least three principals:

- the **end user** requesting an outcome;
- the **agent workload** executing code;
- the **target tool/service** enforcing access.

AgentCore Runtime supports IAM SigV4 inbound authentication or configured JWT authorization. Those are modes, not two headers that every call automatically combines. AgentCore Identity workload identities can broker outbound credentials. If downstream authorization needs the user's authority, propagate a verifiable, audience-restricted delegation token or a trusted user identifier through a documented flow. Never trust `tenantId: Alice` inside model-generated JSON.

At every tool call, authorize the workload and, where applicable, the delegated user against the specific action and resource. Keep the target service's authorization even when Gateway or an interceptor performs an earlier policy check. This is defense in depth and prevents a routing mistake from becoming a data breach.

## Minimize authority

Expose `get_account_balance(account_id)` rather than database credentials or arbitrary SQL. Validate that the account belongs to the authorized subject. Use separate read and write tools, transaction limits, idempotency keys, and human approval for irreversible or regulated actions. A supervisor agent should not pass its broader execution role to a specialist.

Use per-component IAM roles and constrain trust policies. Protect OAuth/API-key credentials in AgentCore Identity or an approved secret system; never place them in prompts or memory. Rotate and revoke credentials independently of model deployment.

## Network boundaries

AWS PrivateLink interface endpoints provide private connectivity from a VPC to supported AgentCore service APIs. VPC configuration can also let Runtime and tools reach private resources, with VPC Lattice used for supported connectivity patterns. This does not mean AgentCore's managed control plane and every component “run inside your VPC.” Document inbound endpoint traffic, Runtime/tool egress, DNS, security groups, NAT, and third-party destinations separately.

A private path does not authorize a request. Keep TLS, IAM/JWT checks, application authorization, and data-level controls. Browser tools that need the public internet require an approved egress path and stronger content isolation.

## Memory and data

Scope AgentCore Memory by actor and session and design long-term namespaces, but enforce tenant access in application/IAM policy as supported. Classify what may enter prompts, traces, raw events, extracted memories, and tool logs. Define retention, deletion, legal hold, encryption keys, residency, and redaction. Test that one tenant cannot retrieve another tenant's records even with guessed identifiers.

## Threats and evaluation

Include prompt injection, confused deputy, excessive agency, token replay, cross-tenant identifiers, malicious tool output, data exfiltration, duplicate financial action, unavailable policy service, and compromised agent in the threat model.

Negative tests should prove:

- invalid/expired/audience-mismatched tokens fail;
- an allowed workload cannot exceed the delegated user's scope;
- read-only agents cannot reach write tools;
- repeated requests produce one business effect;
- interceptor/policy failure closes access;
- private endpoints do not create unintended public egress;
- logs and traces contain no secrets or prohibited financial data.

## Rollout and response

Start read-only with synthetic data, then draft actions, then human-approved low-value actions. Define per-user and per-agent budgets, rate limits, anomaly alarms, and a kill switch that disables tool authority without waiting for a model redeploy. Preserve immutable audit records linking user, workload, policy decision, tool, request ID, and result.

## Migration checklist

- Replace “automatic identity propagation” assumptions with a sequence diagram of real tokens and validators.
- Select SigV4 or JWT inbound auth per caller and document outbound credential exchange.
- Add target-side authorization and narrow tools.
- Map PrivateLink inbound, VPC egress, Lattice, NAT, and public dependencies accurately.
- Add cross-tenant, replay, idempotency, and fail-closed tests.
- Define retention, incident revocation, rollback, and human approval.

Verified on **2026-08-01**.

## Primary sources

- [AgentCore inbound and outbound authentication](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-oauth.html)
- [AgentCore Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html)
- [AgentCore VPC and PrivateLink](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html)
- [NIST Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
