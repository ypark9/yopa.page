---
title: "RAG를 위한 AWS 벡터 데이터베이스 — 2026년판 아키텍처 결정 가이드"
date: 2025-05-25T02:30:00-04:00
author: Yoonsoo Park
description: "AWS에서 벡터 스토어를 고르는 건 이제 다섯 개 중 하나를 고르는 문제가 아니다. OpenSearch, pgvector, Neptune Analytics, Bedrock Knowledge Bases, Kendra에 S3 Vectors가 합류하면서, 진짜 질문은 '내 워크로드가 비용/지연 곡선의 어느 구간에 사는가'임. 업데이트된 결정 프레임워크를 정리한다."
categories:
  - AWS
  - Machine Learning
  - RAG
tags:
  - opensearch
  - pgvector
  - bedrock
  - s3-vectors
  - neptune-analytics
  - kendra
  - vector-search
  - rag
---

> 예전엔 AWS에서 벡터 스토어를 고르는 게 다섯 개 중 하나를 고르는 문제였다. **Amazon S3 Vectors**가 등장하면서 이제는 *내 워크로드가 비용/지연 곡선의 어느 구간(tier)에 속하는가*로 다시 묻는 게 맞다. 각 옵션이 뭘 잘하고, 언제 낫고, 어떻게 같이 쓰일 수 있게 되는지 — 결정 프레임워크를 다시 정의한다.

> **업데이트 노트 (2026):** 이 글은 2025년 5월에 처음 썼다. 이후 S3 Vectors를 추가하고, preview에서 GA로 졸업한 서비스를 반영하고, 시점이 박혀 금방 낡아버린 표현들을 걷어냈다. 원래의 "5개 서비스" 버전을 읽었다면, 가장 큰 변화는 **"DB 하나를 고른다"는 질문 자체가 대체로 틀린 질문이 됐다**는 점이다.

## 멘탈 모델: 최고를 뽑자! 아니라 비용/지연 tier

대부분의 "어떤 벡터 DB 써야 하나" 가이드는 서비스를 나란히 세워놓고 하나 골라 올인하라는 식이다. 현실에서 AWS 네이티브 옵션들은 이제 **비용 vs 지연 곡선** 선상이 있다:

| Tier | 적합한 경우 | AWS 옵션 |
|------|-------------|----------|
| **Hot / 실시간** | 높은 QPS, sub-50ms p99, 상시 가동 | OpenSearch Service |
| **Warm / 트랜잭션** | 관계형 데이터 옆에 벡터, ACID 필요 | Aurora / RDS PostgreSQL + pgvector |
| **Cold / 비용 우선** | 수십억 벡터, 드물거나 배치성 쿼리 | **S3 Vectors** |
| **Managed / 가장 빠른 출시** | DB가 아니라 RAG가 필요 | Bedrock Knowledge Bases |
| **Graph 인지** | 유사도만큼 관계가 중요 | Neptune Analytics (GraphRAG) |
| **턴키 엔터프라이즈 검색** | 커넥터 + 접근제어, 벡터 전문성 0 | Kendra GenAI Index |

2025년 이후 흥미로운 변화는 이 표의 맨 위와 맨 아래가 이제 상호 작용을 한다는 점이다. cold 데이터에 메모리 가격을 지불 혹은, hot 벡터는 OpenSearch에, 반대의 경우는 S3 Vectors 사용. 아래에서 더 다룬다.

## Amazon S3 Vectors — 싸다! (새로운 서비스)

이 글을 처음 쓸 때는 존재하지 않았던 서비스이고, 경제성을 충분히 바꿔놓아서 맨 앞에 둘 자격이 있다.

S3 Vectors는 **벡터 저장과 쿼리를 네이티브로 지원하는 최초의 오브젝트 스토어**다 — S3 안에 벡터 인덱스를 만들고 전용 API로 쿼리하며, 프로비저닝할 클러스터가 없다. AWS는 상시 가동 벡터 DB 대비 벡터의 업로드·저장·쿼리 비용을 **최대 90%까지** 절감한다고 포지셔닝한다.

