---
title: Mocking Modules and Functions with Jest
date: 2023-04-15T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Mocking Modules and Functions"
categories:
  - Jest
tags:
  - Jest
  - TypeScript
  - JavaScript
  - Node.js
---

## Mocking Modules and Functions with Jest

In this tutorial, we'll explore how Jest can be used to Mock Modules and Functions. We'll discuss the different techniques involved and provide examples that demonstrate their usage.

## Using jest.fn to Mock Functions

```js
example/
├── app.js
├── app.test.js
└── math.js
```

The `jest.fn()` method is used to create a Mock Function that can be used to test the behavior of dependent code. Let's consider an example where we want to test a function that depends on another function:

```typescript
// math.ts
export const add = (a: number, b: number): number => a + b;
export const subtract = (a: number, b: number): number => a - b;
export const multiply = (a: number, b: number): number => a * b;
```

```typescript
// app.ts
import { add } from "./math";

export const multiply = (a: number, b: number): number => {
  const result = add(a, b) * 2;
  return result;
};
```

In the above code, the `multiply()` function depends on the `add()` function. To test the `multiply()` function, we can create a Mock Function for the `add() `function using `jest.fn()`:

```typescript
// app.test.ts
import { multiply } from "./app";
import { add } from "./math";

jest.mock("./math", () => ({ add: jest.fn() }));

test("multiply function calls add function", () => {
  const mockedAdd = jest.mocked(add);
  mockedAdd.mockReturnValue(5);
  multiply(2, 3);
  expect(mockedAdd).toHaveBeenCalledWith(2, 3);
});
```

The module factory replaces `add`, and `jest.mocked` gives the import its mock-aware TypeScript type. Assigning directly to an imported ESM namespace is invalid because module bindings are read-only.

This example assumes Jest's transformed/CommonJS mocking flow. Native ESM projects have different loading rules; follow Jest's current [ECMAScript Modules guide](https://jestjs.io/docs/ecmascript-modules) and use `jest.unstable_mockModule` where required.

## Using jest.mock to Mock Modules

The `jest.mock()` method is used to Mock entire modules, rather than just individual functions. This approach is useful when we want to Mock an entire module rather than just one or two functions.

Let's consider an example where we want to Mock an entire module that contains multiple functions:

```typescript
// app.test.ts
import * as math from "./math";

jest.mock("./math", () => ({
  add: jest.fn(),
  subtract: jest.fn(),
  multiply: jest.fn(),
}));

test("Mocking entire math module", () => {
  math.add.mockReturnValue(3);
  math.subtract.mockReturnValue(1);
  math.multiply.mockReturnValue(10);

  expect(math.add(1, 2)).toBe(3);
  expect(math.subtract(5, 4)).toBe(1);
  expect(math.multiply(2, 5)).toBe(10);
});
```

Here's a step-by-step breakdown of what's happening in this code:

The first line imports all the functions exported by the math.js module using the import \* as math from './math'; syntax.

The next line jest.mock Mocks the entire math.js module. The second argument of jest.mock is a function that returns an object containing Mock Functions for all the functions exported by the module. In this case, add, subtract, and multiply are all Mock Functions created using jest.fn().

Next, the code sets the return values for the Mock Functions using mockReturnValue(). For example, math.add.mockReturnValue(3) sets the return value for the add function Mock to 3.

Finally, the code calls the Mock Functions with arguments and asserts that the return values match the expected values using Jest's expect function and the toBe matcher.
