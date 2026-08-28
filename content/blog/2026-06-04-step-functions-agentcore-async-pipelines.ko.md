---
title: "Step Functions × AgentCore: 관리형 Harness 통합이 실제로 지원하는 것"
date: 2026-06-04T11:30:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "AWS의 2026년 6월 Bedrock AgentCore용 Step Functions 통합은 유용하지만 일반적인 async AgentCore 태스크보다 범위가 좁다. 관리형 harness를 Request Response로 호출하는 기능의 실제 계약과, 여전히 필요한 장시간 실행 패턴을 정리한다."
categories:
  - AWS
  - AgentCore
tags:
  - step-functions
  - bedrock
  - agentcore
  - async
  - lambda
---

[AWS는 2026년 6월](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/) 관리형 Bedrock AgentCore harness를 Step Functions에서 호출하는 최적화 통합을 발표했다. 여기서 놓치기 쉬운 핵심은 리소스가 `arn:aws:states:::bedrockagentcore:invokeHarness`이고, 현재 **Request Response** 방식만 지원한다는 점이다.

이미 관리형 AgentCore turn을 호출해야 하는 state machine에는 유용하다. 하지만 모든 `InvokeAgentRuntime` 호출을 `.sync`로 바꾸는 범용 async 통합도 아니고, 8시간짜리 agent invocation을 하나의 Step Functions 태스크로 만들어 주는 기능도 아니다.

## 결국 다들 비슷한 구조로 간다

AWS 위에서 agentic feature를 실제 서비스에 붙이기 시작하면, 아키텍처는 대체로 이런 형태로 수렴한다.

```
POST /something/runs   →  202 + requestId
                              ↓
                      Step Functions 시작
                              ↓
              Lambda(agent 호출 + 결과 저장)
                              ↓
                       DynamoDB 업데이트
                              ↓
GET /something/runs/{id}  →  status + output
```

State machine이 필요한 이유는 agent 호출이 길어서 HTTP 연결을 계속 붙잡고 있을 수 없기 때문이다. Lambda가 얇은 래퍼여도 session ID, payload 저장, retry, callback token, durable result를 맡는 경우가 많다. 최적화 통합은 제한된 harness turn에서 이 래퍼를 없앨 수 있지만, workflow의 내구성 책임까지 자동으로 가져가지는 않는다.

이 구조는 분명 동작한다. 다만 코드 스타일을 아무리 정리해도 사라지지 않는 문제가 네 가지 있다.

## 이 패턴이 실제로 안고 있는 네 가지 문제

### 1. 최적화 turn에도 태스크 한도가 있다

이건 순서가 거꾸로다. 에이전트가 얼마나 오래 추론할 수 있는지는 제품 요구가 결정해야 한다. 예를 들어 "이 작업은 tool call이 다섯 번 돌고 context도 길어서 8분 정도 걸릴 수 있다" 같은 식이다. 그런데 현실에서는 Lambda가 허용하는 시간이 곧 한계가 된다. 15분을 넘기면 ECS나 Fargate로 옮기거나, 상태를 넘겨 가며 Lambda를 이어 붙여야 한다. 솔직히 누구도 반가워할 작업은 아니다.

최적화 리소스에도 **15분 Step Functions 통합 한도**가 있다. `TimeoutSeconds`를 크게 잡아도 8시간짜리 태스크가 되지 않는다. 태스크가 timeout된 뒤에도 harness가 계속 실행될 수 있으므로 cleanup이나 reconciliation 경로가 필요하다.

### 2. 여러 단계로 이뤄진 agent workflow가 통째로 실패한다

하나의 작업이 plan → fan-out tool calls → reduce → validate 순서로 진행된다고 해보자. 지금 구조에서는 이 전체가 하나의 agent loop 안에서, 하나의 Lambda 안에서 실행된다. 도중에 tool 하나가 timeout 나거나, downstream service가 503을 반환하거나, 모델이 세 번째 턴에서 malformed JSON을 만들면 어떻게 될까? 결국 처음부터 전부 다시 돌려야 한다.

위에 얹힌 state machine은 여기서 큰 도움이 되지 않는다. Step Functions 입장에서는 Lambda가 성공했는지 실패했는지만 보이기 때문이다. "plan은 끝났고 validate에서만 실패했으니 validate만 다시 돌리자" 같은 선택지가 없다.

workflow를 workflow답게 나누려면 최적화 태스크 하나에 맡기지 말고 별도 state로 구성해야 한다.

