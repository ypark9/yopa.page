---
title: "Cost Anomaly Detection Across 14,000 Accounts: The Forecast Is the Easy Part"
date: 2026-09-23T09:00:00-04:00
author: Yoonsoo Park
description: "BMW Group runs daily cost anomaly detection over 14,000 cloud accounts for about $50 a month. The interesting engineering is not the Prophet baseline, it is the filter cascade that decides which deviations deserve an email, the tradeoff that comes with any model that adapts to a trend, and the boundary between detection and judgment that automation cannot cross."
categories:
  - AWS
  - FinOps
tags:
  - finops
  - cost-anomaly-detection
  - step-functions
  - forecasting
  - athena
---

A cost dashboard shows what already happened, and only when someone opens it. That sentence is the whole argument for anomaly detection, and BMW Group's CLEA system is the largest concrete version of it I have read: 14,000 cloud accounts, around 3 billion CUR rows a month, a daily detection run, and an email to the account owner the day after the spend appears.

The write-up leads with the forecast, because Prophet is the recognizable part. But the forecast is not where the work is. Getting from "this day is outside the confidence interval" to "this day is worth an email" is the part that took the most iteration, and it is the part worth copying.

## Why a fixed threshold fails at scale

The obvious rule is a dollar threshold: alert when daily spend passes X. It does not hold up, and the reason is worth internalizing before you build anything.

Accounts grow, adopt new services, and ramp workloads on purpose. A fixed rule reads all of that as anomalous. Set the threshold high enough to stay quiet for the largest accounts and the smaller ones get no coverage at all; set it low enough to cover the small accounts and the large ones alert forever. There is no single number, and the failure is not tuning, it is the shape of the rule. You need something per time series, which is what a forecast is.

## The pipeline, and its one real tradeoff

