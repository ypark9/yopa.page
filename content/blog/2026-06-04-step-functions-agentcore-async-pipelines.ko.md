---
title: "Step Functions × AgentCore: 이미 에이전트를 async로 돌리고 있다면"
date: 2026-06-04T11:30:00-04:00
author: Yoonsoo Park
description: "AWS가 Step Functions에서 Bedrock AgentCore Runtime을 native task로 호출할 수 있게 했다. State machine 뒤에 Lambda로 agent를 감싸고 있던 팀이라면, 에이전트가 실제로 어디서 실행되는지 자체가 바뀌고 — 그동안 다들 한 번씩은 밟은 통증 몇 개가 사라진다."
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

[AWS가 2026년 6월](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-step-functions-agentcore/) Step Functions에서 Bedrock AgentCore Runtime을 native task로 호출할 수 있는 통합을 발표했다. State machine이 AgentCore agent를 first-class task로 invoke한다 — Lambda wrapper 없이, 직접 짠 polling 없이, "그냥 인자 forwarding이 일인" Python 함수 안에서 `boto3.client("bedrock-agentcore").invoke_agent_runtime`을 호출하지 않고.

작은 변화처럼 들리는데, 실제 제품에서 에이전트를 async pipeline으로 굴리는 platform 팀에는 작지 않다.

## 다들 결국 같은 모양으로 수렴한다

AWS 위에서 agentic feature를 진지하게 만들면 아키텍처가 대체로 이렇게 수렴한다:

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

State machine이 있는 이유는 agent 호출이 너무 길어서 HTTP connection을 잡고 있을 수 없어서. Lambda가 있는 이유는 지난주까지 state machine에서 agent를 호출하는 방법이 그것밖에 없어서. 우리가 다 한 번씩 짜본 `Runnable.long_run()` / `RunnablePoll` 패턴들은 결국 다 같은 말을 한다 — **Bedrock 호출하고 state machine에 control 돌려주는 얇은 Python wrapper**.

돌아가긴 한다. 그런데 코드를 아무리 깔끔하게 짜도 사라지지 않는 문제 4개가 있다.

## 이 패턴이 실제로 가진 4가지 문제

### 1. Lambda 15분 timeout이 에이전트 사고 시간을 결정함

이게 가장 거꾸로 된 부분이다. 에이전트의 reasoning budget은 제품 결정이어야 한다 — "이 action은 tool call 5번에 긴 context라서 8분 걸릴 수 있다." 그런데 현실에서는 Lambda가 허용하는 시간이 한도다. 그보다 길면 ECS, Fargate, 아니면 state를 넘기는 Lambda 체인 — 누구도 실제로 하고 싶어 하지 않는 작업.

AgentCore Runtime은 8시간까지 허용한다. State machine이 새 `.sync` 통합으로 AgentCore를 직접 invoke하면 Lambda가 사라지고, 15분 cliff도 같이 사라진다.

### 2. Multi-step agent workflow는 atomic하게 실패한다

Action 하나가 plan → fan-out tool calls → reduce → validate를 하면, 그게 전부 agent loop 하나, Lambda 하나 안에서 돈다. Tool 하나가 timeout이든, downstream service가 503을 뱉든, 모델이 세 번째 turn에서 malformed JSON을 만들든 — 어떤 실패든 처음부터 다시 돌린다.

위에 있는 state machine layer는 도움이 안 된다. SF 입장에서는 Lambda가 성공하거나 실패하거나 둘 중 하나니까. "plan은 끝났는데 validation이 터졌으니 validation만 retry"가 없다.

Agent 호출이 SF task가 되면, workflow가 진짜 workflow가 된다:

```
Plan(agent)
  → Map(tool calls in parallel)
    → Reduce(agent)
      → Validate(agent)
```

각 step이 자기 retry, catch, checkpoint를 갖는다. `Validate`에서 실패하면 `Validate`만 다시 돈다.

### 3. External job polling은 매번 다시 짠다

Textract async, Bedrock batch inference, "job 제출 → 완료까지 polling"이 있는 모든 것 — 모든 팀이 같은 loop를 다시 짠다. Interval, max attempts, status mapping, 실패 시 exit. 매번 미묘하게 다르다.

`.sync` 통합은 polling을 Step Functions가 처리한다. State machine이 job을 제출하고 task token에서 기다린다. AgentCore async invocation도 같은 모델로 들어온다. Polling 코드가 더 이상 우리 것이 아니다.

### 4. Agent 실행이 workflow 레이어에서 안 보인다

지금은 multi-step agent 호출이 잘못되면 CloudWatch log가 `{"level": "INFO", "agent": ...}`로 도배되고, 그 안에서 grep으로 실패를 찾는다. Step별 cost? Lambda 단위로만 집계된다. X-Ray trace? Lambda는 보이지만 agent 내부 turn은 안 보인다.

Agent invocation이 state machine task가 되면, workflow execution view에 step으로 떠오른다. Step별 cost, X-Ray trace가 agent 호출까지 걸린다. 실패 모드에 다시 이름이 생긴다.

## Native AgentCore 통합이 바꾸는 것

구체적으로:

