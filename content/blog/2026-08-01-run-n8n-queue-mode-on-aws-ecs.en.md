---
title: "Run n8n Queue Mode on AWS ECS with Recoverable Operations"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A production-oriented n8n queue-mode design on ECS with pinned images, Postgres, Redis, separate process roles, secrets, backups, upgrades, and rollback."
categories:
  - AWS
  - DevOps
tags:
  - n8n
  - Amazon ECS
  - Queue Mode
  - Amazon RDS
  - Amazon ElastiCache
  - Security
---

n8n queue mode separates HTTP/editor work from workflow execution. The scalable unit is not “two workers behind two load balancers.” It is a set of explicit n8n process roles sharing a database, Redis queue, encryption key, and versioned configuration.

This architecture is a starting point, not a claim that ECS is always better than n8n's supported Kubernetes patterns or n8n Cloud.

## Components and boundaries

- **Main/editor service:** owns the editor UI, API, scheduling, and workflow activation. Keep it private to trusted users through SSO/VPN/identity-aware ingress where possible.
- **Webhook processors:** receive production webhook traffic and enqueue executions. Expose only required webhook paths.
- **Workers:** run queued executions. They do not need public ingress.
- **PostgreSQL:** system of record for workflows, credentials metadata, and execution records. Use supported PostgreSQL versions, Multi-AZ where required, backups, and restore tests.
- **Redis:** queue coordination. Configure the n8n-supported Redis mode and durability/failover appropriate to acceptable work loss.
- **Task runners:** isolate user-supplied Code node execution according to current n8n guidance.

Use one Application Load Balancer with host/path routing unless separate load balancers provide a documented security, ownership, or scaling boundary. CORS is not the reason to split ingress; configure `N8N_EDITOR_BASE_URL`, `WEBHOOK_URL`, proxy trust, and allowed origins consistently.

## Version and secrets

Pin the same n8n version or immutable image digest across main, webhook, workers, and runners. Never mix versions during steady state or deploy `latest` to production.

All roles need the same `N8N_ENCRYPTION_KEY`. Store it in AWS Secrets Manager and plan backup/restore separately; losing it can make stored credentials unreadable. Supply database and Redis authentication as ECS secrets, not plain environment values in a task definition or CI log. Use distinct task and execution roles with least privilege.

Representative environment names must be checked against the n8n version you pin:

```text
EXECUTIONS_MODE=queue
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=<private endpoint>
QUEUE_BULL_REDIS_HOST=<private endpoint>
N8N_EDITOR_BASE_URL=https://n8n.example.com
WEBHOOK_URL=https://hooks.example.com
```

Do not copy an old Compose variable list without validating current n8n documentation. Configuration names and task-runner requirements evolve.

## Networking

Run tasks, Postgres, and Redis in private subnets. ALB listeners terminate TLS with ACM. Restrict security groups by connection path: ALB to HTTP roles, ECS roles to database/Redis, and no direct public database access. Provide controlled outbound access for workflow integrations through NAT or approved egress/proxy paths, understanding that arbitrary workflows can exfiltrate data if their network and credential authority is broad.

Protect the editor more strongly than public webhook endpoints. Apply request limits and WAF rules only where they address measured threats. Verify n8n's proxy and secure-cookie settings behind the ALB.

## Scaling and reliability

Keep at least two tasks for roles that require availability across Availability Zones. Scale workers from queue depth and oldest-job age, capped by downstream API and database capacity; CPU alone does not describe backlog. Configure graceful shutdown so workers stop accepting jobs and finish or safely return work before ECS termination.

Health checks should test the correct role endpoint, but an ALB health check does not prove a worker can decrypt credentials, query Postgres, reach Redis, or run a workflow. Add synthetic workflows and alarms for queue age, failed executions, worker availability, database connections/storage, Redis memory/failover, ALB 5xx, and ECS deployment failure.

## Upgrade and rollback

1. Read n8n release and migration notes; test every intermediate version required.
2. Back up PostgreSQL and the encryption key; perform periodic restore drills.
3. Clone production configuration into a non-production environment and run representative workflows.
4. Pin the new image, run database migrations through the documented n8n process, and deploy compatible roles in a controlled order.
5. Pause or drain work if the release requires it. Observe synthetic and real executions.
6. Roll back application images only when the database migration is backward compatible. Otherwise restore the pre-upgrade database and matching encryption key according to the tested plan.

## Alternatives

n8n Cloud removes most infrastructure ownership. A single VM/Compose deployment is often simpler for personal workloads and can be reliable with backups and downtime tolerance. ECS fits teams already operating AWS container workloads. EKS adds Kubernetes ecosystem capabilities but also operational cost. Choose based on recovery objectives, concurrency, expertise, and compliance—not the word “serverless.”

Verified on **2026-08-01**.

## Primary sources

- [n8n queue mode](https://docs.n8n.io/hosting/scaling/queue-mode/)
- [n8n execution data and pruning](https://docs.n8n.io/hosting/scaling/execution-data/)
- [n8n task runners](https://docs.n8n.io/hosting/configuration/task-runners/)
- [Amazon ECS deployment rollback](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
