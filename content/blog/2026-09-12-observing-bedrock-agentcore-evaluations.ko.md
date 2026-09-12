---
title: "Bedrock AgentCore Evaluations 관측하기: 전부 CloudWatch로 흐른다"
date: 2026-09-12T09:05:00-04:00
author: Yoonsoo Park
description: "Bedrock AgentCore Evaluations가 CloudWatch에서 OpenTelemetry span을 읽어 채점하고 결과를 다시 CloudWatch에 쓰는 방식, 그리고 이걸 조용히 깨뜨리는 flush·Transaction Search·message content 함정."
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

프로덕션에서 에이전트가 망가질 땐 스택 트레이스가 안 뜬다. 조용히 나빠진다. 여전히 답하고, 여전히 자신 있게 말하고, 여전히 HTTP 200을 뱉는데, 맞는 tool을 안 부르기 시작했거나 원래 범위 밖을 답하기 시작한 거다. 에러율 알람으로는 이걸 못 잡는다. 행동을 채점해야 잡힌다. 계속해서. 그리고 대규모로 행동을 채점하려면 먼저 그 루프 전체가 관측 가능해야 한다.

Bedrock AgentCore Evaluations(2026년 3월 GA)가 딱 이 아이디어 위에 서 있다. 몸에 새길 건 하나다. 전부 한자리로 흐른다, CloudWatch. 텔레메트리는 OpenTelemetry span으로 들어오고, Evaluations가 그 span을 읽어서 채점하고, 결과를 다시 CloudWatch에 쓴다. 이 한 문장을 이해하면 셋업도 실패 모드도 다 말이 된다. 이 글은 그 루프를 제대로 배선하는 얘기다.

## 루프, 처음부터 끝까지

evaluation이 타는 전체 경로다.

```text
에이전트 (프레임워크 무관)
  -> OpenTelemetry span 방출 (ADOT 경유)
  -> CloudWatch (span은 aws/spans, message content는 에이전트 로그그룹)
  -> AgentCore Evaluations가 span을 읽어 세션 재구성
  -> 빌트인 / 커스텀 evaluator가 채점
  -> 결과가 다시 CloudWatch로:
       - /aws/bedrock-agentcore/evaluations/results/{config_id} 에 JSON
       - score는 CloudWatch 메트릭으로 방출
```

프레임워크 무관이라는 게 핵심이다. Evaluations는 에이전트가 Strands든 LangGraph든 LlamaIndex든 OpenAI Agents SDK든 상관 안 한다. 에이전트가 인식되는 OpenTelemetry scope(`opentelemetry.instrumentation.*` 또는 `openinference.instrumentation.*`) 아래로 텔레메트리를 쏘기만 하면, 서비스가 generic 경로로 읽는다. 공통어는 OTel이고, 만나는 지점은 CloudWatch다.

세션은 세 가지 span 역할로 재구성된다. 최상위 "invoke agent" span(유저 프롬프트 + 최종 응답), inference span(모델로 간 메시지 + 모델의 답), tool-call span(tool 이름, 파라미터, 결과). 최상위 span이 없으면 inference span만으로는 세션을 조립할 수 없다.

## 이걸 조용히 깨뜨리는 함정들

아래 전부 요란한 실패가 아니라 빈 결과나 채점 에러를 낸다. 그래서 적어 둘 값이 있다.

### 1. 텔레메트리 flush를 까먹는 것

evaluation 실패의 가장 흔한 원인 하나다. AgentCore Runtime은 핸들러가 리턴하는 순간 실행 환경을 suspend한다. OTel SDK는 텔레메트리를 클라이언트 측 프로세서에 배치로 모아 뒀다가 타이머로 export한다. 그래서 응답을 리턴할 때 export 안 된 span이 아직 버퍼에 남아 있을 수 있고, suspend 전에 export가 끝난다는 보장이 없다. span은 CloudWatch에 영영 안 닿고, Evaluations는 채점할 게 없다.

핸들러 끝에서, 리턴하기 전에 강제로 flush해라.

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

`finally`가 중요하다. 에이전트가 예외를 던져도 flush해야 한다. 안 그러면 가장 들여다보고 싶은 그 invocation의 텔레메트리를 정확히 잃는다.

### 2. Transaction Search를 안 켠 것

