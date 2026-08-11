---
title: "Hermes Agent를 AWS ECS Fargate와 Slack에서 운영하기"
date: 2026-05-23
lastmod: 2026-08-10
reviewed_at: 2026-08-10
author: Yoonsoo Park
description: "공식 고정 image, EFS 상태, default-deny 접근, 최소 권한 IAM과 명시적인 rollback으로 Hermes Agent Slack gateway 하나를 ECS Fargate에서 운영하는 개정 가이드."
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

Laptop에서 Hermes가 답하는 것을 확인하는 일과 Slack gateway로 계속 운영하는 일은 다르다. 운영하려면 승인된 사용자, active consumer 하나, 사라지지 않는 상태, 고정된 runtime과 잘못된 교체 뒤에 돌아갈 방법이 필요하다.

이 글은 2026년 5월 23일에 처음 공개한 배포 가이드를 현재 기준으로 전면 개정한 것이다. 원문에서는 직접 만든 image를 사용했고 월 infrastructure 비용을 $55–65로 예상했다. 실제로 운영한 뒤 Cost Explorer에서 확인한 금액은 약 833시간 기준 credit 적용 전 약 $108.9였다. 자세한 내역은 [별도의 비용 분석](/ko/blog/2026-08-08-hermes-aws-cost-breakdown.html)에 남겼다. 어느 숫자도 모든 Hermes 배포에 적용되는 가격표는 아니다.

