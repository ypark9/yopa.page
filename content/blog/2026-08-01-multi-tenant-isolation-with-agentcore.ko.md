---
title: Amazon Bedrock AgentCore 멀티테넌트 격리 설계
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "신원, Runtime 세션, Memory 네임스페이스, 도구, 저장소와 로그 전반에 걸쳐 다층적인 tenant 격리를 설계한다."
categories:
  - AWS
  - Security
  - SaaS
tags:
  - Amazon Bedrock AgentCore
  - Multi-Tenancy
  - Security
  - AWS IAM
  - AI Agents
---

멀티테넌트 에이전트에는 위험한 모호함이 있다. 모델은 tenant 이름을 말할 수 있지만 호출자가 어느 tenant에 속하는지는 신뢰할 수 있는 애플리케이션 코드만 확정할 수 있다. Amazon Bedrock AgentCore가 유용한 격리 수단을 제공해도 서비스 전체의 권한 설계를 대신해 주지는 않는다.

인증된 사용자 또는 워크로드, tenant, AgentCore 런타임 세션, AWS 실행 역할을 구분하는 데서 시작한다. 이들은 서로 연관될 수 있지만 같은 신원이 아니다. 특히 runtime session ID는 런타임 상태를 격리할 뿐 tenant 소속을 증명하지 않는다.

## 모델보다 먼저 tenant를 확정한다

경계에서 인증하고 신뢰할 수 있는 디렉터리나 entitlement 서비스에서 tenant 소속을 찾는다. 서버에서 요청 컨텍스트를 만들고, 프롬프트나 브라우저만 제공한 tenant ID는 거부한다.

```json
{
  "principalId": "user-7c91",
  "tenantId": "tenant-42",
  "roles": ["case-reader"],
  "requestId": "req-a813"
}
```

서비스 사이에서는 이 컨텍스트를 서명하거나 무결성을 보호하고, 각 신뢰 경계에서 audience, issuer, 만료, tenant 소속을 검증한다. 허용 여부를 모델에게 묻지 않는다. 모델은 의도를 해석할 수 있지만 최종 동작은 결정적인 정책 계층이 승인해야 한다.

## 격리 수준을 의식적으로 선택한다

공유 런타임은 효율적이고 전용 리소스는 피해 범위를 줄인다. 위험이 낮다면 강한 논리적 제어와 공유 컴퓨트를 사용할 수 있다. 규제 데이터나 강한 격리가 필요한 tenant에는 별도 runtime, memory, KMS 키, 네트워크 경로 또는 AWS 계정을 고려한다. 무엇을 공유하고 무엇을 분리했는지 문서화한다.

AgentCore Runtime은 세션별 격리 환경을 만든다. 그래도 tenant 데이터를 프로세스 전역 변수에 캐시하거나 임시 파일을 세션 사이에 재사용하거나 과거 대화에서 tenant를 추론하면 안 된다. 모든 호출과 도구 요청을 검증된 서버 컨텍스트에 묶는다.

## 메모리 격리를 강제한다

AgentCore Memory 이벤트는 `actorId`와 `sessionId`로 구성되고 장기 레코드는 설정된 네임스페이스를 사용한다. 서버에서 tenant와 사용자에 매핑하는 불투명 actor ID를 쓴다. 예를 들면 다음처럼 전략과 tenant, actor 범위를 함께 둔다.

```text
/tenant/tenant-42/strategy/{memoryStrategyId}/actor/user-7c91/
```

경로 정리는 접근 제어가 아니다. 특정 memory ARN과 허용된 경로를 `bedrock-agentcore:namespace`, `bedrock-agentcore:namespacePath` 같은 공식 IAM 조건 키로 제한한다. 하나의 공유 역할이 모든 tenant 경로를 만들 수 있다면 confused deputy 버그를 IAM만으로 막지 못할 수 있다. 정책 결정 지점을 추가하거나 신뢰된 broker가 session tag를 붙인 tenant 범위 역할을 발급한다.

가능하면 로그와 URL에는 실제 tenant 이름 대신 불투명 ID를 사용한다. 장기 전략을 켜기 전에 tenant와 actor 단위 삭제, 내보내기, 보존 기한을 정한다.

## 모든 도구와 데이터 쿼리를 승인한다

MCP나 A2A를 사용해도 도구가 자동으로 tenant-aware가 되지는 않는다. 모델 인자와 분리된 채널로 신뢰된 컨텍스트를 전달한다. 도구 서비스가 허용된 tenant를 결정하고 모든 저장소 쿼리에 추가하게 한다. “이 tenant만 보라”는 프롬프트보다 행 단위 보안이나 partition key와 권한 검사를 사용한다.

쓰기에서는 리소스 소유자, 동작, 금액, 현재 상태를 검사한다. 멱등성 키를 쓰고 중요한 작업에는 추가 승인을 요구한다. 하위 서비스 자격 증명은 수명이 짧고 최소 권한이어야 한다. Agent Card로 찾은 임의의 에이전트에 사용자 bearer token을 전달하지 않는다.

## 정보 누출 없이 관측한다

구조화된 감사 기록에 요청, tenant, actor, session, 도구, 정책 판단, trace 식별자를 남긴다. 프롬프트와 도구 payload는 기본적으로 일반 로그에서 제외한다. tenant 결과물을 암호화하고 개인정보와 cardinality를 고려해 메트릭 차원을 정하며 tenant 간 접근 거부를 경고한다.

## 이전과 격리 시험

단일 tenant 에이전트를 공유 구조로 바꾸기 전에 런타임 메모리, AgentCore Memory, 캐시, 객체 경로, 벡터 인덱스, DB 행, 큐, trace, 분석 export를 전부 찾는다. tenant 키와 권한을 먼저 추가하고 대조하며 데이터를 채운 뒤 트래픽을 점진적으로 전환한다.

두 tenant를 둔 적대적 테스트를 만든다. session ID 재사용, actor ID 교체, 컨텍스트 위조, 도구를 통한 다른 tenant 객체 요청, 검색 문서에 삽입한 식별자, 과거 요청 재전송, 로그와 캐시 노출을 시험한다. 각 tenant에 고유 marker를 넣고 검색, 기억, 도구, export, 삭제가 경계를 넘지 않는지 지속적으로 확인한다.

## 참고 자료

- [AgentCore Runtime과 세션 격리](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [AgentCore 장기 메모리 네임스페이스](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)
- [IAM session tag](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)
- [SaaS Tenant Isolation Strategies](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/saas-tenant-isolation-strategies.html)

_2026-08-01 기준 공식 문서를 확인했다._
