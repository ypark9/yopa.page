---
title: "하드코딩한 ID 없이 Salesforce Record Type 사용하기"
date: 2026-08-01
author: Yoonsoo Park
description: "Record Type 선택, Person Account 구분, 이식 가능한 RecordTypeId 해석과 데이터 적재를 정리한다."
categories:
  - Salesforce
tags:
  - Salesforce
  - Record Types
  - Data Migration
---

2026-08-01 Salesforce 공식 문서를 기준으로 확인했다.

## 이전 예제를 보관한 이유

Record Type ID는 org마다 다르므로 `012...` 값을 코드에 넣으면 이식할 수 없다. 또한 일반 Account에 “Individual Account” Record Type을 붙인다고 사람이 되는 것은 아니다. **Person Accounts**는 Account와 Contact 동작을 결합한 별도 기능과 데이터 모델이며, 단순한 label 선택이 아니라 조직 차원의 결정이다.

## Record Type이 필요한지 먼저 판단한다

한 object가 실제로 다른 business process, picklist 집합, page layout 경험을 지원할 때 사용한다. 조건부 필드, 보안 경계, 보고용 분류 때문에 추가하지 않는다. 화면은 Dynamic Forms, 접근은 Permission Set, 분류는 picklist만으로 충분할 수 있다.

Account에서는 조직만 관리하는지 Person Account가 필요한지 먼저 정한다. Person Account를 활성화하기 전에 edition, 연동, sharing, duplicate 관리, report 영향을 확인한다. 의도적인 custom model이 아니라면 custom “Individual Account” 타입으로 Person Account를 흉내 내지 않는다.

## 각 org에서 ID를 해석한다

```apex
Schema.RecordTypeInfo info = Account.SObjectType
    .getDescribe()
    .getRecordTypeInfosByDeveloperName()
    .get('Business_Account');
if (info == null || !info.isAvailable()) {
    throw new IllegalArgumentException('Business_Account is unavailable');
}
Id businessRecordTypeId = info.getRecordTypeId();
```

현재 사용자의 profile과 permission이 가용성에 영향을 주므로 `isAvailable()`을 확인한다. 연동 전처리에서는 목표 org의 `SObjectType`과 `DeveloperName`으로 조회하고 해당 실행 동안만 cache한다.

```bash
sf data query --target-org staging --use-tooling-api --query \
  "SELECT Id, DeveloperName, Name, IsActive FROM RecordType
   WHERE SObjectType = 'Account' AND DeveloperName = 'Business_Account'"
```

## 안전한 import와 upsert

원본에는 `RecordTypeDeveloperName`을 보존하고 목표 org에서 ID로 변환해 임시 CSV를 만든다. 매핑되지 않은 값이 하나라도 있으면 적재 전에 실패시킨다.

```text
External_Id__c,Name,RecordTypeDeveloperName
ORG-100,Acme Corp,Business_Account
```

```bash
sf data upsert bulk --target-org staging --sobject Account \
  --file accounts-resolved.csv --external-id External_Id__c --wait 10
```

환경 사이에 RecordTypeId나 record ID를 복사하지 않는다. 고객 데이터 파일을 보호하고 성공, 실패, 미처리 결과를 모두 대조한다.

## Trade-off와 마이그레이션

Record Type은 지원되는 프로세스 경계를 제공하지만 layout, assignment, test, migration mapping을 늘린다. 동작이 실제로 다르지 않다면 하나가 더 단순하다.

1. Object별 developer name, 목적, assignment, 사용 여부를 조사한다.
2. 실제 프로세스 차이와 UI·접근·보고 문제를 분리한다.
3. Person Account 포함 여부를 명시적으로 결정한다.
4. 하드코딩 ID를 describe 또는 target-org lookup으로 교체한다.
5. Profile 또는 Permission Set으로 할당하고 최소 권한 persona를 시험한다.
6. 합성 CSV를 변환해 mapping 건수를 확인하고 sandbox에 upsert한다.
7. 각 타입의 생성, 수정, 자동화, 연동, duplicate rule, report를 테스트한다.
8. 릴리스 후 실패를 모니터링하고 rollback mapping을 보존한다.

## 공식 자료

- [Apex Schema describe](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_sobject_describe.htm)
- [Person Accounts](https://help.salesforce.com/s/articleView?id=sf.account_person.htm&type=5)
- [Salesforce CLI data commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html)
