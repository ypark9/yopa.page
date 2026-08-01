---
title: "Apex 중첩 enum과 이름 가림"
date: 2023-05-03T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-03-why-apex-test-cannot-find-enum-defined-in-apex-class.html"
author: Yoonsoo Park
description: "타입과 변수 이름을 혼동하지 않고 중첩 Apex enum을 참조한다."
categories:
  - Salesforce
tags:
  - Apex
  - Apex Testing
  - Software Design
---

2026-08-01 기준으로 확인했다. 이전 글은 같은 표현을 실패와 해결 예제로 동시에 제시해 원인을 증명하지 못했다.

```apex
public class OrderRules { public enum Stage { Draft, Approved } }
@IsTest private class OrderRulesTest {
 @IsTest static void resolvesNestedEnum() {
  OrderRules.Stage stage = OrderRules.Stage.Approved;
  System.assertEquals(OrderRules.Stage.Approved, stage);
 }
}
```

클래스는 타입처럼, 변수는 lower camel case로 이름 짓고 대소문자만 다른 식별자는 피한다. 실패하는 테스트는 최소 예제로 줄여 변수명을 바꾸고, 대상 클래스 배포 순서와 namespace/package 가시성을 확인한다.

참고: [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_language_reference.htm).

## 현재의 멘탈 모델

중첩 enum은 바깥 클래스가 소유한 타입이므로 안정적인 참조는 `Outer.EnumName.Value`다. Apex 식별자는 대소문자를 구분하지 않는다. 클래스명과 대소문자만 다른 로컬 변수는 컴파일 원인을 설명하기에도, 사람이 읽기에도 좋지 않다.

## 실제 실패를 진단하는 순서

먼저 제품 클래스를 컴파일하고 무관한 설정을 뺀 최소 테스트를 만든다. 정확한 오류 줄, API version, access modifier, namespace, package dependency를 확인한다. 다른 namespace의 테스트라면 가시성, 의존 클래스보다 먼저 컴파일됐다면 배포 순서가 원인일 수 있다. 변수명 변경은 좋은 정리지만 재현 없이 만능 해결책으로 단정하지 않는다.

```apex
public class OrderRules {
 public enum Stage { Draft, Approved }
 public static Boolean canShip(Stage value) { return value == Stage.Approved; }
}
@IsTest private class OrderRulesTest {
 @IsTest static void approvedCanShip() {
  OrderRules.Stage currentStage = OrderRules.Stage.Approved;
  System.assert(OrderRules.canShip(currentStage));
 }
}
```

## 대안과 trade-off

중첩 enum은 작은 도메인 어휘를 소유자 가까이에 둔다. Top-level enum은 여러 클래스가 공유하기 쉽지만 공개 표면이 넓어진다. 문자열 상수는 연동이 쉬운 대신 타입 검사와 유효 값 제한을 잃는다.

## 마이그레이션과 검증

모호한 변수를 바꾸고 중첩 타입을 완전한 이름으로 참조하며 문자열 비교를 제거한다. 의미 있는 enum 분기마다 테스트를 추가한다. 일회성 org에 클래스와 테스트를 함께 배포하고 `sf apex run test --tests OrderRulesTest --target-org scratch --wait 10`을 실행한다. Package 소비자에게 필요한 가시성만 노출됐는지도 확인한다.
