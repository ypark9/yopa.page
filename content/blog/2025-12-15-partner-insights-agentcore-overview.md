---
title: (AWS re:invent 2025) AgentCore Overview
date: 2025-12-15
author: Yoonsoo Park
description: "A comprehensive overview of the AgentCore ecosystem: Runtime, Identity, Gateway, Memory, and Observability."
categories:
  - AWS
  - Enterprise Architecture
  - AgentCore
tags:
  - Bedrock AgentCore
  - Observability
  - Security
---

AWS Bedrock AgentCore is the "Infrastructure-as-Code" layer for AI agents. It wraps your raw python code with enterprise-grade security and scaling.

This guide summarizes the key components: Runtime, Identity, Gateway, and Observability.

## 1. Agent Runtime (Serverless Hosting)

You can turn any Python script into a scalable microservice with just 4 lines of configuration.

```python
from bedrock_agentcore_starter_toolkit import Runtime

# Auto-configure IAM, ECR, and API Gateway
response = agentcore_runtime.configure(
    entrypoint="app.py",
    auto_create_execution_role=True,
    auto_create_ecr=True
)
```

## 2. Identity & Security

Security is handled via decorators. Never hardcode API keys.

### Outbound Security (API Keys)

Use the credential provider to inject keys only when needed.

```python
@requires_api_key(provider_name="openai-apikey-provider")
async def call_openai(*, api_key: str):
    # The key is injected safely at runtime
    client = OpenAI(api_key=api_key)
```

## 3. AgentCore Gateway (The "Librarian")

If you have 300 tools, you can't feed them all to the LLM. The Gateway uses **Semantic Search** to find the 5 most relevant tools for the current query and presents only those to the model, reducing hallucinations and token costs.

## 4. Memory Hooks

To ensure compliance, use **Memory Hooks** to automatically capture audit logs or user preferences.

```python
class AuditHook(HookProvider):
    def on_agent_initialized(self, event):
        # Automatically load recent history
        self.memory_client.get_last_k_turns(5)
```

## 5. Observability (OpenTelemetry)

AgentCore has built-in OTEL support. You just need to instrument your Docker container.

**Dockerfile:**
```dockerfile
# Enable auto-instrumentation
CMD ["opentelemetry-instrument", "python", "-m", "my_agent"]
```

**Result:**
You get full X-Ray traces in the AWS Console, showing exactly how long each tool took to execute and where any errors occurred.

**Conclusion:**
AgentCore solves the "Day 2" problems of AI: deployment, security, and monitoring. It allows developers to focus on the prompt, not the plumbing.
