---
title: "Hermes Agent를 직접 운영할 가치가 있는 때는 언제일까?"
date: 2026-08-10
author: Yoonsoo Park
description: "Chatbot, coding agent, 고정 자동화와 비교해 Hermes Agent를 선택할 조건과 local, VPS, NAS, cloud 실행 환경의 경계를 정리한다."
categories:
  - Agentic AI
  - Architecture
tags:
  - Hermes Agent
  - AI Agents
  - Self-Hosting
  - Security
atlas:
  region: agents
  object: field-note
  journeys:
    - hermes-operator
  evidence: documented
  era: current
---

Hermes Agent는 대화를 기억하고 tool을 사용하며, 반복한 절차를 skill로 남기고, 정해진 시간에 일하고, Slack 같은 messenger에서 계속 만날 수 있다. 매력적인 기능이지만 모든 AI 작업에 Hermes가 필요하다는 뜻은 아니다. 오히려 직접 운영해야 할 시스템이 하나 생긴다는 뜻에 가깝다.

설치 방법보다 먼저 물어야 할 질문은 이것이다.

> 이 일은 credential과 상태를 가진 장기 실행 Agent를 운영할 만큼 지속적인 context와 tool access에서 이익을 얻는가?

제품 기능의 기준은 [Hermes v0.20.0 release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3)와 현재 [공식 기능 문서](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)다. AWS와 Synology에 관한 판단은 제가 직접 운영하며 확인한 경험으로 따로 구분한다.

이 Expedition에서는 Hermes를 **공식 Docker image로만 운영한다**. Shell installer, host에 직접 설치하는 PyPI package와 editable source checkout은 사용하지 않는다. 아래의 local, VPS, NAS와 AWS는 서로 다른 설치 방법이 아니라 같은 container를 어디에서 실행할지에 관한 선택이다.

## 대화창만 보면 비슷한 네 가지 시스템

| 시스템 | 잘 맞는 일 | 상태를 책임지는 곳 | 주요 운영 부담 |
| --- | --- | --- | --- |
| Chatbot | 질문, 초안, 분석 | Provider의 conversation | 데이터 취급과 결과 검토 |
| Coding agent | Repository 안의 범위가 정해진 작업 | Session과 worktree | 코드 리뷰와 command 권한 |
| 고정 workflow | 알려진 trigger와 정해진 단계 | Workflow engine | 재시도, credential, schema 변경 |
| Hermes 같은 persistent agent | Context, tool, 후속 작업이 결합된 반복 업무 | Agent home과 연결된 시스템 | 권한, memory 품질, upgrade, 비용, 복구 |

Cron과 API 호출 하나로 표현되는 일이라면 그렇게 만드는 편이 낫다. 결정론적인 workflow는 시험하고 복구하기 쉽다. 한 번의 repository 변경이라면 격리된 worktree에서 일하는 coding agent가 더 작은 경계다. Hermes는 같은 운영자가 이전 판단을 이어받는 조력자에게 여러 tool을 맡기고, laptop을 닫은 뒤에도 Slack에서 일을 이어가며, 잘된 절차를 다음 작업에 재사용하고 싶을 때 의미가 생긴다.

## 선택 전에 확인할 조건

다음 조건 대부분에 해당하면 Hermes를 검토할 만하다.

- 같은 종류의 일이 반복되지만 매번 입력과 판단이 조금씩 달라진다.
- 이전 결정과 사람의 교정이 다음 작업에 영향을 줘야 한다.
- 단순한 문장 생성이 아니라 여러 tool을 사용해야 한다.
- laptop을 닫은 뒤에도 비동기 작업이나 messenger 접근이 필요하다.
- credential, feedback, upgrade와 recovery를 책임질 운영자가 한 명 있다.
- 잘못된 action을 발견하고 중단하고 되돌릴 수 있다.

