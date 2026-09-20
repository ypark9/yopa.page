---
title: "Bedrock AgentCore Evaluations 관측하기: CloudWatch로 이어지는 전체 흐름"
date: 2026-09-12T09:05:00-04:00
author: Yoonsoo Park
description: "Bedrock AgentCore Evaluations가 CloudWatch의 OpenTelemetry span을 읽어 평가하고 결과를 다시 CloudWatch에 기록하는 구조를 살펴본다. telemetry flush, Transaction Search, message content 설정에서 놓치기 쉬운 점도 함께 정리한다."
categories:
  - AWS
tags:
  - amazon-bedrock-agentcore
  - evaluations
  - opentelemetry
  - cloudwatch
  - observability
  - ai-agents
---

프로덕션에서 에이전트의 동작이 나빠질 때 항상 스택 트레이스가 남는 것은 아니다. 에이전트는 여전히 응답하고 자신 있게 답하며 HTTP 200도 반환하지만, 적절한 tool 호출을 건너뛰거나 원래 범위를 벗어난 답을 하기 시작할 수 있다. 오류율 알람만으로는 이런 변화를 포착하기 어렵다. 행동 자체를 지속적으로 평가해야 하며, 대규모 평가를 하려면 그 전체 과정이 먼저 관측 가능해야 한다.

2026년 3월 정식 출시된 Bedrock AgentCore Evaluations는 바로 이 원칙을 바탕으로 한다. 기억할 점은 단순하다. 모든 데이터가 CloudWatch를 중심으로 흐른다는 것이다. 텔레메트리는 OpenTelemetry span으로 들어오고, Evaluations가 이를 읽어 평가한 뒤 결과를 다시 CloudWatch에 기록한다. 이 흐름을 이해하면 설정 방법과 실패 원인도 훨씬 명확해진다. 이 글에서는 그 루프를 올바르게 구성하는 방법을 다룬다.

## 평가 루프의 전체 흐름

평가가 이루어지는 전체 경로는 다음과 같다.

```text
에이전트 (프레임워크 무관)
  -> OpenTelemetry span 생성 (ADOT 경유)
  -> CloudWatch (span은 aws/spans, message content는 에이전트 로그 그룹)
  -> AgentCore Evaluations가 span을 읽어 세션 재구성
  -> 내장 / 사용자 지정 evaluator가 평가
  -> 결과를 다시 CloudWatch에 기록:
       - JSON: /aws/bedrock-agentcore/evaluations/results/{config_id}
       - 점수: CloudWatch 메트릭
```

프레임워크에 종속되지 않는다는 점이 핵심이다. Evaluations는 에이전트가 Strands, LangGraph, LlamaIndex, OpenAI Agents SDK 중 무엇으로 만들어졌는지에 관계없이 동작한다. 에이전트가 인식 가능한 OpenTelemetry scope(`opentelemetry.instrumentation.*` 또는 `openinference.instrumentation.*`)로 텔레메트리를 생성하면 서비스는 공통 경로에서 이를 읽는다. 공통 형식은 OTel이고, 집결 지점은 CloudWatch다.

서비스는 세 종류의 span을 이용해 세션을 재구성한다. 최상위 “invoke agent” span에는 사용자 프롬프트와 최종 응답이, inference span에는 모델에 전달한 메시지와 모델 응답이, tool-call span에는 tool 이름과 파라미터, 결과가 담긴다. 최상위 span이 없으면 inference span만으로는 세션을 구성할 수 없다.

## 조용히 평가를 실패하게 만드는 함정

아래 문제들은 명확한 장애 대신 빈 결과나 평가 오류로 나타난다. 따라서 사전에 확인해 두는 편이 좋다.

### 1. 텔레메트리 flush 누락

이는 evaluation 실패의 가장 흔한 원인이다. AgentCore Runtime은 핸들러가 반환되면 실행 환경을 일시 중단한다. OTel SDK는 클라이언트 측 프로세서에 텔레메트리를 배치로 모은 뒤 타이머에 따라 export한다. 따라서 응답을 반환하는 시점에도 export되지 않은 span이 버퍼에 남아 있을 수 있고, 일시 중단 전에 export가 완료된다는 보장이 없다. span이 CloudWatch에 도달하지 못하면 Evaluations에는 평가할 데이터가 없다.

핸들러의 끝에서, 반환하기 전에 강제로 flush해야 한다.

```python
def _flush_telemetry():
    from opentelemetry import trace as _trace
    from opentelemetry._logs import get_logger_provider as _get_lp
    for provider in (_trace.get_tracer_provider(), _get_lp()):
        flush = getattr(provider, "force_flush", None)
        if flush:
            flush()

@app.entrypoint
async def invoke(payload, context):
    prompt = payload.get("prompt", "")
    try:
        result = await run_agent(prompt)
    finally:
        _flush_telemetry()
    return str(result)
```

