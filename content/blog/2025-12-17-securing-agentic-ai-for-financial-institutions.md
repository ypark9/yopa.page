---
title: Securing Agentic AI for Financial Institutions
date: 2025-12-17
maintenance_status: archived
reviewed_at: 2026-08-01
archive_reason: "The article overstates automatic user-token propagation, combines SigV4 and OAuth as if both always apply, and describes PrivateLink as placing the entire service mesh inside the customer VPC."
replacement_url_en: "/blog/2026-08-01-zero-trust-agent-systems-on-aws.html"
replacement_url_ko: "/ko/blog/2026-08-01-zero-trust-agent-systems-on-aws.html"
author: Yoonsoo Park
series: AWS re:Invent 2025
description: "A security architecture guide for banking and finance. Covers Zero Trust, AWS SigV4, and PrivateLink for multi-agent systems."
categories:
  - Security
  - Finance
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Zero Trust
  - Security
  - AWS PrivateLink
  - AWS IAM
---

For a bank, an AI agent isn't just a chatbot; it's a potential attack vector. If "Agent A" (Customer Support) calls "Agent B" (Transaction Handler), how do we trust that call?

We implement a **Zero Trust Mesh** using **AgentCore Identity**.

## 1. Identity Propagation

In a monolithic app, you check the user's ID once at the front door. In a multi-agent mesh, that ID must travel with every hop.

**The Solution:** AgentCore automatically propagates the `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` and the User's OIDC token.

*   **Hop 1:** User -> Support Agent (Auth: User JWT)
*   **Hop 2:** Support Agent -> Transaction Agent (Auth: User JWT + Agent SigV4)

This allows the Transaction Agent to enforce **Row-Level Security** (RLS). It knows that even though the "Support Agent" is calling, the *actual user* is "Alice," so it only returns Alice's data.

## 2. Inbound Auth: AWS SigV4

Every agent-to-agent call is signed using **AWS Signature Version 4 (SigV4)**. This provides cryptographic proof of the *caller's* identity (the AWS IAM Role of the calling agent).

```mermaid
sequenceDiagram
    participant User
    participant AgentA as Support Agent
    participant AgentB as Bank DB Agent
    
    User->>AgentA: "Check my balance"
    Note right of User: Auth: OAuth Token (Alice)
    
    AgentA->>AgentB: Request Balance
    Note right of AgentA: Auth Header 1: SigV4 (Agent A Role)<br/>Auth Header 2: OAuth (Alice)
    
    AgentB->>AgentB: Verify SigV4 (Is this really Agent A?)
    AgentB->>AgentB: Verify OAuth (Is Alice allowed?)
    AgentB-->>AgentA: $5,000
```

## 3. Network Isolation (PrivateLink)

For financial compliance (SOC2, PCI-DSS), traffic must never traverse the public internet.

AgentCore Runtime supports **AWS PrivateLink**. The entire mesh—Agents, Gateway, and Memory—runs inside your **Virtual Private Cloud (VPC)**.

## Conclusion

Security cannot be an afterthought. By utilizing Identity Propagation and PrivateLink, financial institutions can deploy autonomous agents that are as secure as their existing microservices.
