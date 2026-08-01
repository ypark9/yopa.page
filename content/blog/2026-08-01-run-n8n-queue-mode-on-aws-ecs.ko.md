---
title: "복구 가능한 운영을 갖춘 AWS ECS n8n Queue Mode"
date: 2025-08-20
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2025-08-20-scaling-n8n-on-aws-serverless-architecture.html"
author: Yoonsoo Park
description: "고정 이미지, Postgres, Redis, 분리된 process role, secret, backup, upgrade와 rollback을 갖춘 ECS n8n queue-mode 설계."
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

n8n queue mode는 HTTP/editor 작업과 workflow 실행을 분리한다. 확장 단위는 “load balancer 두 개 뒤 worker 두 개”가 아니다. DB, Redis queue, encryption key와 versioned configuration을 공유하는 명확한 n8n process role들이다.

이 구조는 출발점이지 ECS가 n8n Cloud나 지원되는 Kubernetes 방식보다 항상 낫다는 주장은 아니다.

## component와 boundary

- **Main/editor:** editor UI, API, scheduling, workflow activation을 담당한다. 가능하면 SSO, VPN 또는 identity-aware ingress로 신뢰 사용자만 접근시킨다.
- **Webhook processor:** production webhook을 받고 execution을 queue에 넣는다. 필요한 webhook path만 공개한다.
- **Worker:** queued execution을 실행하며 public ingress가 필요 없다.
- **PostgreSQL:** workflow, credential metadata, execution record의 system of record다. 지원 버전, 필요 시 Multi-AZ, backup과 restore test를 사용한다.
- **Redis:** queue coordination을 맡는다. 허용 가능한 작업 손실 수준에 맞춰 n8n 지원 구성과 durability/failover를 정한다.
- **Task runner:** 현재 n8n 지침에 따라 사용자가 만든 Code node 실행을 격리한다.

별도 ALB가 실제 security, ownership, scaling boundary를 주지 않는다면 하나의 ALB에서 host/path routing을 쓴다. CORS는 ingress를 둘로 나눌 이유가 아니다. `N8N_EDITOR_BASE_URL`, `WEBHOOK_URL`, proxy trust와 allowed origin을 일치시킨다.

## version과 secret

main, webhook, worker, runner에 같은 n8n version 또는 immutable digest를 고정한다. 정상 상태에서 version을 섞거나 production에 `latest`를 배포하지 않는다.

모든 role은 같은 `N8N_ENCRYPTION_KEY`가 필요하다. AWS Secrets Manager에 저장하고 별도로 backup·restore한다. 키를 잃으면 저장 credential을 읽지 못할 수 있다. DB와 Redis 인증값은 task definition이나 CI log의 일반 environment가 아니라 ECS secret으로 전달한다. task role과 execution role을 분리하고 최소 권한을 준다.

```text
EXECUTIONS_MODE=queue
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=<private endpoint>
QUEUE_BULL_REDIS_HOST=<private endpoint>
N8N_EDITOR_BASE_URL=https://n8n.example.com
WEBHOOK_URL=https://hooks.example.com
```

변수 이름과 task-runner 요구는 바뀔 수 있으므로 고정한 n8n 버전의 문서에서 확인한다.

## network와 reliability

task, Postgres, Redis는 private subnet에 둔다. ALB listener는 ACM으로 TLS를 종료한다. security group은 ALB→HTTP role, ECS role→DB/Redis 경로로 제한하고 DB를 공개하지 않는다. workflow integration을 위한 outbound는 NAT 또는 승인된 egress/proxy로 통제한다. 임의 workflow에 넓은 network와 credential 권한이 있으면 data exfiltration이 가능하다.

editor는 public webhook보다 강하게 보호한다. WAF와 request limit은 알려진 위협을 해결할 때만 추가한다. ALB 뒤 n8n proxy·secure-cookie 설정을 확인한다.

availability가 필요한 role은 AZ에 걸쳐 최소 두 task를 둔다. worker는 queue depth와 oldest-job age로 확장하되 downstream API와 DB 용량으로 상한을 둔다. CPU만으로 backlog를 설명할 수 없다. graceful shutdown으로 새 작업을 받지 않고 실행 중인 작업을 끝내거나 안전하게 queue로 돌려보낸다.

ALB health check는 worker가 credential 복호화, Postgres query, Redis 연결, workflow 실행을 할 수 있다는 증거가 아니다. synthetic workflow와 queue age, failed execution, worker availability, DB connection/storage, Redis memory/failover, ALB 5xx와 ECS deploy failure 알람을 둔다.

## upgrade와 rollback

1. release·migration note와 필요한 intermediate version을 확인한다.
2. PostgreSQL과 encryption key를 백업하고 restore drill을 수행한다.
3. production configuration을 비운영 환경에서 대표 workflow로 시험한다.
4. 새 image를 고정하고 문서화된 migration과 role 배포 순서를 따른다.
5. 필요하면 work를 pause/drain하고 synthetic·real execution을 관찰한다.
6. DB migration이 backward compatible할 때만 image rollback한다. 아니면 사전 backup DB와 맞는 encryption key를 복구한다.

n8n Cloud는 인프라 소유를 줄인다. 개인 workload는 backup과 downtime 허용이 있다면 single VM/Compose가 단순하다. ECS는 AWS container 운영 경험이 있는 팀에 맞고 EKS는 Kubernetes 기능과 함께 더 큰 운영 비용을 준다. recovery objective, concurrency, 역량, compliance로 선택한다.

공식 자료 확인일: **2026-08-01**.

## 공식 자료

- [n8n queue mode](https://docs.n8n.io/hosting/scaling/queue-mode/)
- [n8n execution data](https://docs.n8n.io/hosting/scaling/execution-data/)
- [n8n task runners](https://docs.n8n.io/hosting/configuration/task-runners/)
- [Amazon ECS deployment rollback](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