```
Plan(agent)
  → Map(tool calls in parallel)
    → Reduce(agent)
      → Validate(agent)
```

각 단계가 자기만의 retry, catch, checkpoint를 가진다. `Validate`에서 실패하면 전체를 다시 시작하는 대신 `Validate`만 재실행하면 된다.

### 3. 외부 작업 폴링 코드를 팀마다 매번 다시 쓴다

Textract async, Bedrock batch inference처럼 "작업 제출 → 완료될 때까지 폴링"이 필요한 서비스는 정말 많다. 그런데 이상하게도 이 루프는 팀마다 늘 새로 만든다. polling interval, 최대 시도 횟수, 상태값 매핑, 실패 처리까지. 비슷한데 완전히 같지는 않은 코드가 곳곳에 쌓인다.

AgentCore의 최적화 harness 태스크는 Request Response이지 일반적인 `.sync` poller가 아니다. 제출 후 완료를 기다려야 한다면 아래에서 설명하는 callback 또는 direct SDK 패턴을 사용하고 session, timeout, 결과 상태를 직접 설계해야 한다.

### 4. workflow 레이어에서는 agent 실행이 잘 보이지 않는다

지금 구조에서 여러 단계를 거치는 agent 호출이 꼬이면, CloudWatch 로그에 `{"level": "INFO", "agent": ...}` 같은 줄만 빽빽하게 쌓이고 그 안에서 실패 지점을 grep으로 찾아야 한다. 단계별 비용은 Lambda 단위로만 뭉뚱그려 보이고, X-Ray trace도 Lambda까지만 보일 뿐 agent 내부 턴까지는 잘 드러나지 않는다.

반대로 agent invocation 자체가 state machine 태스크가 되면, workflow execution view에서 그 호출이 하나의 단계로 드러난다. 단계별 비용을 나눠 볼 수 있고, X-Ray trace도 agent 호출까지 이어진다. 실패 유형도 다시 구체적인 이름을 갖게 된다.

## 최적화 AgentCore 태스크가 바꾸는 점

정리하면 이렇다.

| Before | After |
|---|---|
| Lambda wrapper가 `invoke_agent_runtime` 호출 | 최적화 `arn:aws:states:::bedrockagentcore:invokeHarness` 태스크 |
| Lambda에 15분 timeout | 최적화 태스크에도 15분 한도 |
| Agent loop가 하나의 opaque call | 독립 retry가 필요하면 별도 state로 나눠야 함 |
| 직접 작성한 polling/callback 코드 | 장시간·callback workflow에는 여전히 필요 |
| Lambda 로그만 확인 | 최종 text와 execution/CloudWatch harness trace 링크 |
| 직접 만든 승인 state | `waitForTaskToken`은 이 태스크 밖에서 명시적으로 사용 |

승인 사례는 여전히 중요하지만 최적화 harness 리소스가 제공하는 기능은 아니다. state machine을 `waitForTaskToken`으로 멈추고 외부 시스템이 토큰으로 callback한 뒤, 다음 state에서 AgentCore를 호출하는 식으로 구성해야 한다. 승인 token과 비즈니스 상태는 harness session이 아니라 durable store에 보관해라.

## 정말 비동기인 작업에 쓰는 패턴

agent가 태스크 한도를 넘어 실행되거나 사람 승인이 필요하다면, 최적화 태스크를 durable하다고 가정하지 말고 다음 패턴 중 하나를 사용해라.

1. **Lambda dispatcher + callback token.** Lambda가 AgentCore runtime을 시작하거나 호출하고 task token을 전달한다. 작업이 끝나면 agent 또는 callback handler가 `SendTaskSuccess`/`SendTaskFailure`를 호출한다.
2. **직접 AWS SDK 통합.** Lambda 없이 `arn:aws:states:::aws-sdk:bedrockagentcore:invokeAgentRuntime`을 호출할 수 있다. 그래도 session ID, timeout, polling/callback 선택, 결과 저장은 직접 책임져야 한다.
3. **Durable function callback.** Lambda durable function이 callback을 기다리며 orchestration을 유지하고, AgentCore 호출은 제한된 작업 단위로 둔다.

session ID는 안정적으로 유지하고, 256 KB Step Functions state 제한을 넘는 입력·출력은 S3에 두고 참조만 전달해라. 며칠 동안 살아 있는 session이 durable business process와 같은 것도 아니다. 프로세스 상태는 저장하고 대기는 Step Functions가 소유하게 하는 편이 안전하다.

