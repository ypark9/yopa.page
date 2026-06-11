---
title: "OpenSearch Serverless NextGen: scale-to-zero가 RAG 비용을 진짜 바꾸나 (그리고 안 바꾸는 것)"
date: 2026-06-09T02:30:00-04:00
author: Yoonsoo Park
description: "AWS가 OpenSearch Serverless를 agentic AI용으로 새로 만들었다. scale-to-zero, 20배 burst 스케일링, 최대 60% 비용 절감. RAG vector store 입장에서 이게 실제로 뭘 바꾸는지, 발표가 안 알려주는 CloudFormation 마이그레이션 함정, 그리고 vector store 비용 얘기가 왜 RAG 엔진 교체의 근거가 못 되는지 정리한다."
categories:
  - AWS
tags:
  - opensearch
  - rag
  - bedrock
  - cost-attribution
  - serverless
---

AWS가 Amazon OpenSearch Serverless를 agentic AI 워크로드에 맞게 [밑바닥부터 다시 만들었다](https://aws.amazon.com/blogs/aws/introducing-the-next-generation-of-amazon-opensearch-serverless-for-building-your-agentic-ai-applications/). 헤드라인 숫자는 진짜고 볼 만하다: idle 컬렉션의 compute를 **0**까지 내리고(scale-to-zero), 필요하면 수 초 내 **20배**로 burst, 그리고 이전 capacity 모델 대비 최대 **60% 비용 절감**을 주장한다.

RAG 스택을 돌린다면 — 특히 managed knowledge base 뒤에서 OpenSearch Serverless가 vector store로 깔려 있는 구조라면 — 이건 바로 네 cost center에 떨어진다. 근데 내가 직접 마이그레이션을 스파이크해보니, 흥미로운 건 절감액이 아니었다. **발표가 약속하는 것과 마이그레이션이 실제로 물리는 비용 사이의 간극**이었다. 이 발표가 하나로 뭉뚱그리기 쉬운 두 개의 결정을 분리해보자.

## 발표가 실제로 말하는 것

마케팅 걷어내면 NextGen은 새 retrieval 기능이 아니라 **과금·탄력성** 변화다:

- **Scale-to-zero.** 기존 모델은 컬렉션당 OCU(OpenSearch Compute Unit) 최소치를 상시 띄워뒀다 — 트래픽이 0이어도 그 floor만큼 과금됐다. NextGen은 idle일 때 indexing/search compute를 0까지 내린다. idle compute가 아니라 storage만 낸다.
- **즉시 20배 burst.** 트래픽이 돌아오면 수 분이 아니라 수 초 안에 capacity가 다시 올라온다.
- **최대 60% 저렴** — spiky하거나 duty cycle 낮은 워크로드 기준. 사실상 모든 내부용/dev·QA RAG 환경이 여기 해당한다.

아닌 것: 더 나은 retriever도, 새 ranking 모델도, 새 connector도, RAG가 *돌려주는 결과의 품질*을 바꾸는 무엇도 아니다. 이건 vector 레이어의 청구서 최적화다. 이 프레이밍 꼭 붙들어라 — 글 후반에서 중요해진다.

## 발표가 건너뛴 마이그레이션 함정

실제 CloudFormation 변경을 스파이크하면서 찾은 것. NextGen은 기존 컬렉션에 켜는 플래그가 아니다. CloudFormation에서 "NextGen"을 표현하는 방법은 컬렉션을 새로운 **`AWS::OpenSearchServerless::CollectionGroup`** 리소스에 붙이는 거다 — 이 group이 `CapacityLimits`를 들고 있고, 거기서 indexing/search의 min OCU를 `0`으로 두면 그게 scale-to-zero 노브다. 거기에 max 상한도 같이 둔다.

함정: 컬렉션을 group에 연결하는 그 property가 **`Update requires: Replace`**다.

CFN 문서의 이 한 줄이 이야기 전체를 바꾼다. *기존* 컬렉션을 group에 붙이는 건 in-place 재구성이 아니라 — CloudFormation이 컬렉션을 **지우고 다시 만든다**. 즉:

- vector index가 날아가고 다시 빌드해야 한다.
- managed knowledge base(예: Bedrock Knowledge Bases)가 그 컬렉션을 consume한다면, 새 컬렉션에 corpus 전체를 **재인덱싱**한다.

그래서 이건 "config 한 줄"이 아니다. "새 컬렉션 + 풀 재인덱싱"이다. 소스 문서가 다른 데 사는 내부 knowledge base라면 데이터 유실 리스크는 없다 — 하지만 진짜 재인덱싱 작업이 있고, 그게 네가 돌리는 region 수만큼 곱해진다. 예산 잡아둬라. 발표는 안 알려준다.

## 실제로 밟은 함정들

- **`aws-cdk-lib`에 이미 L1이 있다.** `CfnCollectionGroup`이랑 `collectionGroupName` property 쓰려면 CDK 업그레이드가 필요할 줄 알았다. 아니었다 — 최신은 아니어도 적당히 최근인 `aws-cdk-lib`가 이미 둘 다 노출한다. 버전 올리기 전에 설치된 버전부터 확인해라. 이미 거기 있을 수 있다.
- **`generation` 필드는 없다.** `generation: NEXTGEN` 같은 토글 찾으러 다녔는데, 없다. collection-group 연결의 존재 자체가 NextGen 표현이다. 플래그 찾느라 시간 버리지 마라.
- **`cdk synth` 통과 ≠ 검증.** min 0 / max N짜리 `CollectionGroup`에 컬렉션이 연결된 valid CloudFormation을 깔끔하게 synth했다. 그건 템플릿이 컴파일된다는 증명이다. downstream consumer가 런타임에 새 컬렉션을 받아주느냐에 대해선 아무것도 증명 못 한다. (아래 계속)
- **Type-available ≠ deploy-validated.** 내가 신경 쓰는 주요 region 전부에서 `CollectionGroup` 리소스 타입이 available함을 확인했다. region 가용성이라는 blocker는 그걸로 사라진다 — 근데 "API가 그 타입을 안다"와 "실제로 배포해서 knowledge base가 거기 인덱싱했다"는 다른 게이트다. 첫 번째 통과했다고 두 번째를 건너뛰지 마라.
- **Scale-to-zero는 cold start와 맞바꾼다.** idle compute 0은 dev/QA에선 공짜 돈이다, 아무도 안 기다리니까. 고객용 path에선 idle 이후 첫 쿼리가 warm-up을 문다. 그게 받아들일 만한지는 비용 얘기가 아니라 latency 얘기다 — 그래서 나라면 이 변경을 non-prod에 먼저 게이팅하고, prod 건드리기 전에 cold-start 거동부터 증명하겠다.

## 이 발표가 대신 내려주지 않는 결정

여기가 팀들이 걸어 들어가는 함정이다. vector store 비용 발표가 도착하면, 그게 **RAG 엔진을 갈아치우라는 신호**로 읽힌다 — "우리 managed search 서비스 버리고 OpenSearch로 옮겨야 하나?"

이건 다른 결정이고, 이 발표는 그 중 하나만 건드린다.

- **"기존 OpenSearch vector store를 NextGen으로 옮길까?"** — 그래, 충분히. 이미 돌리는 인프라의 비용 최적화다. 분석은 마이그레이션 비용(재인덱싱) vs idle compute 절감. duty cycle 낮은 환경이면 이 산수는 쉽다.
- **"managed RAG 서비스를 OpenSearch로 대체할까?"** — 이 발표는 그 질문에 *무관*하다. 엔진 선택은 retrieval 품질, relevance 튜닝, ACL·멀티테넌트 필터 패리티, connector 생태계, 운영 부담의 문제다. vector 레이어에서 청구서 60% 줄어든다는 게 OpenSearch가 네 corpus에 대해 *더 잘* retrieve하는지, 지금의 접근제어 모델을 재현할 수 있는지에 대해 아무것도 말해주지 않는다. 엔진 교체를 검토 중이면 *그 축*들을 검토해라 — 비용 헤드라인이 그 작업을 대신하게 두지 마라.

둘을 뭉뚱그리는 게, 결국 몇 달짜리 엔진 마이그레이션을 idle compute 얘기일 뿐이었던 숫자로 정당화하게 되는 경로다.

## 그래서 뭘 해야 하나

1. **이미 OpenSearch Serverless를 vector store로 돌린다면:** dev에서 NextGen 마이그레이션을 스파이크해라. min OCU 0짜리 `CollectionGroup` 엮고, 컬렉션 붙이고, **실제로 배포해라** — 그리고 knowledge base가 새 컬렉션에 재인덱싱하고 retrieve하는지 확인해라. synth 통과는 그 증명이 아니다.
2. **config 한 줄이 아니라 재인덱싱으로 계획해라.** 컬렉션이 교체된다. commit 전에 환경별 재인덱싱 비용부터 알아둬라.
3. **non-prod에 먼저 게이팅해라.** idle이 공짜인 데서 scale-to-zero 절감을 챙기고, 고객용 path 뒤에 두기 전에 cold-start latency부터 증명해라.
4. **이걸로 RAG 엔진을 결정하지 마라.** managed search → OpenSearch 이동을 저울질 중이면, 그 결정이 실제로 요구하는 retrieval 품질·접근제어 평가를 돌려라. 이 발표는 거기 입력값이 아니다.

NextGen은 맞는 워크로드한텐 진짜 좋은 변화다. 다만 이게 어떤 결정에 답하는지 — 그리고 어떤 결정을 조용히 건너뛰게 유혹하는지 — 정직하게 구분해라.
