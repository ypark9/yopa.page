---
title: "Amazon Bedrock 요청 단위 비용 추적 — InvokeModel 메타데이터, Inference Profile, 그리고 언제 뭘 쓸 것인가"
date: 2026-06-01T02:30:00-04:00
author: Yoonsoo Park
description: "Amazon Bedrock이 이제 모든 InvokeModel 호출에 임의 메타데이터를 태깅할 수 있게 됐다. application inference profile, IAM 기반 추적과 함께 비용을 쪼개는 세 번째 방법이 생긴 셈. 셋이 어떻게 다르고, 언제 뭐가 이기고, 기존 대시보드를 깨뜨리지 않으면서 request-level 메타데이터를 invocation log에 어떻게 흘려보내는지 정리한다."
categories:
  - AWS
  - Bedrock
tags:
  - bedrock
  - cost-attribution
  - observability
  - inference-profile
  - finops
---

Bedrock 위에 두 개 이상의 팀, 제품, 환경을 올리는 순간 가장 먼저 듣는 재무 질문 이것: **"누가 토큰을 썼지?"** 그리고 최근까지 답은 *"어느 API를 부르냐에 따라 다르다"* 였다.

`Converse`와 `ConverseStream`에는 진작부터 `requestMetadata` 필드가 있었다. 임의의 key/value 태그가 invocation log로 그대로 흘러간다. 그런데 운영 코드의 상당수는 여전히 더 저수준인 `InvokeModel` / `InvokeModelWithResponseStream`을 쓰고, 거기엔 metadata 자체가 없었다. 그래서 선택지는 셋 중 하나였다 — `Converse`로 마이그레이션하거나, 워크로드를 별도 inference profile로 쪼개거나, IAM role 단위 granularity로 만족하거나.

2026년 5월, AWS가 [그 갭을 메웠다](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-bedrock-request-level-usage-attribution/). `InvokeModel`과 `InvokeModelWithResponseStream`도 이제 request-level metadata를 받는다. Bedrock이 제공되는 모든 상용 리전에서 사용 가능.

작은 변화처럼 들리지만 아니다. 이건 어떤 attribution 전략을 default로 깔지를 바꾼다.

## Bedrock 비용을 쪼개는 세 가지 방법

이제 production-grade로 "누가 뭘 썼지"를 묻는 방법은 세 가지다. 서로 배타적이지 않고 — 잘 갖춰진 환경은 보통 두 개를 동시에 쓴다 — 다만 무엇에 답하는가가 다름.

| 메커니즘 | Granularity | 답하는 질문 |
|---------|-------------|-------------|
| **Application Inference Profile** | 서비스/앱 단위 | "이 *제품* 운영 비용이 얼마지?" |
| **IAM principal** (role/user) | role 단위 | "이 *호출자*가 얼마 썼지?" |
| **Request metadata** (신규) | 요청 단위 | "공유 profile 안에서도 *이 팀 / 프로젝트 / env / user*가 얼마 썼지?" |

### Application inference profile

Platform team이 이미 있다면 십중팔구 이게 현재 default일 거다. 서비스마다 inference profile을 깔고, 트래픽을 그 profile로 라우팅하면 Cost Explorer가 profile ARN 단위로 청구서를 쪼개준다. 깔끔하고, audit 친화적이고, application inference profile을 지원하는 모델 (특히 cross-region inference 통한 Claude 계열)에서 잘 동작한다.

문제는: profile은 거친 단위라는 것. 사내 세 팀이 하나의 "shared experimentation" 서비스를 같이 쓰면? - 셋 다 같은 profile 아래로 들어간다.

### IAM 기반 attribution

공짜, 자동이고, 가장 손이 덜 가는 옵션. 호출자별로 별개 role만 잡혀 있으면 Cost Explorer가 IAM principal 단위로 묶어준다. 켜는 순간 동작하고, SSO랑도 잘 맞는다. 단점은 IAM 디자인만큼만 세밀하다는 것 — 그리고 대부분 팀은 결국 몇 개의 "service role"로 수렴해서 내부 구조를 다 가려버린다.

### Request metadata

이번에 새로 들어온 거. 작은 태그 맵 — 예를 들어 `{ "team": "growth", "project": "onboarding-assistant", "env": "prod", "user_id": "u_8421" }` — 을 매 `InvokeModel` 호출에 붙인다. 태그는 model invocation log (S3 또는 CloudWatch)에 그대로 떨어지고, 평소 쓰는 Athena, OpenSearch로 쿼리한다.

진짜 가치는 *post-hoc 유연성*이다. 새 질문 하나 떠오를 때마다 IAM 트리를 다시 짜거나 inference profile을 쪼갤 필요가 없다. 모든 호출에 `team`이랑 `feature`만 박아두면, 이후로 다양한 방향으로 다시 자를 수 있다.

## 언제 뭐가 이기나

운영해보면서 정리한 운영 방식:

- **Inference profile**은 *별도 청구나 SLO를 가진 제품들 사이의 chargeback* 단위로 맞다. Cost Explorer에 깔끔하게 잡히고, 청구서를 조작하기 어렵고, platform 팀에 진짜 핸들 (rate limit, model access, regional routing)을 준다.
- **IAM**은 *security boundary* 단위로 맞다. role 두 개가 서로의 데이터를 볼 수 있다면 metadata 태깅으로 해결될 일이 아니다. IAM은 격리 강제용으로 쓰고, primary cost knob으로 쓰지 마라.
- **Request metadata**는 *제품 분석과 feature 단위 unit economics* 단위로 맞다. "추천 박스가 active user 한 명당 얼마지?" "새 prompt template이 conversation당 토큰 비용을 올렸나?" 이런 질문은 계속 새로 생기고, 그때마다 인프라 변경하는건 답답.

