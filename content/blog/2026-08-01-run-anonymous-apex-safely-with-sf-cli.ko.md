---
title: "sf CLI로 Anonymous Apex 안전하게 실행하기"
date: 2023-05-07T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-07-running-apex-cls-file-on-cli.html"
author: Yoonsoo Park
description: "검토한 .apex 스크립트를 셸 문자열 보간 없이 실행한다."
categories:
  - Salesforce
  - Security
tags:
  - Apex
  - Salesforce CLI
  - Security
---

2026-08-01 기준으로 확인했다. `.cls`는 클래스 정의 파일이지 anonymous script가 아니다. 이전 TypeScript 래퍼는 경로를 셸 문자열에 넣어 명령 주입 위험도 있었다.

```bash
sf apex run --file scripts/apex/seed-data.apex --target-org scratch --json
```

Node 래퍼가 필요하면 `spawn` 또는 `execFile`에 인자 배열을 넘기고, 허용된 디렉터리 아래 `.apex`만 실행하며 JSON과 종료 코드를 검사한다. 디렉터리의 모든 파일을 자동 실행하지 않는다. 제품 코드라면 Apex 테스트와 배포 가능한 클래스를 쓰고, anonymous Apex는 통제된 관리 작업과 설정 스크립트에 한정한다.

마이그레이션 때는 실제 스크립트만 `.apex`로 옮기고 클래스는 `force-app`에 둔다. DML과 callout을 리뷰한 뒤 일회성 org에서 검증한다.

참고: [Apex commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex.html).

## 현재의 멘탈 모델

Anonymous Apex는 한 org 문맥에서 평가되는 관리 스크립트다. `.cls`는 metadata와 생명주기를 가진 배포 소스다. 모든 class 파일을 스크립트처럼 실행하면 경계를 흐리고 잘못된 org에 DML을 실행할 수 있다.

## 통제된 실행 흐름

스크립트는 `scripts/apex` 아래에 두고 migration처럼 리뷰하며 target을 명시한다.

```bash
sf org display --target-org scratch
sf apex run --file scripts/apex/seed-data.apex \
  --target-org scratch --json >apex-result.json
jq '{status, success: .result.success, logs: .result.logs}' apex-result.json
```

스크립트는 가능하면 멱등하게 만든다. 안정적인 키로 조회하고 없는 레코드만 만들며 예상하지 못한 중복은 실패시킨다. 고객 데이터, 자격 증명, 전체 HTTP 응답을 출력하지 않는다. Callout은 Named Credential을 쓰고 최초 실행은 일회성 org에서 한다.

프로그램 래퍼는 허용 디렉터리 아래의 실제 경로인지 확인하고 정책 밖 확장자와 symlink를 거부한다. 인자 배열로 실행하며 동시성을 제한하고, 독립성이 증명되지 않았다면 첫 실패에서 중단한다.

## 대안과 trade-off

Anonymous Apex는 검토된 일회성 작업에 빠르지만 배포 이력이 약하다. 재사용 로직은 테스트가 있는 Apex class가 낫다. Seed data는 data plan이나 `sf data` 명령이 더 분명하고, 설정은 Metadata API 영역이다.

## 마이그레이션과 검증

기존 `.cls`를 분류해 클래스는 배포하고 실제 statement script만 `.apex`로 옮긴다. DML, governor limit, sharing mode, callout, rollback을 리뷰한다. 두 번 실행해 멱등성을 확인하고 JSON 성공 값과 예상 레코드를 검사한다. 출력에 secret이 없는지도 확인한다.
