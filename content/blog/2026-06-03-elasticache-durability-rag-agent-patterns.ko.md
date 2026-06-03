---
title: "ElastiCache가 durable해졌다 — RAG와 에이전트 오케스트레이션 관점에서"
date: 2026-06-03T12:00:00-04:00
author: Yoonsoo Park
description: "AWS가 ElastiCache for Valkey에 durability를 추가했다. 마이크로초 read 그대로, 데이터 손실 없음. RAG 시맨틱 캐시, Step Functions 에이전트 state, DLQ retry 버퍼 — 마지막 캐시 작업이 n8n의 Redis였던 사람의 정리 노트."
categories:
  - AWS
  - AI
tags:
  - elasticache
  - valkey
  - redis
  - rag
  - agents
  - step-functions
  - caching
---

2026년 6월 2일, AWS가 [Amazon ElastiCache durability를 발표했다](https://aws.amazon.com/about-aws/whats-new/2026/06/durability-amazon-elasticache/) (Valkey 9.0부터). 한 줄짜리 release note 같지만, ElastiCache가 무엇을 위한 서비스인지에 대한 정의를 조용히 바꾸는 변화다. 지난주까지 "캐시"는 "빠르지만 날아가도 되는 것"이었다. 이제는 cluster 단위로 write durability를 선택할 수 있고, 그 결과 그동안 무서워서 DynamoDB에 처박아두던 데이터를 ElastiCache에 정식으로 둘 수 있다.

이 글은 그 변화가 어디에서 의미 있는지 정리하는 노트다. 나는 AWS AI 인프라가 메인이고 — RAG 파이프라인, Step Functions 기반 에이전트 오케스트레이션, dead-letter retry — 마지막으로 진지하게 캐시를 다룬 게 n8n의 Redis였다. 이 셋의 접점에 캐시 패턴이 있는데, 다음 프로젝트에서 under-use하지 않으려고 한 번 정리한다.

## 무엇이 바뀌었나

기존 in-memory 속도 위에, 두 가지 새로운 write 모드가 추가됐다:

| 모드 | Write latency | 손실 가능 구간 | 언제 쓰나 |
|---|---|---|---|
| Synchronous | single-digit ms | 0 (≥2 AZ persist 후 ack) | 돈, identity, replay 불가능한 state |
| Asynchronous | microseconds (추가 비용 없음) | AZ 장애 시 최대 10초 | system of record에서 재구성 가능한 hot path |
| (기존) non-durable | microseconds | 마지막 snapshot 이후 전부 | 진짜 ephemeral 캐시 |

Read는 세 모드 모두 microsecond 그대로. 트랜잭션 로그가 multi-AZ에 있어서 failover, restart, recovery 시 commit된 데이터는 안 사라진다.

AWS 공식 문구에서 유스케이스를 — "AI agent long-term memory, AI agent workflow state, knowledge bases for RAG applications" — 이렇게 직접 명시한 게 흔치 않다. 이걸로 뭘 만들기를 기대하는지 대놓고 알려준 셈.

## 패턴 1 — RAG 시맨틱 캐시

기본 RAG 흐름은: 사용자 query → embed → vector store search → re-rank → LLM 호출. 비싼 step은 vector search와 LLM 호출 두 개. 둘 다 결정적인 부분이 있어서 캐시 가능.

```
User query
  → embed (cheap)
    → semantic cache lookup by embedding similarity     ← ElastiCache
       hit  → cached answer 반환 (microseconds)
       miss → vector store + LLM 호출
              → {embedding hash : answer} write back    ← ElastiCache
```

Key 설계 선택지:

- **Exact key**: 정규화된 prompt의 hash. 구현 간단, hit rate 낮음.
- **Semantic key**: embedding 자체를 저장하고 cosine similarity threshold 위로 approximate-match. Hit rate는 높지만 캐시 안에 vector index가 필요. Valkey/Redis 모듈로 가능하고, 작은 HNSW를 in-memory로 두는 방법도 있음.

여기서 durability가 왜 중요한지: 캐시가 ephemeral이면 cluster restart마다 LLM 비용이 cold start. Async durability면 충분 — cached answer 10초 손실은 correctness 문제 아니고 비용 spike만. Sync는 과함. **기본은 async, 그리고 더 이상 "캐시 vs 진짜 store"를 고를 필요가 없다는 점만 기억.**

밟을 함정: 업스트림 RAG가 한 번 hallucination 답변을 내놓으면 TTL 동안 다른 사용자한테 그대로 서빙됨. content-version key (model name + prompt template version + index version)를 항상 끼워서 deploy 시 manual flush 없이 자동 invalidate 되게 해야 함.

## 패턴 2 — Step Functions 에이전트 워크플로 state

Step Functions는 `Map`, `Parallel`, `Wait`, retry policy, `.waitForTaskToken`까지 잘 준다. 근데 싸게 안 주는 것들:

- 256 KB state payload보다 큰 mid-execution scratchpad
- Cross-execution memory ("이 에이전트가 한 시간 전에 이 고객을 본 적 있다")
- DynamoDB round trip 쓰기 아까운 fast lookup

Durability 전 ElastiCache는 속도는 줬지만 재구성 불가능한 데이터 두기엔 무서웠다. Durable Valkey면 패턴이 깔끔해진다:

- **Execution scope state** (Step Functions run 1회 동안 살아있음): key `agent:exec:<exec-arn>:<slot>`, TTL = max execution duration + buffer. Slot 손실이 downstream step을 망가뜨리면 sync write, 아니면 async.
- **Agent long-term memory** (run 사이에 살아있음): key `agent:user:<user-id>:facts`, TTL 없음 또는 길게. Sync write — 사용자가 persist를 기대하는 메모리.
- **Tool-call cache** (비싼 tool에 대한 idempotency): key `tool:<tool-name>:<arg-hash>`, 짧은 TTL. Async OK.

Step Functions의 Lambda task가 직접 read/write. 앞에 "memory service" Lambda 따로 둘 필요 없다. ElastiCache가 memory service.

## 패턴 3 — DLQ retry coordinator

매번 under-build하는 영역. SQS dead-letter queue는 실패 잡는 데는 좋은데, 복구 로직이 보통 "Lambda가 DLQ를 drain해서 무지성 reprocess"로 끝난다. 그게 *상관관계 있는* 실패에서 깨진다 — 동일 downstream API 장애로 1000개가 한 번에 DLQ에 들어가면, 다 reprocess, 다 다시 실패, back-off하고 retry, 반복.

Cache-coordinated retry layer가 이걸 푼다:

```
DLQ message 도착
  → cache lookup: dlq:<failure-fingerprint>     ← ElastiCache
     - window 내 count > N  → retry 보류, circuit-open flag set
     - count ≤ N            → 증가, retry, 성공 시 key 삭제
  → circuit-open이면: TTL 만료까지 retry skip
```

Fingerprint는 실패 class를 격리할 수 있는 무엇이든 — downstream service ID + error code 같은 식. Counter와 open-circuit flag를 캐시가 들고 있음. **여기는 sync durability가 진짜 값을 한다**: AZ failover로 counter가 리셋되면 back-pressure가 사라져서 막 살아난 downstream을 다시 때림. 새 sync 모드가 본전 뽑는 자리.

보너스: 같은 캐시가 per-key idempotency token도 들고 있으면, *부분적으로 성공한* retry가 결제 중복이나 record 중복 write를 안 만든다.

## Sync vs Async vs DynamoDB

내가 지금 정리하는 휴리스틱:

| 필요한 것 | 선택 |
|---|---|
| 재구성 가능, hot path, 비용 중요 | ElastiCache async |
| Correctness 중요, write rate 낮음, microsecond read 필요 | ElastiCache sync |
| Audit trail, key lookup 외 query, 가끔만 access | DynamoDB |
| 큰 blob, write-once-read-many | S3 + ElastiCache에 포인터 |

DynamoDB가 사라지진 않는다. Attribute로 query하거나 paginate하거나 audit해야 하면 여전히 DynamoDB. ElastiCache durability는 DynamoDB 대체재가 아니라, **DynamoDB를 *부실한 캐시로* 쓰는 걸 멈추게 해주는 변화**다.

## 다음에 할 것

- 내부 에이전트의 RAG step 앞에 semantic cache layer 추가. Async write, embedding-hash key, content-version 포함.
- 한 워크플로의 작은 DynamoDB "agent scratchpad" 테이블을 Valkey cluster로 PoC 교체. 다음 state가 읽는 slot은 sync write.
- Retry 시끄러운 Step Function 하나에 DLQ coordinator 패턴 spec 잡기. 이건 짓기 전에 짧은 설계 문서부터.

마지막 캐시 작업이 어떤 워크플로 툴의 Redis였다면, 이번 발표는 다시 들여다볼 이유다. "캐시 vs 데이터베이스" 선이 방금 옮겨졌다.