**핵심 팩트:**

- **규모:** 인덱스당 최대 **20억 벡터**, 벡터 버킷당 10,000 인덱스 — 버킷당 수조 개 벡터까지.
- **지연:** warm 쿼리는 **~100ms** 수준(sub-second). 인메모리 엔진의 한 자릿수 ms가 아니다. 이게 트레이드오프다.
- **일관성:** 강한 일관성 — 쿼리는 항상 가장 최근에 쓴 벡터를 본다.
- **인프라 없음:** 사용한 만큼 과금, 프로비저닝 0.

**적합한 자리:** 드물게 또는 배치로 쿼리되는 크고 장기적으로 사용되는 벡터셋 — 에이전트 장기 메모리, 아카이브성 시맨틱 검색, "지금까지 적재한 모든 것 검색" 코퍼스. 고QPS 실시간 서빙에는 *부적합*하다.

**진짜 중요한 통합:** S3 Vectors는 **Bedrock Knowledge Bases**에 네이티브로 연결돼 있고(KB가 S3 Vectors를 스토어로 써서 RAG 비용을 깎을 수 있다), **OpenSearch Service**와도 연결돼 tiered 전략을 짤 수 있다 — 낮은 지연이 필요한 hot 벡터는 OpenSearch, 비용이 중요한 cold 대량은 S3 Vectors. 이 tiering이 이번 업데이트에서 나온 가장 유용한 아키텍처 패턴이다.

## Amazon OpenSearch Service — scale와 latency 챔피언

OpenSearch는 아주 많은 벡터를 대상으로 **sub-second(흔히 한 자릿수 ms) 지연에서 높은 QPS**가 필요할 때 유용하다. 운영 유연성이 가장 크고 billion-scale에서 검증된 퍼포먼스를 보인다.

**강점:**

- 여러 엔진(FAISS, Lucene, NMSLIB) + HNSW, IVF, product quantization.
- 공격적 압축: binary quantization(~32배), product quantization, 그리고 메모리 요구를 크게 줄이는 disk-optimized ANN.
- 스파이크성 트래픽을 위한 OCU 단위 오토스케일링 Serverless 옵션.
- 멀티테넌시를 위한 k-NN 통합 메타데이터 필터링.

**트레이드오프:** 결국 검색 클러스터다 — 운영 복잡도와 메모리 비용을 직접 떠안는다. 이제 S3 Vectors가 cold tier로 존재하므로, 전체 코퍼스에 맞춰 OpenSearch를 사이징하기보다 *hot set은 OpenSearch, 나머지는 S3 Vectors*가 점점 정답이 된다.

## Aurora / RDS PostgreSQL + pgvector — integration 마스터

벡터가 관계형 데이터 옆에 산다면 `pgvector`가 가장 자연스럽다: 한 엔진에서 벡터 검색과 ACID 트랜잭션을, 익숙한 도구로 연결

**강점:**

- HNSW 인덱스, `halfvec`(메모리 50% 절감), sparse·binary 벡터 타입.
- iterative index scan(0.8.x) — `WHERE` 절과 벡터 검색을 합칠 때 over-filtering을 막아준다.
- 더 나은 가성비를 위한 Graviton 인스턴스, 가변 부하에 맞춰 줄어드는 Aurora Serverless v2.

**트레이드오프:** HNSW 인덱스는 메모리에 살고 싶어 해서 수백만 벡터를 넘기면 인스턴스 사이징이 중요한 결정 포인트가 된다. 피크 벡터 처리량보다 "관계형 + 벡터를 한 트랜잭션 스토어에" 두는 가치가 클 때 최적.

## Amazon Bedrock Knowledge Bases — RAG로 가는 가장 빠른 길

실제로 원하는 게 운영할 벡터 DB가 아니라 *retrieval-augmented generation* 그 자체라면, Bedrock Knowledge Bases가 매니지드 정문이다: 적재 → 청킹 → 임베딩 → 검색 → (선택) 생성, 벡터 스토어는 추상화 되어 보이지 않는다.

**2025년 이후 성숙한 것:**

