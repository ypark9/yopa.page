---
title: "ECS Deployment Observability in the Console: The Before/After, and What Your Pipeline Still Cannot See"
date: 2026-09-23T09:00:00-04:00
author: Yoonsoo Park
description: "Amazon ECS now shows a live deployment timeline with traffic shift, circuit breaker state, alarms, health checks, and failed-task diagnostics in the console. Here is what that replaces, how it lines up with a single-task Fargate service whose rollout IS the outage window, and the one gap it does not close for CDK and OpenTofu pipelines."
categories:
  - AWS
  - DevOps
tags:
  - Amazon ECS
  - fargate
  - deployment
  - observability
  - circuit-breaker
---

Deploying a service on ECS has always been a two-tool activity. You trigger the rollout with `aws ecs update-service`, then you go somewhere else to find out whether it worked: `describe-services` for the deployment state, `describe-events` for the service event log, CloudWatch Logs for the task, CloudTrail if it failed in a way the previous two could not explain. Nothing was wrong with those tools. The problem was that you had to hold the state machine in your head and re-poll it.

As of this month, ECS renders that state machine for you. The console now has a real-time deployment timeline for services using the native Linear, Canary, and Blue/Green deployment strategies: every deployment phase, the service events, and task launch and termination progress, always reflecting the current state. It is available at no additional charge in all commercial Regions and GovCloud, for any ECS service on a native deployment type.

This post is about what that actually replaces, and the one place it does not help.

## The old loop, concretely

A rollout of a single-task Fargate service used to look like this:

```bash
# 1. trigger
aws ecs update-service \
  --cluster hermes-private \
  --service hermes-gateway \
  --force-new-deployment

# 2. is it still rolling?
aws ecs describe-services \
  --cluster hermes-private \
  --services hermes-gateway \
  --query 'services[0].deployments[].[status,rolloutState,desiredCount,runningCount,failedTasks]'

# 3. what happened?
aws ecs describe-services \
  --cluster hermes-private \
  --services hermes-gateway \
  --query 'services[0].events[:10].[createdAt,message]'
```

Three query shapes, two of which people get wrong under pressure (`rolloutState` versus `status` is not the same field), and none of which tells you *why* a task died. The answer to "why" lived in CloudWatch Logs, and the answer to "who changed what" lived in CloudTrail. You assembled the story by hand.

## What the Deployments tab gives you

Select any ECS service in the console and open the **Deployments** tab. The timeline narrates the deployment as it happens:

- **Phase, service events, and task progress** on one axis, in real time. You can see whether you are scaling up green tasks, waiting on a lifecycle hook, or sitting through bake time, without translating JSON.
- **Traffic shift distribution** across the source and target revisions. For canary and blue/green this is the number you actually care about during the rollout, not after it.
- **Deployment health signals in one place**: circuit breaker status with live task failure and threshold tracking, deployment alarm state, container and load balancer health check results, and lifecycle hook status.
- **Failed tasks with diagnostic context and deep links into CloudTrail**, so the "why" and the "who" are one click from the timeline instead of three console tabs away.

| Question | Before | Now |
|----------|--------|-----|
| Which phase is it in? | Parse `deployments[].rolloutState` | Timeline shows the phase |
| How much traffic has shifted? | Derive from target group or LB stats | Traffic shift distribution in the timeline |
| Did the circuit breaker trip? | Read `deployments[].rolloutState = FAILED` and infer | Circuit breaker status with failure thresholds |
| Did the alarm fire? | Check CloudWatch separately | Alarm state on the timeline |
| Why did the task die? | CloudWatch Logs, then CloudTrail | Failed tasks with diagnostics plus CloudTrail deep links |

The scope matters: this is **deployment** observability, not runtime observability. It tells you what happened to a rollout. It is not a replacement for your metrics, traces, or log aggregation, and it is not a deployment history product. It is the missing middle between "I triggered it" and "the service is running the new version."

## Where it lines up with a single-task service

The reason this lands for me is that my Hermes Agent gateway is the worst case for the old loop and the best case for the new one. It runs as one Fargate task with no ALB and no public inbound: Slack Socket Mode dials out, so there is no HTTP port to health-check. The relevant bits of the service definition:

```ts
circuitBreaker: { enable: true, rollback: true },
minHealthyPercent: 0,
maxHealthyPercent: 100,
healthCheck: {
  command: ["CMD-SHELL", "true"], // no HTTP port exists; liveness only
},
```

Two consequences fall out of that combination, and both of them used to be things I discovered by polling:

- **With one task, `minHealthyPercent: 0` and `maxHealthyPercent: 100`, the rollout is the outage window.** There is no spare capacity, so the old task stops before the new one is healthy. The deployment timeline is the only view that tells you which phase you are spending that window in.
- **The circuit breaker is the actual failure detector, because the health check is deliberately a no-op.** A container that starts and immediately exits still passes a `CMD-SHELL true` check; the circuit breaker is what catches the crash loop and rolls back. Watching its live task failure and threshold tracking is watching the only mechanism that will save you here.

This is a nice illustration of a general rule: the less standard your health signal, the more you depend on the deployment machinery itself. The Deployments tab shows that machinery.

## Three ways a rollout reports success with nothing running

The single-task setup above has a failure mode worse than a visible crash loop: a deployment that completes, reaches steady state, and leaves the service at zero tasks. ECS is not lying in any of these. It is answering a narrower question than the one you are asking.

