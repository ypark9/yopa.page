---
title: "A Practical Taxonomy for AI Agent Systems"
date: 2025-05-21
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2025-05-21-ai-agents-vs-agentic-ai-understanding-key-differences-2025.html"
author: Yoonsoo Park
description: "Evaluate AI systems by tools, planning horizon, autonomy, persistence, delegation, and risk instead of an unstable agent-versus-agentic-AI label."
categories:
  - Artificial Intelligence
  - Architecture
tags:
  - AI Agents
  - Multi-Agent Systems
  - AI Evaluation
  - Security
---

“AI agent” and “agentic AI” do not have one universally enforced boundary. Vendors and researchers use the terms differently. A system does not become more capable merely because it is called agentic, and a multi-agent topology is not automatically more autonomous than one agent.

For design and governance, describe observable capabilities instead of choosing between two labels.

## Six dimensions that matter

1. **Tool authority:** Can the model only retrieve information, or can it write data, send messages, deploy software, move money, or delete resources?
2. **Planning horizon:** Does it answer one turn, execute a bounded workflow, or pursue a goal across hours and resumptions?
3. **Autonomy:** Which steps require human approval? Can the system choose new goals, or only methods inside an approved goal?
4. **State and memory:** Is context limited to one request, persisted in a session, or extracted into long-term user or organizational memory?
5. **Delegation topology:** Is there one model/tool loop, a supervisor with specialists, peer-to-peer delegation, or a deterministic workflow calling models?
6. **Environment uncertainty:** Are actions applied to a sandbox, a reversible draft, or a live system with people and money?

Two systems with the same “agent” label can have completely different risk. A single agent with permission to refund customers is more consequential than five read-only agents summarizing documents.

## Choose the smallest architecture

Start with a deterministic application calling a model for a narrow transformation. Add retrieval when current or private knowledge is required. Add tools when the model must act, but expose specific operations with validated inputs rather than a general shell or database credential. Add planning only when the task cannot be represented as a known workflow.

Use multiple agents when specialization creates a measurable benefit: separate context ownership, independently evaluated skills, security boundaries, or parallel work with disjoint outputs. Do not add agents just to imitate an organization chart. Every delegation adds latency, tokens, failure modes, context loss, and another authorization decision.

For reliable business processes, a workflow engine should usually own durable state, retries, deadlines, compensation, and human approvals. A model can recommend or execute a bounded step without becoming the system of record.

## A decision record

```yaml
goal: triage incoming support cases
tools:
  - read_case
  - draft_reply
forbidden:
  - send_reply
  - change_account
planning_horizon: one_case
memory: session_only
human_gate: approve_draft
rollback: discard_draft
success_metrics:
  - routing_accuracy
  - unsafe_action_rate
  - reviewer_edit_distance
```

This description is testable. “Build an agentic support system” is not.

## Security and evaluation

Treat prompts, retrieved documents, web pages, tool output, and messages from other agents as untrusted data. Validate tool arguments server-side and authorize every action against the authenticated actor and current resource—not against text that says the user is allowed. Use least-privilege workload identity, egress controls, secret isolation, audit logs, cost/time budgets, and idempotency keys.

Evaluate each layer separately:

- model quality on representative inputs;
- retrieval recall and grounding;
- tool selection and argument validity;
- authorization denials and prompt-injection resistance;
- end-to-end task success, latency, cost, and recoverability;
- human escalation quality when confidence or policy is unclear.

Test duplicate events, partial failures, stale context, unavailable tools, malicious retrieved text, and a delegated agent returning an invalid result. A polished demo is not evidence of safe autonomy.

## Migration from label-first architecture

- Inventory every tool and classify its read/write and reversibility.
- Record planning horizon, memory scope, identity propagation, and approval points.
- Replace broad tool access with narrow typed operations.
- Move durable workflow state out of model context.
- Establish a single-agent baseline before adding delegation.
- Add evaluation cases and explicit stop budgets.
- Roll out read-only, then drafts, then narrowly approved actions.
- Review whether each extra agent improves measured outcomes enough to justify complexity.

Verified on **2026-08-01**.

## Primary sources

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- [Agent2Agent protocol specification](https://a2a-protocol.org/latest/specification/)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/)
