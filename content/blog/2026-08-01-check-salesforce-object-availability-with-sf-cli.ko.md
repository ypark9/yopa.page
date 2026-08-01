---
title: "sf CLI로 Salesforce 객체 사용 가능 여부 확인하기"
date: 2023-04-25T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-04-25-checking-if-an-sobject-exists-in-a-salesforce-scratch-org.html"
author: Yoonsoo Park
description: "JSON 결과와 종료 코드를 이용해 Salesforce 객체 사용 가능 여부를 확인한다."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Scratch Orgs
  - Metadata API
---

2026-08-01 기준으로 확인했다. 예전 schema list 플래그는 객체 존재 여부를 안정적으로 판별하지 못한다.

```bash
if sf sobject describe --sobject MyObject__c --target-org test --json >describe.json; then
  echo "object is available"
else
  echo "object is absent or inaccessible" >&2
fi
```

describe 실패는 객체가 없다는 뜻뿐 아니라 현재 사용자에게 접근 권한이 없다는 뜻일 수도 있다. 라이선스, 설치 패키지, 권한까지 객체 가시성에 영향을 준다. 자동화에서는 JSON의 상태와 오류 코드를 확인하고 인증 정보는 출력하지 않는다. Apex 런타임에서는 CLI 대신 Schema describe와 CRUD/FLS 검사를 사용한다.

기존 `sfdx force:schema:*` 호출을 `sf sobject describe`로 바꾼 뒤, 실제 객체와 일부러 존재하지 않는 객체를 대상으로 종료 코드를 검증한다.

참고: [Salesforce CLI command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html).

## 현재의 멘탈 모델

“존재한다”는 말에는 metadata가 org에 있음, 인증한 주체가 볼 수 있음, 원하는 작업에 사용할 수 있음이라는 세 의미가 섞인다. Describe 요청은 앞의 두 조건을 함께 반영하므로 권한이나 라이선스 차이가 부재처럼 보일 수 있다.

## 단계별 검증

먼저 대상 identity를 확인하고 정확한 API 이름을 describe한 뒤 비민감 필드만 남긴다.

```bash
sf org display --target-org test
sf sobject describe --sobject MyObject__c --target-org test --json >describe.json
jq '{status, name: .result.name, queryable: .result.queryable,
     createable: .result.createable, updateable: .result.updateable}' describe.json
```

Object API 이름 자리에는 label이나 `DeveloperName`을 넣지 않는다. 표준, custom, namespace, external object의 suffix가 서로 다르다. 실패하면 구조화된 오류를 보존하고 package와 license를 확인한다. 관리자와 비교할 때도 부재와 권한 문제를 구분하기 위한 범위로 한정하고 무작정 넓은 권한을 주지 않는다.

## 대안과 trade-off

- CLI describe는 스크립트와 로컬 진단에 알맞다.
- Apex `Schema.getGlobalDescribe()`는 런타임 판단에 쓸 수 있지만 describe 자원을 사용하며 보안 검사를 대신하지 않는다.
- Metadata 목록은 전체 인벤토리에 유용하지만 정확한 한 객체 검사보다 무겁다.

## 마이그레이션 체크리스트

레거시 schema 명령을 바꾸고 `--target-org`를 필수로 한다. 사람이 읽는 문자열 대신 JSON을 파싱하고, 0이 아닌 종료 코드는 즉시 “없음”이 아니라 분류가 필요한 상태로 다룬다. 존재하는 객체, 잘못된 API 이름, 접근 권한이 없는 사용자 세 경우를 시험한다. CI에서는 CLI 버전을 고정하고 org 정보가 든 진단 파일을 작업 후 삭제한다.
