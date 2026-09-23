---
title: "AWS 토크노믹스: 비용을 어떻게 나누고, 어떤 레버를 당기고, 어디서 막을까"
date: 2026-09-23T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Cloud Financial Management가 AI 비용 관리를 가시성·최적화·거버넌스·ROI 네 기둥의 토크노믹스로 정리했다. 이 틀이 이미 Amazon Bedrock에 있는 비용 attribution 방식과 어떻게 맞물리는지, 에이전트 루프에서도 살아남는 최적화 레버는 무엇인지, 그리고 모든 호출자가 하나의 서비스 롤을 공유할 때 IAM principal 기준 비용 리포트가 왜 조용히 무너지는지 살펴본다."
categories:
  - AWS
  - FinOps
tags:
  - finops
  - bedrock
  - cost-attribution
  - prompt-caching
  - budgets
---

FinOps Foundation이 올해 AI 비용 관리에 이름을 붙이고 재단까지 세웠다. **토크노믹스(tokenomics)** 다. Linux Foundation 산하의 새 도메인으로 발표됐다. 이어서 AWS가 기존 FinOps 기둥(See, Save, Run, Plan)을 AI 워크로드에 맞춰 다시 매핑한 글을 올렸다. 가시성과 attribution(Visibility & Attribution), 최적화(Optimization), 거버넌스(Governance), 가치와 ROI(Value/ROI)다.

이 틀은 쓸 만하다. 그런데 네 기둥짜리 다이어그램은 결정이 아니다. 실제로 채워 넣기 시작하면 네 기둥은 서로 독립된 작업 흐름이 아니라, 대시보드를 만들기 전에 먼저 답해야 할 세 가지 질문으로 접힌다.

1. **Unit of account**: 토큰이냐, 요청이냐, run이냐. 무엇을 관리 단위로 삼을 것인가?
2. **Attribution key**: 청구서에서 "누가 썼는가"를 알려주는 필드는 무엇인가?
3. **Enforcement point**: 한도가 "안 된다"고 말할 수 있는 자리는 어디인가?

기둥 글의 나머지는 이 셋을 정한 다음에 당기는 레버다. 이 글에서는 Amazon Bedrock에 실제로 있는 메커니즘으로 그 셋을 짚고, 어디서 깨지는지 본다.

## 첫 번째 기둥은 사실 하나의 결정이다: attribution grain

"가시성"은 체크박스 하나 켜는 일처럼 들린다. 실체는 비용을 얼마나 잘게 나눠 볼 것인가다. 그리고 지금 쓸 수 있는 단위들은 서로 대체가 안 된다. 오늘 네 가지가 나와 있고, 각각 다른 질문에 답한다.

| 메커니즘 | 단위 | 답하는 질문 | 비용 |
|-----------|-------|-----------------|------|
| CUR 2.0의 IAM principal allocation | 롤·사용자 단위 | "어떤 호출자가 썼는가" | 무료, Data Exports 설정과 비용 할당 태그 활성화 필요 |
| application inference profile | 워크로드·모델 단위 | "이 제품을 운영하는 데 얼마가 드는가" | 무료, 다만 모델마다 프로파일 하나 |
| Bedrock Projects / Workspaces | 프로젝트 단위, 집계 | "이 앱이 이번 주에 얼마를 썼는가" | 무료, 요청 단위 정보 없음 |
| model invocation logging | 요청 단위 | "이 프롬프트에 얼마가 들었는가" | 저장과 조회 비용, 리전별 설정 필요 |

가장 눈에 띄는 건 IAM principal allocation이다. Amazon Data Exports 설정에서 켜고 대응하는 비용 할당 태그를 활성화하면, Cost Explorer가 Bedrock 모델 추론 비용을 호출한 IAM principal 기준으로 나눠 준다. 비용 데이터에 모델 ID밖에 없던 예전과 비교하면 확실히 큰 개선이다.

