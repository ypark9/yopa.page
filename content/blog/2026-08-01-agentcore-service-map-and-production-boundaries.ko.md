---
title: "Amazon Bedrock AgentCore 서비스와 Production 경계"
date: 2025-12-15
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2025-12-15-partner-insights-agentcore-overview.html"
author: Yoonsoo Park
description: "AgentCore Runtime, Identity, Gateway, Memory, Browser, Code Interpreter와 observability의 control·data·security·cost 경계를 구분하는 가이드."
categories:
  - AWS
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Security
  - Observability
  - AWS Architecture
atlas:
  region: agents
  object: field-note
  journeys:
    - safe-agent-operations
  evidence: documented
  era: current
---

Amazon Bedrock AgentCore는 agent를 자동으로 production-ready로 만드는 “IaC layer”가 아니라 여러 managed capability의 모음이다. 각 서비스는 다른 경계를 해결하고 별도의 control-plane과 data-plane API를 제공한다. application authorization, evaluation, 비용 통제와 복구 설계는 여전히 필요하다.

## Runtime

Runtime은 격리된 runtime session에서 agent application을 host한다. HTTP, MCP, A2A는 서로 다른 port와 path의 protocol contract를 가진다. invocation은 IAM SigV4 또는 설정된 JWT authorization을 사용한다. lifecycle setting은 idle timeout과 instance maximum lifetime을 제어하지만 durable business state는 runtime 밖에 있어야 한다.

stateless application과 고정 dependency/image를 배포하고 execution role을 최소 권한으로 제한한다. conference example의 base image나 helper가 현재 API라고 가정하지 않는다.

## Identity와 Gateway

Identity는 workload identity와 외부 접근용 credential provider를 관리한다. OAuth 2.0 또는 API-key credential을 prompt와 소스에 넣지 않고 중개할 수 있다. inbound runtime 인증과 outbound tool 권한은 별개의 결정이다. 유효한 JWT가 tool action을 자동 승인하지 않으며 사용자 context 전파는 명시적으로 설계한다.

Gateway는 Lambda, API 등의 target을 MCP-compatible tool로 노출한다. 좁은 schema를 정의하고 target에서 재검증하며 인증된 actor로 승인한다. request/response interceptor는 transformation이나 custom policy를 위한 Lambda를 실행할 수 있지만 limit, retry, latency와 민감 header 처리가 필요하다. Gateway가 target의 authorization을 대신하지 않는다.

## Memory와 managed tool

Memory는 actor/session 아래 short-term event를 저장하고 strategy와 namespace template로 long-term record를 비동기 추출할 수 있다. application은 event와 retrieval API를 호출하고 무엇을 저장·주입할지 결정한다. namespace는 정리에 도움을 주지만 IAM과 tenant authorization을 대신하지 않는다. retention, KMS, deletion, consent와 extracted memory 평가가 필요하다.

Browser와 Code Interpreter는 browsing과 code execution 환경을 제공한다. 운영 부담을 줄이지만 위험을 없애지는 않는다. browser content는 prompt injection을 포함할 수 있다. code execution에는 입출력 limit, network policy, artifact scan, time budget과 외부로 내보낼 파일 정책이 필요하다.

## Observability와 선택 절차

trace, log, metric으로 model call, tool decision, gateway target, memory operation과 사용자 결과를 연결한다. prompt, token, credential, 민감 payload를 비식별화한다. token count뿐 아니라 task success, unsafe action, human escalation, latency, 비용, retry와 recovery를 측정한다.

1. application과 threat model에서 시작해 요구를 해결하는 서비스만 고른다.
2. 모든 hop의 identity와 authorization을 그린다.
3. durable state, idempotency, timeout, retry, compensation, human gate를 정의한다.
4. protocol, SDK, image, model version을 가능한 범위에서 고정한다.
5. denied tool, cross-user memory, 악성 content, dependency failure, budget exhaustion을 negative test한다.
6. read-only 또는 draft pilot을 단순 baseline과 비교한 뒤 권한을 점진적으로 늘린다.

AgentCore는 hosting과 integration 작업을 줄이지만 AWS service, quota, Region, IAM과 variable cost를 추가한다. 좁은 agent에는 ordinary service가 단순할 수 있고 deterministic durable process에는 workflow engine이 더 적합하다.

## 마이그레이션 체크리스트

- 현재 SDK에 없는 예시 API를 제거한다.
- control-plane provisioning과 data-plane invocation을 분리한다.
- broad role을 component별 최소 권한으로 바꾼다.
- secret은 Identity/Secrets Manager, durable state는 명시적 store로 옮긴다.
- memory와 log retention/deletion을 정한다.
- quota, cost alarm, evaluation gate와 rollback을 추가한다.
- 실제 Region과 account에서 검증한 capability만 production support로 기록한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html)
- [AgentCore Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html)
- [AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-create.html)
- [AgentCore Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html)