CLEA aggregates CUR (plus other providers' exports) into one grain: daily cost per account per service. One account running EC2, S3, Lambda, and RDS produces four time series; 15 services produces 15. Across 14,000 accounts that is hundreds of thousands of series, each needing its own forecast.

Each series trains Prophet on 365 days of daily history with additive seasonality. The daily run is a Step Functions workflow: a preparation Lambda discovers active accounts and writes the list to S3, then a Distributed Map fans out across up to 500 concurrent Lambdas, one per account. The full 14,000-account run finishes in about 20 minutes. Detection is then a daily comparison — actual spend minus expected spend — and a day is flagged when actual falls outside the confidence interval Prophet produced. Because that interval widens as the model's own uncertainty grows, the test adapts per series instead of applying one band to everything, which filters out most ordinary day-to-day movement for free.

Then the honest caveat, which I would put in bold if I were writing it:

> A model that adapts to a trend will eventually absorb one.

A sustained step up in spend gets flagged for the first few days and then settles in as the new expected level once the training window catches up. **Detection of this kind is strongest on spikes.** If your failure mode is a slow six-week drift, a forecasting baseline is the wrong instrument, and no amount of threshold tuning fixes that. Knowing this up front is what stops you from promising a detection system something it cannot deliver.

## The filter cascade is the product

This is the part I would steal. CLEA applies four layers, each answering "yes, but is it worth an owner's attention?"

**Exclusions before detection.** Low-spend services (trailing 3-day average under $0.10), series with fewer than 10 days of history, and specific line items and charge types that are not relevant to a forecast never enter the model.

**A deviation floor.** A flagged day must deviate at least 40% from expected spend to stay in scope.

**Account-cluster minimum impact.** A 900% jump sounds alarming until you look at the absolute numbers: $0.10 to $1.00 is a spike, and it is irrelevant. CLEA sorts accounts into four clusters by trailing 3-month average spend, each with a minimum dollar impact:

| Cluster | Trailing 3-month average | Minimum impact to alert |
|---------|--------------------------|--------------------------|
| 1 | Under $100k | Over $300 |
| 2 | $100k–$250k | Over $500 |
| 3 | $250k–$500k | Over $750 |
| 4 | Over $500k | Over $1,000 |

**Service-specific thresholds.** Some services spike as part of normal use. Glue, Athena, and EC2 showed consistently higher daily variance during legitimate workloads and produced a disproportionate share of false positives, so they get a 60% deviation threshold instead of 40%. This is the layer most people skip, and it is the one that respects that services have different cost shapes.

**Account-specific overrides.** Teams with known volatile workloads can be placed on a reduced-sensitivity list, where an anomaly must exceed three times the standard threshold.

One piece of low-level bookkeeping matters more than it looks: CLEA merges consecutive flagged days into date ranges, and the grouping logic reads **every historical model snapshot**, not just the latest run. Without that, ranges fragment whenever Prophet reclassifies a single day between executions. That is the kind of detail you only learn by shipping it.

## The boundary automation cannot cross

CLEA can see operations, usage types, and the resulting costs. It cannot see intent. Only the account owner knows whether an increase was a planned workload rollout or a migration.

The write-up treats this as permanent rather than as a gap to engineer away, and the practical consequence is a design rule: **tune thresholds against user feedback instead of trying to infer intent.** Two mechanisms carry that feedback — a button in the application and a call to action in every alert email. If you are building the equivalent, the feedback path is not a nice-to-have; it is the only input that can distinguish a false positive from a real one.

## The alert has to arrive with the answer

Anomaly detection that stops at "something changed" just moves the work to the owner. Every alert email carries the account ID and name, the owners and department hierarchy, the affected service, the anomaly date range and duration, expected against actual spend, the absolute impact and the percentage deviation, and the accumulated impact across every concurrent anomaly on that account, with the full table as an Excel attachment.

Alerts are deduplicated by matching the detected date against the current date; anomalies that began within the last four days always alert, and older ones alert only if still ongoing. Which is the right policy: a two-week-old spent cost is not actionable, and an ongoing one is.

The self-service side is where the design gets sharp. The drill-down leads with two dimensions — daily cost broken down by **operation** and by **usage type** — because in BMW's own review of past cases those two together accounted for the large majority of root causes. One example from the post resolves a spike from a ~$900 baseline to ~$2,600 on a single day, and the usage-type chart points straight at `EUC1-BoxUsage:g6.48xlarge`, naming the instance type. That is the difference between an alert and a ticket.

## What the monitor itself costs

The whole daily pipeline costs about **$50 per month in compute**, less than half a cent per account per month, because every component is serverless and there is no idle infrastructure between runs. Failure tolerance is set to five accounts out of roughly 14,000, which requires a 99.96% success rate per run. Two numbers worth holding together: for a monitoring system, the cost of the monitor and the reliability of the monitor are both part of the design, and a $50/month ceiling is what makes a 500-way fan-out acceptable in the first place.

Where it goes next is instructive about what the team found missing: ITSM integration so alerts become incident tickets in the workflow owners already use, user-controlled sensitivity so teams can set their own discrepancy threshold, an agentic endpoint for automated root-cause explanations, and CloudTrail integration to surface **which user or role configured the service behind the cost increase**. That last one is the pattern worth noting: once detection is solved, attribution of the change becomes the next question.

## What I would take from this

The gap between this and a personal account is mostly scale, but not the design lessons. My own [personal AWS cost guardrails](/blog/2026-03-30-personal-aws-cost-guardrails.html) were three layers precisely because the notify layer and the stop layer fail differently, and CLEA is the same idea at 14,000 accounts with a much better filter between them.

If you are building anomaly detection for your own estate, in this order:

1. **Do not start with a dollar threshold.** Start with a per-series baseline, even a simple one.
2. **Budget most of your effort for the filters.** The forecast will be the easy part; deciding which deviations deserve an email is where the false positives live, and false positives are what kill adoption.
3. **Give services their own deviation thresholds.** Glue and Athena are not EC2, and treating them alike is where the noise comes from.
4. **Make the alert carry the diagnosis,** not just the number. Operation plus usage type is enough for most cases.
5. **Build the feedback path before you need it.** It is the only way thresholds ever improve.
6. **Say out loud what the model cannot see.** Trend absorption is a real limitation; document it so nobody assumes slow drift is covered.

## Pitfalls

- **A 900% deviation and a $50 impact are different problems.** Cluster by scale before you rank by percentage.
- **Reading only the latest model snapshot fragments your anomaly ranges.** Merge across snapshots, not within one.
- **Deduplicating by detection run, not by detected date, double-alerts the same day.** Match on the date.
- **Aggregated daily grain cannot answer "why."** Plan for the operation and usage-type breakdown from the start, because that is what the owner will ask for first.
- **Serverless monitoring is cheap, not free.** $50/month for 14,000 accounts is excellent, but it is a budget line, and fan-out concurrency is what sets it.

## References

- [How BMW Group detects cost anomalies across 14,000 cloud accounts](https://aws.amazon.com/blogs/machine-learning/how-bmw-group-detects-cost-anomalies-across-14000-cloud-accounts/) — AWS Machine Learning Blog
- [AWS Step Functions Distributed Map](https://docs.aws.amazon.com/step-functions/latest/dg/state-map-distributed.html)
- [AWS Cost and Usage Reports](https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html)
