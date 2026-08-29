---
title: "How to Deploy an Alexa Skill with Lambda Versions and Aliases"
date: 2026-08-29
author: Yoonsoo Park
description: "A beginner-friendly deployment pattern for Alexa skills on AWS Lambda: publish immutable versions, use beta and production aliases, run a small canary safely, roll back by moving an alias, and keep GitHub Actions credentials short-lived with OIDC."
categories:
  - AWS
  - DevOps
tags:
  - Alexa Skills Kit
  - AWS Lambda
  - GitHub Actions
  - Infrastructure as Code
  - DevOps
---

The default AWS Lambda workflow is deceptively simple: upload code and invoke `$LATEST`. It is fine for a prototype. It is a poor rollback story for a live Alexa skill.

If a customer reports that a new voice flow is broken, `$LATEST` cannot tell you exactly what they received, and rolling back means rebuilding or re-uploading an old ZIP under pressure. Lambda versions and aliases turn that into a small pointer change instead.

This guide explains the release pattern I use for Alexa skills: a beta alias for the development endpoint, a production alias for the customer endpoint, immutable versions underneath, and a cautious canary when traffic is sufficient to learn from it.

## The four Lambda names that matter

| Name | Meaning | Mutable? |
| --- | --- | --- |
| Function | The container for code and configuration. | Yes |
| `$LATEST` | The working copy you update before publishing. | Yes |
| Published version | An immutable snapshot of code and configuration, such as `12`. | No |
| Alias | A named pointer to a published version, such as `beta` or `prod`. | Yes |

