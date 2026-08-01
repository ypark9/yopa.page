---
title: "sf CLI로 CSV 데이터를 Salesforce에 upsert하기"
date: 2026-08-01
author: Yoonsoo Park
description: "현재 Salesforce CLI와 Bulk API 2.0으로 레코드를 안전하게 적재한다."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Bulk API 2.0
  - Data Migration
---

2026-08-01 기준으로 확인했다. 레코드는 배포하는 것이 아니라 적재하는 것이며, 이전 글의 mapping 파일 플래그는 현재 bulk upsert 흐름에 맞지 않는다.

```bash
sf data upsert bulk --sobject Widget__c --file widgets.csv \
  --external-id External_Id__c --target-org staging --wait 10
```

UTF-8 CSV와 안정적인 external ID를 준비하고 작은 파일로 먼저 시험한다. 실패·미처리 결과를 보관하되 민감한 행은 로그에 남기지 않는다. 대량 비동기 작업에는 Bulk가 맞고, 몇 건뿐이면 `sf data upsert record`나 API 클라이언트가 오류를 건별로 다루기 쉽다.

마이그레이션에서는 `mapping.json`을 제거하고 CSV 헤더를 API 필드명과 맞춘다. Sandbox에서 건수와 실패 행을 대조한 다음 같은 파일과 명령을 목표 org에 적용한다.

참고: [CLI data commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html), [Bulk API 2.0](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm).

## 현재의 멘탈 모델

Metadata 배포는 schema와 설정을 바꾼다. 데이터 적재는 레코드를 만들거나 바꾸며 validation rule, Flow, Apex, duplicate rule, sharing, 외부 연동을 실행할 수 있다. Upsert는 external ID로 insert와 update를 고르므로 키의 안정성과 유일성이 재실행 안전성을 결정한다.

## 안전한 준비와 실행

불필요한 민감 컬럼을 뺀 대표 sample로 시작한다. 필드 API 이름, 타입, picklist, locale 영향을 받는 날짜, UTF-8 인코딩, external-ID 필드를 확인한다. 먼저 몇 개 키를 조회해 충돌 동작을 파악한다.

```bash
sf data query --target-org staging \
  --query "SELECT Id, External_Id__c FROM Widget__c LIMIT 5" --json
sf data upsert bulk --sobject Widget__c --file widgets-sample.csv \
  --external-id External_Id__c --target-org staging --wait 10
```

성공, 실패, 미처리 건수를 입력과 대조한다. 실패 파일을 읽지 않고 전체를 다시 실행하지 않는다. Lookup이 있으면 parent를 먼저 적재하거나 안정적인 external ID로 해석하며 환경 사이에 Salesforce record ID를 복사하지 않는다.

## 대안과 trade-off

Bulk API 2.0은 대량 파일의 client orchestration을 줄이지만 비동기이고 부분 성공이 가능하다. 소량 운영 변경은 record 명령이 분명하다. 전용 연동은 변환, 재시도, 관측성을 제공하지만 운영 책임이 커진다. Data Loader는 감독된 admin 작업에 유용하나 설정도 코드처럼 검토한다.

## 마이그레이션과 검증

폐기된 mapping 플래그를 없애고 작업 이름을 deploy가 아닌 load/upsert로 고친다. 고객 데이터 대신 schema만 보여주는 sample을 버전 관리한다. Sandbox에서 자동화 부작용, 실패 행 재시도, backup, rollback을 시험한다. 적재 후 건수와 external ID별 sample 필드를 비교하고 자동화 실패를 확인하며 sample을 재실행해 멱등성을 증명한다.
