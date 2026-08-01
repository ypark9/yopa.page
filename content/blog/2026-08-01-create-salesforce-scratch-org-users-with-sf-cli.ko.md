---
title: "sf CLI로 Salesforce scratch org 사용자 만들기"
date: 2026-08-01
author: Yoonsoo Park
description: "지원되는 CLI 명령과 명시적인 권한 설정으로 scratch org 사용자를 만든다."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - Scratch Orgs
  - Security
---

2026-08-01 기준으로 확인했다. 셸 치환으로 조립한 범용 `User` DML은 위험하고, 필수 필드·프로필·라이선스도 org마다 다르다.

```bash
sf org create user --target-org scratch \
  --set-alias qa-user email=qa@example.invalid lastname=Tester
sf org assign permset --name App_Tester --target-org qa-user
```

사용자 정의에는 실제 개인정보를 넣지 않고 검토한 permission set으로 권한을 준다. 이 방식은 폐기 가능한 개발 org에 적합하다. 프로덕션 사용자는 라이선스, MFA, 비활성화, 감사까지 포함하는 ID 프로비저닝 또는 검토된 API 흐름으로 관리해야 한다.

기존 `jq` 셸 치환을 제거하고 새 scratch org에서 생성한 뒤 `sf org list users`와 실제 권한을 확인한다.

참고: [Salesforce CLI org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html).

## 현재의 멘탈 모델

Scratch org 사용자는 해당 org의 license와 profile에서 파생되는 폐기 가능한 테스트 identity다. 프로덕션 identity 생명주기를 우회하는 방법이 아니다. 전용 CLI 명령은 scratch user 기본값을 이해하고 JSON을 따옴표 없는 셸 인자로 바꾸는 위험을 피한다.

## 안전한 단계별 예제

대상 org와 기존 사용자를 확인하고 최소 범위 identity를 만든 뒤 permission set은 별도로 부여한다.

```bash
sf org display --target-org scratch
sf org list users --target-org scratch
sf org create user --target-org scratch --set-alias qa-user \
  email=qa@example.invalid lastname=Tester
sf org assign permset --name App_Tester --target-org qa-user
sf org display user --target-org qa-user
```

메일 수신이 테스트 대상이 아니라면 예약된 invalid domain을 사용한다. 실제 직원 정보나 password는 definition에 커밋하지 않는다. Permission set은 의도를 리뷰하기 쉽고 과도한 profile 복제를 피한다. 필요한 license나 profile이 없으면 관리자 identity를 빌리지 말고 scratch definition 또는 테스트 설계를 바꾼다.

## 대안과 trade-off

Inline 속성은 한 명을 만들 때 빠르다. 버전 관리한 user definition은 팀 재현성이 높지만 비밀이 아닌 합성 데이터만 담아야 한다. Apex나 REST는 맞춤 로직을 제공하지만 org별 필수 필드와 license 규칙을 직접 다뤄야 한다. 프로덕션과 장기 sandbox 사용자는 승인, MFA, 비활성화, 감사가 있는 identity provisioning으로 관리한다.

## 마이그레이션과 검증

1. `$(jq ...)` 같은 셸 확장을 없앤다.
2. Identity 생성과 permission 부여를 분리한다.
3. 개인 sample을 합성 값으로 바꾼다.
4. 새 scratch org에서 다시 만들어 재현성을 시험한다.
5. 해당 사용자로 로그인해 허용 및 거부 동작을 확인한다.
6. 끝나면 테스트 사용자를 이어 쓰지 말고 scratch org를 삭제한다.

목록에 보이는 것은 생성 검증이고, 그 identity로 수행한 테스트가 실제 권한 경계 검증이다.
