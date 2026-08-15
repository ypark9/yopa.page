---
title: "Hermes의 Memory와 Skill은 실제로 어떻게 작동할까?"
date: 2026-08-10
author: Yoonsoo Park
description: "Hermes의 session history, curated memory, USER.md, SOUL.md, skill과 선택적인 외부 memory provider를 분리해 학습 loop를 설계한다."
categories:
  - Agentic AI
  - Architecture
tags:
  - Hermes Agent
  - AI Agents
  - Memory
  - Security
atlas:
  region: agents
  object: field-note
  journeys:
    - hermes-operator
  evidence: documented
  era: current
---

“Agent가 기억한다”는 말만으로는 시스템을 설계하거나 검토할 수 없다. 대화 기록, 사용자에 관한 장기 사실, 성격을 정하는 규칙과 재사용할 배포 절차는 모두 다음 답변에 영향을 줄 수 있다. 하지만 소유자와 실패 방식은 서로 다르다.

Hermes는 이 역할들을 나눠 놓는다. 기능은 계속 바뀔 수 있으므로 이 글은 2026년 8월 10일에 확인한 공식 [persistent memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/), [context file](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files/), [memory provider](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/) 문서를 기준으로 한다.

## 먼저 각 층을 분리한다

| 층 | 보존하는 것 | 적합한 내용 | 주요 위험 |
| --- | --- | --- | --- |
| Session history | 대화와 tool 실행의 흐름 | 현재 작업의 context | 잡음, 낡은 가정, 민감한 출력 |
| `MEMORY.md` | 선별한 장기 사실과 교훈 | 안정적인 환경 정보, 결정, gotcha | 틀리거나 낡은 사실이 권위 있게 재사용됨 |
| `USER.md` | 사용자 profile과 선호 | 대화 방식과 장기적인 사용자 선호 | 사용자가 예상하지 못한 profiling |
| `SOUL.md` | Agent identity와 행동 태도 | 말투, 가치, 일반적인 행동 방식 | 성격을 policy로 오해함 |
| Project context file | Repository나 directory 규칙 | `AGENTS.md`, `.hermes.md`, project 제약 | 신뢰할 수 없는 repository 텍스트가 prompt에 들어옴 |
| Skill | 필요할 때 불러오는 재사용 절차 | 검증한 단계, script, reference, template | 잘못되거나 악의적인 절차가 장기 보존됨 |
| 외부 memory provider | 추가적인 session 간 modeling과 검색 | Provider 고유 recall이 필요한 경우 | 데이터 경계, 비용, 삭제, 불투명한 추론 |

이 층들을 서로 대신 쓰면 안 된다. “Rollback 확인 없이 deploy하지 않는다”는 교정은 장기 교훈이나 skill의 gate가 될 수 있다. 그 교훈이 생긴 대화 log 전체를 영구적인 identity 규칙으로 만들 필요는 없다.

## Session history는 증거이지 policy가 아니다

Hermes는 이전 작업을 찾고 이어갈 수 있도록 session을 저장한다. 어떤 command가 실행됐고 무엇이 실패했으며 사용자가 무엇을 고쳤는지 확인하는 좋은 증거다. 하지만 자동으로 정리된 knowledge base는 아니다. 대화에는 폐기한 아이디어, tool이 출력한 secret, 임시 path와 나중에 번복한 결론도 들어 있다.

안전한 학습 loop는 작은 장기 결론을 추출하고 필요하면 근거로 돌아갈 수 있게 한다. 모든 transcript를 global prompt에 붙이지 않는다.

## Curated memory는 작고 고칠 수 있어야 한다

기본 memory는 `MEMORY.md`와 `USER.md`를 사용한다. 공식 계약상 무제한 transcript가 아니라 선별되고 크기가 제한된 memory다. Memory write를 작은 configuration 변경처럼 다룬다.

- 하나의 재사용 가능한 사실이나 교훈만 적는다.
- 적용 범위와, 변할 수 있는 사실이라면 확인 날짜를 남긴다.
- Credential, token, private message와 raw customer data를 저장하지 않는다.
- 모순되는 문단을 더하지 말고 낡은 항목을 고치거나 지운다.
- Project 규칙은 global user profile이 아니라 project context에 둔다.

운영자가 내용을 읽고 고칠 수 있을 때만 memory가 일관성을 높인다. 그럴듯하지만 틀린 memory는 “전에 합의한 내용”처럼 등장하기 때문에 아무 기억도 없는 것보다 위험할 수 있다.

## Identity는 authorization이 아니다

