---
title: "증거 중심의 AI 보조 소프트웨어 개발"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "명시적 맥락, 작은 변경, 결정론적 검증, 보안 검토와 rollback으로 coding agent를 통제하는 개발 흐름."
categories:
  - Artificial Intelligence
  - Software Engineering
tags:
  - AI-Assisted Development
  - AI Evaluation
  - Security
  - Software Engineering
---

모델에게 “프로젝트 매니저, 아키텍트, 시니어 엔지니어 역할을 하라”고 말하면 답변 형식은 나아질 수 있지만 사실이 맞아지지는 않는다. 최신 coding agent는 저장소를 읽고 파일을 편집하며 명령과 외부 도구를 실행한다. 따라서 제어 단위는 persona가 아니라 **관찰 가능한 증거와 승인 경계를 가진 제한된 작업**이어야 한다.

## 현재의 멘탈 모델

agent를 정해진 workspace 안에서 일하는 유능하지만 검증이 필요한 협업자로 본다. 하나의 결과에 필요한 최소한의 context와 도구만 준다. 저장소 사실, 최신 외부 사실, 가정, 사용자 결정을 구분하게 한다. 자동화 가능한 부분은 결정론적 도구로 검증하고 의도, 아키텍처, 보안, 제품 판단은 사람이 리뷰한다.

실용적인 반복 흐름은 다음과 같다.

1. **파악:** 저장소 지침, 현재 구현, 테스트, 소유 경계와 dirty worktree를 읽는다.
2. **명세:** 목표, 제외 범위, acceptance test, 위험, 데이터 민감도, rollback을 적는다.
3. **계획:** 편집 전에 interface와 영향받는 행동을 찾는다.
4. **작은 변경:** 파일 소유가 명확한 작은 diff를 만들고 관련 없는 작업을 보존한다.
5. **검증:** format, type, unit/integration test, build, 보안 검사와 수동 시나리오를 실행한다.
6. **증거 리뷰:** diff와 실제 출력으로 검토하고 근거 없는 주장을 거부한다.
7. **점진적 release:** 위험에 맞춰 branch, preview, feature flag, canary, reversible migration을 쓴다.
8. **학습:** raw private conversation이 아니라 오래 쓸 프로젝트 gotcha만 남긴다.

## 역할 프롬프트보다 유용한 task brief

```text
목표: 처리 전에 10 MB 초과 upload를 거부한다.
포함: API validation, error response, tests, docs.
제외: storage migration, UI redesign.
제약: 기존 API shape 유지, filename/content 로그 금지.
승인 기준:
- 10 MB 성공, 10 MB + 1 byte는 413.
- 기존 auth 행동 유지.
- unit/integration suite 통과.
필요 증거: 변경 파일, test 명령과 결과, 남은 manual gate.
```

agent는 먼저 현재 limit가 어디서 강제되는지 확인해야 한다. framework, 환경, production 결과를 지어내면 안 된다. 최신 library나 cloud 기능이 중요하면 primary document를 확인하고 날짜를 기록한다.

## 보안과 privacy 경계

저장소 문장, issue, 웹 페이지와 tool output에는 prompt injection이 있을 수 있다. 이를 authority가 아니라 data로 취급한다. publish, delete, deploy, secret 접근처럼 영향이 큰 도구는 기본 거부하고 read-only discovery와 mutation을 분리한다.

승인된 서비스와 data policy가 허용하지 않으면 고객 데이터, credential, private source, meeting transcript를 모델에 보내지 않는다. fixture와 로그를 비식별화한다. 생성된 dependency, license, network call과 telemetry가 조직 정책에 맞는지 확인한다. local fixture만 실행하고 production이나 실제 device 검증을 했다고 주장해서는 안 된다.

## 평가와 테스트

build 성공만으로 충분하지 않다.

- syntax, type, format, policy, secret scan;
- contract와 regression을 위한 결정론적 테스트;
- 통제된 환경에서 실제 boundary integration test;
- authorization, injection, data exposure, failure handling 보안 테스트;
- UX와 모호한 요구를 위한 fresh-context human acceptance를 조합한다.

반복 작업에는 대표 요청, 기대 속성, 금지 행동, 비용·latency가 포함된 evaluation set을 둔다. 한 사례에 맞춰 prompt를 최적화하지 않는다. 버전을 비교하고 privacy가 허용하면 실패를 regression case로 남긴다.

agent는 탐색, 반복 편집, 테스트와 문서화를 빠르게 하지만 큰 autonomous change는 review 부담과 연쇄 오류를 늘린다. 병렬 agent는 파일 소유와 결과 계약이 분리될 때만 효과적이다. context가 많을수록 항상 좋은 것도 아니다. privacy 노출과 distraction을 줄이는 최소한의 context가 보통 낫다.

## 마이그레이션 체크리스트

- 재사용 persona prompt를 task brief와 acceptance evidence로 바꾼다.
- 저장소에 검증, secret, ownership, release 지침을 둔다.
- tool permission을 조사하고 비가역·외부 action에 승인을 요구한다.
- 큰 작업을 독립적으로 리뷰 가능한 변경으로 나눈다.
- 사용 확대 전에 결정론적 test와 작은 eval suite를 만든다.
- 변하기 쉬운 기술 주장에는 최신 primary citation을 기록한다.
- diff review, rollback note와 미검증 gate 목록을 요구한다.
- 생성한 코드 줄 수가 아니라 escaped defect와 review time을 측정한다.

공식 자료 확인일: **2026-08-01**.

## 공식 자료

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- [GitHub Copilot coding agent 책임 있는 사용](https://docs.github.com/en/copilot/responsible-use/copilot-coding-agent)
