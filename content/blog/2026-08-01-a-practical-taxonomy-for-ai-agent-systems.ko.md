---
title: "AI Agent 시스템을 위한 실용적인 분류법"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "불안정한 agent와 agentic AI 구분 대신 도구, 계획 기간, 자율성, 기억, 위임과 위험으로 AI 시스템을 평가하는 방법."
categories:
  - Artificial Intelligence
  - Architecture
tags:
  - AI Agents
  - Multi-Agent Systems
  - AI Evaluation
  - Security
---

“AI agent”와 “agentic AI” 사이에는 모두가 따르는 하나의 경계가 없다. vendor와 연구자마다 다르게 쓴다. agentic이라는 이름이 붙는다고 시스템이 더 유능해지는 것도 아니고 multi-agent topology가 single agent보다 자동으로 더 자율적인 것도 아니다.

설계와 governance에서는 두 label 중 하나를 고르는 대신 관찰 가능한 capability를 기술해야 한다.

## 중요한 여섯 차원

1. **도구 권한:** 정보 조회만 가능한가, 데이터 쓰기, 메시지 전송, 배포, 결제, 삭제까지 가능한가?
2. **계획 기간:** 한 turn, 제한된 workflow, 여러 시간과 재개를 포함한 goal 중 어디까지 수행하는가?
3. **자율성:** 어느 단계에 사람 승인이 필요한가? 승인된 목표 안의 방법만 고르는가, 새 목표도 만드는가?
4. **상태와 기억:** 한 요청, 한 session, 또는 장기 사용자·조직 memory까지 무엇을 보존하는가?
5. **위임 topology:** single model/tool loop, supervisor와 specialist, peer 위임, 또는 모델을 호출하는 deterministic workflow인가?
6. **환경 불확실성:** sandbox, 되돌릴 수 있는 draft, 사람과 돈이 연결된 live system 중 어디에 action을 적용하는가?

같은 agent label이라도 위험은 다르다. 고객 환불 권한이 있는 single agent가 문서를 요약하는 read-only agent 다섯 개보다 더 큰 통제가 필요하다.

## 가장 작은 아키텍처 선택

먼저 deterministic application이 좁은 변환을 위해 모델을 호출하게 한다. 최신 또는 private knowledge가 필요할 때 retrieval을 추가한다. 실제 행동이 필요하면 general shell이나 DB credential이 아니라 입력이 검증되는 구체적인 operation을 도구로 노출한다. 알려진 workflow로 표현할 수 없는 작업에만 planning을 추가한다.

multi-agent는 context ownership 분리, 독립 평가 가능한 전문성, security boundary, 겹치지 않는 output의 병렬 작업처럼 측정 가능한 이점이 있을 때 사용한다. 조직도를 흉내 내기 위해 추가하지 않는다. 위임마다 latency, token, failure mode, context loss와 authorization 결정이 늘어난다.

신뢰성이 필요한 business process에서는 workflow engine이 durable state, retry, deadline, compensation과 human approval을 소유하는 편이 보통 낫다. 모델은 제한된 단계를 제안하거나 실행할 수 있지만 system of record가 되어서는 안 된다.

```yaml
goal: triage incoming support cases
tools:
  - read_case
  - draft_reply
forbidden:
  - send_reply
  - change_account
planning_horizon: one_case
memory: session_only
human_gate: approve_draft
rollback: discard_draft
success_metrics:
  - routing_accuracy
  - unsafe_action_rate
  - reviewer_edit_distance
```

이 기록은 테스트할 수 있지만 “agentic support system 구축”이라는 문장은 테스트할 수 없다.

## 보안과 평가

prompt, 검색 문서, 웹 페이지, tool output과 다른 agent의 메시지를 신뢰할 수 없는 data로 취급한다. tool argument를 server-side에서 검증하고 텍스트 속 권한 주장이 아니라 인증된 actor와 현재 resource로 매 action을 승인한다. least privilege workload identity, egress control, secret isolation, audit log, 비용·시간 budget과 idempotency key를 사용한다.

모델 품질, retrieval recall·grounding, tool 선택·인자, authorization denial·prompt injection, end-to-end 성공·latency·cost·복구, 불확실할 때 human escalation을 각각 평가한다. duplicate event, partial failure, stale context, unavailable tool, 악성 검색 문장과 잘못된 delegated result를 시험한다. 매끄러운 demo는 안전한 autonomy의 증거가 아니다.

## 마이그레이션 체크리스트

- 모든 tool의 read/write와 reversibility를 조사한다.
- planning horizon, memory scope, identity propagation과 approval point를 기록한다.
- 넓은 tool access를 좁고 typed된 operation으로 바꾼다.
- durable workflow state를 model context 밖으로 옮긴다.
- multi-agent 전에 single-agent baseline을 만든다.
- evaluation case와 명시적인 stop budget을 둔다.
- read-only, draft, 좁게 승인된 action 순으로 rollout한다.
- 추가 agent가 복잡성보다 큰 측정 이점을 주는지 검토한다.

공식 자료 확인일: **2026-08-01**.

## 공식 자료

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- [Agent2Agent protocol specification](https://a2a-protocol.org/latest/specification/)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/)
