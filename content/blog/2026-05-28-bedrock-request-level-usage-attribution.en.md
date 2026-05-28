---
title: "Per-Request Cost Attribution on Amazon Bedrock — InvokeModel Metadata, Inference Profiles, and What to Use When"
date: 2026-05-28T02:30:00-04:00
author: Yoonsoo Park
description: "Amazon Bedrock now lets you tag every InvokeModel call with arbitrary metadata, joining application inference profiles and IAM-based attribution as a third way to slice cost. Here's how the three compare, when each one wins, and how to wire request-level metadata into your invocation logs without breaking existing dashboards."
categories:
  - AWS
  - Bedrock
tags:
  - bedrock
  - cost-attribution
  - observability
  - inference-profile
  - finops
---

If you run more than one team, product, or environment on top of Amazon Bedrock, the very first finance question you'll hear is: **"who used the tokens?"** And until recently, the honest answer was *"it depends on which API you're calling."*

The `Converse` and `ConverseStream` APIs already supported a `requestMetadata` field — arbitrary key/value tags that flow into your invocation logs. But a lot of production code still uses the older, lower-level `InvokeModel` and `InvokeModelWithResponseStream` APIs, and those didn't accept metadata at all. You either had to migrate to `Converse`, separate workloads behind different inference profiles, or live with IAM-role-level granularity.

In May 2026, AWS [closed that gap](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-bedrock-request-level-usage-attribution/): `InvokeModel` and `InvokeModelWithResponseStream` now accept request-level metadata too, available in every commercial region where Bedrock is offered.

That sounds small. It isn't. It changes which attribution strategy is the right default.

## Three ways to attribute Bedrock spend

There are now three production-grade ways to slice "who used what" on Bedrock. They aren't mutually exclusive — most mature setups use two of them at once — but they answer different questions.

| Mechanism | Granularity | What it answers |
|-----------|-------------|-----------------|
| **Application Inference Profile** | Per service / per app | "How much does *this product* cost to run?" |
| **IAM principal** (role/user) | Per role | "How much did *this caller* spend?" |
| **Request metadata** (new) | Per request | "How much did *this team / project / env / user* spend, even on a shared profile?" |

### Application inference profiles

If you've already built a platform team, this is probably your current default. You provision an inference profile per service, route the service's traffic through it, and Cost Explorer breaks the bill down by profile ARN. Clean, audit-friendly, and works for any Bedrock model that supports application inference profiles (notably the Claude family via cross-region inference).

The catch: profiles are a coarse unit. If three internal teams share one "shared experimentation" service, they all show up under the same profile.

### IAM-based attribution

Free, automatic, and the lowest-effort tier. Cost Explorer can group spend by IAM principal if your callers each have distinct roles. Works the moment you turn it on, and pairs well with SSO. The downside is that it's only as granular as your IAM design — and most teams converge on a small number of "service roles" that hide a lot of internal structure.

### Request metadata

This is the new one. You attach a small map of tags — say `{ "team": "growth", "project": "onboarding-assistant", "env": "prod", "user_id": "u_8421" }` — to each `InvokeModel` call. The tags land in your model invocation log on S3 (or CloudWatch), and you query them with Athena, OpenSearch, or whatever you already use.

The win is *post-hoc flexibility*. You don't have to redesign your IAM tree or split inference profiles to ask a new question. Tag every call with `team` and `feature`, and you can re-slice spend by either dimension forever after.

## When each one wins

Here's the rule of thumb I've landed on after running this in production:

- **Inference profiles** are the right unit for *billing chargeback* between teams that own separate products. They show up cleanly in AWS Cost Explorer, the bill is hard to game, and they give the platform team a real handle (rate limits, model access, regional routing).
- **IAM** is the right unit for *security boundaries*. If two roles can see each other's data, no amount of metadata tagging fixes that. Use IAM to enforce isolation; don't use it as your primary cost knob.
- **Request metadata** is the right unit for *product analytics and per-feature unit economics*. "How much does the suggestion box cost per active user?" "Did the new prompt template raise our per-conversation token cost?" These are questions you'll keep inventing, and you don't want to file an infra ticket every time.

