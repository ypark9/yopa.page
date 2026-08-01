---
title: TypeScript Decorators After TypeScript 5.0
date: 2026-08-01
author: Yoonsoo Park
description: Understand standard TypeScript decorators, the legacy experimental model, and the migration boundary between them.
categories:
  - TypeScript
tags:
  - TypeScript
  - JavaScript
  - Design Patterns
---

TypeScript now has two decorator models that look similar but have different call signatures and capabilities. TypeScript 5.0 introduced support for the current ECMAScript decorator proposal without requiring `experimentalDecorators`. The older experimental model remains available for frameworks that depend on it.

This article was verified on 2026-08-01 against the [TypeScript 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators) and the [legacy decorators reference](https://www.typescriptlang.org/docs/handbook/decorators).

## A standard method decorator

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

The decorator receives the decorated value and a context object. Keep decorators small and explicit: changing initialization order, binding, or public behavior can make a class difficult to reason about.

Standard decorators can return a replacement value of the appropriate kind. They can also use `context.addInitializer` when initialization work is necessary. The type parameters in the example preserve the original method's `this`, argument, and return types instead of erasing them with `any`. That makes the wrapper useful without weakening the class's public contract.

Decorators execute while a class is being defined, and their order matters when several are stacked. Avoid network calls, filesystem access, or other unpredictable work at definition time. A decorator should not quietly turn a synchronous method into an asynchronous one or change its error contract. If the behavior cannot be described and tested locally, an ordinary function or explicit composition is often the clearer design.

## Standard versus legacy

Standard decorators are the default choice for new code. Legacy decorators use `experimentalDecorators` and signatures such as `(target, propertyKey, descriptor)`. They are not type-compatible with the standard model. The standard proposal also does not support parameter decorators or `emitDecoratorMetadata` in the same way.

That boundary matters for Angular, NestJS, TypeORM, and other libraries that may depend on legacy metadata. Follow the framework's supported configuration instead of mechanically removing `experimentalDecorators`.

## Why the old tutorial is archived

The earlier article used the legacy class-decorator signature as though it were the only TypeScript model. That code can still be correct inside a deliberately configured legacy project, but it gives new readers the wrong default and omits the most important compatibility boundary. A partial edit would leave examples whose meaning changes with `tsconfig.json`, so the original is preserved as an archive and this guide starts from the current mental model.

## Alternatives and tradeoffs

Use a decorator when declarative syntax materially improves a repeated, cross-cutting operation and the team understands its lifecycle. Common examples include framework registration, validation metadata, or a small method wrapper.

Prefer an ordinary higher-order function when the transformation does not need class syntax. Prefer constructor injection or explicit composition when wiring services. Prefer a factory when object creation is the real concern. These alternatives are easier to call, debug, and test because control flow remains visible.

Legacy decorators may remain the right choice when a supported framework requires them. The tradeoff is coupling compiler options and metadata behavior to that framework. Standard decorators align with the current language direction but cannot be substituted mechanically for legacy parameter decorators or reflection-based dependency injection.

## Safe adoption example

Add one decorator behind behavior tests before applying it across a codebase:

```typescript
import { strict as assert } from "node:assert";

const greeter = new Greeter();
assert.equal(greeter.greet("Ada"), "Hello, Ada");
```

Check the generated JavaScript target used by the application and test both normal results and thrown errors. If a decorator binds methods through an initializer, also test detached callbacks and subclass behavior. A compile-only check will not detect every runtime-order problem.

## Migration checklist

1. Inventory decorators and metadata consumers.
2. Check framework and library documentation for standard-decorator support.
3. Create a small compilation test before changing `tsconfig.json`.
4. Rewrite signatures and add behavior tests for initialization and method calls.
5. Remove legacy flags only after all consumers have migrated.

For a library, publish the decorator model and required TypeScript range as part of the public compatibility contract. For an application, pin TypeScript and review compiler release notes before upgrades. Do not enable `emitDecoratorMetadata` merely because an unrelated example does; emitted runtime type information increases coupling and is part of the legacy ecosystem.

Verify with the project's pinned compiler:

```bash
npx tsc --noEmit
npm test
```

Inspect `tsconfig.json` in the same review. A passing command from a different directory or compiler version does not prove which decorator model the real build used.
