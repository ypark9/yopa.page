---
title: "DynamoDB에 벡터 검색이 붙었다: 언제 벡터 DB를 대체하고, 언제 안 되는가"
date: 2026-08-06T09:00:00-04:00
author: Yoonsoo Park
description: "이제 DynamoDB가 embedding을 저장하고 운영 데이터와 같은 테이블에서 유사도 검색을 돌린다. running 예제 하나로 이게 없애주는 sync 파이프라인을 before/after로 보고, 실제로 dedicated 벡터 스토어를 대체하는 지점이 어디인지 솔직하게 짚는다."
categories:
  - AWS
  - RAG
tags:
  - amazon-dynamodb
  - vector-search
  - rag
  - amazon-bedrock
  - semantic-search
  - architecture
---

> DynamoDB가 native vector search를 지원한다. embedding을 아이템의 attribute로 저장하고 테이블에서 바로 유사도 검색을 돌린다. 테이블 하나가 운영 데이터 저장소이자 벡터 스토어가 되는 거다. 특정 모양의 앱한테는 진짜 단순화고, 다른 앱한테는 함정이다. running 예제, 이게 지워주는 파이프라인, 그리고 경계선이 실제로 어디 있는지 보자.

전에 쓴 [AWS 벡터 데이터베이스 결정 가이드](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html)를 읽었다면, 이건 그 cost/latency 곡선 위의 새 항목이다. 다만 pitch가 거기 있는 다른 옵션들과 다르다. 더 좋은 벡터 스토어가 아니라, 아예 별도 벡터 스토어가 없는 거다.

## running 예제

제품 카탈로그를 운영한다고 하자. 모든 제품이 이미 DynamoDB 테이블에 `product_id` 키로 들어가 있고 `title`, `description`, `price`, `category`를 들고 있다. 읽기 쓰기는 이미 빠르고 싸다. 이제 제품팀이 "비슷한 제품 찾기"랑 자연어 검색("비 오는 날 하이킹용 따뜻한 재킷")을 원한다. 키워드가 아니라 의미로 매칭되는 검색.

그 semantic 레이어에는 embedding이랑 nearest-neighbor 검색이 필요하다. 질문은 그 벡터가 어디 사느냐다.

## Before: 두 번째 DB와, 그걸 정직하게 유지하는 파이프라인

지금까지 표준 답은 DynamoDB 옆에 dedicated 벡터 스토어를 두는 거였다. 제품마다 embedding을 만들어 벡터 스토어에 `product_id`로 되짚어 저장하고, 쿼리할 때 벡터 스토어를 검색해 ID를 받은 다음, 실제 제품 row를 가져오러 DynamoDB로 다시 round-trip 한다.

비싼 건 벡터 스토어 자체가 아니다. 배관이다.

```
DynamoDB (source of truth)
    | DynamoDB Streams
    v
Lambda (변경 시 embed) --> Bedrock (Titan embeddings)
    |
    v
Vector store (OpenSearch / pgvector / etc.)   <-- 계속 sync 맞춰야 함

쿼리 시점:
  query --embed--> vector store --> [product_id, ...] --> DynamoDB BatchGetItem --> rows
```

이 그림에는 오래가는 문제 세 개가 세트로 딸려 온다.

- **Sync drift.** 제품 write마다 벡터 스토어로 fan-out 해야 한다. 하나라도 놓치면(Lambda 에러, throttle, 절반만 끝난 backfill) 검색이 조용히 stale 하거나 빠진 결과를 돌려준다. 이제 reconciliation job을 네가 소유한다.
- **두 번의 round trip.** 벡터 스토어는 ID를 주니까, 사용자가 실제로 볼 row를 가져오려고 결국 DynamoDB를 또 친다. 검색할 때마다 latency가 붙고 실패 지점이 하나 더 생긴다.
- **청구서 둘, scaling 스토리 둘.** 이미 갖고 있는 데이터를 미러링하는 게 유일한 일인 두 번째 저장소를 프로비저닝하고 패치하고 돈 낸다.

## After: 벡터는 그냥 attribute 하나