아래 runtime 계약은 2026년 8월 10일에 공식 Hermes [Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker/), [Slack](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack), [security](https://hermes-agent.nousresearch.com/docs/user-guide/security/) 문서와 [v0.20.0 release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3)를 다시 확인한 결과다.

## 목표 architecture

ECS에서 직접 운영할 최소 구성은 다음과 같다.

- `desiredCount: 1`인 ECS Fargate service
- private ECR로 복사한 공식 `nousresearch/hermes-agent:v2026.8.3` image
- `/opt/data`에 mount한 EFS access point 하나
- public load balancer가 필요 없는 Slack Socket Mode
- Image에 들어가지 않고 task에 주입되는 Secrets Manager 값
- CloudWatch log와 deployment circuit breaker
- Slack과 model provider로 나가는 경로를 명시한 private subnet

Hermes는 `/opt/data`를 persistent home으로 사용한다. Config, credential, session, memory, skill, cron 정의와 gateway state가 이 경계에 속한다. SQLite file 하나나 `MEMORY.md` 하나만 보존해서는 완전하게 복구할 수 없다.

## 1. Runtime을 고정하고 ECR로 복사한다

`latest`를 배포하지 않는다. 검토한 release를 pull하고 platform별 digest를 기록한 다음 ECR로 복사한다.

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

Push된 ECR digest를 확인하고 task definition에는 `repository@sha256:…`를 넣는다. Tag는 어떤 release인지 알려주고 digest는 교체 결과를 결정론적으로 만든다. 이전 task-definition revision을 rollback target으로 기록한다.

## 2. Slack 접근을 default-deny로 만든다

Socket Mode와 bot token을 사용하는 Slack app을 만든다. 실제 workflow에 필요한 scope만 부여한다. 개인 assistant가 보통 필요로 하는 것은 지정된 대화 surface의 message history와 답변 권한이다. 다른 bot의 넓은 scope 목록을 그대로 복사하지 않는다.

Bot token과 Socket Mode app token은 Secrets Manager에 저장한다. `SLACK_ALLOWED_USERS`에는 bot을 사용할 수 있는 Slack member ID만 넣는다. Hermes gateway는 allow-all switch, pairing 승인, platform allowlist 또는 global allowlist로 허용하지 않은 사용자를 거부한다. 개인 Agent에 allow-all을 켜지 않는다.

OAuth scope나 event subscription을 바꾼 뒤에는 Slack app을 다시 설치해야 새 권한이 적용된다.

## 3. Service 밖에서 Hermes home을 준비한다

Production service를 대화형 setup terminal로 사용하지 않는다. 같은 EFS access point를 일회성 maintenance task에 mount하고 setup을 실행한 뒤, runtime user가 결과 file을 읽을 수 있는지 확인하고 service를 시작하기 전에 task를 종료한다.

공식 image의 home은 `/opt/data`다. Maintenance task는 production과 같은 image digest, environment, secret, EFS volume, access point, mount path와 CPU architecture를 사용해야 한다. 여기서는 setup과 진단 command만 실행한다. 같은 home을 가리키는 두 번째 gateway는 실행하지 않는다.

최소한 다음 상태를 확인한다.

```text
/opt/data/config.yaml
/opt/data/.env 또는 주입된 runtime environment
/opt/data/SOUL.md
/opt/data/memories/
/opt/data/skills/
/opt/data/sessions/
/opt/data/state.db와 존재하는 SQLite sidecar
```

정확한 file은 release에 따라 바뀔 수 있다. 불변 조건은 이 예시 목록이 아니라 Hermes home 전체다.

## 4. ECS task 경계를 정의한다

Hermes 전용 directory를 root로 사용하는 EFS access point를 만든다. 전송 중 encryption을 켜고 NFS ingress는 task security group에서만 허용한다. Task definition은 EFS를 `/opt/data`에 mount해야 한다. Container의 ephemeral storage는 source of truth가 아니다.

Execution role과 task role을 나눈다.

- Execution role은 ECR image pull, CloudWatch log 기록과 시작에 필요한 이름이 지정된 secret 조회만 담당한다.
- Task role은 Hermes tool이 실제로 사용해야 하는 AWS action만 가진다.
- 첫 답변을 성공시키기 위해 administrator policy나 넓은 Bedrock wildcard를 붙이지 않는다.
- Hermes가 AWS API를 tool로 호출할 필요가 없다면 task에 application AWS permission을 주지 않는다.

Slack Socket Mode는 outbound HTTPS와 WebSocket 연결이 필요하다. Private subnet은 egress 비용이나 위험을 없애지 않는다. NAT, egress proxy 또는 검토한 다른 outbound 방식을 선택하고 가능하면 destination을 제한한다. Slack만 사용하는 구성에는 public load balancer가 필요 없다.

공식 image의 gateway command를 사용한다.

```text
gateway run
```

공식 container는 gateway를 supervise한다. ECS service는 task 하나만 실행하고 deployment circuit breaker와 rollback을 켠다. 긴 overlap을 피하도록 minimum healthy percent를 정하되, Slack Socket Mode consumer가 동시에 실행될 위험은 별도로 다룬다. Persistent schema가 바뀌거나 rollback 가능성이 확실하지 않다면 기존 writer를 먼저 멈춘다.

## 5. Approval과 tool 범위를 정한다

업무를 안정시키는 동안 `approvals.mode: smart`를 유지하거나 `manual`을 사용한다. 사람이 없는 cron에서 위험한 command를 만났을 때는 deny하도록 둔다. 새로 만든 절차가 검토 없이 장기 executable guidance가 되지 않도록 skill write approval을 설정한다.

관계없는 filesystem은 mount하지 않는다. MCP subprocess와 tool에는 필요한 credential만 준다. Slack message, 연결된 web page, repository context, recall된 memory와 tool output을 신뢰할 수 없는 입력으로 취급한다. `SOUL.md`의 친근한 identity는 action을 승인하지 않는다.

## 6. 배포하고 검증한다

Service를 task 하나로 올리기 전에 다음을 기록한다.

- 새 task-definition ARN과 이전 ARN
- Image tag와 ECR digest
- EFS access point와 복구 가능한 backup
- 승인된 Slack user ID
- 예상 gateway profile
- Rollback 담당자와 중단 조건

그다음 배포하고 확인한다.

1. ECS가 running task 하나로 안정화된다.
2. Log에서 예상 Hermes release와 gateway 시작이 보인다.
3. 승인된 Slack 사용자가 답변을 받는다.
4. 승인되지 않은 사용자는 거부된다.
5. 무해한 tool call이 작동하고 approval 대상으로 분류한 안전한 시험이 의도한 승인 경계에 도달한다.
6. Task 교체 뒤에도 conversation과 curated memory가 남는다.
7. Slack app token을 소비하는 gateway가 하나뿐이다.

거부를 확인하려고 production에서 destructive command를 실행하지 않는다. Approval 대상으로 분류되지만 해를 주지 않는 command나 non-production profile을 사용한다.

## Upgrade와 rollback

Release가 자동 config migration을 제공하더라도 upgrade를 state migration처럼 다룬다.

1. Target release note를 읽고 고정 tag를 pull한다.
2. Digest를 기록하고 ECR로 복사한다.
3. Persistent schema가 바뀌거나 rollback이 불확실하면 gateway writer를 멈춘다.
4. EFS home 전체를 backup하고 backup을 읽을 수 있는지 확인한다.
5. 새 digest의 일회성 task에서 필요한 non-interactive migration을 실행한다.
6. Service task 하나를 시작하고 검증 목록을 수행한다.
7. 실패하면 새 writer를 멈추고, 필요할 경우 compatible snapshot을 복원한 뒤 이전 task definition으로 돌아간다.

Forward-only state migration 뒤 image만 예전 것으로 바꾸는 것은 rollback이 아니다. Image와 state snapshot이 하나의 recovery point를 이룬다.

## 이 배포가 증명한 것

이 architecture로 Hermes Slack gateway 하나가 container 교체 뒤에도 상태를 유지할 수 있다는 사실을 확인했다. ECS가 가장 저렴한 실행 위치라는 것, 모든 tool이 안전하다는 것, Agent profile을 늘리면 업무가 좋아진다는 것은 증명하지 않았다.

다음 단계는 실제 청구 내역을 측정하는 것이다. 마지막 단계는 상태를 잃지 않고, Slack consumer를 동시에 두 개 실행하지 않으면서 AWS 밖으로 옮길 수 있음을 증명하는 것이다.