- 여러 백킹 스토어 위에 올라갈 수 있다 — OpenSearch Serverless, Aurora pgvector, Neptune Analytics, 그리고 이제 비용 최적화 RAG를 위한 **S3 Vectors**.
- 멀티모달 적재, 구조화 데이터(자연어→SQL) 검색, reranking, 커스텀 청킹, 내장 RAG 평가가 "preview"에서 표준 기능 쪽으로 이동.
- GraphRAG(Neptune Analytics 경유)가 관계가 풍부한 코퍼스를 위한 검색 모드로 제공.

**트레이드오프:** 검색 내부를 관리하지 않음. 핵심은 마이그레이션 경로다 — Bedrock KB로 검증을 시작하고, KB가 못 채우는 구체적 니즈를 입증했을 때만 자체 관리 스토어로 내려가라.

## Amazon Neptune Analytics — relation master

Neptune Analytics는 벡터 유사도와 **그래프 순회**를 결합해 GraphRAG를 구동한다: 단순 유사도 검색으로는 불가능한 multi-hop, 관계 인지 검색. 지식 그래프와 촘촘히 연결된 문서에서는, 단순 최근접 이웃이 아니라 *연결*에 의존하는 질문의 답 품질을 실질적으로 끌어올린다. Ontology 생각하면 될듯.

**트레이드오프:** 순수 벡터 검색보다 모델링 복잡도가 높고, 데이터에 진짜로 풍부한 관계가 있을 때만 값을 한다. "비슷한 청크 찾기"로 충분하면 overengineering일 수 있다.

## Amazon Kendra GenAI Index — 쉬운 엔터프라이즈 검색

Kendra는 **벡터 전문성이 전혀 필요 없는** 시맨틱 엔터프라이즈 검색을 제공한다: 엔터프라이즈 소스로의 매니지드 커넥터, 내장 문서 이해, 네이티브 접근 제어. GenAI Index는 RAG 검색에 맞춰 튜닝됐고 Bedrock Knowledge Bases에 공급할 수도 있다.

**트레이드오프:** 가장 덜 유연하고 소규모에서 가장 싸지도 않지만, "누가 무엇을 볼 수 있는지를 존중하며 (multitenancy) 내부 문서를 검색한다"는 요구에는 가장 빠른 가치 실현.

## 결정 단축키

- **고QPS, 실시간, 대규모** → OpenSearch (cold 벡터는 S3 Vectors 활용).
- **수십억 벡터, 드물거나 배치성 쿼리, 비용이 제약** → S3 Vectors.
- **관계형 데이터 옆의 벡터, ACID 필요** → Aurora/RDS pgvector.
- **이번 주 안에 RAG 출시, 운영할 DB는 노노** → Bedrock Knowledge Bases.
- **답이 유사도가 아니라 관계에 달림** → Neptune Analytics (GraphRAG).
- **접근 제어 있는 엔터프라이즈 문서 검색, ML/Ops 팀 없음** → Kendra GenAI Index.

## 피해야 할 안티패턴

- **전체 코퍼스를 hot 스토어 하나에 맞춰 사이징.** 2025년엔 마땅한 cold tier가 없어서 이게 기본이었음. S3 Vectors가 생긴 지금, 거의 안 쓰는 벡터에 인메모리 가격을 낼 이유는 딱히 없다 — tier로 나눠라.
- **첫 배포부터 오버 엔지니어링.** Bedrock Knowledge Bases로 동작하는 RAG 데모가 나온다면 거기서 시작하고, 구체적 한계를 확인하면 마이그레이션하라.
- **모든 데이터 타입을 한 서비스에 우겨넣기.** 하이브리드가 정상이다: hot은 OpenSearch, cold 대량은 S3 Vectors, 관계는 Neptune, 구조화 데이터는 pgvector. 데이터 형태별로 골라라.
- **quantization 건너뛰기.** full float32 벡터를 무압축으로 돌리면 메모리와 돈을 낭비한다; binary/product quantization은 보통 품질을 유지하면서 풋프린트를 크게 줄여준다.

Cheers! 🍺
