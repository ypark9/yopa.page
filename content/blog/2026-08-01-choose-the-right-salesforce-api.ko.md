---
title: "Salesforce API를 고르는 기준"
date: 2024-05-05
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-05-05-understanding-salesforce-apis-metadata-tooling-and-bulk.html"
author: Yoonsoo Park
description: "리소스, 생명주기, 데이터량, 지연시간을 기준으로 Salesforce API를 선택한다."
categories:
  - Salesforce
tags:
  - Salesforce APIs
  - Metadata API
  - Tooling API
  - Bulk API 2.0
---

2026-08-01 기준으로 확인했다.

## 이전 글이 바뀐 이유

Metadata, Tooling, Bulk는 같은 API의 크기별 선택지가 아니다. 각각 설정, 개발 도구, 대량 데이터를 다룬다. 현재 선택표에는 REST, SOAP, Composite, GraphQL, UI API도 포함해야 한다.

## 선택표

| 요구 | 우선 검토 | 이유 |
|---|---|---|
| 비즈니스 레코드 CRUD/query | REST | 동기 resource 모델 |
| 의존 관계가 있는 여러 REST 작업 | Composite | 왕복 감소와 선택적 transaction 묶음 |
| 대량 비동기 적재·추출 | Bulk API 2.0 | Job 기반 처리와 부분 결과 |
| 설정 배포·조회 | Metadata API | Metadata 생명주기와 manifest |
| 테스트·trace·coverage | Tooling API | 개발 도구 object |
| Graph 형태 조회 | GraphQL | Client가 관련 필드를 선택 |
| Salesforce UI 문맥 데이터 | UI API | Layout, metadata, data, 사용자 문맥 |
| 기존 WSDL 계약 | SOAP | 강한 계약과 기존 enterprise 연동 |

먼저 record, metadata, tooling, UI 중 리소스를 고른다. 다음으로 volume, latency, transaction 경계, 지원 object, API version, limit을 본다.

## 안전한 예제

```bash
sf data query --target-org integration-test \
  --query "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 10" --json

sf data upsert bulk --target-org integration-test \
  --sobject Account --file accounts.csv --external-id External_Id__c --wait 10
```

CLI가 저장된 인증을 사용하게 하고 token을 출력하지 않는다. OAuth scope는 최소화하고, 새 Salesforce OAuth 연동에는 해당되는 경우 External Client App을 사용한다. TLS, secret rotation, timeout, 안정적인 external ID, 제한된 retry, payload 없는 구조화 로그를 적용한다.

## Trade-off

REST는 단순하지만 호출이 많아진다. Composite는 왕복을 줄이는 대신 실패 표면이 커진다. GraphQL은 over-fetching을 줄여도 모든 mutation과 metadata 작업을 대신하지 않는다. UI API는 Salesforce UI 의미를 보존하지만 그 모델에 결합된다. Bulk API 2.0은 확장성이 높지만 비동기이고 부분 성공이 가능하다. SOAP은 계약이 강한 대신 XML과 생성 client가 복잡하다.

## 마이그레이션과 검증

1. Endpoint를 리소스, 호출량, 지연, 실패 의미로 목록화한다.
2. Bulk를 reporting API, Tooling을 범용 refactoring API로 설명한 부분을 제거한다.
3. 부분 결과를 받아들일 수 있는 대량 record 작업만 Bulk API 2.0으로 옮긴다.
4. 설정은 Metadata API, 개발 관측은 문서화된 Tooling object에 둔다.
5. API version을 고정하고 다음 version을 사전 테스트한다.
6. Limit, timeout, retry, duplicate, permission, partial failure를 시험한다.
7. HTTP 성공뿐 아니라 record 수, metadata 구성요소, 최종 비즈니스 상태를 검증한다.

## 공식 자료

- [Salesforce Platform APIs](https://developer.salesforce.com/docs/apis)
- [REST API Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Bulk API 2.0](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm)
- [GraphQL API](https://developer.salesforce.com/docs/platform/graphql/guide)
- [UI API](https://developer.salesforce.com/docs/platform/lwc/guide/reference-ui-api.html)
