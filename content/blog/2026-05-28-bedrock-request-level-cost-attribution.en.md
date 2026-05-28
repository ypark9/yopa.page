---
title: "Per-Request Cost Attribution on Amazon Bedrock with InvokeModel Metadata"
date: 2026-05-28T11:30:00-04:00
author: Yoonsoo Park
description: "Bedrock now lets you tag every InvokeModel call with arbitrary metadata — team, project, environment — and slice usage by those tags in the invocation logs. Here's how it fits with inference profiles and IAM-based attribution, and where it actually helps."
categories:
  - AWS
tags:
  - bedrock
  - cost-attribution
  - observability
  - finops
---

If you run more than one workload on Bedrock, you've probably hit the same wall I did: the bill comes back as one big number per model, and Cost Explorer can't tell you which feature, which team, or which environment actually spent it.

There are a few ways to chip at this problem, and as of May 2026, Bedrock added one more: **request-level metadata on `InvokeModel` and `InvokeModelWithResponseStream`**. The Converse API already had this; now the older invocation API does too. Worth knowing what it gives you and what it doesn't.

## What changed

You can now attach a `requestMetadata` map to any `InvokeModel` / `InvokeModelWithResponseStream` call. Free-form key/value pairs — `team=payments`, `project=summarizer`, `env=prod`, whatever you want.

The values land in the **model invocation logs** (S3 or CloudWatch Logs, configured per region). From there you query them with Athena, CloudWatch Logs Insights, or whatever pipeline you already have on top of those logs.

It's available in every commercial region where Bedrock runs.

## How it stacks against the other attribution options

There are now four overlapping ways to slice Bedrock usage. They're not redundant — they work at different granularities and answer different questions.

| Mechanism | Granularity | Best for |
|---|---|---|
| Application Inference Profile | Per profile (per service) | Hard isolation between services. Profiles also carry tags that show up in Cost Explorer. |
| IAM principal | Per role / user | Auto-attribution by who's calling. Free, no code change. |
| Request metadata (new) | Per request | Splitting usage *inside* one profile or one role — feature flags, A/B tests, multi-tenant calls. |
| Workspace-level (Anthropic Claude) | Per workspace | Claude-specific, separate billing dimension. |

The mental model: profiles and IAM are the "structural" attribution — they reflect how your infra is laid out. Request metadata is the "logical" attribution — it reflects how your code thinks about itself, even when the structure doesn't change.

## When request metadata actually helps

The structural options solve most cases. You spin up an inference profile per service, you give each service its own role, and Cost Explorer shows you the breakdown without writing a single line of code.

Request metadata earns its keep when the structure is too coarse:

- **One service, multiple internal features.** A summarization service that gets called from three different product surfaces. Same profile, same role, but you want to know which surface burns the most tokens.
- **Multi-tenant inside a single role.** A platform Lambda that calls Bedrock on behalf of N customers. You can't reasonably mint a profile per customer, but you can stamp `tenant_id` on the request and report per tenant later.
- **Experiment / cohort tagging.** A/B test two prompts, tag each call with the variant, see the cost delta in the logs.
- **Environment split inside one account.** Dev and prod traffic in the same account because you're scrappy and that's fine — `env=dev` vs `env=prod` in the metadata gets you the breakdown without a re-architecture.

## What it doesn't give you

A few honest limits:

- **Not free in Cost Explorer.** Inference profile tags propagate to Cost Explorer. Request metadata does not — it lives in the invocation logs only. You need an analytics step (Athena over S3 logs, or Logs Insights over CloudWatch) to turn the tags into a chart.
- **Logs have to be on.** If model invocation logging isn't enabled in the region you're calling, your metadata vanishes into the void. Easy to forget when you spin up a new region.
- **Trust the caller, not the metadata.** Anyone with `bedrock:InvokeModel` permission can stamp anything they want into `requestMetadata`. Useful for your own reporting, useless for billing-grade enforcement. If you need that, separate IAM roles or separate accounts are still the answer.
- **Cardinality discipline.** If you start tagging `request_id` or `user_id` with millions of unique values, your queries get slow and your storage costs creep up. Tag what you'll actually group by.

## Practical setup

The path I'd take on a fresh service:

1. Turn on model invocation logging in the regions you call. S3 destination if you want to query with Athena later, CloudWatch Logs if Logs Insights is enough.
2. Decide your tag schema upfront. Two or three keys is plenty: usually `service`, `feature`, `env`. Document it. Anyone adding a new caller follows the schema.
3. Inject the tags in your Bedrock client wrapper, not at the call site. One place to enforce the schema, one place to evolve it.
4. Build the Athena/Logs Insights query before you need it. The first time you actually need to attribute a cost spike, you don't want to be writing the query under pressure.

If you already use **inference profiles** for your services, keep doing that. Request metadata is a layer on top — it splits usage *inside* a profile, it doesn't replace the profile.

## The short version

Bedrock now has request-level tags. They land in invocation logs, not Cost Explorer. They're the right tool when your structural attribution (profiles, IAM) is too coarse and you need to slice usage *inside* a single service or role. Pick a small tag schema, inject it from a shared client, turn on logging, and your future self will thank you the next time the bill spikes.
