---
title: "Hermes를 AWS ECS에서 Synology로 옮기며 배운 데이터 무손실 마이그레이션"
date: 2026-08-08
author: Yoonsoo Park
description: "ECS Fargate와 EFS에서 운영하던 Hermes Agent를 Synology Dockge로 옮긴 실제 과정. SQLite WAL, 일회성 maintenance task, Slack Socket Mode, Compose 재생성과 복구 기준을 다룬다."
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
---

지난 글에서는 Hermes Agent를 ECS Fargate에 올리고 EFS에 상태를 보존하는 구성을 만들었다. 이 구조는 잘 동작했다. Slack bot은 늘 켜져 있었고, 컨테이너가 교체되어도 대화와 기억이 남았다.

그런데 개인용 agent 하나를 운영하기에는 AWS 쪽 구성 요소가 많았다. ECS, EFS, NAT Gateway, ECR, Secrets Manager, S3와 로그를 함께 관리해야 했다. 이미 집에 24시간 켜져 있는 Synology NAS가 있었기 때문에 질문이 생겼다.

> 이 workload는 정말 Fargate가 필요한가, 아니면 복구 가능한 Docker Compose면 충분한가?

이번 글은 그 판단의 결과다. 결론부터 말하면 컨테이너를 띄우는 일은 쉬웠다. 어려운 부분은 SQLite 상태를 한 건도 잃지 않고 옮기고, Slack consumer가 두 곳에서 동시에 실행되지 않도록 순서를 설계하는 일이었다.

## 옮기기 전 구조와 목표

AWS에서는 Hermes가 ECS Fargate task 하나로 실행되고 있었다. 상태 디렉터리는 암호화된 EFS에 있었고 Slack은 Socket Mode로 연결했다. ALB나 public inbound endpoint는 없었다.

Synology의 목표 구성은 훨씬 작다.

```text
Slack Cloud
    ⇅ outbound TLS WebSocket
Synology NAS
    └─ Docker bridge
        └─ Hermes container
            └─ /volume1/docker/hermes/data
```

Socket Mode에서는 Hermes가 Slack으로 outbound WebSocket을 먼저 연다. Slack이 NAS의 공개 주소로 접속하는 방식이 아니다. 따라서 router port forwarding이나 Hermes용 공개 포트가 필요 없다. 다만 이것을 private connection이라고 부르면 정확하지 않다. 트래픽은 공용 인터넷을 지나며 Slack은 여전히 신뢰해야 하는 외부 서비스다.

