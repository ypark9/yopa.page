---
title: "Run Hermes Agent on AWS ECS Fargate with Slack"
date: 2026-05-23
lastmod: 2026-08-10
reviewed_at: 2026-08-10
author: Yoonsoo Park
description: "A maintained deployment guide for one Hermes Agent Slack gateway on ECS Fargate using the official pinned image, EFS state, default-deny access, least-privilege IAM, and explicit rollback."
categories:
  - AWS
  - Agentic AI
tags:
  - Hermes Agent
  - Amazon ECS
  - Amazon EFS
  - Slack Bot
  - Security
atlas:
  region: cloud
  object: field-note
  journeys:
    - hermes-operator
  evidence: production
  era: current
---

Running Hermes on a laptop proves that it can answer. Running it as a Slack gateway requires a different contract: one authorized audience, one active consumer, durable state, a pinned runtime, narrow AWS permissions, and a way back after a bad replacement.

This is a maintained version of the deployment I first published on May 23, 2026. The original used a custom image and estimated infrastructure at $55–65 per month. After operating it, the measured AWS usage was about $108.9 before credits for roughly 833 runtime hours. The [separate cost analysis](/blog/2026-08-08-hermes-aws-cost-breakdown.html) explains that result. Do not use either number as a universal price.

The runtime contract below was rechecked against the official Hermes [Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker/), [Slack](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack), and [security](https://hermes-agent.nousresearch.com/docs/user-guide/security/) guides and the [v0.20.0 release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3) on August 10, 2026.

## Target architecture

The smallest version I would operate on ECS contains:

- one ECS Fargate service with `desiredCount: 1`;
- the official `nousresearch/hermes-agent:v2026.8.3` image copied into private ECR;
- one EFS access point mounted at `/opt/data`;
- Slack Socket Mode, with no public inbound load balancer;
- Secrets Manager values injected into the task, never written into the image;
- CloudWatch logs and a deployment circuit breaker;
- private subnets with deliberate outbound access to Slack and the model provider.

Hermes treats `/opt/data` as its persistent home. Config, credentials, sessions, memory, skills, cron definitions, and gateway state belong to that boundary. Persisting only a SQLite filename or only `MEMORY.md` creates an incomplete restore.

## 1. Pin and mirror the runtime

Do not deploy `latest`. Pull the reviewed release, record the platform-specific digest, then mirror it into ECR.

```bash
docker pull --platform linux/arm64 nousresearch/hermes-agent:v2026.8.3
docker image inspect nousresearch/hermes-agent:v2026.8.3 \
  --format '{{json .RepoDigests}}'

aws ecr create-repository \
  --repository-name hermes-agent \
  --image-scanning-configuration scanOnPush=true

aws ecr get-login-password | docker login \
  --username AWS \
  --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker tag nousresearch/hermes-agent:v2026.8.3 \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/hermes-agent:v2026.8.3"
docker push \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/hermes-agent:v2026.8.3"
```

Resolve the pushed ECR digest and put `repository@sha256:…` in the task definition. A tag communicates the release; a digest makes replacement deterministic. Store the previous task-definition revision as the rollback target.

## 2. Prepare Slack with default-deny access

Create a Slack app with Socket Mode and a bot token. Grant only scopes needed by the workflow. A basic private assistant usually needs message history for the intended surfaces plus permission to post replies; do not copy a broad scope list from an unrelated bot.

Store the bot token and app-level Socket Mode token in Secrets Manager. Set `SLACK_ALLOWED_USERS` to the Slack member IDs that may use the bot. Hermes denies gateway users unless an allow-all switch, pairing approval, platform allowlist, or global allowlist authorizes them. Do not enable an allow-all flag for a personal agent.

After changing OAuth scopes or event subscriptions, reinstall the Slack app so the new grant takes effect.

## 3. Initialize the Hermes home outside the service

Do not let the production service become an interactive setup terminal. Mount the same EFS access point into a one-off maintenance task, run setup, confirm the resulting files are owned by the runtime user, and stop the task before starting the service.

The official image uses `/opt/data`. The maintenance task should use the same image digest, environment, secrets, EFS volume, access point, mount path, and CPU architecture as production. Run only setup and diagnostic commands there; never run a second gateway against the same home.

At minimum, verify:

```text
/opt/data/config.yaml
/opt/data/.env or injected runtime environment
/opt/data/SOUL.md
/opt/data/memories/
/opt/data/skills/
/opt/data/sessions/
/opt/data/state.db and SQLite sidecars when present
```

Exact files can change by release. The invariant is the complete Hermes home, not this illustrative list.

## 4. Define the ECS task boundary

Use an EFS access point rooted at a dedicated Hermes directory. Enable encryption in transit and restrict NFS ingress to the task security group. The task definition needs the EFS mount at `/opt/data`; ephemeral container storage is not the source of truth.

Use separate execution and task roles:

- the execution role pulls ECR images, writes CloudWatch logs, and retrieves only the named secrets required at startup;
- the task role contains only AWS actions Hermes tools actually need;
- do not attach administrator policies or broad Bedrock wildcards merely to make the first response succeed;
- if Hermes should not call AWS APIs as a tool, give the task no application AWS permissions.

Slack Socket Mode needs outbound HTTPS/WebSocket connectivity. A private subnet does not eliminate egress cost or risk. Choose NAT, an egress proxy, or another reviewed outbound design and restrict destinations where practical. There is no reason to attach a public load balancer for Slack-only operation.

Use the image's gateway command:

```text
gateway run
```

The official container supervises the gateway. Configure the ECS service for exactly one task, enable the deployment circuit breaker with rollback, set minimum healthy percent to avoid a long overlap, and still treat simultaneous Socket Mode consumers as a cutover hazard. For a stateful personal bot, stop the old writer before a migration or uncertain schema transition.

## 5. Configure approvals and tool reach

Keep `approvals.mode: smart` or use `manual` while establishing the workload. Keep unattended cron behavior at deny for dangerous commands. Configure skill-write approval so a newly generated procedure does not silently become durable executable guidance.

Mount no unrelated filesystem. Give MCP subprocesses and tools only the credentials they require. Treat Slack messages, linked web pages, repository context, recalled memory, and tool output as untrusted input. The bot's friendly identity in `SOUL.md` does not authorize an action.

## 6. Deploy and verify

Before increasing the service to one task, record:

- new and previous task-definition ARNs;
- image tag and ECR digest;
- EFS access point and a recoverable backup;
- authorized Slack user IDs;
- expected gateway profile;
- rollback owner and stop condition.

Then deploy and verify:

1. ECS stabilizes at one running task.
2. Logs identify the expected Hermes release and gateway start.
3. An authorized Slack user receives a reply.
4. An unauthorized user is denied.
5. A harmless tool call works and a dangerous test reaches the intended approval boundary.
6. A task replacement preserves the conversation and curated memory.
7. Only one active gateway is consuming the Slack app token.

Do not test destructive commands against production merely to prove denial. Use a harmless command that is classified for approval or a non-production profile.

## Upgrade and rollback

Treat an upgrade as a state migration even when the release advertises automatic config migration.

1. Read the target release notes and pull a fixed tag.
2. Record its digest and mirror it to ECR.
3. Stop the gateway writer when the release changes persistent schemas or the rollback is uncertain.
4. Back up the complete EFS home and validate that the backup can be read.
5. Run any non-interactive migration in a one-off task using the new digest.
6. Start one service task and execute the verification list.
7. If verification fails, stop the new writer, restore the compatible state snapshot when required, and return to the previous task definition.

Rolling back only the image after a forward-only state migration is not a rollback. The image and state snapshot form one recovery point.

## What this deployment proves

This architecture proved that one Hermes Slack gateway could survive container replacement while keeping state. It did not prove that ECS was the cheapest home, that every tool was safe, or that more Agent profiles would improve the work.

The next step is to measure the actual bill. The final step is to prove that the state can leave AWS without loss and without running two Slack consumers at once.