다만 principal의 해상도는 IAM 설계의 해상도를 넘지 못한다. 여기서 첫 번째 함정이 나온다.

### 서비스 롤을 공유하면 비용이 한 줄로 뭉친다

프로덕션 에이전트 대부분은 최종 사용자 자격으로 Bedrock을 호출하지 않는다. 서비스 롤로 호출한다. 런타임용 task role 하나, 또는 플랫폼 전체가 쓰는 execution role 하나다. 조직의 모든 에이전트 턴이 `arn:aws:iam::…:role/agent-platform-prod` 하나로 나간다면, principal별 attribution은 정확히 한 줄을 만들어 내고, 그 한 줄은 아주 큰 금액이 된다.

[Per-Request Cost Attribution on Amazon Bedrock](/blog/2026-06-01-bedrock-request-level-usage-attribution.html)에서 짚었던 실패 모드와 같고, 해법도 그대로다. 호출 서비스마다 롤을 따로 주거나, 공용 클라이언트 래퍼에서 요청 메타데이터를 붙여 로그 한 줄에 팀과 기능 키가 실리게 하는 것이다. AWS 글도 같은 순서를 권한다. IAM principal allocation을 먼저, invocation logging을 다음으로 켜고, 둘을 조인해 일 단위 토큰 attribution을 만드는 흐름이다.

비용이 덜 드는 쪽을 원하면 Projects와 Workspaces가 괜찮은 기본값이다. 클라이언트에 Project ID를 한 번 설정하면 `bedrock-mantle` 엔드포인트의 Responses와 Chat Completions 호출이 모두 그 프로젝트로 attribution된다. Workspaces는 Anthropic 호환 Messages API에 같은 일을 한다. 둘 다 모델에 묶이지 않으므로 프로파일이 모델 수만큼 늘어나는 문제를 피할 수 있다.

여기서 application inference profile을 이미 쓰는 팀이라면 한 가지를 짚고 넘어가야 한다. application inference profile과 Projects는 같은 API 표면의 두 선택지가 아니다. profile은 `bedrock-runtime`의 InvokeModel과 Converse 위에서 동작하고, Projects와 Workspaces는 `bedrock-mantle` 엔드포인트의 Responses·Chat Completions와 Anthropic Messages API에서 동작한다. 그래서 "프로파일이 늘어나는 문제를 피한다"는 말은 설정을 조금 바꾸는 정도가 아니라, 호출을 다른 엔드포인트와 다른 API 형태로 옮긴다는 뜻이다. 지금 클라이언트가 Converse를 호출하고 있다면, 워크로드 단위로 붙일 수 있는 태그는 여전히 application inference profile뿐이다.

단점은 기능 설명에 그대로 적혀 있다. Projects와 Workspaces는 **사용 유형별·일별로 집계된 금액**만 전달한다. 프롬프트 단위 비용은 없고, 나중에 복원할 수도 없다. ROI 질문이 "새 프롬프트 템플릿이 대화당 비용을 어떻게 바꿨는가"라면 일별 집계로는 답할 수 없다. 그건 invocation log가 있어야 가능하다.

### invocation log가 실제로 사 주는 것

invocation logging은 호출마다 프롬프트, 응답, 토큰 수, 모델, 중단 사유, 계정, IAM 롤을 S3나 CloudWatch에 기록한다. 이 레코드가 "누가 몇 토큰"을 조인할 수 있게 해 준다. 금액은 CUR, 토큰은 로그, 날짜 한 키로 묶는 구조다.

운영 중에 자주 걸리는 점이 두 가지 있다.

- **리전별 설정이다.** 로깅을 끈 리전의 모델 호출은 토큰 대시보드에 나타나지 않는데, 비용은 청구서에 그대로 남는다. 이 설정은 runbook이 아니라 계정 부트스트랩에 넣어야 한다.
- **`amountUsd = 0`도 행을 만든다.** 토큰이 0인 호출과 캐시된 호출도 로그 레코드를 남긴다. 로그 저장 비용은 토큰량이 아니라 호출량 기준으로 잡아야 한다.

