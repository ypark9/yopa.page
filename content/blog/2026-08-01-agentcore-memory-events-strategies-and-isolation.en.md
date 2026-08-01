---
title: AgentCore Memory Events, Strategies, and Isolation
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use AgentCore Memory's current event, strategy, namespace, and IAM model without treating memory as an authorization system."
categories:
  - AWS
  - AI Agents
  - Security
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Memory
  - Multi-Tenancy
  - Security
---

Agent memory is not one database that magically remembers a user. Amazon Bedrock AgentCore Memory has a concrete model: a memory resource stores immutable short-term events, while configured strategies asynchronously derive long-term memory records. Applications must choose actor and session identifiers, namespace layouts, retention, retrieval rules, and authorization.

## The current data model

An event is a timestamped interaction associated with a `memoryId`, `actorId`, and `sessionId`. A conversation turn, tool result, or application activity can become an event. Short-term retrieval follows the actor and session. If the memory resource has strategies, those strategies process events into records for long-term retrieval.

Built-in strategies cover common needs such as semantic facts, summaries, user preferences, and episodic information. A self-managed strategy is appropriate when extraction must be deterministic, independently audited, or driven by domain logic. It lets an application extract records itself and use batch record APIs instead of inventing a nonexistent “save insight” hook.

```mermaid
flowchart LR
    App[Application] -->|CreateEvent| Events[(Events)]
    Events --> Strategy[Managed or custom strategy]
    Strategy -->|asynchronous| Records[(Memory records)]
    App -->|ListEvents| Events
    App -->|RetrieveMemoryRecords| Records
```

The write path and long-term read path have different consistency expectations. A newly created event can be read as short-term history, but derived records may not exist immediately. Design the prompt assembly path to tolerate that delay.

## Write events through the supported API

The SDK helper below follows the documented session model and keeps actor and session explicit:

```python
from bedrock_agentcore.memory import MemorySessionManager
from bedrock_agentcore.memory.constants import ConversationalMessage, MessageRole

manager = MemorySessionManager(memory_id=MEMORY_ID, region_name="us-west-2")
session = manager.create_memory_session(
    actor_id=stable_actor_id,
    session_id=conversation_id,
)
session.add_turns(messages=[
    ConversationalMessage("I prefer email updates.", MessageRole.USER),
    ConversationalMessage("I'll use email for updates.", MessageRole.ASSISTANT),
])
```

Generate `stable_actor_id` in the trusted application tier after authentication. Do not accept an arbitrary actor ID from a browser and forward it unchanged. Session IDs should be unique, opaque, and bound to the authenticated actor in application state.

Never place passwords, access tokens, payment data, or unnecessary personal data in events. Extraction can copy sensitive input into a durable record. Apply redaction before writing, define an event expiry duration, and implement deletion and subject-access workflows appropriate to the data.

## Namespace design is part of the contract

Namespaces organize records produced by each strategy. Use documented template variables rather than string concatenation inside prompts. A typical actor-scoped shape is:

```text
/strategy/{memoryStrategyId}/actor/{actorId}/
```

Include `{sessionId}` only when memories should not carry across sessions. A global namespace makes sense only for intentionally shared, non-user-specific knowledge. Changing the namespace later creates a migration problem because old and new records live under different paths; version a namespace when its meaning changes.

Namespace organization is not sufficient authorization. Enforce retrieval with IAM condition keys such as `bedrock-agentcore:namespace` or `bedrock-agentcore:namespacePath`, and constrain the memory resource ARN. The principal used by the application still needs a trusted mapping from identity to permitted namespace.

## Retrieval and prompt assembly

Retrieve only the strategies and namespace needed for the current task. Apply a small result limit, filter by relevance, label memory as untrusted context, and avoid letting recalled text override system policy. When the system must know a fact—an account balance, entitlement, or approval—read the authoritative service instead of memory.

Store provenance with application records: actor, session, event ID, strategy, namespace, creation time, and the prompt or extraction version where available. These fields make it possible to explain why a memory appeared and to remove bad records.

## Migration and evaluation

Replace custom hooks with `CreateEvent` or the SDK session helper. Map old users to stable actors and old conversations to sessions. Choose strategies and namespaces before importing anything; use self-managed batch operations for vetted legacy facts. Run imports with checkpoints and keep a reconciliation report.

Evaluate more than recall quality. Test cross-actor and cross-tenant denial, delayed extraction, deletion, poisoned instructions inside remembered text, contradictory updates, empty retrieval, and strategy changes. Measure whether relevant memories help task success without leaking information or displacing authoritative data.

## References

- [Get started with AgentCore Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-get-started.html)
- [Memory terminology](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-terminology.html)
- [Organize long-term memory with namespaces](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)
- [Self-managed memory strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-self-managed-strategies.html)

_Reviewed against official documentation on 2026-08-01._
