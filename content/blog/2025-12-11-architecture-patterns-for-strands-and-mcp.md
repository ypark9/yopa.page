---
title: Architecture Patterns for Strands and MCP (AWS re:Invent 2025)
date: 2025-12-11
author: Yoonsoo Park
description: "A definitive guide to the Strands framework, Model Context Protocol (MCP), and Agent-to-Agent (A2A) communication."
categories:
  - Architecture
  - AI Protocols
  - Integration
tags:
  - Strands
  - MCP
  - A2A
---

In the "Agentic Era," software architecture is defined by three components:
1.  **Strands:** The Brain (Orchestration).
2.  **MCP:** The Hands (Vertical Integration).
3.  **A2A:** The Voice (Horizontal Collaboration).

This guide explains when to use which protocol and how to implement them.

## The Mental Model: MCP vs. A2A

The most common question is: "Why do we need two protocols?"

| Feature | MCP (Model Context Protocol) | A2A (Agent-to-Agent) |
| :--- | :--- | :--- |
| **Direction** | Vertical (Agent $\to$ Data) | Horizontal (Agent $\leftrightarrow$ Agent) |
| **Relationship** | Master/Slave | Peer-to-Peer |
| **Transport** | JSON-RPC (Local/SSE) | JSON-RPC 2.0 (HTTP/Cloud 9000) |
| **State** | Stateless | Stateful (Tasks) |
| **Best For** | Database access, API calls | Delegation, Negotiation |

**The Rule of Thumb:** Use MCP for *deterministic* tools (reading a file). Use A2A for *probabilistic* work (asking another agent to "review this plan").

## Implementation: The Matryoshka Pattern

A production agent is often a "Strands Agent" wrapped in an "A2A Server," consuming "MCP Clients."

```python
# 1. Define the Core Agent (Strands)
from strands import Agent
from strands_tools.calculator import calculator

strands_agent = Agent(
    model="anthropic.claude-3-5-sonnet-v2:0",
    tools=[calculator] # MCP Tools
)

# 2. Wrap in A2A Server (Horizontal)
from strands.multiagent.a2a import A2AServer

a2a_server = A2AServer(
    agent=strands_agent,
    name="Finance Agent",
    port=9000
)

# 3. Serve
a2a_server.serve()
```

## Discovery: The Agent Card

A2A agents don't use hardcoded IP addresses. They use **Semantic Discovery**. Every agent publishes an `agent-card.json`.

```json
{
  "name": "TravelAgent",
  "description": "I can book flights and hotels.",
  "capabilities": ["book_flight", "check_visa"],
  "auth": {
    "type": "oauth2",
    "scopes": ["travel:write"]
  }
}
```

When a user asks "I need a flight," the Orchestrator scans the network for agents with "travel" capabilities, reads their cards, and routes the task dynamically.

## Security: Zero Trust Mesh

In a multi-agent system, we use **Identity Propagation**.

When Agent A calls Agent B, it passes the original user's specific context (e.g., `User: Alice`). This ensures that even if Agent B has admin access to a database, it enforces permissions *as if* Alice were querying it directly.

## Conclusion

Stop building monolithic agents. Build a **Composable Cognitive Enterprise** by using MCP for your data layer and A2A for your collaboration layer.

**References:**
*   [Model Context Protocol](https://modelcontextprotocol.io)
