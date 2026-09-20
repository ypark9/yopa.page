---
title: "Observing Bedrock AgentCore Evaluations: It All Flows Through CloudWatch"
date: 2026-09-12T09:05:00-04:00
author: Yoonsoo Park
description: "How Bedrock AgentCore Evaluations reads OpenTelemetry spans from CloudWatch, writes scores back to CloudWatch, and the flush, Transaction Search, and message-content pitfalls that quietly break it."
categories:
  - AWS
tags:
  - amazon-bedrock-agentcore
  - evaluations
  - opentelemetry
  - cloudwatch
  - observability
  - ai-agents
---

An agent failure in production is rarely a stack trace. It is a quiet degradation: the agent still responds, still sounds confident, still returns HTTP 200, but it stopped calling the right tool or started answering outside its scope. You do not catch that with an alarm on error rate. You catch it by scoring behavior, continuously, and the only way to score behavior at scale is to make the whole loop observable first.

Bedrock AgentCore Evaluations (GA since March 2026) is built on exactly that idea, and the thing worth internalizing is that everything routes through one place: CloudWatch. Telemetry flows in as OpenTelemetry spans, Evaluations reads those spans, scores them, and writes the results back to CloudWatch. If you understand that one sentence, the setup and the failure modes both make sense. This post is about wiring that loop correctly.

## The loop, end to end

Here is the whole path an evaluation takes:

```text
agent (any framework)
  -> emits OpenTelemetry spans (via ADOT)
  -> CloudWatch (spans in aws/spans, message content in the agent log group)
  -> AgentCore Evaluations reads the spans, reconstructs the session
  -> built-in / custom evaluators score it
  -> results written back to CloudWatch:
       - JSON in /aws/bedrock-agentcore/evaluations/results/{config_id}
       - scores emitted as CloudWatch metrics
```

The framework-agnostic part is the point. Evaluations does not care whether the agent is Strands, LangGraph, LlamaIndex, or the OpenAI Agents SDK. As long as the agent emits telemetry under a recognized OpenTelemetry scope (`opentelemetry.instrumentation.*` or `openinference.instrumentation.*`), the service reads it through a generic path. The common language is OTel, and the meeting point is CloudWatch.

It reconstructs a session from three span roles: the top-level "invoke agent" span (user prompt plus final response), inference spans (messages to the model plus its reply), and tool-call spans (tool name, parameters, result). Miss the top-level span and the session cannot be assembled from inference spans alone.

## The pitfalls that quietly break it

Every one of these produces empty results or a scoring error, not a loud failure. That is what makes them worth writing down.

### 1. Forgetting to flush telemetry

This is the single most common cause of evaluation failures. AgentCore Runtime suspends the execution environment as soon as your handler returns. The OTel SDK batches telemetry in client-side processors that export on a timer. So when you return the response, unexported spans may still be sitting in the buffer, and there is no guarantee the export finishes before suspension. The spans never reach CloudWatch, and Evaluations has nothing to score.

Force a flush at the end of the handler, before you return:

```python
def _flush_telemetry():
    from opentelemetry import trace as _trace
    from opentelemetry._logs import get_logger_provider as _get_lp
    for provider in (_trace.get_tracer_provider(), _get_lp()):
        flush = getattr(provider, "force_flush", None)
        if flush:
            flush()

@app.entrypoint
async def invoke(payload, context):
    prompt = payload.get("prompt", "")
    try:
        result = await run_agent(prompt)
    finally:
        _flush_telemetry()
    return str(result)
```

The `finally` matters: flush even when the agent throws, or you lose the telemetry for exactly the invocations you most want to inspect.

### 2. Transaction Search not enabled

This is the prerequisite teams most often miss. Without CloudWatch Transaction Search turned on (ingesting spans as structured logs), span queries return nothing and evaluations silently have no input. Enable it once in the CloudWatch console before you expect any spans to be queryable.

### 3. Message content lives separately from spans

Span classification and message content are two different things, stored in two different places. Spans land in `aws/spans`. The actual message content (what the user said, what the model replied) is stored as correlated event records in the agent's log group. If your evaluation data source covers only `aws/spans`, span classification still succeeds, but message content comes back empty, and any evaluator that scores response quality returns an error. Point the data source at both the span store and the log group that holds the content.

## Where the results go, and how to route them

Online evaluation results are written to a dedicated CloudWatch log group, `/aws/bedrock-agentcore/evaluations/results/{config_id}`, in JSON that follows the OpenTelemetry GenAI evaluation-result conventions, parented to the original trace and session IDs. Scores are also emitted as CloudWatch metrics under `Bedrock-AgentCore/Evaluations`. That gives you two immediate handles:

- **Query** the JSON with CloudWatch Logs Insights to slice results by evaluator, session, or time window.
- **Alarm** on the metrics to catch a drop in goal-success or helpfulness before a human notices the agent got worse.

Now, the part that connects to a recent Lambda-free plumbing change. Once your eval results (and your Bedrock model-invocation logs, and your span data) are all landing in CloudWatch, the next operational question is how to get them *out* for long-term retention or a SIEM. CloudWatch Logs delivery is the vended-log mechanism for that, and on 2026-07-14 AWS extended the same mechanism to API Gateway REST API execution logs, letting a single delivery source fan out to CloudWatch Logs, S3, and Firehose at once. The relevance here is not API Gateway specifically. It is that the delivery-source/delivery-destination model is becoming the standard way to route any CloudWatch-resident log stream to S3 (for cheap Athena-queryable retention of eval history) or Firehose (for a SIEM), without maintaining subscription-filter-plus-Lambda-forwarder glue. If you are standing up eval observability, plan the export path with the same primitive rather than hand-rolling forwarders.

## What to actually do

1. Instrument the agent with ADOT under a recognized OTel scope. You do not write custom span logic; the instrumentation package does it.
2. **Flush telemetry in a `finally` block** at the end of the handler. This is the pitfall that will bite you first.
3. Enable CloudWatch Transaction Search before you expect span queries to work.
4. Point the evaluation data source at both the span store and the message-content log group, or response-quality scores will error out.
5. Alarm on the eval metrics, query the JSON with Logs Insights, and plan an S3/Firehose export path using CloudWatch Logs delivery if you need retention or a SIEM.

The whole design collapses to one instinct: make the agent observable in CloudWatch first, and evaluation becomes a reader on top of telemetry you already have, not a separate system you have to feed. If you are thinking about the trust boundaries around agents running this way, I covered that in [Zero Trust Agent Systems on AWS](/blog/2026-08-01-zero-trust-agent-systems-on-aws.html).