팀들이 가장 자주 놓치는 전제 조건이다. CloudWatch Transaction Search(span을 구조화 로그로 ingest)를 안 켜면 span 쿼리가 아무것도 안 돌려주고, evaluation은 조용히 입력이 없다. span이 쿼리되길 기대하기 전에 CloudWatch 콘솔에서 한 번 켜 둬라.

### 3. message content는 span과 따로 산다

span 분류와 message content는 다른 거고, 다른 데 저장된다. span은 `aws/spans`에 떨어진다. 실제 message content(유저가 뭐라 했는지, 모델이 뭐라 답했는지)는 에이전트 로그그룹에 상관된 event record로 저장된다. evaluation data source가 `aws/spans`만 덮으면 span 분류는 성공하는데 message content가 비어서 돌아오고, 응답 품질을 채점하는 evaluator는 에러를 낸다. data source를 span 저장소와 content가 든 로그그룹 양쪽에 걸어라.

## 결과는 어디로 가고, 어떻게 라우팅하나

online evaluation 결과는 전용 CloudWatch 로그그룹 `/aws/bedrock-agentcore/evaluations/results/{config_id}`에 JSON으로 쓰인다. OpenTelemetry GenAI evaluation-result 컨벤션을 따르고, 원래 trace ID와 session ID에 parenting된다. score는 `Bedrock-AgentCore/Evaluations` 네임스페이스 아래 CloudWatch 메트릭으로도 방출된다. 여기서 바로 손잡이가 둘 나온다.

- CloudWatch Logs Insights로 JSON을 **쿼리**해서 evaluator별, 세션별, 기간별로 결과를 쪼갠다.
- 메트릭에 **알람**을 걸어 goal-success나 helpfulness가 떨어지는 걸 사람이 알아채기 전에 잡는다.

이제 최근 Lambda 없는 배관 변경과 연결되는 지점이다. eval 결과, Bedrock model invocation 로그, span 데이터가 다 CloudWatch에 떨어지고 나면 다음 운영 질문은 이걸 장기 보관이나 SIEM으로 어떻게 *빼내나*다. CloudWatch Logs delivery가 그걸 위한 vended-log 메커니즘이고, 2026년 7월 14일에 AWS가 같은 메커니즘을 API Gateway REST API execution log까지 확장했다. delivery source 하나가 CloudWatch Logs, S3, Firehose로 동시에 fan-out하게 된 거다. 여기서 중요한 건 API Gateway 자체가 아니다. delivery-source/delivery-destination 모델이 CloudWatch에 있는 아무 로그 스트림이든 S3(eval 히스토리를 Athena로 싸게 쿼리하며 보관)나 Firehose(SIEM)로 라우팅하는 표준 방법이 되어 가고 있다는 거다. subscription filter + Lambda forwarder 접착제를 유지 안 하고 말이다. eval 관측성을 세운다면 forwarder를 손으로 짜지 말고 같은 primitive로 export 경로를 계획해라.

## 실제로 뭘 하면 되나

1. 인식되는 OTel scope 아래로 ADOT로 에이전트를 instrument해라. 커스텀 span 로직을 짜는 게 아니라 instrumentation 패키지가 해 준다.
2. 핸들러 끝에서 **`finally` 블록에서 텔레메트리를 flush해라.** 제일 먼저 물릴 함정이다.
3. span 쿼리가 되길 기대하기 전에 CloudWatch Transaction Search를 켜라.
4. evaluation data source를 span 저장소와 message-content 로그그룹 양쪽에 걸어라. 안 그러면 응답 품질 score가 에러 난다.
5. eval 메트릭에 알람 걸고, Logs Insights로 JSON 쿼리하고, 보관이나 SIEM이 필요하면 CloudWatch Logs delivery로 S3/Firehose export 경로를 계획해라.

전체 설계는 감각 하나로 접힌다. 에이전트를 CloudWatch에서 먼저 관측 가능하게 만들면, evaluation은 이미 가진 텔레메트리 위에 얹히는 reader가 되지, 따로 먹여야 하는 별개 시스템이 아니다. 이렇게 도는 에이전트 주변의 신뢰 경계가 궁금하면 [AWS에서 Zero Trust 에이전트 시스템](/ko/blog/2026-08-01-zero-trust-agent-systems-on-aws.html)에 적어 뒀다.
