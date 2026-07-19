---
title: "Step Functions × AgentCore: 이미 async 파이프라인에서 에이전트를 돌리고 있다면"
date: 2026-06-04T11:30:00-04:00
author: Yoonsoo Park
description: "AWS가 Step Functions에서 Bedrock AgentCore Runtime을 네이티브 태스크로 호출할 수 있게 했다. 이미 state machine 뒤에서 Lambda로 에이전트를 감싸 돌리고 있다면, 에이전트가 실제로 어디서 실행되는지부터 달라지고, 긴 실행 시간·재시도·폴링 같은 골칫거리도 꽤 정리된다."
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

[AWS는 2026년 6월](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/) Step Functions에서 Bedrock AgentCore Runtime을 네이티브 태스크로 호출할 수 있는 통합을 발표했다. 이제 state machine에서 AgentCore 에이전트를 1급 태스크처럼 직접 호출할 수 있다. Lambda 래퍼도 필요 없고, 직접 폴링 루프를 짤 필요도 없고, 인자만 받아 `boto3.client("bedrock-agentcore").invoke_agent_runtime`으로 넘겨주는 얇은 Python 함수도 굳이 둘 이유가 없다.

겉보기에는 자잘한 개선처럼 보일 수 있다. 하지만 실제 제품에서 에이전트를 async 파이프라인에 올려 운용하는 플랫폼 팀에게는 그렇지 않다.

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

State machine이 필요한 이유는 agent 호출이 길어서 HTTP 연결을 계속 붙잡고 있을 수 없기 때문이다. Lambda가 끼어 있는 이유는, 지난주까지만 해도 state machine에서 에이전트를 호출하는 가장 현실적인 방법이 그것뿐이었기 때문이다. 많은 팀이 결국 도달하는 `Runnable.long_run()` / `RunnablePoll` 패턴도 본질적으로는 같다. **Bedrock을 한 번 호출하고 제어권을 state machine으로 돌려주는 얇은 Python 래퍼**일 뿐이다.

이 구조는 분명 동작한다. 다만 코드 스타일을 아무리 정리해도 사라지지 않는 문제가 네 가지 있다.

## 이 패턴이 실제로 안고 있는 네 가지 문제

### 1. Lambda의 15분 제한이 에이전트의 사고 시간을 정한다

이건 순서가 거꾸로다. 에이전트가 얼마나 오래 추론할 수 있는지는 제품 요구가 결정해야 한다. 예를 들어 "이 작업은 tool call이 다섯 번 돌고 context도 길어서 8분 정도 걸릴 수 있다" 같은 식이다. 그런데 현실에서는 Lambda가 허용하는 시간이 곧 한계가 된다. 15분을 넘기면 ECS나 Fargate로 옮기거나, 상태를 넘겨 가며 Lambda를 이어 붙여야 한다. 솔직히 누구도 반가워할 작업은 아니다.

AgentCore Runtime은 최대 8시간까지 실행할 수 있다. 새 `.sync` 통합으로 state machine이 AgentCore를 직접 호출하면 Lambda가 빠지고, 15분 제한도 함께 사라진다.

### 2. 여러 단계로 이뤄진 agent workflow가 통째로 실패한다

하나의 작업이 plan → fan-out tool calls → reduce → validate 순서로 진행된다고 해보자. 지금 구조에서는 이 전체가 하나의 agent loop 안에서, 하나의 Lambda 안에서 실행된다. 도중에 tool 하나가 timeout 나거나, downstream service가 503을 반환하거나, 모델이 세 번째 턴에서 malformed JSON을 만들면 어떻게 될까? 결국 처음부터 전부 다시 돌려야 한다.

위에 얹힌 state machine은 여기서 큰 도움이 되지 않는다. Step Functions 입장에서는 Lambda가 성공했는지 실패했는지만 보이기 때문이다. "plan은 끝났고 validate에서만 실패했으니 validate만 다시 돌리자" 같은 선택지가 없다.

하지만 agent 호출이 Step Functions 태스크가 되면, 비로소 workflow를 workflow답게 나눌 수 있다.

```
Plan(agent)
  → Map(tool calls in parallel)
    → Reduce(agent)
      → Validate(agent)
```

