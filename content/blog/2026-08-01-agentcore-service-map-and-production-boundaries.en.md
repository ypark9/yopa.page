---
title: "Amazon Bedrock AgentCore: A Service Map for Production Boundaries"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A factual map of AgentCore Runtime, Identity, Gateway, Memory, Browser, Code Interpreter, and observability with explicit control, data, security, and cost boundaries."
categories:
  - AWS
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Security
  - Observability
  - AWS Architecture
---

Amazon Bedrock AgentCore is a collection of managed capabilities, not an “infrastructure-as-code layer” that automatically makes an agent production-ready. Each service solves a different boundary, exposes separate control- and data-plane APIs, and still requires application authorization, evaluation, cost controls, and recovery design.

## Runtime

AgentCore Runtime hosts an agent application in an isolated runtime session. It supports HTTP, MCP, and A2A protocol contracts with different required ports and paths. An invocation uses either IAM SigV4 or configured JWT authorization. Runtime lifecycle settings control idle timeout and instance maximum lifetime; durable business state must live outside the runtime.

Package a stateless application, pin dependencies and image digest, give its execution role only required AWS actions, and test the exact protocol contract. Do not assume a base image or SDK helper from a conference example remains current.

## Identity

AgentCore Identity manages workload identities and credential providers for outbound access. It can broker OAuth 2.0 or API-key credentials without embedding them in prompts or source code. Inbound runtime authentication and outbound tool authorization are different decisions. A valid user JWT does not automatically authorize a tool action, and user context propagation must be designed explicitly.

## Gateway

Gateway exposes Lambda functions, APIs, and other targets as MCP-compatible tools. Define narrow schemas, validate at the target, and authorize against the authenticated actor. Request/response interceptors can run Lambda code for transformation or custom policy, but they have limits, retries, latency, and sensitive-header handling requirements. Gateway is not a substitute for the target system's own authorization.

## Memory

Memory stores short-term events under actor/session identifiers and can asynchronously extract long-term records with configured strategies and namespace templates. Applications call event and retrieval APIs; they decide what data is appropriate to store and inject. Namespace organization helps isolation but does not replace IAM and tenant authorization. Set retention, KMS, deletion, consent, and evaluation for extracted memories.

## Browser and Code Interpreter

These tools provide managed execution environments for browsing and code. They reduce infrastructure work, not risk. Browser content is untrusted and can contain prompt injection. Code execution needs input/output limits, network policy, artifact scanning, time budgets, and a decision about which generated files can leave the sandbox.

## Observability

Use traces, logs, and metrics to connect model calls, tool decisions, gateway targets, memory operations, and user-visible outcomes. Redact prompts, tokens, credentials, and sensitive tool payloads. Track task success, unsafe-action rate, human escalation, latency, token/tool cost, retries, and recovery—not only model token counts.

## A production selection process

1. Start with the application and threat model; select only services that solve a stated requirement.
2. Draw identities and authorization at every hop.
3. Define durable state, idempotency, timeout, retry, compensation, and human gates.
4. Pin protocol, SDK, image, and model versions where supported.
5. Build negative tests for denied tools, cross-user memory, malicious content, unavailable dependencies, and budget exhaustion.
6. Deploy a read-only or draft-producing pilot, compare against a simpler baseline, then expand authority gradually.

AgentCore can reduce undifferentiated hosting and integration work, but it introduces AWS-specific services, quotas, Regions, IAM policy, and variable cost. A self-hosted runtime or ordinary service may be simpler for a narrow agent. A workflow engine is usually better for deterministic, durable business orchestration.

Before adoption, estimate steady and burst traffic, session lifetime, tool calls, memory extraction, observability volume, and idle resources. Confirm quotas and pricing in the chosen Region, then set budget alarms and load-test the failure limits.

## Migration checklist

- Remove illustrative APIs that are not present in current SDK documentation.
- Separate control-plane provisioning from data-plane invocation.
- Replace broad roles with per-component least privilege.
- Move secrets to Identity/Secrets Manager and durable state to explicit stores.
- Add retention/deletion policy for memory and logs.
- Establish service quotas, cost alarms, evaluation gates, and rollback.
- Verify each capability in the intended Region and account before claiming production support.

Verified on **2026-08-01**.

## Primary sources

- [Amazon Bedrock AgentCore documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)
- [AgentCore Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html)
- [Create an AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-create.html)
- [AgentCore Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html)
