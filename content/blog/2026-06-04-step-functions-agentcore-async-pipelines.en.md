---
title: "Step Functions × AgentCore: What the Managed Harness Integration Actually Supports"
date: 2026-06-04T11:30:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "AWS's June 2026 Step Functions integration for Bedrock AgentCore is useful, but narrower than a generic async AgentCore task: it invokes the managed harness in Request Response mode. Here is what it does, what it does not do, and which patterns still fit long-running workflows."
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

[AWS announced](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/) an optimized Step Functions integration for the managed Bedrock AgentCore harness in June 2026. The important detail is easy to miss: the resource is `arn:aws:states:::bedrockagentcore:invokeHarness`, and the integration currently supports **Request Response** only.

That is still useful for a state machine that already needs a managed AgentCore turn. It is not a drop-in `.sync` replacement for every `InvokeAgentRuntime` call, and it does not make an eight-hour agent invocation a single Step Functions task.

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

The state machine exists because the agent call is too slow to hold an HTTP connection open for. The Lambda may be thin, but it often owns session IDs, payload storage, retries, callback tokens, and the durable result. The optimized integration can remove that wrapper for a bounded harness turn, but it does not remove those workflow responsibilities automatically.

It works. It also has four specific problems that don't go away no matter how clean your code is.

## Four problems this pattern actually has

### 1. A task limit still decides how long the optimized turn can run

This one is backwards. The agent's reasoning budget should be a product decision — "this action involves five tool calls and a long context, so it might take 8 minutes" — but in practice, the limit is whatever Lambda lets you do. Anything longer needs ECS, Fargate, or a chain of Lambdas that hand off state, all of which are work nobody actually wants to do.

The optimized resource is subject to the Step Functions integration limit of **15 minutes**. Increasing `TimeoutSeconds` above that does not turn it into an eight-hour task. If the task times out, the harness can continue running, so you need an explicit cleanup or reconciliation path.

### 2. Multi-step agent workflows fail atomically

If your action does plan → fan-out tool calls → reduce → validate, all of that runs inside one agent loop, inside one Lambda. Any failure — a tool that timed out, a downstream service that returned 503, a model that produced malformed JSON on the third turn — restarts the whole thing.

The state machine layer above it is useless for this, because from its perspective the Lambda either succeeded or didn't. There's no "the plan finished but the validation step blew up, retry just the validation."

You can still make the workflow a workflow, but you do it with separate states rather than one automatically decomposed agent call:

```
Plan(agent)
  → Map(tool calls in parallel)
    → Reduce(agent)
      → Validate(agent)
```

Each step has its own retry, catch, and checkpoint. A failure in `Validate` re-runs `Validate`, not the whole chain.

### 3. External job polling is a pattern everyone reimplements

Textract async, Bedrock batch inference, anything with "submit job → poll for completion" — every team writes the same loop. Configurable interval, max attempts, status mapping, exit on failure. It's never quite the same code twice.

For AgentCore, the optimized harness task is Request Response, not a general `.sync` poller. If you need submit-and-wait semantics, use one of the explicit callback or direct-SDK patterns described below and keep the session, timeout, and result state in your design.

### 4. Agent execution is invisible at the workflow layer

Right now, if a multi-step agent call goes wrong, your CloudWatch logs are a wall of `{"level": "INFO", "agent": ...}` lines and you're greping for the failure. Per-step cost? Aggregated at the Lambda level. X-Ray traces? They cover the Lambda, not the agent's internal turns.

When the agent invocation is a state machine task, the workflow execution view shows it as a step. Cost attributes per step. X-Ray traces span the agent call. Failure modes have names again.

## What the optimized AgentCore task changes

Concretely:

| Before | After |
|---|---|
| Lambda wrapper calls `invoke_agent_runtime` | Optimized `arn:aws:states:::bedrockagentcore:invokeHarness` task |
| Lambda has a 15-minute timeout | Optimized task is also limited to 15 minutes |
| Agent loop is one opaque call | Separate states are still required for independent retry |
| Hand-written polling/callback code | Still required for long-running or callback workflows |
| Lambda logs only | Final text plus execution/CloudWatch harness trace link |
| Custom approval state | `waitForTaskToken` remains an explicit pattern outside this task |