건강한 setup은 셋이 공존 — 청구서는 profile, blast radius는 IAM, 대시보드는 metadata.

## 연결하는 법

메카니즘은 단순한데, 빼먹으면 안 되는 단계가 셋 있다.

### 1. Model invocation logging 켜기

읽을 수 없으면 metadata는 의미가 없다. 호출하는 리전마다 Bedrock model invocation logging을 켜고 destination을 정한다 — 장기 보관이랑 Athena 쿼리는 S3가 싸고, 실시간 grep은 CloudWatch Logs. 둘 다 켜도 되지만 결국 한쪽으로 수렴한다.

리전별 설정이라서 새 리전 띄울 때 까먹기 쉽다. 계정 부트스트랩 CDK / Terraform에 적용하기.

### 2. 매 호출에 `requestMetadata` 넘기기

`InvokeModel`과 `InvokeModelWithResponseStream`의 신규 `requestMetadata` 파라미터는 flat한 string-to-string 맵을 받는다. key/value 길이 제한이 있고 (tag 수준 예산이지 blob storage가 아니다), 같은 필드가 `Converse` / `ConverseStream`에서도 동일하게 동작한다.

진짜 중요한 건 **공용 client wrapper에서 metadata를 주입하는 것** — 호출 site마다 따로가 아니라. feature 별로 자기 맘대로 태그를 박게 두면 inconsistent key 수프 (`team`, `Team`, `team_name`, `owning_team`)가 되고 대시보드에 정확하지 않은 데이터가 보여짐. 스키마 하나 정해서, 어딘가에 적어두고, 한 곳에서 강제해야됨.

쓸 만한 starter schema:

| Key | 예시 | 필수? |
|-----|------|-------|
| `team` | `growth`, `core`, `platform` | 예 |
| `service` | `onboarding-assistant` | 예 |
| `env` | `dev`, `qa`, `prod` | 예 |
| `feature` | `summarize`, `chat`, `eval` | 선택 |
| `request_id` | `req_01J…` (자체 correlation id) | 선택 |

retention을 진지하게 고려하지 않았다면 PII나 full user ID는 거기 박지 마라. 로그는 오래 유지된다.

### 3. 로그 쿼리

S3에 떨군다면 [공식 partition layout](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)이 Athena랑 잘 맞는다. 첫 쿼리는 보통 이런 모양이다:

```sql
SELECT
  request_metadata['team']     AS team,
  request_metadata['service']  AS service,
  SUM(input_token_count)       AS input_tokens,
  SUM(output_token_count)      AS output_tokens
FROM bedrock_invocation_logs
WHERE date = current_date - interval '7' day
GROUP BY 1, 2
ORDER BY input_tokens + output_tokens DESC
```

토큰을 모델별 단가로 곱하면 팀 단위 주간 청구서가 나오고, 박아둔 어떤 태그로도 다시 나눌 수 있다.

## 실제로 경험한 문제들

디버깅 한번 아낄 만한 것들:

- **리전 미스매치.** Logging은 리전별. 로깅이 꺼진 리전 호출은 사라진다 — Cost Explorer엔 잡히는데 대시보드엔 없고, 피드백이 없음.
- **Streaming 응답.** `InvokeModelWithResponseStream`은 stream이 끝난 뒤에야 token count를 기록한다. 클라이언트가 중간에 끊기면 row가 부분 데이터로 남을 수 있다. 모든 row가 "준비되었다"고 가정하지 말아야됨.
- **Schema drift.** Metadata 스키마는 한 번 ship하면 public API처럼 다뤄야 한다. 6개월 뒤에 `team`을 `owning_team`으로 rename하는 순간 대시보드가 fork된다. 새 key 추가는 OK, deprecation은 OK, silent rename은 안 됨.
- **IAM이 강제해야 할 걸 metadata로 태깅하지 마라.** `env=prod`가 metadata 태그라면 *InvokeModel 권한 가진 누구나* prod라고 주장할 수 있다. 위조되면 안 되는 건 IAM (이상적으로는 env별 별개 role)으로 처리하라.

## 그래서 뭘 써야 하냐?

오늘 Bedrock 시작한다면:

1. 자기 청구서나 SLO를 가질 만한 제품마다 **최소 하나의 inference profile**을 깐다. 이게 invoice-grade 단위다.
2. 호출하는 서비스마다 **별개 IAM role**을 준다. 귀찮아도 그렇게 해라. 보안 리뷰가 떨어지면 미래의 너가 지금의 너에게 감사할 거다.
3. **공용 client wrapper에 첫날부터 request metadata 넣기**, 작고 enforce 가능한 스키마로. 런타임 비용은 0이고, 아직 떠오르지도 않은 질문들에 대한 탈출구가 된다.

새 InvokeModel metadata 기능이 아키텍처를 바꾸진 않는다. 다만 이제는 "modern Converse API 쓰기"와 "per-request attribution 갖기" 사이에서 골라야 할 필요가 없어졌다는 거다. 기존 InvokeModel 기반 코드를 그대로 두고도 예전엔 마이그레이션이 필요했던 *세밀한 조율*을 얻을 수 있다. 그리고 현실에선 이런 기능들이 결국 삶을 쉽게 만들어준다.

## 참고

- [AWS What's New — Bedrock request-level usage attribution (2026년 5월)](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-bedrock-request-level-usage-attribution/)
- [Bedrock model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
- [Application inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