## 두 번째 기둥: 에이전트 루프에서도 살아남는 최적화 레버

전통적인 FinOps 레버는 그대로 옮겨지지 않는다. 가격과 모델 라인업이 분기마다 바뀌는 서비스에 commitment(약정)은 맞지 않는다. consumption 기반 과금에서는 idle-resource hunting도 통하지 않는다. 놀고 있는 에이전트는 아무것도 쓰지 않기 때문이다. 살아남는 레버는 더 적고, 순서가 중요하다.

**도구 선택이 나머지 전부를 좌우한다.** AWS가 같은 Haiku 4.5 코딩 작업을 도구별로 돌렸더니 Kiro에서 1센트, Claude Code에서 7센트가 나왔다. 같은 작업에서 7배 차이다. 프롬프트 엔지니어링으로 얻을 수 있는 어떤 개선보다 크다. 프롬프트를 다듬기 전에 도구부터 재야 한다.

**입력 프롬프트를 다듬는 게 가장 싼 레버다.** "hey, 이거 좀 도와줄래?" 같은 대화형 프롬프트는 약 85토큰이었고, 같은 작업을 구조적이고 지시형으로 쓰면 약 38토큰이었다. 프롬프트를 쓰는 방식만 바꿔도 입력이 55% 줄고, 이 효과는 이후 모든 호출에 계속 적용된다. 캐싱 효과와도 곱해진다.

**context는 사람들이 놓치기 쉬운 레버다.** 설치한 MCP 서버와 스킬은 매 호출의 컨텍스트 윈도우에 더해진다. 8개를 켜 두고 3개만 쓴다면 쓰지도 않는 5개 값까지 내는 셈이고, 캐시가 만료되면 전부 다시 로드되면서 한 번 더 낸다. 멀티턴 대화에서는 sliding window나 progressive summarization이 같은 역할을 한다. 같은 질문인데 10번째 턴이 1번째 턴의 열 배가 될 수 있다.

**비싼 쪽은 출력 토큰이다.** 토큰당 출력 가격은 입력의 약 3배다. `max_tokens`를 제한하고 "간결하게"라고 지시하는 건 문체 취향이 아니라 청구서의 나머지 절반을 다루는 일이다.

**prompt caching은 가장 큰 단일 레버지만, TTL이라는 조건이 붙는다.** Bedrock prompt caching은 반복되는 컨텍스트를 저장해 두고, exact match 기준 5분 TTL에서 비용을 최대 90%, 지연 시간을 최대 85%까지 줄인다. 실제로 큰 숫자다. 동시에 위 두 레버가 만나는 지점이기도 하다. 여러 사용자가 공유하는 긴 시스템 프롬프트는 잘 캐시되지만, 사용자나 턴마다 바뀌는 내용은 그렇지 않고, 재로딩 비용은 캐시가 만료된 직후의 호출이 떠안는다.

**모델 적정화는 추측이 아니라 측정이다.** 저렴한 모델이 그 작업에 충분한지 답하려고 Bedrock model evaluation이 있다. 분류와 라우팅 트래픽을 옮기기 전에 반드시 돌려야 하고, 모델 평판만 보고 고르면 안 된다.

### 캐싱에 숨어 있는 리포팅 함정

비용 90% 절감이라는 숫자는 재무 담당자에게 수요 신호로 읽히지만, 사실 수요 신호가 아니다. 캐시된 입력 토큰이 싼 이유는 작업이 재사용됐기 때문이지 사용량이 줄어서가 아니다. 대시보드가 금액만 그리면 캐싱 성과와 트래픽이 빠진 제품이 똑같아 보인다. 두 이야기가 섞이지 않도록 토큰 수와 캐시 동작을 비용 옆에 같이 둬야 한다.