In a healthy setup all three coexist: profiles for the bill, IAM for the blast radius, metadata for the dashboard.

## Wiring it up

The mechanics are simple, but there are three steps you can't skip.

### 1. Turn on model invocation logging

Metadata only matters if you can read it back. Enable Bedrock model invocation logging in each region you call from, and pick a destination — S3 for cheap long-term storage and Athena queries, CloudWatch Logs if you want to grep in real time. Both is fine; you'll usually settle on one.

This is a per-region setting and it's easy to forget when you spin up a new region. Put it in your account-bootstrap CDK / Terraform.

### 2. Pass `requestMetadata` on every call

For `InvokeModel` and `InvokeModelWithResponseStream`, the new `requestMetadata` parameter takes a flat string-to-string map. Keys and values are limited in length (think tag-style budgets, not blob storage), and the same field works on `Converse` / `ConverseStream` for code paths that already use those.

The critical move is to **inject metadata in your shared client wrapper**, not in each call site. If you let individual features set their own tags, you'll end up with a soup of inconsistent keys (`team`, `Team`, `team_name`, `owning_team`) and your dashboards will lie. Pick a schema, write it down, enforce it in one place.

A reasonable starter schema:

| Key | Example | Required? |
|-----|---------|-----------|
| `team` | `growth`, `core`, `platform` | yes |
| `service` | `onboarding-assistant` | yes |
| `env` | `dev`, `qa`, `prod` | yes |
| `feature` | `summarize`, `chat`, `eval` | optional |
| `request_id` | `req_01J…` (your own correlation id) | optional |

Resist the urge to put PII or full user IDs in there unless you've thought through retention. Logs live for a long time.

### 3. Query the logs

If you're on S3, the [official partition layout](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html) plays well with Athena. A first query usually looks like:

```sql
SELECT
  request_metadata['team']     AS team,
  request_metadata['service']  AS service,
  SUM(input_token_count)       AS input_tokens,
  SUM(output_token_count)      AS output_tokens
FROM bedrock_invocation_logs
WHERE date = current_date - interval '7' day
GROUP BY 1, 2
ORDER BY input_tokens + output_tokens DESC
```

Translate tokens to dollars with the published per-model rates and you've got a per-team weekly bill, sliceable by any tag you set.

## Pitfalls I've actually hit

A few things to save you a debug session:

- **Region mismatches.** Logging is per-region. Calls to a model in a region where logging is off vanish — they'll show up in Cost Explorer but not in your dashboard, and the discrepancy is silent.
- **Streaming responses.** `InvokeModelWithResponseStream` records token counts only after the stream completes. If your client disconnects early, the row may still be written but with partial data. Don't assume every row is "clean."
- **Schema drift.** Once you ship a metadata schema, treat it like a public API. Renaming `team` to `owning_team` six months in will fork your dashboards. Add new keys, deprecate old ones, never silently rename.
- **Don't tag what IAM should enforce.** If `env=prod` is a metadata tag, *anyone with InvokeModel permission* can claim to be prod. Use IAM (and ideally separate roles per env) for anything that must not be forgeable.

## So which one should you use?

If you're starting today on Bedrock:

1. Set up **at least one inference profile per product** that has its own bill or SLO. This is your invoice-grade unit.
2. Give each calling service a **distinct IAM role**, even if it's tedious. Future-you will thank present-you when the security review lands.
3. Add **request metadata in your shared client wrapper from day one**, with a small, enforced schema. It costs nothing extra at runtime and gives you a permanent escape hatch for the questions you haven't thought of yet.

The new InvokeModel metadata feature isn't going to change your architecture. But it does mean you no longer have to choose between "use the modern Converse API" and "have per-request attribution." You can keep your existing InvokeModel-based code and still get the granularity that used to require a migration — which, in practice, is how most of these features actually get adopted.

## References

- [AWS What's New — Bedrock request-level usage attribution (May 2026)](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-bedrock-request-level-usage-attribution/)
- [Bedrock model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
- [Application inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