| Before | After |
|---|---|
| `LambdaInvoke` task → Python handler → `bedrock-agentcore.invoke_agent_runtime` | Native `BedrockAgentCore: InvokeAgentRuntime.sync` task |
| 15분 Lambda timeout | 8시간 AgentCore Runtime timeout |
| Agent loop가 Lambda 안에서 돔; 실패하면 처음부터 | Plan/fan-out/reduce/validate가 SF step으로 분리, 독립 retry |
| 직접 짠 `poll_run()` + `interval_seconds`, `max_poll_attempts` | SF `.sync` 통합이 polling 처리 |
| Per-Lambda CloudWatch log | Per-step SF execution view + X-Ray |
| Custom DynamoDB state로 만든 human-in-the-loop | `waitForTaskToken` + agent task |

마지막 줄은 잠깐 멈출 만하다. 규제 산업의 agentic feature는 거의 다 어디선가 사람 승인 step이 필요하다 — "에이전트가 loan memo 초안을 썼는데, 나가기 전에 사람이 sign off." 예전에 이걸 만드는 방식: agent가 draft를 DynamoDB에 쓰고, 별도 API가 approved로 mark하고, 별도 Lambda가 picking up하고, 별도 state machine이 resume. `waitForTaskToken`으로는 state machine이 그 step에서 그냥 멈춰 있고, 외부 시스템이 token으로 callback하면 agent가 이어서 간다. Approval flow가 service 3개의 coupling이 아니라 state diagram 하나가 된다.

## Decision tree — 진짜 migrate해야 하나?

모든 async agent 호출이 이걸 도입해서 이득은 아니다.

✅ **Migrate할 만함:**
- 이미 Step Functions 안에서 Lambda로 agent를 돌리고 있음
- Agent 호출이 길거나 (>5분) 15분 cliff를 느꼈음
- Multi-step agent workflow가 있고 partial retry가 도움 됨
- External job polling 패턴이 있음 (Textract async, batch inference 등) — 가장 risk 작은 첫 이전 대상. Polling 코드가 그냥 사라진다.
- Human-in-the-loop가 필요했고 그동안 손으로 만들어왔음

⚠️ **Migrate 전에 비용 먼저 따져야:**
- Lambda 안에서 직접 SDK (Strands, raw Bedrock)를 쓰고 있음. AgentCore Runtime으로 옮기는 것 자체가 별개의 배포/운영 변화다. 이 통합은 이미 AgentCore를 채택했다고 가정한다.
- Async pipeline이 작음 (Lambda 1개, DynamoDB write 1개). 다시 짜는 비용이 얻는 것보다 큼.

❌ **굳이 안 해도 됨:**
- Agent 호출이 짧고 (< 1분), single-turn이고, 흥미롭게 실패하지 않음. Lambda + SDK로 충분.
- 애초에 state machine이 없음. 이 통합 쓰려고 SF를 도입하는 건 본말전도.

## 예상되는 함정

- **Step Functions state size 256 KB 한도.** SF로 큰 document 흘리는 팀은 이미 알고 있는 문제. Agent input/output까지 끼면 payload는 S3에 두고 reference만 넘기는 패턴 필수. 이 통합이 한도를 풀어주지는 않는다.
- **AgentCore Runtime region availability.** 발표 시점 기준 AgentCore는 Step Functions보다 리전이 적다. `me-central-1`이나 `ap-northeast-1`에서 굴러가는 제품이라면 재설계 전에 확인 필요. Cross-region AgentCore invocation from SF는 별도 질문.
- **Cold start는 사라지는 게 아니라 이동한다.** Lambda cold start는 안 내지만 AgentCore Runtime cold start를 낸다. 숫자가 같지 않고, 실제 workload에서 측정해보고 victory 선언해야 한다.
- **IAM trust chain에 새 principal이 들어온다.** State machine execution role이 `bedrock-agentcore:InvokeAgentRuntime`이 필요해진다. Tag-based access control이 있는 platform이라면 (우리도 그렇다 — `IntelligenceRegistryAccess` 스타일) state machine role이 올바른 tag를 가져야 한다. Lambda role만 있는 게 아니라.
- **Observability 모양이 바뀐다.** Lambda function name으로 dashboard 짜둔 게 있다면 agent path에서 조용해진다. Traffic flip 전에 SF execution + AgentCore metric으로 parallel dashboard 준비해두는 편.

## 결국 이 발표가 말하는 것

이 통합 전까지 "에이전트가 어디서 실행되는가"는 답하기 짜증나는 질문이었다 — Lambda 안에서, 왜냐하면 workflow engine이 invoke할 줄 아는 게 그것밖에 없으니까. 실행 위치는 디자인 결정이 아니라 orchestration 선택의 부작용이었다.

Native AgentCore-as-task가 그걸 바꾼다. Agent 실행이 제자리에 둘 수 있는 무언가가 된다 — long-running, observable, workflow에 맞는 step 단위로 retry 가능. Orchestrator가 얇은 wrapper가 아니라 진짜 orchestrator가 된다.

"async story가 지저분해서" 미뤄둔 agentic feature가 있다면, 다시 볼 만하다. Async story가 꽤 덜 지저분해졌다.