native vector search에서는 이미 있는 테이블에 vector index를 추가한다. embedding이 제품 아이템의 attribute가 된다. 두 번째 스토어도 sync 파이프라인도 없다. 벡터가 그게 설명하는 row와 같은 아이템에 살기 때문이다.

인덱스를 만든다(기존 테이블에 `UpdateTable`로 추가할 수도 있다. 재생성 필요 없음).

```python
dynamodb.create_table(
    TableName="Products",
    AttributeDefinitions=[{"AttributeName": "product_id", "AttributeType": "S"}],
    KeySchema=[{"AttributeName": "product_id", "KeyType": "HASH"}],
    VectorIndexes=[
        {
            "IndexName": "VectorIndex",
            "VectorAttribute": {"AttributeName": "embedding"},
            "Dimensions": 1024,                 # embedding 모델 출력과 일치해야 함
            "DistanceFunction": "DOT_PRODUCT",  # COSINE | DOT_PRODUCT | EUCLIDEAN
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
    BillingMode="PAY_PER_REQUEST",
)
```

제품을 embedding과 함께, row를 쓰는 그 호출에서 같은 아이템에 저장한다.

```python
emb = bedrock_embed(f"{title}. {description}")   # Titan Text Embeddings V2, normalized
table.put_item(Item={
    "product_id": pid, "title": title, "description": description,
    "price": price, "category": category, "embedding": emb,
})
```

검색은 ID가 아니라 제품 row를 바로 돌려준다.

```python
q = bedrock_embed("비 오는 날 하이킹용 따뜻한 재킷")
resp = table.query(
    IndexName="VectorIndex",
    VectorSearchConfiguration={"Vector": q, "TopK": 5},
)
# resp["Items"]에 이미 title, price, category가 들어 있음. 두 번째 round trip 없음
```

`Streams -> Lambda -> vector store` 그림 전체, reconciliation job, `BatchGetItem` round trip이 다 사라진다. `Projection`이 `ALL`이라 검색이 한 번의 호출로 full row를 돌려주기 때문이다.

중요한 손잡이 몇 개.

- **Dimensions**는 모델 출력과 같아야 한다(Titan V2는 1024). 최대 4,096까지 된다.
- **Distance function**: embedding이 이미 unit-normalized면 `DOT_PRODUCT`를 쓴다(cosine과 같은데 normalization 단계를 건너뛴다). normalized 안 된 벡터면 `COSINE`, magnitude가 중요하면 `EUCLIDEAN`. `COSINE`/`EUCLIDEAN`은 낮을수록 유사, `DOT_PRODUCT`는 높을수록 유사다.
- **Projection**: `ALL`은 full row를 돌려주고, `INCLUDE`는 고른 일부만(인덱스가 작아지고 싸진다), `KEYS_ONLY`는 다시 round trip으로 돌려보낸다. 아이템이 크면 `INCLUDE`를 골라라.
- **검색은 ANN**(approximate nearest neighbor)이다. 정확도를 살짝 내주고 예측 가능한 속도와 비용을 얻는다. 규모에서는 맞는 trade지만, recall이 100%가 아니라는 뜻이고 이게 아래 결정에서 중요하다.

## 멀티테넌시 격리: 여기선 partition key가 진짜 일을 한다

카탈로그가 multi-tenant면(고객마다 자기 제품만 봄) vector index의 옵셔널 **partition key**가 흥미로운 지점이다. 인덱스를 `tenant_id` partition key로 정의하면 모든 검색이 tenant 값을 넘겨야 하고, DynamoDB는 그 tenant의 인덱스 조각만 훑는다. 세 개를 한 번에 얻는다. 더 싼 검색(훑는 데이터 감소), tenant별 throughput 쿼터, 그리고 "제대로 걸었길 바라는 필터"가 아니라 스토리지 레이어에서 강제되는 격리.

이건 대부분의 managed RAG 스택이 쓰는 "metadata 필드 붙여서 쿼리 때 필터링" 패턴보다 깔끔한 격리 스토리다. 필터 하나 빠뜨려서 한 tenant 데이터가 다른 tenant 결과로 새어 나가는 버그를 배포해 본 적 있다면, 스토리지 레벨 partitioning은 진지하게 볼 값어치가 있다.

