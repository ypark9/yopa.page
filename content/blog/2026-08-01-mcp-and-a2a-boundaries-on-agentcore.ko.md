---
title: Amazon Bedrock AgentCore에서 MCP와 A2A 경계 정하기
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "HTTP, MCP, A2A를 계약에 따라 선택하고 AgentCore Runtime에 맞게 배포하며 모델의 판단과 권한 검사를 분리한다."
categories:
  - AWS
  - Architecture
  - AI Protocols
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - MCP
  - A2A
  - Security
---

Model Context Protocol(MCP)과 Agent-to-Agent(A2A)는 모든 에이전트가 갖춰야 할 ‘손’과 ‘목소리’가 아니다. 서로 다른 통신 계약이다. MCP는 모델을 사용하는 클라이언트에 도구와 컨텍스트 리소스를 공개한다. A2A는 다른 애플리케이션이나 에이전트에 에이전트의 기능과 작업 중심 상호작용을 공개한다. 경우에 따라 평범한 HTTP가 더 작고 좋은 경계다.

Amazon Bedrock AgentCore Runtime은 세 계약을 모두 지원한다. 선택에 따라 포트, 마운트 경로, 메시지 형식, 탐색 방법과 클라이언트 기대가 달라진다.

| 계약 | Runtime 엔드포인트 | 탐색 | 적합한 용도 |
| --- | --- | --- | --- |
| HTTP | 8080, `/invocations` 또는 `/ws` | 애플리케이션 정의 | 직접 호출과 스트리밍 |
| MCP | 8000, `/mcp` | 도구 목록 | 범위가 좁은 도구와 MCP 서버 |
| A2A | 9000, `/` | Agent Card | 상호운용 가능한 에이전트 위임 |

한 런타임 뒤에 여러 계약을 섞고 payload 모양으로 프로토콜을 추측하지 않는다. 외부에 공개한 계약별로 따로 배포하고 시험하는 편이 안전하다.

## 제한된 기능에는 MCP를 쓴다

MCP 도구에는 범위가 좁은 이름, JSON 스키마, 예측 가능한 오류, 실행 시점의 권한 검사가 필요하다. 모델이 도구를 골랐다는 사실은 승인이 아니다. 인자를 검증하고 호출자가 접근할 수 있는 리소스에 묶으며 비싼 동작은 속도를 제한한다. 중요한 쓰기에는 사용자 확인도 둔다.

여러 MCP 호환 클라이언트가 같은 도구를 사용해야 할 때 MCP의 가치가 생긴다. 한 프로세스만 사용하는 내부 함수라면 일반 함수가 낫다. 네트워크 프로토콜을 추가하면 인증, 버전 관리, 관측성과 가용성까지 운영해야 한다.

도구 설명과 반환 문자열은 신뢰하지 않은 내용으로 취급한다. MCP로 읽은 문서에는 모델을 노린 지시가 들어 있을 수 있다. 시스템 정책을 분리하고 출처를 표시하며 다른 명령에 사용할 출력은 검증한다. 검색한 텍스트를 그대로 셸이나 데이터베이스 명령으로 만들지 않는다.

## 에이전트 형태의 서비스에는 A2A를 쓴다

AgentCore의 A2A 계약은 HTTP 위 JSON-RPC 2.0을 사용하고 `/.well-known/agent-card.json`에서 Agent Card를 제공한다. Agent Card는 탐색용 메타데이터이지 검색 엔진이나 신뢰 증명, 권한 부여가 아니다. 운영 환경에서는 허용 목록 기반 레지스트리를 쓰고 대상의 신원과 기능을 검증한다.

현재 AgentCore와 Strands 연동은 지원되는 executor와 runtime 도우미로 Strands 에이전트를 감싼다.

```python
from strands import Agent, tool
from strands.multiagent.a2a.executor import StrandsA2AExecutor
from bedrock_agentcore.runtime import serve_a2a

@tool
def summarize_case(case_id: str) -> str:
    """현재 호출자에게 허용된 사건 요약을 반환한다."""
    return load_authorized_summary(case_id)

agent = Agent(tools=[summarize_case])

if __name__ == "__main__":
    serve_a2a(StrandsA2AExecutor(agent))
```

이 코드는 프로토콜 호환성을 제공할 뿐 업무 권한을 구현하지 않는다. AgentCore는 SigV4 또는 OAuth 2.0으로 호출을 인증할 수 있다. 그 뒤에도 서비스가 해당 주체의 사건 접근과 도구 사용 권한을 검사해야 한다. 사용자 토큰을 아무 곳에나 전달하지 말고, 최소 권한을 가진 명시적 위임이나 토큰 교환을 사용한다. 최초 사용자와 실제 워크로드 신원도 따로 기록한다.

## 컨텍스트를 의도적으로 전달한다

AgentCore는 세션 격리를 위해 런타임 세션 헤더를 추가한다. 세션 ID는 tenant ID가 아니다. 상관관계, tenant, 최종 사용자 정보는 서명되었거나 서버가 만든 envelope로 전달하고 각 hop에서 검증한다. 모델이 만든 식별자를 신뢰해서는 안 된다.

A2A 호출에는 timeout과 취소, fan-out 상한을 두고 trace ID를 이어 간다. 그렇지 않으면 위임 그래프가 순환하거나 비용이 증폭될 수 있다. 오류는 구조화해서 반환하되 JSON-RPC 오류 데이터에 비밀이나 내부 stack trace를 넣지 않는다.

## 이전과 평가

기존 도구와 엔드포인트부터 목록화한다. 결정적이고 작은 동작은 함수나 MCP 도구로 유지한다. 독립된 소유권, 기능 탐색, 프레임워크 간 위임이 실제로 필요할 때만 A2A를 공개한다. 새 경계 뒤에 기존 adapter를 두고 클라이언트를 점진적으로 옮긴다.

Agent Card, JSON-RPC 오류, 인증 실패, 도구 스키마, 취소, 스트리밍을 계약 테스트로 확인한다. 위조한 tenant 컨텍스트, 도구 출력의 prompt injection, 침해된 하위 에이전트, 과도한 위임, 재전송 요청도 보안 시험에 넣는다. 이전 전후의 작업 성공률, 지연, 토큰 사용량, 도구 오류와 권한 거부를 비교한다.

## 참고 자료

- [AgentCore Runtime 서비스 계약](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-service-contract.html)
- [AgentCore Runtime에 A2A 서버 배포하기](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a.html)
- [AgentCore A2A 프로토콜 계약](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a-protocol-contract.html)
- [Model Context Protocol 사양](https://modelcontextprotocol.io/specification/)

_2026-08-01 기준 공식 문서를 확인했다._
