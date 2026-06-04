---
title: "Step Functions × AgentCore: When Your Async Pipeline Already Runs Agents"
date: 2026-06-04T11:30:00-04:00
author: Yoonsoo Park
description: "AWS just shipped a native Step Functions integration for Bedrock AgentCore Runtime. If you already wrap agent calls in Lambda behind a state machine, this changes where the agent actually executes — and removes a few specific pain points that anyone running long-running agents has hit."
categories:
  - AWS
  - AgentCore
tags:
  - step-functions
  - bedrock
  - agentcore
  - async
  - lambda
---

[AWS announced](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/) a native Step Functions integration for Bedrock AgentCore Runtime in June 2026. State machines can now invoke an AgentCore agent as a first-class task — no Lambda wrapper, no hand-rolled polling, no `boto3.client("bedrock-agentcore").invoke_agent_runtime` inside a Python function whose only job is to forward arguments.

That sounds like a small thing. For platform teams who already run agents inside async pipelines, it isn't.

## The shape we keep ending up with

If you're building agentic features on AWS for a real product, the architecture converges on something close to this:

```
POST /something/runs   →  202 + requestId
                              ↓
                      Step Functions starts
                              ↓
              Lambda(call agent + write result)
                              ↓
                       DynamoDB updated
                              ↓
GET /something/runs/{id}  →  status + output
```

The state machine exists because the agent call is too slow to hold an HTTP connection open for. The Lambda exists because, until last week, that was the only way to call an agent from a state machine. The `Runnable.long_run()` / `RunnablePoll` patterns most teams end up with are all variations on the same theme: **a thin Python wrapper that calls Bedrock and returns control to the state machine.**

It works. It also has four specific problems that don't go away no matter how clean your code is.

## Four problems this pattern actually has

### 1. Lambda's 15-minute timeout decides how long your agent can think

This one is backwards. The agent's reasoning budget should be a product decision — "this action involves five tool calls and a long context, so it might take 8 minutes" — but in practice, the limit is whatever Lambda lets you do. Anything longer needs ECS, Fargate, or a chain of Lambdas that hand off state, all of which are work nobody actually wants to do.

AgentCore Runtime has an 8-hour ceiling. When the state machine invokes AgentCore directly via the new `.sync` integration, the Lambda is gone, and so is the 15-minute cliff.

### 2. Multi-step agent workflows fail atomically

If your action does plan → fan-out tool calls → reduce → validate, all of that runs inside one agent loop, inside one Lambda. Any failure — a tool that timed out, a downstream service that returned 503, a model that produced malformed JSON on the third turn — restarts the whole thing.

The state machine layer above it is useless for this, because from its perspective the Lambda either succeeded or didn't. There's no "the plan finished but the validation step blew up, retry just the validation."

Once the agent calls are SF tasks, the workflow can actually be a workflow:

```
Plan(agent)
  → Map(tool calls in parallel)
    → Reduce(agent)
      → Validate(agent)
```

Each step has its own retry, catch, and checkpoint. A failure in `Validate` re-runs `Validate`, not the whole chain.

### 3. External job polling is a pattern everyone reimplements

Textract async, Bedrock batch inference, anything with "submit job → poll for completion" — every team writes the same loop. Configurable interval, max attempts, status mapping, exit on failure. It's never quite the same code twice.

`.sync` integrations let Step Functions handle the polling. The state machine submits the job and waits on the task token. AgentCore async invocations slot into the same model. The polling code stops being yours.

### 4. Agent execution is invisible at the workflow layer

Right now, if a multi-step agent call goes wrong, your CloudWatch logs are a wall of `{"level": "INFO", "agent": ...}` lines and you're greping for the failure. Per-step cost? Aggregated at the Lambda level. X-Ray traces? They cover the Lambda, not the agent's internal turns.

When the agent invocation is a state machine task, the workflow execution view shows it as a step. Cost attributes per step. X-Ray traces span the agent call. Failure modes have names again.

## What changes with native AgentCore integration

