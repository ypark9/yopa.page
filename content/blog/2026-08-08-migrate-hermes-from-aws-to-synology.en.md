---
title: "Migrating Hermes from AWS ECS to Synology Without Losing Its Memory"
date: 2026-08-08
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "A real migration of Hermes Agent from ECS Fargate and EFS to Synology Dockge, covering SQLite WAL safety, a writer-free maintenance task, Slack Socket Mode, Compose recreation, and rollback."
categories:
  - DevOps
  - Agentic AI
  - Self-Hosting
tags:
  - Hermes Agent
  - Amazon ECS
  - Synology
  - Docker Compose
  - SQLite
  - Slack Bot
atlas:
  region: archive
  object: field-note
  journeys:
    - safe-agent-operations
  evidence: production
  era: current
---

In an earlier post, I deployed Hermes Agent on ECS Fargate and kept its state on EFS. It worked well: the Slack bot stayed online, and replacing a container did not erase conversations or memory.

The architecture was also larger than I needed for one personal agent. I was operating ECS, EFS, a NAT Gateway, ECR, Secrets Manager, S3, and logs. I already had a Synology NAS running around the clock, so I asked a simpler question:

> Does this workload need Fargate, or does it need a recoverable Docker Compose deployment?

Moving the container was easy. The real work was moving SQLite state without losing a transaction and ensuring that AWS and Synology never acted as competing Slack consumers.