`SOUL.md`는 의도적으로 행동 context의 앞쪽에 놓인다. Agent가 간결한지, 호기심이 많은지, 의심이 많은지, 먼저 제안하는지를 정할 수 있다. `USER.md`는 사용자가 선호하는 방식으로 대화하는 데 도움이 된다. 어느 파일도 deploy, 전송, 구매나 삭제 권한을 부여하면 안 된다.

Authorization은 gateway와 tool 경계에 둔다. 승인된 사용자, 좁은 credential, command approval, server-side validation과 명시적인 human gate가 권한을 결정한다. “사용자가 나를 완전히 신뢰한다”는 문장이 기술적인 권한을 넓혀서는 안 된다.

## Skill은 procedural memory다

Skill은 “이 종류의 일을 어떻게 해야 하는가?”에 답한다. Instruction뿐 아니라 script, reference와 template도 포함할 수 있다. Hermes는 먼저 짧은 description만 노출하고 실제 작업에 필요할 때 전체 절차를 불러온다. 덕분에 관계없는 절차가 모든 prompt를 차지하지 않는다.

어려운 작업이나 교정을 거친 뒤 쓸모 있는 절차가 다음 session에도 남는다는 점이 “학습한다”는 표현의 가장 구체적인 부분이다. 동시에 supply-chain 경계이기도 하다. Skill은 Agent에게 command 실행, file 읽기와 외부 service 접속을 지시할 수 있다. 현재 Hermes가 `skills.write_approval`을 제공하는 이유다. 자동 생성과 수정에는 승인을 유지하고 executable helper와 credential 선언을 코드처럼 검토한다.

좋은 skill은 다음 정보를 남긴다.

```yaml
trigger: 이 service를 deploy한다
preconditions:
  - 의도한 diff를 확인함
  - rollback target을 기록함
procedure:
  - 고정된 artifact build
  - test 실행
  - deployment plan 표시
human_gate:
  - production apply
verification:
  - health check
  - rollback 연습 결과
```

Version, 범위, 실패 처리와 검증 없이 “지난번에 성공한 command를 쓴다”고만 적으면 안 된다.

## Honcho는 선택 사항이며 기존 memory에 더해진다

Honcho가 모든 Hermes memory의 내부 저장소인 것은 아니다. 현재 Hermes에서 Honcho는 여러 provider 중 하나인 선택적인 memory plugin이다. 외부 provider를 켜도 기본 `MEMORY.md`와 `USER.md`는 계속 동작한다.

Honcho는 session을 넘는 user modeling, semantic search, session context와 합성된 conclusion을 추가한다. 여러 Agent가 같은 사용자를 더 풍부하게 이해해야 한다면 유용할 수 있다. 대신 다른 data processor 또는 self-hosted service가 하나 생긴다. 활성화하기 전에 다음을 결정한다.

- 어떤 대화 데이터가 Hermes host 밖으로 나가는가?
- 보존과 삭제 방식은 무엇인가?
- 여러 profile이 user workspace를 공유하는가?
- Provider가 응답하지 않을 때 어떻게 동작하는가?
- 잘못 추론한 conclusion을 어떻게 찾고 지우는가?
- 기본 memory보다 나아졌다는 사실을 어떻게 측정하는가?

처음에는 외부 provider 없이 시작한다. 기본 memory와 session search로 해결되지 않는 구체적인 recall 문제가 생겼을 때 추가한다.

## 사람의 판단으로 loop를 닫는다

책임 있는 개선 loop는 일부러 작게 만든다.

1. Hermes가 범위가 정해진 일을 끝내고 session trajectory를 보존한다.
2. 운영자가 증거가 생생할 때 결과를 유용함, 틀림, 위험함으로 표시한다.
3. Agent가 범위가 좁은 memory 또는 skill 변경 하나를 제안한다.
4. 사람이 장기 변경과 executable content를 검토한다.
5. 다음 작업에서 그 변경이 권한을 넓히지 않고 성공률을 높였는지 시험한다.
6. 낡거나 해로운 내용을 제거한다.

답변을 잘 만들었다는 이유로 다음 외부 action을 허용하지 않는다. Skill 수정이 자기 자신을 승인하게 하지 않는다. Memory가 많을수록 좋다고 생각하지 않는다.

운영 목표는 모든 것을 기억하는 Agent가 아니다. 직접 읽어볼 수 있을 만큼 작고, 다음 작업에 도움이 될 만큼 구체적이며, 무엇을 할 수 있는지 결정하는 통제와 분리된 장기 context가 목표다.