돈을 이동하거나 production 데이터를 삭제하거나, 법적 약속을 만들거나, 고객에게 직접 말하는 일을 믿을 만한 승인 절차 없이 수행해야 한다면 더 작은 시스템을 선택해야 한다. Memory와 skill, log, 비용과 backup을 검토할 사람이 없을 때도 마찬가지다. “스스로 개선한다”는 표현은 운영 작업을 없애지 않는다. 사람이 검토해야 할 대상이 달라질 뿐이다.

## 성격보다 권한을 먼저 적는다

`SOUL.md`는 Agent의 말투와 정체성을 선명하게 만들 수 있지만 authorization을 대신하지 않는다. 먼저 다음과 같은 운영 기록을 만든다.

```yaml
job: Slack에 매일 engineering brief 초안 작성
inputs:
  - 승인된 repository
  - read-only monitoring data
tools:
  - web search
  - read-only Git과 log
forbidden:
  - deploy
  - merge
  - private Slack channel 밖으로 전송
human_gate:
  - 외부 시스템에 쓰는 모든 action
state:
  - Hermes home을 매일 backup
recovery:
  - gateway 종료, snapshot 복원, consumer 하나만 시작
```

Hermes에는 위험한 command 승인과 gateway allowlist가 있지만 직접 설정해야 한다. 현재 [공식 security guide](https://hermes-agent.nousresearch.com/docs/user-guide/security/)는 `smart`, `manual`, `off` approval mode를 설명하며, messenger 사용자는 pairing이나 allowlist로 승인하지 않으면 기본적으로 거부된다. 이 default-deny 성질을 유지하고 사람이 없는 cron 작업에는 대화형 작업보다 더 좁은 권한을 준다.

## 어디에서 실행할까

### 개인 컴퓨터

필요한 tool과 permission을 아직 알아가는 중이라면 local Docker runtime에서 공식 container로 시작하는 것이 좋다. 비용이 적고 직접 들여다보기 쉽다. 대신 sleep, network 변경과 사용자 login session이 availability의 일부가 된다.

### 작은 VPS

Agent 하나를 계속 켜 두려면 공식 container를 실행하는 VPS가 실용적인 기본값이다. Mount한 Hermes home을 backup하고 host와 Docker를 계속 patch해야 하지만, private subnet을 둔 AWS 구성보다 infrastructure surface가 작다.

### NAS

이미 24시간 실행되는 NAS가 있다면 비용을 줄일 수 있다. 전용 container, 제한된 mount, 명시적인 resource limit와 live volume 밖의 backup을 사용한다. 저장 장치가 가깝다는 이유로 개인 파일 전체를 Agent에게 보여주면 안 된다.

### Managed cloud container

이미 ECS 같은 platform을 운영하고 IAM, 중앙 log, 선언적인 교체와 조직 통제가 필요하다면 managed container가 맞다. 다만 개인 Agent 하나에서는 network, storage와 secret service가 예상보다 비쌀 수 있다. 제가 측정한 ECS 구성은 약 833시간 동안 credit 적용 전 약 $108.9가 들었다. 이 값은 하나의 architecture에 대한 결과이지 Hermes의 공통 가격표가 아니다.

## 결론

지속적인 context와 tool, 비동기 접근이 실제로 필요한 반복 업무를 말할 수 있고, 그 기능을 가능하게 하는 상태와 권한을 운영할 의지가 있을 때 Hermes를 선택한다.

처음부터 아홉 명의 캐릭터를 만들 필요는 없다. Agent 하나, 운영자 한 명, 제한된 업무 하나, persistent home 하나와 검증된 중단·복구 절차에서 시작한다. 첫 Agent의 context와 tool이 실제 업무를 개선했다는 증거가 생긴 뒤에 profile이나 자동 loop를 늘린다.

다음 글에서는 흔히 “Hermes가 기억한다”는 말 안에 섞여 있는 session history, curated memory, identity file, skill과 외부 memory provider를 분리한다.