`finally`가 중요한 이유는 에이전트가 예외를 발생시켜도 flush가 실행되기 때문이다. 이를 생략하면 가장 확인이 필요한 invocation의 텔레메트리를 잃게 된다.

### 2. Transaction Search 미활성화

팀에서 자주 놓치는 전제 조건이다. CloudWatch Transaction Search를 활성화해 span을 구조화된 로그로 ingest하지 않으면 span 쿼리는 아무 결과도 반환하지 않고 evaluation에는 입력 데이터가 없게 된다. span을 쿼리하기 전에 CloudWatch 콘솔에서 이 기능을 활성화해야 한다.

### 3. message content는 span과 별도로 저장된다

span 분류와 message content는 서로 다른 데이터이며 저장 위치도 다르다. span은 `aws/spans`에 기록된다. 실제 message content, 즉 사용자의 입력과 모델의 응답은 에이전트 로그 그룹에 연관된 event record로 저장된다. evaluation data source가 `aws/spans`만 포함하면 span 분류는 성공하더라도 message content는 비어 있게 된다. 그러면 응답 품질을 평가하는 evaluator가 오류를 낸다. data source에는 span 저장소와 content가 있는 로그 그룹을 모두 지정해야 한다.

## 결과의 저장 위치와 라우팅 방법

온라인 evaluation 결과는 전용 CloudWatch 로그 그룹인 `/aws/bedrock-agentcore/evaluations/results/{config_id}`에 JSON으로 기록된다. 이 결과는 OpenTelemetry GenAI evaluation-result 규약을 따르며, 원래 trace ID와 session ID에 연결된다. 점수는 `Bedrock-AgentCore/Evaluations` 네임스페이스의 CloudWatch 메트릭으로도 기록된다. 따라서 바로 활용할 수 있는 방법은 두 가지다.

- CloudWatch Logs Insights로 JSON을 **쿼리**해 evaluator, 세션, 기간별 결과를 분석한다.
- 메트릭에 **알람**을 설정해 goal-success나 helpfulness가 저하되는 상황을 사용자가 알아차리기 전에 감지한다.

여기서 최근의 Lambda 없는 로그 전달 방식과 연결된다. evaluation 결과, Bedrock model invocation 로그, span 데이터가 모두 CloudWatch에 쌓이면 다음 운영 과제는 이를 장기 보관 또는 SIEM으로 어떻게 내보낼지 결정하는 일이다. CloudWatch Logs delivery는 이를 위한 vended-log 메커니즘이다. 2026년 7월 14일 AWS는 같은 메커니즘을 API Gateway REST API execution log에도 확장해, 하나의 delivery source가 CloudWatch Logs, S3, Firehose로 동시에 fan-out할 수 있도록 했다. 중요한 것은 API Gateway 자체가 아니라, delivery-source/delivery-destination 모델이 CloudWatch의 로그 스트림을 S3(평가 이력을 Athena로 비용 효율적으로 쿼리하며 보관) 또는 Firehose(SIEM)로 라우팅하는 표준 방식이 되고 있다는 점이다. subscription filter와 Lambda forwarder를 조합해 별도로 유지할 필요가 없다. evaluation 관측성을 구성한다면 직접 forwarder를 만들기보다 이 메커니즘을 기준으로 export 경로를 설계하는 편이 낫다.

## 적용 순서

1. 인식 가능한 OTel scope에서 ADOT로 에이전트를 instrument한다. 커스텀 span 로직을 직접 작성하는 대신 instrumentation 패키지를 사용한다.
2. 핸들러의 끝에서 **`finally` 블록으로 텔레메트리를 flush한다.** 가장 먼저 발생하기 쉬운 문제다.
3. span 쿼리를 사용하기 전에 CloudWatch Transaction Search를 활성화한다.
4. evaluation data source에 span 저장소와 message-content 로그 그룹을 모두 지정한다. 그렇지 않으면 응답 품질 점수 평가가 오류를 낸다.
5. evaluation 메트릭에 알람을 설정하고, Logs Insights로 JSON을 쿼리한다. 장기 보관이나 SIEM이 필요하다면 CloudWatch Logs delivery를 사용해 S3 또는 Firehose로 내보내는 경로를 계획한다.

전체 설계의 핵심은 하나다. 먼저 에이전트를 CloudWatch에서 충분히 관측 가능하게 만들면 evaluation은 별도로 데이터를 공급해야 하는 시스템이 아니라, 이미 수집한 텔레메트리를 읽는 계층이 된다. 이 방식으로 동작하는 에이전트의 신뢰 경계는 [AWS에서 Zero Trust 에이전트 시스템](/ko/blog/2026-08-01-zero-trust-agent-systems-on-aws.html)에서 다뤘다.