각 단계가 자기만의 retry, catch, checkpoint를 가진다. `Validate`에서 실패하면 전체를 다시 시작하는 대신 `Validate`만 재실행하면 된다.

### 3. 외부 작업 폴링 코드를 팀마다 매번 다시 쓴다

Textract async, Bedrock batch inference처럼 "작업 제출 → 완료될 때까지 폴링"이 필요한 서비스는 정말 많다. 그런데 이상하게도 이 루프는 팀마다 늘 새로 만든다. polling interval, 최대 시도 횟수, 상태값 매핑, 실패 처리까지. 비슷한데 완전히 같지는 않은 코드가 곳곳에 쌓인다.

`.sync` 통합을 쓰면 이 폴링을 Step Functions가 맡는다. State machine이 작업을 제출하고 완료를 기다리는 흐름을 프레임워크 차원에서 처리해 준다. AgentCore의 async invocation도 같은 모델에 들어온다. 다시 말해, 폴링 코드는 더 이상 애플리케이션 코드가 아니다.

### 4. workflow 레이어에서는 agent 실행이 잘 보이지 않는다

지금 구조에서 여러 단계를 거치는 agent 호출이 꼬이면, CloudWatch 로그에 `{"level": "INFO", "agent": ...}` 같은 줄만 빽빽하게 쌓이고 그 안에서 실패 지점을 grep으로 찾아야 한다. 단계별 비용은 Lambda 단위로만 뭉뚱그려 보이고, X-Ray trace도 Lambda까지만 보일 뿐 agent 내부 턴까지는 잘 드러나지 않는다.

반대로 agent invocation 자체가 state machine 태스크가 되면, workflow execution view에서 그 호출이 하나의 단계로 드러난다. 단계별 비용을 나눠 볼 수 있고, X-Ray trace도 agent 호출까지 이어진다. 실패 유형도 다시 구체적인 이름을 갖게 된다.

## 네이티브 AgentCore 통합으로 달라지는 점

정리하면 이렇다.

| Before | After |
|---|---|
| `LambdaInvoke` task → Python handler → `bedrock-agentcore.invoke_agent_runtime` | 네이티브 `BedrockAgentCore: InvokeAgentRuntime.sync` task |
| 15분 Lambda timeout | 8시간 AgentCore Runtime timeout |
| Agent loop가 Lambda 안에서 돌고, 실패하면 처음부터 다시 실행 | plan/fan-out/reduce/validate를 SF 단계로 나누고 각각 독립적으로 retry |
| 직접 작성한 `poll_run()` + `interval_seconds`, `max_poll_attempts` | SF `.sync` 통합이 폴링 처리 |
| Lambda 중심의 CloudWatch 로그 | 단계별 SF execution view + X-Ray |
| 직접 조합한 DynamoDB 상태 기반 human-in-the-loop | `waitForTaskToken` + agent task |

특히 마지막 줄은 한 번 짚고 넘어갈 만하다. 규제 산업의 agentic feature에는 중간 어딘가에 사람 승인 단계가 들어가는 경우가 많다. 예를 들어 "에이전트가 대출 메모 초안을 만들고, 외부로 나가기 전에 사람이 최종 승인한다" 같은 흐름이다. 예전에는 에이전트가 초안을 DynamoDB에 저장하고, 별도 API가 승인 상태로 바꾸고, 다른 Lambda가 그걸 주워 가고, 또 다른 state machine이 이어서 실행하는 식으로 얽히기 쉬웠다. `waitForTaskToken`을 쓰면 state machine이 특정 단계에서 그대로 멈춰 있다가, 외부 시스템이 토큰으로 콜백을 보내는 순간 다시 이어서 진행할 수 있다. 승인 흐름이 서로 얽힌 세 개의 서비스가 아니라 하나의 state diagram으로 정리된다.

## 그래서, 실제로 옮길 만한가?

모든 async agent 호출이 이 통합 덕을 보는 것은 아니다.

✅ **옮길 가치가 큰 경우**
- 이미 Step Functions 안에서 Lambda를 통해 agent를 실행하고 있다
- Agent 호출이 길거나(5분 이상), 15분 제한에 걸려 본 적이 있다
- 여러 단계로 나뉜 agent workflow가 있고, 부분 재시도가 큰 도움이 된다
- 외부 작업 폴링 패턴이 있다(Textract async, batch inference 등) — 가장 부담 없이 옮기기 좋은 첫 대상이다. 폴링 코드가 그대로 사라진다
- Human-in-the-loop가 필요해서 지금까지 직접 구현해 왔다