> **Review note (2026-08-28):** This is a completed migration snapshot, including the pinned `v2026.8.3` image. Before repeating it, resolve the current release and digest from the [Hermes Docker/configuration docs](https://hermes-agent.nousresearch.com/docs/user-guide/docker/), then preserve the same stop, backup, and rollback gates; do not copy the historical tag blindly.

## The target architecture

The AWS deployment used one Fargate task, encrypted EFS storage, and Slack Socket Mode. It had no load balancer or public inbound endpoint.

The Synology version is smaller:

```text
Slack Cloud
    ⇅ outbound TLS WebSocket
Synology NAS
    └─ Docker bridge
        └─ Hermes container
            └─ /volume1/docker/hermes/data
```

Hermes opens the outbound WebSocket to Slack. Slack does not initiate a connection to a public address on the NAS, so this setup needs no router port forwarding or published Hermes port. It is not a private link to Slack, though. Traffic still crosses the public Internet, and Slack remains a trusted external service.

[Slack's Socket Mode documentation](https://docs.slack.dev/apis/events-api/using-socket-mode/) describes the same boundary: Events API delivery without a public HTTP Request URL. Docker's bridge network provides outbound masquerading, while inbound access depends on explicitly published ports. This Compose file publishes none.

## Pin the runtime before moving data

This migration also upgraded Hermes from `0.19.0` to `0.20.0`. Combining a host move with an application upgrade makes failures harder to classify, so I treated them as separate gates even though they happened in one maintenance window.

The NAS uses the official image with both a release tag and a verified amd64 digest:

```yaml
services:
  hermes:
    image: nousresearch/hermes-agent:v2026.8.3@sha256:<verified-amd64-digest>
    restart: unless-stopped
    command: ["gateway", "run"]
    env_file:
      - .env
    environment:
      HERMES_UID: "<measured-uid>"
      HERMES_GID: "<measured-gid>"
    volumes:
      - /volume1/docker/hermes/data:/opt/data
    mem_limit: 6g
    stop_grace_period: 30s
```

I did not use `latest`, and I did not override the official `/init` entrypoint. That entrypoint fixes initial permissions and drops the Hermes process to the configured non-root identity.

UID, GID, storage capacity, and the Dockge stacks directory were measured on the NAS. They are machine-specific values, not defaults another Synology should copy blindly.

## Stop AWS before taking the final backup

My first plan was to create the final backup inside the live ECS task and immediately scale the service to zero. I changed that plan when I made the priority explicit: losing no data mattered more than avoiding downtime.

The final sequence was:

1. Stop using the Slack bot.
2. Set the ECS service desired count to zero.
3. Verify that the running task count is zero.
4. Start a one-off maintenance task that mounts the same EFS but does not run the gateway.
5. Use that task only for inspection and backup.

The maintenance task reused the task definition, subnets, security group, and EFS mount, but overrode the container command with a long `sleep`. ECS Exec remained available, while there was no Slack consumer and no SQLite writer.

Once downtime was acceptable, this was much easier to reason about. There was no race between the last backup and a final incoming message.

## A SQLite database is more than `state.db`

Hermes stores sessions and messages in SQLite. The EFS directory contained:

```text
state.db
state.db-wal
state.db-shm
```

In WAL mode, these files belong to one database generation. Copying only the main file can omit committed work. Placing an old WAL or SHM file beside a newly restored database can also corrupt the result.

With the writer stopped, I used Python's SQLite backup API:

```python
import sqlite3

source = sqlite3.connect("file:/data/hermes/state.db?mode=ro", uri=True)
target = sqlite3.connect("/tmp/state.consistent.db")
source.backup(target)
target.close()
source.close()
```

I archived the full state directory together with `state.consistent.db`, uploaded it to a private S3 migration prefix, and downloaded it again to a mode-700 directory on my Mac. The round trip was checked with SHA-256, tar extraction, and a second database inspection.

The useful invariants were:

```sql
PRAGMA quick_check;
PRAGMA foreign_key_check;
SELECT version FROM schema_version;
SELECT count(*) FROM sessions;
SELECT count(*) FROM messages;
```

The final AWS generation had schema version 22, 19 sessions, and 479 messages. `quick_check` returned `ok`, and there were no foreign-key errors. Those values became the acceptance criteria for every later step.

## Build a new NAS generation

I preserved the rehearsal directory under a timestamped name instead of deleting it. A fresh data directory then received only the state Hermes needed:

- `SOUL.md`
- `auth.json`
- the consistent `state.db`
- memories
- skills
- sessions
- Slack pairing state

I did not reuse the AWS `config.yaml`. A minimal v0.20 configuration carried over the provider, model, reasoning effort, `/opt/data` path, and Slack platform. AWS-specific paths and the Bedrock fallback were removed.

The first boot had no Slack tokens. Hermes migrated the database from schema 22 to 25 while preserving all 19 sessions and 479 messages. The integrity checks still passed.

If this gate had failed, the final AWS archive and the NAS rehearsal directory would still have been untouched.

## Two Dockge failures worth remembering

The first failure was a CPU limit:

```text
NanoCPUs can not be set, as your kernel does not support CPU CFS scheduler
or the cgroup is not mounted
```

The DS918+ kernel did not support Compose `cpus: 3.0`. Removing `cpus` allowed the container to start, while the supported memory limit remained. A Compose option being valid does not mean every Synology kernel implements its underlying cgroup feature.

The second failure was subtler. I installed the Slack tokens in a mode-600 `.env` and ran Dockge Update, but the gateway still had no platforms. Changing only `env_file` content had not recreated the existing container, so it retained the old empty environment.

I added a harmless generation marker to change the Compose configuration hash:

```yaml
environment:
  HERMES_CUTOVER_GENERATION: "20260808T182908Z"
```

Dockge Update then recreated the container. I also restored `platforms/pairing` from the AWS archive so the previously approved Slack user remained approved.

The practical lesson was simple:

> “Running” in a UI does not prove that the process is using the new configuration.

I required five independent signals:

- a new container boot timestamp;
- a current gateway heartbeat;
- `platforms.slack.state=connected`;
- authentication and Socket Mode connection logs;
- a real DM response with SOUL and memory recall.

The final NAS database stayed at 19 sessions and 479 messages after migration, now on schema 25, and the real Slack DM worked.

## The security boundary changed

No published ports is a good start, but it does not make the container harmless. A compromised container may have outbound Internet access and may be able to probe LAN resources reachable by the NAS. Its Hermes bind mount is read-write.

I keep these controls around the smaller deployment:

- DSM, Dockge, and SSH are reachable only from the LAN or a private VPN.
- There is no router port forwarding for Hermes, Dockge, or DSM.
- `.env` is mode 600 and excluded from Git.
- Slack and GitHub tokens should have the smallest practical scope.
- The image tag and digest are pinned.
- Data, `.env`, and OAuth state belong only in encrypted backups.
- An explicit Slack member allowlist is a follow-up hardening item.

Moving from managed AWS services to Compose did not remove operational responsibility. It moved that responsibility to my NAS.

## Rollback does not always mean “start AWS”

Before the NAS accepts a real message, restarting the old AWS service is a valid rollback. After the NAS creates new sessions or messages, it is not. Starting the stale EFS generation would discard everything written after cutover.

The post-cutover recovery sequence is therefore:

1. Stop the NAS gateway.
2. Create a consistent backup of the newest NAS state.
3. Repair the NAS, or restore that newer generation to EFS if AWS must return.
4. Verify the database invariants before starting any gateway.

I do not merge two SQLite databases. I select one complete, newest generation as the authoritative copy.

## Closing thoughts

Docker Compose was the easiest part of this migration. The real design was the order in which writers disappeared, database generations moved, invariants were checked, and rollback changed meaning.

For a personal workload, several minutes of downtime can be cheaper than an ambiguous recovery path. Once I accepted that tradeoff, the migration became much safer.

AWS was not deleted at cutover. EFS, the final archive, secrets, images, and infrastructure state remain until a seven-day soak, an off-box backup, and a real restore test are complete.

Sources verified on **2026-08-08**.

## References

- [Hermes Docker guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/docker.md)
- [Hermes Slack setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/)
- [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- [Docker bridge networking](https://docs.docker.com/engine/network/drivers/bridge/)
- [Python sqlite3 backup API](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup)