The key rule is that an alias points to a *published version*, never to `$LATEST`. AWS documents this constraint in its [weighted alias routing guide](https://docs.aws.amazon.com/lambda/latest/dg/configuring-alias-routing.html). That immutable boundary gives a rollback a stable destination.

```text
Alexa Development endpoint ---> trivia-quiz-time:beta ---> version 12

Alexa Production endpoint ----> trivia-quiz-time:prod ---> version 11
                                                        \-> version 12 (10% canary)
```

The Alexa Developer Console stores an endpoint ARN, so the development and production configurations can use different qualified alias ARNs. The skill ID should also be constrained in the Lambda permission and checked by the request-handling layer; Amazon recommends validating that the request is intended for your skill in its [request-handling guidance](https://developer.amazon.com/en-US/docs/alexa/custom-skills/handle-requests-sent-by-alexa.html).

## Build a release before moving any customer traffic

The deployment order matters more than the infrastructure tool. OpenTofu, CloudFormation, CDK, or a carefully reviewed console workflow can all produce the same safe sequence:

1. Build a clean artifact from a staging directory.
2. Update the function's working configuration and code.
3. Publish a new immutable Lambda version.
4. Point `beta` at that version.
5. Test the Alexa Development endpoint in the simulator and on a device.
6. Change `prod` only after the beta checks pass.

The artifact is part of the security boundary. It should contain the application bundle, production dependencies if they are not bundled, content data, and package metadata. It should not contain `.git`, CI workflows, source tests, infrastructure state, a local `.env`, or a developer credential. A CI inspection that fails on forbidden paths is cheap protection against an accidental source-tree ZIP.

For a first migration, create a clean version of the old behavior as version 1 before introducing the modern code as version 2. Then the first production rollback has a known destination that was built by the same pipeline.

## Use beta as a real endpoint, not a label on a branch

The `beta` alias should be the endpoint configured for the Alexa **Development** version. This makes beta a complete path:

```text
commit -> tested artifact -> published Lambda version -> beta alias
       -> Alexa Development endpoint -> simulator / developer device
```

That path tests more than a Lambda invocation. It catches an unbuilt interaction model, a mismatched endpoint ARN, a missing Alexa permission, and a voice response that reads poorly on a real device.

Keep `prod` configured only for the Alexa **Live** version. Never make a production skill endpoint point to `$LATEST`, and do not expect a development alias change to update a published interaction model. Lambda deployment and Alexa publication are independent systems; [Alexa Skill Certified but Not Live](/blog/2026-08-29-alexa-skill-certified-but-not-live.html) explains the version boundary on the Alexa side.

## Canary routing: useful, but not magic

AWS lets one alias route to two published versions. For example, `prod` can send 90% of invocations to version 11 and 10% to version 12:

```hcl
resource "aws_lambda_alias" "prod" {
  name             = "prod"
  function_name    = aws_lambda_function.skill.function_name
  function_version = aws_lambda_function.skill.version

  routing_config {
    additional_version_weights = {
      "12" = 0.10
    }
  }
}
```

The snippet is illustrative: production infrastructure should derive version numbers from the deploy rather than hard-code them. The important semantics are that the alias has one primary version and, at most, one additional weighted version. Both must be published and have compatible execution settings.

AWS describes this as a probabilistic split and warns that low-traffic functions can see large variation from the configured percentage. A 10% canary with ten invocations is not meaningful evidence; it might route zero or several requests to the new version by chance. Use both a time window and a minimum new-version invocation count before promoting.

For a small personal skill, a sensible rollout can be:

| Gate | `prod` route | What to check |
| --- | --- | --- |
| Beta | 100% new version through `beta` | Contract fixtures, simulator, a real device, error-free smoke paths. |
| Canary | 90% old / 10% new | New-version invocation count, errors, throttles, and latency. |
| Midpoint | 50% old / 50% new | Same metrics over another observation window. |
| Promote | 100% new | Continue monitoring; retain the prior version as rollback baseline. |

If a mode-blocking bug or a predefined health threshold fails, update `prod` back to the previous published version. That is a rollback, not another rebuild.

## Observe the version actually invoked

Logs and metrics should tell you *which immutable version* handled a request. Lambda includes the executed version in its invocation logging, and the `ExecutedVersion` metric dimension can separate versions behind a weighted alias. Avoid logging user IDs, utterances, session attributes, or full question text just to get this observability.

For a privacy-conscious game, a structured application log entry can stay small:

```json
{
  "event": "skill_request_complete",
  "requestType": "IntentRequest",
  "mode": "survival",
  "result": "answered",
  "durationMs": 84,
  "executedVersion": "12"
}
```

The log explains the release's aggregate behavior without turning gameplay into a customer transcript. Pair it with Lambda alarms for errors, throttles, duration, and invocation count. Retain logs for a stated, limited period.

## Make CI able to deploy without long-lived AWS keys

GitHub Actions can obtain short-lived AWS credentials through OpenID Connect (OIDC) instead of storing an AWS access key and secret in GitHub. The deployment role's trust policy should be narrow: one repository, an expected branch or GitHub Environment, and the `sts.amazonaws.com` audience. GitHub's [OIDC hardening guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) describes this model.

For a small project, I separate the gates this way:

```text
pull request: lint + tests + question validation + package inspection + tofu plan
manual beta dispatch: approved environment -> OIDC role -> publish version -> beta alias
manual production dispatch: approved environment -> OIDC role -> change prod alias
```

The branch restriction is not a substitute for review, but it prevents an arbitrary branch from using the environment's deploy role. The manual dispatch keeps a merge to `main` from becoming an automatic public release.

## Permissions must follow aliases too

When Alexa invokes a qualified alias ARN, the Lambda resource policy needs permission for that qualifier. Scope the permission to the Alexa service principal and the intended skill identifier. Do not solve an alias permission error by granting an unqualified, account-wide invoke permission.

Also give the execution role only what the function needs. For a stateless trivia game that writes application logs, that may be only the CloudWatch Logs actions required to create streams and write events in its own log group. It does not need table, bucket, or broad IAM access merely because the deployment role has those abilities.

## The release record to keep

After each rollout, save a short, non-sensitive record:

- commit SHA and artifact hash;
- published Lambda version numbers;
- beta and production alias targets and weights;
- Development and Live endpoint aliases;
- smoke-test cases and result;
- observation window and aggregate health result; and
- exact rollback target.

This is enough to make the next production change predictable. The design is simple: build once, publish immutably, test through `beta`, and let `prod` be a reversible pointer rather than a copy of whatever happens to be `$LATEST`.
