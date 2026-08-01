---
title: "Safe Container Updates on a Personal Docker Host"
date: 2024-01-22
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-01-22-harnessing-the-power-of-watchtower-for-docker-automated-updates-made-simple.html"
author: Yoonsoo Park
description: "A controlled update workflow for Docker and Synology hosts using pinned versions, notifications, backups, health checks, and rollback instead of blind latest-tag updates."
categories:
  - Docker
  - DevOps
tags:
  - Docker
  - Container Updates
  - Security
  - Reliability
---

Automatic container replacement looks like maintenance, but it is also an unattended production deployment. Pulling a mutable `latest` tag and restarting several stateful services can introduce a breaking application or database migration with no reviewed change, tested backup, or rollback artifact.

For a personal Docker or Synology host, the practical goal is not “never automate.” It is to separate **discovery** from **deployment** and make each update observable and recoverable.

## The current mental model

Use automation to detect new images and notify you. Promote a specific version or digest during a maintenance window after reviewing release notes. Back up persistent data, update one dependency group at a time, verify health and user workflows, then retain the previous image until the rollback window closes.

Watchtower can still be useful, especially in monitor-only mode. Mounting `/var/run/docker.sock` gives a container powerful control over the Docker daemon, effectively a host-level trust boundary. Run only a pinned, trusted Watchtower image; limit the containers it observes with labels or an explicit list; and do not expose its API publicly.

## Pin the deployment

```yaml
services:
  app:
    image: ghcr.io/example/app:2.4.1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    volumes:
      - app-data:/var/lib/app

  watchtower:
    image: containrrr/watchtower:1.7.1
    command: --monitor-only --label-enable --notifications-level info
    environment:
      WATCHTOWER_SCHEDULE: "0 30 8 * * 1"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped

volumes:
  app-data:
```

Watchtower uses a six-field cron expression that includes seconds. `0 30 8 * * 1` means Monday at 08:30. A traditional five-field expression can be rejected or mean something other than intended. Confirm the schedule in the version you actually deploy.

The example enables monitoring only for containers labeled `com.centurylinklabs.watchtower.enable=true`. Notification configuration depends on the chosen provider; test it before relying on it.

## Maintenance-window procedure

1. Read application and image release notes, including required intermediate upgrades and schema changes.
2. Record the current image reference and Compose configuration.
3. Stop application writes if the product requires a consistent backup.
4. Back up volumes and external databases, then perform a restore test periodically. A successful archive command is not proof of recoverability.
5. Change the image to a specific version or immutable digest and pull it.
6. Recreate the affected service without deleting dependencies or volumes.
7. Wait for the health check, then test login, reads, writes, scheduled jobs, and dependent services.
8. Watch logs and resource use through the rollback window.

If the new version fails before a one-way data migration, restore the previous image reference. If it migrated data incompatibly, follow the application's documented downgrade path or restore the pre-update backup. Simply starting the old image against a newer schema can make damage worse.

## Tradeoffs

Full automatic updates reduce patch delay but accept unreviewed breaking changes. Monitor-only automation needs human time but preserves a decision gate. A registry digest is immutable and ideal for reproducibility, while a version tag is more readable but depends on publisher tag discipline. Renovate or Dependabot can propose Compose changes in Git and provide a review trail; that is valuable when the host configuration is managed as code.

For disposable stateless services, auto-update plus strong health and rollback automation may be reasonable. For databases, media indexes, identity services, or anything with irreplaceable state, require a maintenance gate.

Do not confuse a container's `healthy` status with application acceptance. A health endpoint can succeed while authentication, background jobs, storage permissions, or integrations are broken. Keep a short smoke-test list for the services you actually use. On Synology, also verify Container Manager still points to the intended project, volume paths retain their permissions, and reverse-proxy routes reach the recreated container.

## Migration checklist

- Replace `latest` with a version or digest.
- Move Watchtower to monitor-only before changing deployment policy.
- Correct schedules to six-field syntax and verify timezone.
- Add real health checks and notifications.
- Inventory volumes, databases, configuration, and secrets; document backup and restore.
- Test one service group, dependency ordering, and rollback.
- Remove unused images only after the rollback period.
- Review Docker socket access and keep the management UI private.

Verified on **2026-08-01**.

## Primary sources

- [Watchtower arguments](https://containrrr.dev/watchtower/arguments/)
- [Watchtower lifecycle hooks](https://containrrr.dev/watchtower/lifecycle-hooks/)
- [Docker Compose healthcheck reference](https://docs.docker.com/reference/compose-file/services/#healthcheck)
- [Docker image digests](https://docs.docker.com/dhi/core-concepts/digests/)
