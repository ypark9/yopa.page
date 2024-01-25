---
title: Mocking Modules and Functions with Jest
date: 2023-04-15T01:25:00-04:00
author: Yoonsoo Park
description: "Mocking Modules and Functions"
categories:
  - Jest
tags:
  - Mock modules and functions
---

## Mocking Modules and Functions with Jest: A Complete Tutorial

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
import * as math from "./math";

test("multiply function calls add function", () => {
  math.add = jest.fn();
  multiply(2, 3);
  expect(math.add).toHaveBeenCalledTimes(1);
});
```

In the above example, we create a Mock Function for the `add()` function using `jest.fn()`. We then assign the Mock Function to the `math.add` property, replacing the original function with the Mock Function.

Finally, we call the multiply() function with the arguments 2 and 3. Since multiply() calls `add()` internally, the Mock Function will be called instead, allowing us to test the behavior of multiply() in isolation.

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

Cheers! 🍺