## 그래서 언제 실제로 벡터 DB를 대체하나

DynamoDB native vector를 꺼낼 때.

- **DynamoDB가 이미 운영 저장소**고 벡터가 거기 이미 두는 row를 설명할 때. 이게 핵심 전부다. 이득은 파이프라인을 지우는 거지 더 좋은 인덱스를 얻는 게 아니다.
- **주력 쿼리가 "비슷한 아이템이랑 그 데이터 줘"**를 한 방에 하는 거일 때. 매칭된 row를 같이 돌려주는 게 이게 밥값 하는 지점이다.
- **tenant별 격리와 throughput이 필요**하고 partition key가 tenant 경계에 깔끔하게 맵될 때.
- **청구서 하나, 운영할 두 번째 물건 없음**을 원할 때.

꺼내지 말아야 할 때.

- **full managed RAG 파이프라인이 필요할 때.** DynamoDB는 vector *search*를 준다. document chunking, ingestion 파이프라인, retrieve-and-generate orchestration을 주지 않는다. 그게 turnkey로 필요하면 Bedrock Knowledge Bases가 여전히 빠른 길이고, DynamoDB로 가면 그 배관을 손으로 다시 짓는 셈이다.
- **적당한 corpus에서 recall이 near-exact 해야 할 때.** ANN + 튜닝된 dedicated 인덱스(OpenSearch)가 recall 품질에서 범용 스토어를 이긴다. 커밋 전에 네 golden set으로 측정해라. 이 숫자 하나가 마이그레이션을 조용히 결정한다.
- **source of truth가 DynamoDB에 없을 때.** 데이터가 S3나 Postgres에 살면, 벡터 담으려고 DynamoDB를 끼워 넣는 건 이 기능이 없애주는 바로 그 sync 문제를 반대 방향으로 다시 들여오는 거다.

## 실제로 밟은 함정들

- **"vector search"는 "RAG"가 아니다.** 이 기능은 nearest 아이템을 돌려준다. chunking, embedding orchestration, generation은 여전히 네가 짠다. "우린 RAG 스택 대신 DynamoDB 쓸 거야"로 프로젝트 스코프를 잡으면서 이게 안 해주는 부분을 계산에 안 넣으면 안 된다.
- **Dimensions는 인덱스 생성 시 고정이고 모델과 일치해야 한다.** 나중에 embedding 모델을 바꾸면(dimension 다름) 새 인덱스 + backfill이다. 모델 선택을 의도적으로 pin 해라.
- **`KEYS_ONLY` projection은 round trip을 조용히 다시 데려온다.** 인덱스 작게 유지하려고 이걸 걸면 hit마다 두 번째 `GetItem`으로 돌아간다. 결과 뷰가 필요한 필드만 담아 `INCLUDE`를 써라.
- **vibes 말고 recall을 측정해라.** ANN은 정확도를 속도와 바꾼다. 쿼리 열 개에선 멀쩡해 보이는 데모가 long tail에서 놓친다. 쿼리-기대결과 쌍의 golden set을 만들어, 마이그레이션 전에 지금 스토어 대비 recall을 확인해라.

## 그래서 뭘 하면 되나

이미 DynamoDB를 운영 DB로 돌리고 있고 bolt-on 벡터 스토어를 눈여겨보고 있었다면, 이걸 먼저 프로토타입 해라. 테이블 복사본에 vector index 하나 붙이고, 데이터 일부를 embed 하고, 진짜 쿼리를 golden set으로 돌려 recall을 확인해라. recall이 버티면 DB 하나, sync 파이프라인, round trip을 통째로 지운다. 안 버티면 싸게 배운 거고, [결정 가이드](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html)의 dedicated 스토어 옵션들은 그대로 거기 있다.

정신적 전환은 그 글이 끝난 지점과 같다. 질문이 "어떤 벡터 데이터베이스냐"에서 "별도로 하나 필요하긴 하냐"로 바뀐 거다.