[Slack 공식 문서](https://docs.slack.dev/apis/events-api/using-socket-mode/)도 Socket Mode가 공개 HTTP Request URL 없이 Events API를 사용할 수 있는 방식이라고 설명한다. Docker bridge는 기본적으로 outbound traffic을 host 주소로 masquerade하고, 외부 접근은 publish한 port를 통해서만 허용한다. 이번 Compose에는 `ports:`가 없다.

## 한 달 운영비에서 예상하지 못한 것

처음에는 비용의 대부분이 Fargate task와 LLM에서 나올 것으로 생각했다. 실제로 약 한 달을 운영한 뒤 Cost Explorer의 `Usage` line item을 확인해 보니 그림이 달랐다. 가장 비싼 항목은 하나가 아니라 NAT Gateway, Fargate, EFS throughput 세 개였다.

측정 기간은 2026년 7월 4일부터 8월 8일까지다. Hermes가 실제로 동작한 시간은 약 833시간이었다. 아래 금액은 credit을 적용하기 전의 on-demand usage cost이며 센트 단위로 반올림했다.

| 항목 | 사용량 | 비용 |
|---|---:|---:|
| NAT Gateway 시간 및 처리량 | 833시간, 약 12.3 GB | 약 $38.04 |
| ECS Fargate ARM | 833 vCPU-hours, 1,664 GB-hours | 약 $32.92 |
| EFS Elastic Throughput 데이터 접근 | 약 730.5 GB | 약 $31.97 |
| EFS 저장 공간 | 평균 1 GB 미만 | 약 $0.14 |
| NAT용 public IPv4 | 약 833시간 | 약 $4.17 |
| Secrets Manager | secret 3개 | 약 $1.32 |
| ECR 저장 공간 | 기간 중 누적 사용량 | 약 $0.34 |
| EFS backup | 1 GB 미만 | 약 $0.02 |
| **합계** |  | **약 $108.9** |

S3와 CloudWatch Logs는 이 workload 규모에서는 사실상 반올림 오차 수준이었다. LLM 비용도 이 표에 포함하지 않았다. 당시 Hermes의 기본 provider는 OpenAI Codex였고 AWS Bedrock usage는 $0이었다. OpenAI 구독이나 외부 provider 비용을 AWS 인프라 비용과 섞으면 비교가 오히려 어려워진다.

내 AWS 계정에는 이 기간 promotional credit이 있었다. 계정 전체 Usage는 약 $113.22였고 거의 같은 금액의 credit이 적용되어 실제 현금 청구는 거의 $0이었다. 그렇다고 이 구성이 무료였던 것은 아니다. **개인 agent 하나가 약 $109의 credit을 한 달 남짓 동안 소비했다**고 보는 편이 정확하다. Credit이 끝난 다음 달부터는 같은 구조가 그대로 청구된다.

가장 놀라운 항목은 EFS였다. 저장된 데이터는 마지막 측정에서도 약 924 MB였지만, Elastic Throughput data access는 약 730 GB였다. EFS 비용을 계산할 때 저장 용량만 보면 이 차이를 놓친다. Hermes가 SQLite와 여러 상태 파일을 얼마나 자주 읽고 썼는지 별도 tracing을 하지 않았기 때문에 특정 동작 하나를 원인으로 단정할 수는 없다. 다만 작은 파일 시스템도 반복적인 I/O 패턴에서는 throughput 비용이 저장 비용보다 훨씬 커질 수 있다는 사실은 실제 청구 내역으로 확인했다.

NAT Gateway도 비슷했다. Hermes에는 public inbound endpoint가 없었지만 private subnet에서 Slack과 provider API로 나가기 위해 NAT를 24시간 유지했다. 트래픽이 적어도 시간당 요금은 계속 발생한다. 이번 기간에는 NAT 처리량 요금보다 고정 시간 요금이 압도적으로 컸다.

이 비용표를 다시 본다면 다음 네 가지를 먼저 계산할 것이다.

1. 항상 켜진 task의 vCPU와 memory 시간
2. private subnet outbound를 위한 NAT와 public IPv4 고정비
3. 파일 시스템의 저장량뿐 아니라 throughput mode와 data access
4. credit이 사라진 뒤의 할인 전 비용

[AWS VPC pricing](https://aws.amazon.com/vpc/pricing/), [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/), [Amazon EFS pricing](https://aws.amazon.com/efs/pricing/), [AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/)에서 현재 단가를 확인할 수 있다. 이 글의 숫자는 내 리전, 실행 시간과 I/O 패턴에 따른 실제 사례이지 모든 Hermes 배포의 고정 가격은 아니다.

## 먼저 이미지를 고정했다

마이그레이션과 upgrade를 동시에 하면 실패 원인을 나누기 어렵다. 하지만 이번에는 Hermes `0.19.0`에서 `0.20.0`으로 올라가야 했기 때문에 두 변화를 분리된 gate로 다뤘다.

NAS에서는 공식 이미지를 사용하고 tag와 amd64 digest를 함께 고정했다.

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

`latest`는 쓰지 않았다. 공식 entrypoint `/init`도 override하지 않았다. 이 entrypoint가 초기 권한을 정리하고 실제 Hermes process를 non-root 사용자로 실행하기 때문이다.

UID/GID와 Dockge stack 경로도 추측하지 않았다. NAS에서 직접 측정했다. Synology 모델과 DSM 설정에 따라 값이 다를 수 있기 때문에 다른 장비에서 이 Compose를 그대로 복사하면 안 된다.

## 가장 중요한 결정: AWS를 먼저 멈춘다

처음에는 live ECS task 안에서 final backup을 만들고 곧바로 desired count를 0으로 내리는 방식을 생각했다. 하지만 서비스 연속성보다 데이터 무손실이 더 중요했다. 그래서 순서를 바꿨다.

1. Slack 사용을 중단한다.
2. ECS service desired count를 0으로 내린다.
3. running task가 0인지 확인한다.
4. 같은 EFS를 mount하지만 gateway는 실행하지 않는 일회성 maintenance task를 띄운다.
5. maintenance task에서 backup과 검증만 수행한다.

maintenance task는 기존 task definition, subnet, security group과 EFS mount를 그대로 사용하되 container command를 긴 `sleep`으로 override했다. 덕분에 ECS Exec으로 EFS에 접근할 수 있었지만 Slack consumer와 SQLite writer는 존재하지 않았다.

서비스 중단을 허용하면 이 방식이 훨씬 단순하다. “백업과 task 종료 사이에 새 메시지가 들어오면 어떻게 하지?”라는 race 자체가 사라진다.

## `state.db`만 복사하면 안 되는 이유

Hermes의 session과 message는 SQLite에 저장된다. 당시 EFS에는 다음 세 파일이 존재했다.

```text
state.db
state.db-wal
state.db-shm
```

WAL mode에서 이 셋은 같은 database generation이다. main DB만 복사하거나, 새 DB 옆에 과거 WAL/SHM을 남기면 최신 transaction이 빠지거나 database가 손상될 수 있다.

writer가 없는 maintenance task에서 Python SQLite backup API를 사용했다.

```python
import sqlite3

source = sqlite3.connect("file:/data/hermes/state.db?mode=ro", uri=True)
target = sqlite3.connect("/tmp/state.consistent.db")
source.backup(target)
target.close()
source.close()
```

그 뒤 원본 상태 디렉터리와 `state.consistent.db`를 하나의 archive로 만들고 private S3에 올렸다. Mac으로 다시 내려받아 SHA-256, tar 압축 해제, DB 검사를 다시 수행했다.

검증 기준은 단순히 파일 크기가 비슷한지가 아니었다.

```sql
PRAGMA quick_check;
PRAGMA foreign_key_check;
SELECT version FROM schema_version;
SELECT count(*) FROM sessions;
SELECT count(*) FROM messages;
```

최종 AWS 기준은 schema 22, session 19개, message 479개였다. `quick_check`는 `ok`, foreign key 오류는 0건이었다. 이 숫자가 이후 단계의 invariant가 됐다.

## NAS에서는 복구가 아니라 새 generation을 만들었다

기존 NAS rehearsal 데이터는 삭제하지 않고 timestamp가 붙은 디렉터리로 옮겼다. 새 data directory를 만든 다음 필요한 상태만 복원했다.

- `SOUL.md`
- `auth.json`
- consistent `state.db`
- memories
- skills
- sessions
- Slack pairing state

AWS의 오래된 `config.yaml`은 그대로 쓰지 않았다. v0.20이 이해하는 최소 설정을 새로 만들고 provider, model, reasoning effort, `/opt/data`, Slack platform만 명시했다. Bedrock fallback과 AWS 전용 경로는 제거했다.

첫 부팅은 Slack token 없이 했다. 이 단계에서 v0.20 migration이 DB schema를 22에서 25로 올렸다. session과 message 수는 19/479로 그대로였고 DB 검사도 다시 통과했다.

이 방식의 장점은 명확하다. migration이 실패하더라도 AWS final archive와 NAS rehearsal directory는 손대지 않은 채 남아 있다.

## Dockge에서 실제로 걸린 두 가지 문제

첫 번째는 CPU limit이었다.

```text
NanoCPUs can not be set, as your kernel does not support CPU CFS scheduler
or the cgroup is not mounted
```

DS918+의 현재 kernel에서는 Compose의 `cpus: 3.0`을 적용할 수 없었다. `cpus`를 제거하자 container가 정상 생성됐다. memory limit은 유지했다. Compose option을 지원한다고 해서 모든 Synology kernel이 그 기능을 제공하는 것은 아니었다.

두 번째는 `.env` 변경이었다. Slack token을 mode 600의 `.env`로 옮기고 Dockge에서 Update했지만 gateway에는 platform이 하나도 나타나지 않았다. 원인은 `.env` 내용만 바뀌었을 때 기존 container가 재생성되지 않은 것이었다.

Compose에 비밀값이 아닌 generation marker를 추가해 configuration hash를 바꿨다.

```yaml
environment:
  HERMES_CUTOVER_GENERATION: "20260808T182908Z"
```

그 뒤 Dockge Update로 container를 재생성했다. 또 AWS archive의 `platforms/pairing`도 함께 복원해야 기존 승인 사용자가 유지됐다.

여기서 배운 가장 실용적인 교훈은 이것이다.

> UI에 Running이라고 표시되는 것과 새 설정으로 올바르게 실행되는 것은 다르다.

나는 다음 다섯 가지를 모두 확인했다.

- 새 container boot timestamp
- 현재 gateway heartbeat
- `platforms.slack.state=connected`
- Slack authentication과 Socket Mode log
- 실제 DM 왕복과 SOUL/memory 회상

최종적으로 DB는 schema 25, session 19개, message 479개를 유지했고 Slack DM도 정상 동작했다.

## 보안 경계는 AWS보다 단순해졌지만 자동으로 강해지지는 않는다

공개 port가 없다는 것은 좋은 출발점이다. 하지만 container가 침해되면 outbound Internet과 NAS가 접근할 수 있는 LAN 자원을 탐색할 수 있다. bind mount된 Hermes data도 read-write다.

그래서 다음 조건을 유지한다.

- DSM, Dockge와 SSH는 LAN 또는 private VPN에서만 접근한다.
- router에 Hermes, Dockge, DSM port forwarding을 만들지 않는다.
- `.env`는 mode 600이며 Git에 넣지 않는다.
- Slack과 GitHub token은 최소 권한으로 제한한다.
- image tag와 digest를 함께 고정한다.
- data, `.env`, OAuth state는 암호화된 backup에만 포함한다.
- 명시적인 Slack user allowlist를 추가하는 것을 다음 hardening 항목으로 둔다.

Docker Compose가 짧아졌다고 backup과 monitoring까지 사라지는 것은 아니다. 운영 책임이 AWS managed service에서 내 NAS로 이동했을 뿐이다.

## rollback은 “AWS를 다시 1로”가 아니었다

NAS가 아직 실제 메시지를 받기 전이라면 AWS service를 다시 시작할 수 있다. 하지만 NAS에서 새 session이나 message가 생성된 뒤 stale AWS database를 켜면 그 이후 데이터가 사라진다.

따라서 cutover 이후의 기본 장애 대응은 다음과 같다.

1. NAS를 중지한다.
2. NAS의 최신 consistent backup을 만든다.
3. NAS를 복구하거나, 정말 AWS로 돌아가야 하면 최신 NAS generation을 EFS에 복원한다.
4. DB invariant를 확인한 뒤 AWS gateway를 시작한다.

두 SQLite database를 병합하지 않는다. 항상 가장 최신인 하나의 complete generation을 authoritative copy로 선택한다.

## 마무리

이번 이전에서 Compose는 가장 쉬운 부분이었다. 실제 작업의 중심은 writer를 없애는 순서, SQLite generation, 검증 가능한 기준치와 rollback의 의미를 정하는 일이었다.

개인 workload에서는 몇 분의 중단보다 복구 가능한 상태가 더 중요할 때가 많다. 그 조건을 먼저 인정하자 migration 설계도 단순해졌다. AWS는 바로 삭제하지 않았다. NAS를 7일간 관찰하고, off-box backup과 실제 restore test가 끝난 뒤 별도 승인으로 제거할 예정이다.

공식 자료 확인일: **2026-08-08**.

## 참고 자료

- [Hermes Docker guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/docker.md)
- [Hermes Slack setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/)
- [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- [Docker bridge networking](https://docs.docker.com/engine/network/drivers/bridge/)
- [Python sqlite3 backup API](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup)