Concretely:

| Before | After |
|---|---|
| `LambdaInvoke` task → Python handler → `bedrock-agentcore.invoke_agent_runtime` | Native `BedrockAgentCore: InvokeAgentRuntime.sync` task |
| 15-min Lambda timeout | 8-hour AgentCore Runtime timeout |
| Agent loop runs inside Lambda; failure restarts everything | Plan/fan-out/reduce/validate as separate SF steps with independent retry |
| Hand-written `poll_run()` with `interval_seconds` and `max_poll_attempts` | SF `.sync` integration handles polling |
| Per-Lambda CloudWatch logs | Per-step SF execution view + X-Ray |
| Human-in-the-loop bolted on with custom DynamoDB state | `waitForTaskToken` + agent task |

The last row is worth pausing on. A lot of agentic features in regulated industries need a human approval step somewhere — "the agent drafted this loan memo, but a human signs off before it goes out." The way you used to build that was: agent writes draft to DynamoDB, separate API marks it approved, separate Lambda picks it up, separate state machine resumes. With `waitForTaskToken`, the state machine literally pauses on a step, an external system calls back with the token, and the agent picks up where it left off. The approval flow becomes a single state diagram instead of three coupled services.

## Decision tree — should you actually migrate?

Not every async agent call benefits from this.

✅ **Worth migrating** if:
- You already run agents inside Step Functions via Lambda
- Agent calls are long-running (>5 min) or you've felt the 15-min ceiling
- You have multi-step agent workflows where partial retry would help
- You have external-job polling patterns (Textract async, batch inference, etc.) — these are the lowest-risk first move; the polling code straight-up disappears
- You need human-in-the-loop and you've been building it manually

⚠️ **Cost-first before migrating** if:
- You're using a direct SDK (Strands, raw Bedrock) inside Lambda. Moving to AgentCore Runtime is its own deployment and operational change. The integration assumes you've already adopted AgentCore.
- Your async pipeline is small (one Lambda, one DynamoDB write) and the rewrite is bigger than the win.

❌ **Don't bother** if:
- The agent call is short (< 1 min), single-turn, and never fails interestingly. Lambda + SDK is fine.
- You don't actually have a state machine. Adding one to use this integration is putting the cart before the horse.

## Pitfalls to expect

- **Step Functions state size limit is 256 KB.** This already affects anyone passing large documents through SF. With agent inputs/outputs in the loop, plan to keep payloads in S3 and pass references. Existing patterns work; the integration doesn't relax the limit.
- **AgentCore Runtime region availability.** As of launch, AgentCore is in fewer regions than Step Functions. If your product runs in `me-central-1` or `ap-northeast-1`, check before you redesign. Cross-region AgentCore invocation from SF is a separate question.
- **Cold start moves, it doesn't disappear.** You stop paying for Lambda cold start; you start paying for AgentCore Runtime cold start. The numbers aren't identical and they're worth measuring on a real workload before declaring victory.
- **IAM gets a new principal in the trust chain.** The state machine's execution role now needs `bedrock-agentcore:InvokeAgentRuntime`. If your platform has tag-based access controls (we do — `IntelligenceRegistryAccess` style tags), the state machine role needs the right tag, not just the Lambda role.
- **Observability changes shape.** Existing dashboards keyed on Lambda function names will go quiet on the agent path. Plan a parallel set of SF execution and AgentCore metrics before flipping traffic.

## What this actually means

Up until this integration, "where does the agent execute" was a question with a frustrating answer: inside a Lambda, because that's the only thing your workflow engine knew how to invoke. The execution location was a side effect of the orchestration choice, not a design decision.

Native AgentCore-as-task changes that. Agent execution becomes something you can place where it belongs — long-running, observable, retryable at the step granularity that actually matches your workflow. The orchestrator stops being a thin wrapper and becomes the actual orchestrator.

If you've been deferring an agentic feature because "the async story is messy," it's worth a fresh look. The async story just got a lot less messy.