The approval case still matters, but it is not supplied by the optimized harness resource. A state machine can pause with `waitForTaskToken`, an external system can call back with the token, and a later state can invoke AgentCore. Keep the approval token and business state in a durable store rather than assuming the harness session is the workflow record.

## Patterns for genuinely asynchronous work

When an agent must run longer than the task limit, or a human must approve a result, use an explicit callback pattern instead of treating the optimized task as durable:

1. **Lambda dispatcher + callback token.** A Lambda starts or invokes the AgentCore runtime, gives the agent a Step Functions task token, and the agent or a callback handler calls `SendTaskSuccess`/`SendTaskFailure` when the durable work finishes.
2. **Direct AWS SDK integration.** Step Functions can call `arn:aws:states:::aws-sdk:bedrockagentcore:invokeAgentRuntime` without a Lambda in the request path. You still own the session ID, timeout, polling/callback decision, and result persistence.
3. **Durable function callback.** A Lambda durable function can hold the orchestration and resume from a callback while each AgentCore invocation remains a bounded unit of work.

Use a stable session ID, keep large inputs and outputs in S3 rather than the 256 KB Step Functions state, and set heartbeat/timeouts that match the business operation. A session that may last days is not the same thing as a durable business process: persist process state and let Step Functions own the wait.

## Decision tree — should you actually migrate?

Not every async agent call benefits from this.

✅ **Worth migrating** if:
- You already run agents inside Step Functions via Lambda
- You need a bounded harness turn and its final text/usage result in a state machine
- You already run agents inside Step Functions via Lambda and want to remove only that wrapper
- You can split a workflow into explicit states with independent retry
- You can keep genuinely long-running or approval work in one of the callback patterns above

⚠️ **Cost-first before migrating** if:
- You're using a direct SDK (Strands, raw Bedrock) inside Lambda. Moving to AgentCore Runtime is its own deployment and operational change. The integration assumes you've already adopted AgentCore.
- Your async pipeline is small (one Lambda, one DynamoDB write) and the rewrite is bigger than the win.

❌ **Don't bother** if:
- The agent call is short (< 1 min), single-turn, and never fails interestingly. Lambda + SDK is fine.
- You don't actually have a state machine. Adding one to use this integration is putting the cart before the horse.

## Pitfalls to expect

- **Step Functions state size limit is 256 KB.** This already affects anyone passing large documents through SF. With agent inputs/outputs in the loop, keep payloads in S3 and pass references. The integration does not relax the limit.
- **Do not write `InvokeAgentRuntime.sync` by analogy.** Use the documented `invokeHarness` resource for the optimized integration; `.sync` and `waitForTaskToken` are not supported there.
- **Task timeout and agent timeout are different clocks.** A Step Functions timeout can leave the harness running. Add a cancellation, idempotency, or reconciliation plan.
- **AgentCore Runtime region availability.** As of launch, AgentCore is in fewer regions than Step Functions. If your product runs in `me-central-1` or `ap-northeast-1`, check before you redesign. Cross-region AgentCore invocation from SF is a separate question.
- **Cold start moves, it doesn't disappear.** You stop paying for a Lambda wrapper, but you still need to measure AgentCore runtime behavior on a real workload.
- **IAM gets a new principal in the trust chain.** The state machine's execution role needs the documented AgentCore permission for the resource you call. If your platform has tag-based access controls, the state machine role needs the right tag, not just the old Lambda role.
- **Observability changes shape.** The optimized task returns final assistant text and aggregated usage, not every tool/reasoning block. Keep the CloudWatch harness trace or your own durable evidence for detailed debugging.

## What this actually means

Before this integration, many teams put a thin Lambda around every AgentCore call. The optimized task removes that wrapper for one bounded harness turn, but it does not make every runtime invocation a durable Step Functions task.

AgentCore-as-task is therefore a useful narrow contract: final-text handoff, aggregated usage, and a link to the harness trace. Long-running execution, human approval, and partial retry still belong in explicit Step Functions states and callback patterns.

If you've been deferring an agentic feature because "the async story is messy," it is worth a fresh look. Just choose the optimized task only when its Request Response and 15-minute contract actually fits.
