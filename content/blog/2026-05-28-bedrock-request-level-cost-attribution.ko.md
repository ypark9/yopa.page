---
title: "Amazon Bedrock InvokeModel 메타데이터로 요청 단위 비용 추적하기"
date: 2026-05-28T11:30:00-04:00
author: Yoonsoo Park
description: "Bedrock이 이제 InvokeModel 호출마다 team/project/environment 같은 임의의 메타데이터를 붙일 수 있게 됐다. 기존 inference profile, IAM 기반 attribution과 어떻게 다른지, 어디에 실제로 쓰면 좋은지 정리."
categories:
  - AWS
tags:
  - bedrock
  - cost-attribution
  - observability
  - finops
---

Bedrock에 워크로드 두 개 이상 올려본 사람은 다 같은 벽에 부딪힌다 — 청구서엔 모델별 큰 숫자 하나만 찍히고, Cost Explorer는 어느 기능/어느 팀/어느 환경이 그 비용을 썼는지 안 알려준다.

이걸 풀려고 AWS가 몇 가지 수단을 제공해 왔는데, 2026년 5월에 하나 더 추가됐다 — **`InvokeModel` / `InvokeModelWithResponseStream`에 request-level metadata 태깅**. Converse API엔 이미 있던 기능이 이제 구식 invocation API에도 붙은 거다. 뭐가 가능하고 뭐가 안 되는지 정리해둘 만하다.

## 뭐가 바뀐 거야

`InvokeModel` 호출에 `requestMetadata` 맵을 붙일 수 있다. 자유 형식 key/value — `team=payments`, `project=summarizer`, `env=prod`, 원하는 거 아무거나.

값은 **model invocation log**(리전별로 S3 또는 CloudWatch Logs 설정)에 들어간다. 그 다음은 Athena, CloudWatch Logs Insights, 아니면 그 위에 이미 깔아둔 분석 파이프라인에서 쿼리.

Bedrock이 제공되는 모든 상용 리전에서 사용 가능.

## 기존 attribution 수단과 어떻게 겹쳐?

이제 Bedrock 사용량을 자르는 방법이 네 개. 서로 대체재가 아니라 **다른 granularity로 다른 질문에 답하는 도구들**이다.

| 수단 | 단위 | 잘 맞는 경우 |
|---|---|---|
| Application Inference Profile | Profile (서비스) 단위 | 서비스 간 hard isolation. Profile 태그가 Cost Explorer에 그대로 뜸. |
| IAM principal | Role/User 단위 | 호출자 기준 자동 분류. 무료, 코드 수정 0. |
| Request metadata (신규) | 요청 단위 | 한 profile/role *안에서* 사용량 쪼개기 — feature/A-B test/multi-tenant. |
| Workspace-level (Claude) | Workspace 단위 | Claude 전용, 별도 billing dimension. |

멘탈 모델 — Profile과 IAM은 **구조적 attribution**, 인프라 레이아웃을 그대로 반영한다. Request metadata는 **논리적 attribution**, 코드가 자기 자신을 어떻게 보는지를 반영한다. 구조는 그대로 두고 코드 관점만 바뀔 때 이게 필요해진다.

## Request metadata가 진짜 빛나는 순간

대부분 케이스는 구조적 수단으로 풀린다. 서비스마다 inference profile 하나씩 띄우고, 각자 IAM role 따로 쓰면 Cost Explorer가 코드 한 줄 없이 다 보여준다.

Request metadata는 **구조가 너무 거칠 때** 등장한다.

- **한 서비스 안에 기능이 여러 개.** Summarization 서비스 하나가 product surface 세 곳에서 호출된다. Profile도 같고 role도 같지만, 어느 surface가 토큰을 제일 많이 태우는지 보고 싶다.
- **하나의 role 안에서 multi-tenant.** Platform Lambda가 N명 고객 대신 Bedrock을 호출. 고객별로 profile 발급하긴 부담스럽고, 요청에 `tenant_id` 찍어서 사후에 테넌트별 리포트.
- **실험/코호트 태깅.** 프롬프트 두 개로 A/B 테스트, 호출마다 variant 태깅, 로그에서 비용 차이 본다.
- **단일 계정 내 env 분리.** Dev/prod 트래픽이 같은 계정에 있고 — 스타트업 모드, 그럴 수 있다 — `env=dev` vs `env=prod` 태그로 재구조 없이 쪼갬.

## 안 되는 것들

솔직한 한계 몇 개:

- **Cost Explorer에 자동으로 안 뜸.** Inference profile 태그는 Cost Explorer로 propagate. Request metadata는 invocation log에만 들어간다. Athena(S3 로그) 또는 Logs Insights(CloudWatch) 쿼리 한 단계가 추가로 필요하다.
- **로그가 켜져 있어야 한다.** 호출하는 리전에 model invocation logging이 안 켜져 있으면 metadata는 그냥 사라진다. 새 리전 띄울 때 까먹기 쉬움.
- **호출자를 신뢰할 뿐, 메타데이터를 신뢰하는 게 아니다.** `bedrock:InvokeModel` 권한이 있는 사람은 누구나 `requestMetadata`에 아무거나 박을 수 있다. 내부 리포트엔 충분하지만 billing-grade 강제용으론 부적합. 그게 필요하면 답은 여전히 IAM role 분리 또는 계정 분리.
- **Cardinality 관리.** `request_id`나 `user_id` 같은 거 백만 개씩 unique 값으로 태깅하면 쿼리 느려지고 저장 비용 슬슬 오른다. 실제로 group by 할 만한 것만 태깅.

## 실전 셋업

새 서비스라면 이 순서:

1. 호출하는 리전에 model invocation logging 켜기. 나중에 Athena 쓸 거면 S3 destination, Logs Insights로 충분하면 CloudWatch Logs.
2. 태그 스키마를 미리 정한다. 키 두세 개면 충분 — 보통 `service`, `feature`, `env`. 문서화하고, 새 caller 추가하는 사람이 그 스키마를 따르게 한다.
3. **태그는 Bedrock client wrapper에서 주입**, 호출 지점에서 직접 박지 말 것. 스키마를 강제할 곳이 한 군데, 진화시킬 곳도 한 군데여야 한다.
4. Athena/Logs Insights 쿼리는 필요해지기 *전에* 미리 짜둔다. 비용 스파이크 터졌을 때 압박 속에서 쿼리 새로 짜는 건 피하고 싶다.

이미 서비스마다 **inference profile**을 쓰고 있다면 그건 그대로. Request metadata는 그 위에 얹는 레이어 — profile *안에서* 사용량을 쪼갤 뿐, profile을 대체하는 게 아니다.

## 짧게 요약

Bedrock에 요청 단위 태그가 생겼다. 태그는 invocation log에 들어가고 Cost Explorer엔 자동으로 안 뜬다. 구조적 attribution(profile/IAM)이 너무 거칠어서 한 서비스/한 role *안*을 더 쪼개야 할 때 쓰는 도구다. 작은 태그 스키마 정하고, 공유 client에서 주입하고, 로깅 켜둬라. 다음 비용 스파이크 때 미래의 너 자신이 고마워한다.
