---
title: "Lambda Now Takes Full IAM Resource-Based Policies: One Document Instead of N add-permission Calls"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda now supports full IAM resource-based policies with multiple principals, actions, and condition keys in one document. Here is the before/after and when to still use add-permission."
categories:
  - AWS
tags:
  - lambda
  - iam
  - resource-based-policy
  - cross-account
  - least-privilege
---

If you have wired more than a couple of services to invoke the same Lambda function, you know the shape of the old problem: a pile of narrow permission statements, each added one call at a time, none of them able to express a real condition. On 2026-08-25 Lambda changed that. Functions now accept full IAM resource-based policies, so you can define multiple principals, multiple actions, and the full range of IAM condition keys in a single policy document. It is available in all commercial regions at no extra charge.

This post walks one concrete example from the old way to the new way, then covers when the old way is still the right call and the pitfalls that come with the new power.

## The running example

Say one function, `order-events-processor`, needs to be invoked by three sources:

1. An S3 bucket firing `s3:ObjectCreated` events.
2. An EventBridge rule on a schedule.
3. A second AWS account in your organization that runs a batch job.

That is a normal fan-in. Nothing exotic. But look at how you had to grant it.

## Before: one add-permission call per principal

Each principal was its own statement, and each statement was its own API call. There was no policy document you edited directly; you appended to an opaque policy through `add-permission`, one `--statement-id` at a time.

```bash
# S3 bucket
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::my-orders-bucket

# EventBridge rule
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:111122223333:rule/nightly-batch

# The other account
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id cross-account-batch \
  --action lambda:InvokeFunction \
  --principal 444455556666
```

Three calls, three statement IDs to track. The bigger limit was expressiveness: each statement supported a narrow set of parameters (`--principal`, `--source-arn`, `--source-account`). You could not attach an arbitrary IAM condition. If you wanted "allow this account, but only from a principal carrying a specific tag" or "only from this source IP range," there was no place to put it. You managed a growing list of single-purpose statements and hoped the `statement-id` naming stayed sane.

## After: one policy document, multiple principals, real conditions

Now the function has a resource-based policy you can write as one JSON document, the same way you already write IAM policies everywhere else. Multiple principals collapse into one statement where they share terms, and condition keys are finally available.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AwsServicesInvoke",
      "Effect": "Allow",
      "Principal": {
        "Service": ["s3.amazonaws.com", "events.amazonaws.com"]
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:111122223333:function:order-events-processor",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "111122223333" }
      }
    },
    {
      "Sid": "CrossAccountBatch",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::444455556666:root" },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:111122223333:function:order-events-processor",
      "Condition": {
        "StringEquals": { "aws:PrincipalTag/team": "batch" },
        "StringEquals": { "aws:PrincipalOrgID": "o-exampleorgid" }
      }
    }
  ]
}
```

Two statements now carry what took three opaque calls, and the cross-account grant is scoped by a principal tag and an org ID instead of "account `444455556666`, trust me." That is the real win: not the line count, but that access decisions can finally reference the same condition keys you use in identity policies. Restrict by source IP, principal tag, org ID, or any of the standard keys, all in the document you can read in one place.

You update it in one step through the JSON editor in the Lambda console, the CLI, the SDK, or IaC like CloudFormation and SAM.

## When the old add-permission is still right

Do not rewrite working stacks for the sake of it. `add-permission` is still the simpler tool when:

- **A single service, a single source ARN.** The classic "this one bucket triggers this one function" grant is one `add-permission` call and needs no conditions. A hand-written policy document is more surface area for no benefit.
- **Your IaC already models it.** CDK's `fn.addPermission(...)` and SAM event sources generate the right grants. If the framework owns the policy, let it.
- **You never need a condition.** The entire reason to move is condition keys and multi-principal consolidation. No conditions, no consolidation, no reason.

The new capability earns its place when a function is a genuine fan-in target, when grants cross account or org boundaries, or when security wants access gated on tags or network origin.

## Pitfalls I would watch

- **Policy size is finite.** Resource-based policies have a size limit. Consolidating many principals into one document is cleaner, but a function that truly has dozens of distinct grants can bump the ceiling. Group principals that share terms; do not create one mega-statement with unrelated conditions crammed together.
- **`Principal: "*"` with a loose condition is a foot-gun.** The power to express conditions invites the anti-pattern of a wildcard principal "constrained" by a single weak condition. Prefer explicit principals. If you must use org-wide access, gate it with `aws:PrincipalOrgID`, not just an account list, and understand the blast radius.
- **A single document is a single point of edit.** Ten `add-permission` calls fail independently; one bad JSON edit can drop grants you meant to keep. Version the policy in IaC and review the diff, rather than editing live in the console.
- **Existing add-permission grants still exist.** Moving to a document does not auto-migrate old statements. Read the current policy first (`aws lambda get-policy`) so you do not silently double-grant or drop something.

## What to do

If your functions are single-trigger, leave them. Where you have a fan-in target, a cross-account invoke, or a security requirement you could not previously express, migrate that function to a full resource-based policy: read the current policy, fold shared principals into one statement, add the condition keys you actually need, and manage the document in IaC. The goal is not fewer lines. It is access rules you can read in one place and reason about with the same condition keys as the rest of your IAM.

If you also manage how services *authenticate* to your APIs, the same read-it-in-one-place instinct applies to signing and identity. I wrote about the credential side in [Use IAM Identity Center Profiles Safely from TypeScript](/blog/2023-05-23-aws-sso-with-typescript.html).