⚠️ **옮기기 전에 비용부터 따져볼 경우**
- Lambda 안에서 SDK(Strands, raw Bedrock 등)를 직접 쓰고 있다. AgentCore Runtime으로 옮기는 것 자체가 별도의 배포·운영 변화다. 이 통합은 이미 AgentCore를 도입했다는 전제에서 가장 빛난다
- Async pipeline이 아주 단순하다(Lambda 하나, DynamoDB write 하나). 이 경우에는 재작성 비용이 이득보다 더 클 수 있다

❌ **굳이 건드리지 않아도 되는 경우**
- Agent 호출이 짧고(1분 미만), single-turn이며, 실패 양상도 단순하다. 이 정도면 Lambda + SDK로도 충분하다
- 애초에 state machine이 없다. 이 통합 하나를 쓰려고 Step Functions부터 도입하는 건 순서가 뒤바뀐 선택이다

## 미리 예상할 만한 함정

- **Step Functions state size는 256 KB로 제한된다.** 이미 큰 문서를 SF 안에서 넘기는 팀이라면 익숙한 제약일 것이다. Agent input/output까지 흐름에 포함되면 payload는 S3에 두고 참조만 넘기는 방식이 사실상 필수다. 이번 통합이 이 한도를 완화해 주지는 않는다.
- **AgentCore Runtime의 리전 지원 범위가 더 좁다.** 출시 시점 기준으로 AgentCore는 Step Functions보다 지원 리전이 적다. 제품이 `me-central-1`이나 `ap-northeast-1`에서 돌아간다면 아키텍처를 바꾸기 전에 먼저 확인해야 한다. Step Functions에서 cross-region으로 AgentCore를 호출할 수 있는지는 또 다른 문제다.
- **Cold start는 사라지는 게 아니라 위치만 바뀐다.** Lambda cold start 비용은 줄지만, 대신 AgentCore Runtime cold start를 보게 된다. 둘은 성격이 같지 않으니 실제 workload로 측정해 보기 전에는 섣불리 결론 내리지 않는 편이 좋다.
- **IAM trust chain에 새로운 주체가 추가된다.** 이제 state machine execution role에 `bedrock-agentcore:InvokeAgentRuntime` 권한이 필요하다. 플랫폼에서 tag-based access control을 쓴다면(예: `IntelligenceRegistryAccess` 스타일 태그) Lambda role뿐 아니라 state machine role에도 올바른 태그가 붙어 있어야 한다.
- **관측 지점의 모양이 달라진다.** 지금까지 Lambda 함수 이름 기준으로 대시보드를 짜 두었다면, agent 경로에서는 그 지표가 잠잠해질 수 있다. 트래픽을 전환하기 전에 Step Functions execution과 AgentCore metrics를 기준으로 새 대시보드를 함께 준비해 두는 편이 안전하다.

## 결국 이 발표가 의미하는 것

지금까지는 "에이전트가 어디서 실행되는가?"라는 질문에 답하기가 애매했다. 대개는 "Lambda 안에서"라고 답할 수밖에 없었고, 그 이유도 단순했다. workflow engine이 원래 그렇게밖에 호출할 수 없었기 때문이다. 즉, 실행 위치는 설계 결정이라기보다 orchestration 방식이 만들어 낸 부작용에 가까웠다.

하지만 AgentCore를 state machine 태스크로 직접 다룰 수 있게 되면서 상황이 달라졌다. 이제 agent 실행을 더 자연스러운 자리에 놓을 수 있다. 오래 실행될 수 있고, 관측 가능하고, 실제 workflow 구조에 맞춰 단계별로 재시도할 수 있는 자리 말이다. Orchestrator도 더 이상 얇은 래퍼에 머무르지 않고, 진짜 orchestrator 역할을 하게 된다.

그동안 "async 쪽이 너무 지저분해서" agentic feature를 미뤄 왔다면, 이제는 다시 한 번 검토해 볼 만하다. 적어도 예전보다 훨씬 덜 지저분해졌다.