## 그래서, 실제로 옮길 만한가?

모든 async agent 호출이 이 통합 덕을 보는 것은 아니다.

✅ **옮길 가치가 큰 경우**
- 제한된 harness turn 하나의 최종 text/usage를 state 결과로 받고 싶다
- 이미 Step Functions 안에서 Lambda로 AgentCore를 호출하고 있고 그 wrapper만 없애고 싶다
- workflow를 독립 retry가 가능한 명시적인 state로 나눌 수 있다
- 진짜 장시간·승인 작업은 위 callback 패턴으로 분리할 수 있다

⚠️ **옮기기 전에 비용부터 따져볼 경우**
- Lambda 안에서 SDK(Strands, raw Bedrock 등)를 직접 쓰고 있다. AgentCore Runtime으로 옮기는 것 자체가 별도의 배포·운영 변화다. 이 통합은 이미 AgentCore를 도입했다는 전제에서 가장 빛난다
- Async pipeline이 아주 단순하다(Lambda 하나, DynamoDB write 하나). 이 경우에는 재작성 비용이 이득보다 더 클 수 있다

❌ **굳이 건드리지 않아도 되는 경우**
- Agent 호출이 짧고(1분 미만), single-turn이며, 실패 양상도 단순하다. 이 정도면 Lambda + SDK로도 충분하다
- 애초에 state machine이 없다. 이 통합 하나를 쓰려고 Step Functions부터 도입하는 건 순서가 뒤바뀐 선택이다

## 미리 예상할 만한 함정

- **Step Functions state size는 256 KB로 제한된다.** 이미 큰 문서를 SF 안에서 넘기는 팀이라면 익숙한 제약일 것이다. Agent input/output까지 흐름에 포함되면 payload는 S3에 두고 참조만 넘겨라. 이번 통합이 이 한도를 완화해 주지는 않는다.
- **`InvokeAgentRuntime.sync`를 추측해서 쓰지 마라.** 최적화 통합에는 문서화된 `invokeHarness` 리소스를 사용한다. `.sync`와 `waitForTaskToken`은 이 통합에서 지원되지 않는다.
- **태스크 timeout과 agent timeout은 서로 다른 시계다.** Step Functions가 timeout돼도 harness가 남을 수 있다. 취소, idempotency, reconciliation 계획을 둬라.
- **AgentCore Runtime의 리전 지원 범위가 더 좁다.** 출시 시점 기준으로 AgentCore는 Step Functions보다 지원 리전이 적다. 제품이 `me-central-1`이나 `ap-northeast-1`에서 돌아간다면 아키텍처를 바꾸기 전에 먼저 확인해야 한다. Step Functions에서 cross-region으로 AgentCore를 호출할 수 있는지는 또 다른 문제다.
- **Cold start는 사라지는 게 아니라 위치만 바뀐다.** Lambda wrapper는 줄지만 AgentCore runtime 동작은 실제 workload로 측정해야 한다.
- **IAM trust chain에 새로운 주체가 추가된다.** state machine execution role에 호출하는 리소스에 맞는 AgentCore 권한이 필요하다. tag-based access control을 쓴다면 기존 Lambda role뿐 아니라 state machine role에도 올바른 태그가 있어야 한다.
- **관측 지점의 모양이 달라진다.** 최적화 태스크는 최종 assistant text와 집계 usage, harness trace 링크를 반환할 뿐 모든 tool/reasoning block을 반환하지 않는다. 상세 근거는 CloudWatch나 별도 durable store에 남겨라.

## 결국 이 발표가 의미하는 것

그동안 많은 팀은 AgentCore 호출마다 얇은 Lambda를 앞에 뒀다. 최적화 태스크는 제한된 harness turn에서 이 wrapper를 없애 주지만, 모든 runtime invocation을 durable Step Functions 태스크로 바꾸지는 않는다.

AgentCore-as-task의 실제 계약은 좁고 분명하다. 최종 text 전달, 집계 usage, harness trace 링크를 제공한다. 장시간 실행, 사람 승인, 부분 retry는 여전히 명시적인 Step Functions state와 callback 패턴의 책임이다.

그동안 "async 쪽이 너무 지저분해서" agentic feature를 미뤄 왔다면 다시 검토해 볼 만하다. 다만 Request Response와 15분이라는 최적화 태스크의 실제 계약이 맞을 때만 선택해라.
