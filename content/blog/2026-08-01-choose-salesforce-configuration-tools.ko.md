---
title: "Salesforce 설정 도구를 고르는 기준"
date: 2026-08-01
author: Yoonsoo Park
description: "Record Type, Dynamic Forms, Custom Metadata, Flow의 역할을 구분해 선택한다."
categories:
  - Salesforce
tags:
  - Salesforce Flow
  - Record Types
  - Custom Metadata
---

2026-08-01 기준으로 확인했다. “Record-based configuration”은 하나의 Salesforce 기능이 아니며 Workflow Rules는 레거시 자동화 경로다.

- Record Type은 실제로 다른 비즈니스 프로세스와 picklist 경험을 선택한다.
- Page Layout과 Dynamic Forms는 화면을 구성하지만 권한을 대신하지 않는다.
- Custom Metadata는 배포 가능한 애플리케이션 설정을 저장한다.
- Flow는 선언형 자동화의 기본 선택지이며, 코드 수준 제어와 규모가 필요하면 Apex를 쓴다.
- Permission Set은 접근 권한을 담당한다.

작은 차이마다 Record Type을 늘리지 말고 프로세스와 보안 경계부터 정한다. 선언형 도구도 소스 관리, 테스트, 담당자, 한도 관리가 필요하다.

기존 Workflow Rule과 과도한 Record Type을 목록화하고 회귀 테스트를 만든 뒤 공식 Flow 전환 도구로 옮긴다. 통제된 릴리스 후 실패한 Flow interview를 모니터링한다.

참고: [Migrate to Flow](https://help.salesforce.com/s/articleView?id=sf.flow_migrate_to_flow.htm&type=5).

## 기능보다 결정에서 시작한다

무엇이 달라지는지, 누가 바꾸는지, org 사이에 배포되는지, UI·접근·자동화 중 무엇에 영향을 주는지 먼저 적는다. Record Type은 한 객체가 실제로 다른 프로세스를 지원할 때만 적합하다. 모든 조건을 표현하는 범용 플래그로 쓰지 않는다.

## 단계별 예제

Project가 Internal과 Client delivery 프로세스를 가진다고 하자. Picklist나 단계가 실제로 다를 때만 Record Type을 쓴다. 조건부 필드 노출은 Dynamic Forms, 접근은 Permission Set, 배포 가능한 임계값은 Custom Metadata, 자동화는 record-triggered Flow가 맡는다.

1. Developer name과 소유자를 source control에 정의한다.
2. UI 숨김을 보안으로 오해하지 않도록 permission set을 먼저 만든다.
3. 환경 독립 정책은 org별 record ID가 아니라 custom metadata에 둔다.
4. Flow의 bulk, recursion, 실패 경로를 테스트한다.
5. Sandbox에 배포하고 pilot permission-set group에 할당해 실패 interview를 본다.

## 대안과 trade-off

하나의 Record Type과 Dynamic Forms는 관리 분기를 줄이지만 서로 다른 영업·지원 프로세스를 혼자 표현하지 못한다. Custom Setting은 런타임 설정에 쓸 수 있고 배포 가능한 설정에는 대체로 Custom Metadata가 낫다. Apex는 transaction 제어와 재사용성이 높지만 코드 운영이 필요하다. Flow는 접근성과 관측성이 좋지만 거대한 단일 Flow는 거대한 코드만큼 유지하기 어렵다.

## 마이그레이션과 검증

Record Type, Layout, Workflow Rule, Process Builder, Validation Rule, Permission, hard-coded ID를 함께 목록화한다. 각 동작에 소유자와 테스트를 연결한다. 공식 migration 도구 결과를 동등성의 증거로 여기지 않는다. 순서, recursion, scheduled path, 오류 처리가 일치한 뒤에만 기존 자동화를 끈다.

각 persona와 record type, create/update/bulk, 거부된 필드를 시험한다. Org별 ID 없이 metadata가 배포되는지 확인하고 릴리스 후 Flow 오류와 비즈니스 결과를 모니터링한다.