## 세 번째 기둥: 거버넌스는 어디에 두느냐의 문제다

거버넌스는 AI FinOps가 리포팅을 멈추고 아키텍처가 되기 시작하는 지점이다. 한도는 요청 경로가 실제로 지나가는 자리에 살아야 하기 때문이다.

기둥 글은 세 층을 제시한다.

- **AWS Budgets**(billing view 지원): 특정 AI 워크로드에 예산을 좁히고 100%에 닿기 전에 경고한다.
- **Cost Anomaly Detection**: "누군가 뭘 배포하고 잊어버린" 상황을 잡는다.
- **Service Control Policies**: 조직 단위(OU) 수준에서 접근 가능한 모델을 제한한다. 샌드박스에는 이게 맞는 도구다. 프론티어 모델을 쓰지 말라고 부탁하는 대신 OU에서 빼 버린다.

런타임 쪽은 게이트웨이를 가리킨다. 오픈소스로 팀별 예산을 걸려면 LiteLLM, Bedrock 위 Claude를 위한 AWS 관리형 경로는 Claude Apps Gateway, 그리고 AgentCore Gateway 위에서 정책 언어로 토큰 예산 상한을 걸고 폭주하는 에이전트 루프를 막을 수 있는 Dogwood가 있다.

이 모든 것 아래에 있는 결정은 **enforcement가 어디에서 "안 된다"고 말할 수 있는가** 하나다. 실제 배치는 세 가지뿐이다.

| 배치 | 실패하는 방식 | 어울리는 대상 |
|-----------|-----------|-----------|
| SCP / 모델 접근 제어 | 요청 시점에 하드 차단 | 샌드박스, 모델 허용 목록 |
| Budget + 이상 경보 | 사후 소프트 알림 | 사람 소유자가 있는 프로덕션 팀 |
| 게이트웨이 토큰 상한 | 팀·루프 단위 하드 차단 | 루프를 돌 수 있는 에이전트 |

대시보드는 enforcement point가 아니다. 여기서 사람들이 자주 헷갈린다. 비용 리포트도 마찬가지다. 둘 다 요청 경로에 있지 않으므로 주말 내내 도는 폭주 루프를 막지 못한다. 세 번째 행만 막을 수 있다. 작년 개인 계정 실험에서 얻은 결론도 같다. [personal AWS cost guardrails](/blog/2026-03-30-personal-aws-cost-guardrails.html)를 세 층으로 만든 이유가 바로 알림 층과 정지 층의 실패 방식이 다르기 때문이었다.

## 네 번째 기둥: ROI, 그리고 사실 분모가 어려운 부분

기둥 글은 ROI를 놀랄 만큼 솔직하게 다루고, 숫자보다 구조를 다시 적어 둘 가치가 있다. 문제는 셋인데 비용 문제는 첫 번째뿐이다.

- **분자는 토큰 청구서보다 크다.** 엔지니어링 시간, 데이터 준비, 테스트, 모니터링에 저장소, 게이트웨이, 오케스트레이션, 데이터 전송이 더해진다. 이런 항목을 뺀 토큰 비용 대시보드는 실제보다 90% 싼 시스템처럼 읽힌다.
- **분모는 설계해야 하는 측정값이다.** "버그 하나 해결에 500달러"는 대리 지표이고 대체로 좋지 않다. 글에서 쓸모 있는 부분은 실패 목록이다. 아낀 시간은 인원 감축이 없어 비용 절감으로 이어지지 않았고, 효율은 올랐는데 이익은 제자리였고, 매출 기여는 동시에 일어난 다른 열 가지와 분리할 수 없었다.
- **목표는 계속 움직인다.** 반 년 전에는 합리적이던 모델 선택이 오늘은 완전히 열등해질 수 있다. 즉 ROI 모델의 유효기간은 분기 단위다.

