---
title: TypeScript 5.0 이후의 Decorator 이해하기
date: 2023-04-19T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-04-19-decorators-for-class-in-typescript.html"
author: Yoonsoo Park
description: 표준 TypeScript decorator와 기존 experimental 모델의 차이, 그리고 안전한 이전 경계를 설명한다.
categories:
  - TypeScript
tags:
  - TypeScript
  - JavaScript
  - Design Patterns
---

현재 TypeScript에는 문법은 비슷하지만 호출 규약과 기능이 다른 두 decorator 모델이 있다. TypeScript 5.0부터 `experimentalDecorators` 없이 현재 ECMAScript 제안에 맞춘 decorator를 사용할 수 있다. 기존 experimental 모델도 이를 전제로 만든 프레임워크를 위해 남아 있다.

이 글은 2026년 8월 1일 [TypeScript 5.0 릴리스 노트](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators)와 [기존 decorator 문서](https://www.typescriptlang.org/docs/handbook/decorators)를 기준으로 확인했다.

## 표준 메서드 decorator

```typescript
function loggedMethod<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
) {
  return function (this: This, ...args: Args): Return {
    console.log(`calling ${String(context.name)}`);
    return target.call(this, ...args);
  };
}

class Greeter {
  @loggedMethod
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

표준 decorator는 대상 값과 context 객체를 받는다. 초기화 순서, 바인딩, 공개 동작을 과도하게 바꾸면 클래스를 이해하기 어려워지므로 작은 책임에 한정하는 편이 좋다.

표준 decorator는 종류에 맞는 대체 값을 반환할 수 있고 초기화가 필요하면 `context.addInitializer`를 사용할 수 있다. 예제의 type parameter는 `any`로 지우지 않고 원래 메서드의 `this`, 인자, 반환 타입을 보존한다. wrapper를 추가해도 클래스의 공개 계약을 약하게 만들지 않는 것이 중요하다.

Decorator는 class 정의 과정에서 실행되고 여러 개를 쌓으면 순서가 결과에 영향을 준다. 정의 시점에 network, filesystem 같은 예측하기 어려운 작업을 실행하지 않는다. 동기 메서드를 조용히 비동기로 바꾸거나 error contract를 바꾸는 decorator도 피한다. 동작을 짧게 설명하고 독립적으로 시험하기 어렵다면 일반 함수나 명시적 composition이 더 명확하다.

## 표준 모델과 기존 모델

새 코드의 기본 선택은 표준 decorator다. 기존 decorator는 `experimentalDecorators`와 `(target, propertyKey, descriptor)` 형태의 호출 규약을 사용하며 표준 모델과 타입 호환되지 않는다. 표준 제안은 parameter decorator와 `emitDecoratorMetadata`도 기존 방식과 동일하게 지원하지 않는다.

Angular, NestJS, TypeORM처럼 기존 metadata에 의존할 수 있는 프레임워크에서는 이 차이가 중요하다. 설정을 일괄 삭제하지 말고 프레임워크가 지원하는 구성을 따른다.

## 기존 글을 보관한 이유

이전 글은 legacy class decorator 호출 규약을 TypeScript의 유일한 모델처럼 설명했다. 의도적으로 구성된 기존 프로젝트에서는 여전히 맞을 수 있지만 새 독자에게 잘못된 기본값을 전달하고 가장 중요한 호환성 경계를 빠뜨린다. `tsconfig.json`에 따라 의미가 달라지는 예제를 부분 수정하는 대신 원문은 보관하고 현재 모델에서 다시 설명한다.

## 대안과 trade-off

반복되는 횡단 관심사를 선언적으로 표현하는 이점이 분명하고 팀이 lifecycle을 이해할 때 decorator를 사용한다. 프레임워크 등록, validation metadata, 작은 method wrapper가 대표적인 사례다.

변환에 class 문법이 필요 없다면 higher-order function이 단순하다. Service 연결에는 constructor injection이나 명시적 composition을, 객체 생성이 핵심이면 factory를 우선 검토한다. 호출과 제어 흐름이 눈에 보이므로 debugging과 testing이 쉽다.

지원 중인 프레임워크가 요구한다면 legacy decorator가 올바른 선택일 수 있다. 대신 compiler option과 metadata 동작이 프레임워크에 결합된다. 표준 decorator는 현재 언어 방향과 맞지만 legacy parameter decorator나 reflection 기반 dependency injection을 기계적으로 대체할 수 없다.

## 안전한 도입 예제

전체 코드베이스에 적용하기 전에 하나의 decorator를 동작 테스트 뒤에 추가한다.

```typescript
import { strict as assert } from "node:assert";

const greeter = new Greeter();
assert.equal(greeter.greet("Ada"), "Hello, Ada");
```

애플리케이션이 사용하는 JavaScript target에서 정상 결과와 exception을 모두 시험한다. initializer로 메서드를 bind한다면 분리한 callback과 subclass 동작도 확인한다. compile 성공만으로 모든 runtime 순서 문제를 찾을 수는 없다.

## 이전 절차

1. decorator와 metadata 소비자를 모두 찾는다.
2. 프레임워크와 라이브러리의 표준 decorator 지원 여부를 확인한다.
3. `tsconfig.json` 변경 전에 작은 컴파일 검증을 만든다.
4. 호출 규약을 바꾸고 초기화 및 메서드 동작 테스트를 추가한다.
5. 모든 소비자가 이전된 뒤에만 기존 플래그를 제거한다.

라이브러리는 decorator 모델과 필요한 TypeScript 범위를 공개 호환성 계약에 포함한다. 애플리케이션은 TypeScript 버전을 고정하고 compiler 업그레이드 전에 release note를 검토한다. 관계없는 예제에서 사용했다는 이유로 `emitDecoratorMetadata`를 켜지 않는다. runtime type metadata는 결합도를 높이며 legacy 생태계의 일부다.

프로젝트가 고정한 컴파일러와 테스트로 확인한다.

```bash
npx tsc --noEmit
npm test
```

같은 review에서 `tsconfig.json`도 확인한다. 다른 디렉터리나 다른 compiler 버전으로 실행한 명령이 통과해도 실제 build가 어떤 decorator 모델을 사용했는지는 증명하지 못한다.
