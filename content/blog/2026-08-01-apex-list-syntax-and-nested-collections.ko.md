---
title: "Apex List 문법과 중첩 컬렉션"
date: 2023-04-10T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-04-10-what-is-the-difference-between-string-and-liststring-in-apex.html"
author: Yoonsoo Park
description: "Apex List의 문법, 초기화, 중첩 컬렉션을 컴파일 가능한 예제로 정리한다."
categories:
  - Salesforce
tags:
  - Apex
  - Collections
  - Apex Testing
---

2026-08-01 Salesforce 공식 문서를 기준으로 확인했다.

Apex에서 `String[]`와 `List<String>`는 모두 리스트를 표현하는 문법이다. 서로 다른 저장 구조가 아니므로, 특별한 이유가 없다면 의미가 분명한 `List<String>`를 쓰는 편이 낫다.

```apex
List<String> names = new List<String>{'Ada', 'Grace'};
String[] aliases = new String[]{'a', 'g'};
List<List<String>> groups = new List<List<String>>{names, aliases};
```

이전 글은 컴파일되지 않는 예제와 잘못된 메모리 설명 때문에 보관했다. 기존 코드는 모호한 선언을 `List<T>`로 바꾸고, 메서드 이름 충돌을 없앤 뒤 인덱스와 빈 입력을 다루는 Apex 테스트를 실행하면 된다. 배열 모양 문법은 기존 코드와 통일할 때 쓸 수 있지만, 중첩 타입은 `List<T>`가 더 읽기 쉽다.

참고: [Apex Developer Guide: Lists](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_collections_lists.htm).

## 이전 설명이 실패한 이유

Apex는 배열 모양 문법을 `List<T>`의 다른 표기로 제공한다. Java 배열의 메모리 모델을 가져와 설명하면 잘못된 결론에 도달한다. 중복된 메서드 시그니처와 정의되지 않은 변수도 실제 개념보다 컴파일 오류만 남긴다.

## 실무에서 쓸 멘탈 모델

List는 순서가 있고 0부터 인덱싱하며 `add`로 늘리고 `set`으로 값을 바꾸는 컬렉션이다. 중첩 타입은 generic 표기가 더 분명하다. 중복 제거가 목적이면 Set, 키 조회가 목적이면 Map이 맞다.

## 안전한 예제

```apex
public class NameGroups {
 public static List<List<String>> group(List<String> input, Integer size) {
  if (input == null || size == null || size <= 0) {
   throw new IllegalArgumentException('A positive group size is required');
  }
  List<List<String>> result = new List<List<String>>();
  for (Integer i = 0; i < input.size(); i += size) {
   List<String> chunk = new List<String>();
   for (Integer j = i; j < Math.min(i + size, input.size()); j++) chunk.add(input[j]);
   result.add(chunk);
  }
  return result;
 }
}
```

빈 값, null, 정확히 나누어지는 크기, 나머지가 생기는 입력을 테스트한다. List 변수를 다른 변수에 대입하면 같은 가변 객체를 공유하므로 얕은 복사가 필요하면 새 List를 만든다.

## 마이그레이션과 검증

1. 두 컬렉션 타입이라는 설명을 하나의 List 모델로 바꾼다.
2. 공개 API 표기는 `List<T>`로 통일한다.
3. 메서드 시그니처를 고유하게 만들고 scratch org에서 컴파일한다.
4. 중첩은 `List<List<T>>`를 쓰고 변경과 범위 오류를 테스트한다.
5. 배포 전에 Apex 테스트와 정적 분석을 실행한다.

레거시 코드에서는 배열 표기가 변경량을 줄일 수 있지만, 일관성과 중첩 타입의 가독성이 보통 더 중요하다.