세 가지를 모두 통과하는 개입은 하나다. 프로젝트가 시작되기 전에 문제와 기준선을 정의하는 것. 글에는 내부 사례도 있다(분산 분석이 15분에서 1분으로, 14,000시간 절감). 솔직한 해석은 숫자가 의미를 갖는 이유가 기준선이 먼저 있었기 때문이라는 것이다.

## 그래서 나라면 무엇부터 할까

기둥 하나를 골라 끝내는 게 맞다. Bedrock 비중이 큰 계정에서 오늘 시작한다면 이 순서로 간다.

1. **IAM principal allocation과 비용 할당 태그를 켜고**, Bedrock 지출에 실제로 몇 개의 principal이 있는지 확인한다. 하나뿐이라면, 찾은 건 첫 대시보드가 아니라 첫 번째 실제 작업 항목이다.
2. **호출하는 모든 리전에서 invocation logging을 켜고**, 그 설정을 계정 부트스트랩에 넣는다. 요청 단위 해상도를 얻을 수 있는 유일한 원천이다.
3. **AI 워크로드에 budget 하나와 anomaly detector 하나**를 걸고, 둘 중 무엇이든 실제로 멈출 수 있는 게 있는지 분명히 한다. 답이 "둘 다 아니다"라면 거버넌스가 아니라 알림만 있는 것이다.

에이전트 플랫폼은 종료 스위치가 없는 비용 표면이다. 계속 돌아가고, 사용자 입력마다 모델을 호출하며, 툴 호출 한 번이 상호작용 하나의 값을 두 배로 만들 수 있다. 내 [Hermes Agent 비용 분석](/blog/2026-08-08-hermes-aws-cost-breakdown.html)이 예상 밖이었던 이유도 같다. 상시 구동 에이전트에서는 주변 인프라(NAT Gateway, EFS 처리량)가 컴퓨트만큼 비쌀 수 있고, 모델 지출은 그 위에 얹힌다. 토크노믹스는 그중 어느 줄을 실제로 움직일 수 있는지 아는 훈련이다.

## 적어 둘 만한 함정

- **메타데이터는 위조할 수 있다. 위조되면 안 되는 값을 넣지 말 것.** 요청 메타데이터의 `env=prod` 태그는 모델을 호출할 수 있는 사람이면 누구나 붙일 수 있다. 경계는 IAM으로 만든다.
- **집계 단위는 일방통행이다.** invocation log 없이 Projects만 고르면, 로그를 켜는 시점 이후가 되기 전까지 프롬프트 단위 질문에 답할 수 없다.
- **캐시된 토큰 감소는 수요 감소가 아니다.** 토큰 수를 금액 옆에 둔다.
- **성장하는 워크로드에 고정 임계값은 버티지 못한다.** 고정 달러 규칙은 큰 계정을 익사시키거나 작은 계정을 방치한다. 이 주제는 예측 기반 탐지를 다루는 짝 글에서 이어진다.
- **overage와 표준 요율은 별개 개념이다.** 내부 청구 모델에 overage 요율이 있다면 그 요율이 실제로 어딘가에서 적용되는지 확인해야 한다. 아니면 플래그만 모으고 있는 것이다.

## 참고 자료

- [Getting started with Tokenomics on AWS](https://aws.amazon.com/blogs/aws-cloud-financial-management/getting-started-with-tokenomics-on-aws/) — AWS Cloud Financial Management Blog
- [IAM principal cost allocation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/iam-principal-cost-allocation.html)
- [Bedrock cost management: Projects, inference profiles, and workspaces](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-management.html)
- [Bedrock model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
- [Bedrock prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)

이 대시보드 아래에 chargeback 계층을 만든다면 같은 질문이 더 낮은 층에서 다시 온다. 무엇을 청구 단위로 삼을 것인가, 그리고 달러 비용을 그 단위로 환산하는 권한은 누구에게 있는가. 위의 attribution 표가 실제로 다루는 결정이 그것이다.