**1. Your IaC resets `desiredCount` on every deploy.**

If the construct declares `desiredCount: 0` — a common choice for a service that ships dark and gets scaled up by hand afterwards — CloudFormation writes that value back on *every* subsequent deploy. The hand-scaled count does not survive a release.

```
18:45:00  task definition registered
18:45:06  has stopped 1 running tasks
18:46:25  deployment completed
18:46:25  has reached a steady state      <- desiredCount 0, runningCount 0
```

Steady state is true. Deployment completed is true. The service is down and will stay down until somebody notices, and the timeline shows it as a clean finish because by its own definition it is one.

The fix is in the source, not the console: put the real count in the IaC and take a service down by changing it there. A hand-scaled count is a change that quietly undoes itself.

**2. The event log's reason field is a hypothesis, not a diagnosis.**

After that deploy the service could not place a replacement task:

```
18:59:51  was unable to place a task. The reason for failure is
          Capacity is unavailable at this time. Please try again later
          or in a different availability zone.
```

"Capacity is unavailable" named the wrong thing. A throwaway task — stock `busybox`, 0.5 vCPU, same subnets and security group, **in a different cluster that had nothing to do with this deploy** — returned `RunTask -> ServerException: Internal Error` in both AZs, while `CreateNetworkInterface` succeeded in both, the Fargate vCPU quota showed 4000 with 1.5 in use, and the service-linked role was intact.

None of that is visible in the deployment view, and the string it does show would have sent you auditing your own task sizing and subnets. When the deployment view hands you a reason, build the control that removes your change from the picture before acting on it. Ours took two minutes and turned "we broke it" into "the API is 500ing account-wide".

**3. Silence is not recovery, and it is not failure either.**

Between 18:59 and 19:45 the service posted no new events at all — not a success, not another failure. ECS backs off after repeated placement failures, and a deduplicated event log looks identical to a quiet, healthy service.

```
18:59:51  unable to place a task
          ... 46 minutes of nothing ...
19:45:52  deployment failed: tasks failed to start
19:48:50  has started 1 tasks
19:52:00  deployment completed / steady state
```

The 19:45 line is the circuit breaker doing exactly its job, and it is the first honest signal in three quarters of an hour. If you are watching events and see nothing, you have learned nothing.

One more thing that surprised me: the service scheduler and the `RunTask` API are not the same path. Our other service placed a task at 23:33 while direct `run-task` calls were still returning `ServerException`. A synthetic health probe built on `run-task` can be red while your services are fine — and, less comfortably, green while they are not.

## The gap it does not close

`--force-new-deployment` from a laptop or a one-off CLI call is exactly the workflow this console view improves. A CI/CD pipeline is not.

If your deploys run from GitHub Actions, CDK, or OpenTofu, nobody is looking at the console during the rollout, and the new timeline does not change what the pipeline can observe. You still need the API path: `describe-services` for `rolloutState`, the service event log for the human-readable reason, and your own assertion that the deployment reached `COMPLETED` rather than `FAILED`. The reasonable pattern is unchanged, and worth writing down:

```bash
# poll until the rollout settles, then fail the pipeline on FAILED
aws ecs wait services-stable \
  --cluster hermes-private \
  --services hermes-gateway
```

Two more boundaries to keep in mind:

- **Native deployment types only.** The timeline covers services using ECS native Linear, Canary, and Blue/Green. Services still on the CodeDeploy controller are out of scope, which matters if you have not migrated and are wondering why the tab looks empty.
- **It is console-scoped, so it does not appear in your observability stack.** Nothing here is an API you can query later or a dashboard you can embed. If you need a deployment record, keep capturing it where you already do.

## Pitfalls

- **Do not retire your event-log query if a pipeline depends on it.** The console view and `describe-events` are different consumers of the same rollout; only one of them can fail a build.
- **A green timeline is not a healthy service, and "steady state" is not "serving".** The timeline ends at "deployment complete." A deployment can complete, reach steady state, and leave `runningCount` at zero — most often because your IaC reset `desiredCount`. Assert on `runningCount` against the number you intended, not on `rolloutState`.
- **`minHealthyPercent: 0` costs you a gap whose length you do not control.** On a good day ours is about sixty seconds — the old task stops at :43 and the new one starts at :25 of the next minute. On the day the platform could not place a task it was fifty minutes, and the deployment had reported success at minute two.
- **`minHealthyPercent: 0` is a deliberate risk, not a default to copy.** It is correct for a single-task service that cannot have two of itself; it is wrong for anything that can run two tasks and would rather not drop a request.

## What to do

If you deploy by hand, open the Deployments tab next time before you start guessing at `describe-services` output; the phase is right there. If you deploy from a pipeline, this launch does not change your code, but it is a good prompt to make sure your pipeline actually asserts on `rolloutState` instead of assuming a forced deployment succeeded, because the failure mode of an unnoticed `FAILED` rollout is a service running the old version while everyone believes the new one shipped.

For the fuller picture of running a real service on ECS, including version pinning, secret handling, and rollback, the queue-mode design in [Run n8n Queue Mode on AWS ECS with Recoverable Operations](/blog/2026-08-01-run-n8n-queue-mode-on-aws-ecs.html) covers the parts the timeline does not.

## References

- [AWS What's New — Amazon ECS real-time deployment observability](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-ecs-console-deployment-observability/)
- [Amazon ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
- [Amazon ECS service deployment types](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
