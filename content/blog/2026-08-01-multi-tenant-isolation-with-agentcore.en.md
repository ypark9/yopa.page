---
title: Multi-Tenant Isolation with Amazon Bedrock AgentCore
date: 2025-12-13
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2025-12-13-implementing-multi-tenancy-with-agentcore.html"
author: Yoonsoo Park
description: "Build defense-in-depth tenant isolation across identity, Runtime sessions, Memory namespaces, tools, data stores, logs, and evaluation."
categories:
  - AWS
  - Security
  - SaaS
tags:
  - Amazon Bedrock AgentCore
  - Multi-Tenancy
  - Security
  - AWS IAM
  - AI Agents
---

Multi-tenant agents add a dangerous ambiguity: the model can talk about a tenant, but only trusted application code can establish which tenant the caller belongs to. Amazon Bedrock AgentCore provides useful isolation primitives, yet none replaces an end-to-end tenant authorization design.

Start by separating four identities: the authenticated human or workload, the tenant, the AgentCore runtime session, and the AWS execution role. They may be related, but they are not interchangeable. In particular, a runtime session ID isolates runtime state; it is not proof of tenant membership.

## Establish tenant context before the model

Authenticate at the edge. Resolve tenant membership from a trusted directory or entitlement service. Construct server-side request context and reject any tenant identifier supplied only by the prompt or browser.

```json
{
  "principalId": "user-7c91",
  "tenantId": "tenant-42",
  "roles": ["case-reader"],
  "requestId": "req-a813"
}
```

Sign or integrity-protect this context between services and validate audience, issuer, expiry, and tenant membership at every trust boundary. Do not ask the model whether a request is allowed. The model can help interpret intent; a deterministic policy layer must authorize the resulting operation.

## Choose the isolation tier deliberately

A pooled runtime is efficient, while dedicated resources reduce blast radius. Use pooled compute with strong logical controls for lower-risk workloads. Consider separate runtime, memory, KMS key, network path, or AWS account for regulated data or tenants requiring hard isolation. Document which components are pooled and which are siloed.

AgentCore Runtime creates isolated session execution environments. Still, never cache tenant data in process-global variables, reuse temporary files across sessions, or derive a tenant from previous conversation content. Keep each invocation and tool request bound to validated server context.

## Make memory isolation enforceable

AgentCore Memory events are organized by `actorId` and `sessionId`; long-term records use configured namespaces. Use opaque actor IDs mapped server-side to tenant and user. A useful namespace includes the strategy and trusted tenant/actor scope, for example:

```text
/tenant/tenant-42/strategy/{memoryStrategyId}/actor/user-7c91/
```

Organization alone is not access control. Restrict the specific memory ARN and permitted namespace with documented IAM condition keys such as `bedrock-agentcore:namespace` and `bedrock-agentcore:namespacePath`. If one shared execution role can calculate any tenant path, IAM alone may not prevent confused-deputy bugs; add a policy decision point or assume tenant-scoped roles with session tags from a trusted broker.

Avoid placing raw tenant IDs in logs or URLs when opaque identifiers work. Define deletion, export, and retention by tenant and actor before enabling long-term strategies.

## Authorize every tool and data query

An MCP or A2A boundary does not make a tool tenant-aware. Pass trusted context out of band from model arguments. At the tool service, derive the permitted tenant and add it to every storage query. Prefer database row-level security or partition keys plus authorization over a prompt instruction such as “only access this tenant.”

For writes, validate resource ownership, action, amount, and state. Use idempotency keys and require step-up approval for consequential actions. Downstream credentials should be short-lived and least-privileged. Do not forward the caller’s bearer token to an arbitrary agent selected from an Agent Card.

## Observe without leaking

Include request, tenant, actor, session, tool, policy decision, and trace identifiers in structured audit records, but keep prompts and tool payloads out of general logs by default. Encrypt tenant artifacts, use tenant-aware metric dimensions only where cardinality and privacy allow, and alert on cross-tenant denials. Log policy inputs and outcomes so an investigation does not depend on model prose.

## Migration and isolation testing

Before pooling an existing single-tenant agent, inventory every state location: runtime memory, AgentCore Memory, caches, object prefixes, vector indexes, database rows, queues, traces, and analytics exports. Add tenant keys and authorization first, backfill data with reconciliation, then enable pooled traffic gradually.

Build a two-tenant adversarial suite. Reuse session IDs, swap actor IDs, forge context, request another tenant’s object through a tool, inject identifiers through retrieved documents, retry old requests, and inspect logs and caches. Test both allowed and denied cases. Run canaries that place unique markers in each tenant and continuously verify that search, memory retrieval, tools, exports, and deletion never cross the boundary.

## References

- [AgentCore Runtime overview and session isolation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [Organize AgentCore long-term memory with namespaces](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)
- [IAM session tags](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)
- [SaaS Tenant Isolation Strategies whitepaper](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/saas-tenant-isolation-strategies.html)

_Reviewed against official documentation on 2026-08-01._
