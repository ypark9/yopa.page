---
title: "Your Agent Is Wrong, Not Broken: What Agent Observability Actually Changes"
date: 2026-09-24T09:00:00-04:00
author: Yoonsoo Park
description: "CloudWatch Omni unifies application and agent observability, but the interesting part is not the dashboards. It is that agent correctness has to be measured per run, in production, and that the same quality signals decide how much authority an agent should get."
categories:
  - AI Agents
  - AWS
tags:
  - observability
  - ai-agents
  - evaluation
  - agentcore
  - correctness
---

Operations has answered one question for twenty years: is it broken? Metrics, logs, and traces are all built on a single assumption. When software fails, the failure eventually shows up as something a machine can measure.

Agents break that assumption. Picture a refund agent that answers in 600 milliseconds with a zero error rate, and tells the customer they are owed $40 when the policy says $140, because it retrieved last quarter's version of the document. Every dashboard is green. The system is wrong.

That is the shift behind [Amazon CloudWatch Omni](https://aws.amazon.com/cloudwatch/omni/), and it is worth separating the launch noise from the one idea underneath it: correctness now has to be measured at the level of the run, continuously, in production. If you have read my [post on where agent boundaries belong](/blog/2026-08-01-agentcore-service-map-and-production-boundaries.html), this is the observability half of the same argument.

## Why the old model runs out

Traditional observability assumes that what you care about is either known before release or visible as a metric. A slow handler shows up as latency. A broken handler shows up as a 5xx. Both are measurable without knowing anything about the request.

An agent moves part of that behavior into runtime. The same code and the same agent can get one request right and the next one wrong, depending on how the question was phrased, what context was retrieved, which path it took through its tools, and what the model generated. None of that is knowable before the request arrives, so a pre-release test suite cannot answer the whole question. Some of the answer has to come from live runs.

## What Omni actually is

Two surfaces share one dataset. Developers get a VS Code / Kiro extension where traces appear as you run the agent, with a playground and evaluators a click away. Operators get a standalone web experience outside the AWS Console, reachable through SSO. The trace a developer debugs is the trace an operator investigates.

The instrumentation is deliberately boring, which is the right call. It is OpenTelemetry at the base, with OpenInference and ADOT for agent spans. Agents on Bedrock AgentCore report traces and sessions with almost no setup, and telemetry you already send to CloudWatch shows up with nothing to reconfigure. Existing metrics, alarms, and dashboards keep working. That matters more than any single feature, because it means adoption does not require a re-platforming project.

The genuinely new capability is evaluation. Omni ships 17 built-in evaluators that score responses on dimensions like correctness, coherence, faithfulness, and routing correctness, and it can run them two ways. Online evaluation scores production traffic as it happens. Offline evaluation scores a versioned dataset on demand. A bad run in production can be promoted into a golden dataset, so the evidence that something went wrong becomes the regression test for whether the fix worked.

Around that sit the workflow pieces: a trace explorer with a compare mode that puts two traces side by side, an agent topology view that maps sub-agents, tools, and delegations, a session explorer for multi-turn history, and prompt management with versioning and rollback.

## What this changes about autonomy

Here is the part that is easy to read as marketing and is actually structural. The amount of authority you can lend an agent depends on how clearly you can see what it does.

Permissions still set the outer boundary. A policy can say an agent is allowed to issue refunds. It cannot say whether this refund, to this customer, for this amount, was right. More and more of what matters happens inside the boundary, and the only way to understand it is to look at what actually happened.

That relationship is usually described as if it were static, but it points somewhere specific. If quality signals are live, authority can widen as an agent builds a track record and narrow when quality slips until someone understands why. AWS frames this as a direction rather than a shipped feature, and it is right to. What exists today is the raw material: evaluator scores that live on the same trace as latency, errors, and token usage.

## The part nobody budgets for

Building evaluations forces a team to turn tacit judgment into an operational definition of good. What counts as a correct refund decision? When should the agent escalate instead of acting?

Human organizations run on a surprising amount of unstated judgment, and that is fine as long as humans are making the calls. An evaluator needs something concrete. In practice the argument about what to measure is as useful as the measurement. It is also where the real cost of this work sits, and it is not a tooling cost.

## Where it stops

A few things worth being honest about before you plan around it.

The evaluator only measures the definition you gave it. If you attach an evaluator and the score does not move, the usual cause is a badly defined axis, not a well-behaved agent.

Observability answers what the agent did, not whether the decision was right in the policy sense. You still have to decide that.

And this is early. The dynamic autonomy loop is a direction, not a feature you can buy. Anyone selling you "automatic agent trust scoring" today is describing a roadmap.

The practical takeaway is narrow and does not require adopting anything: if you run agents where a wrong answer costs more than a slow one, your error rate is not your quality metric, and you should stop pretending it is.
