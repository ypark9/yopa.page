---
title: Mastering Jest with TypeScript - A Comprehensive Guide
date: 2024-02-10
author: Yoonsoo Park
description: "An insightful guide into using Jest with TypeScript, covering setup, matchers, and best practices with detailed examples."
categories:
  - Testing
tags:
  - Jest
  - TypeScript
  - JavaScript
---

![Jest and Oni](images/oni-jest.webp)

In the realm of JavaScript and TypeScript development, testing your code is just as important as writing it. Jest, a delightful JavaScript Testing Framework, has gained immense popularity for its simplicity and feature-rich environment. When combined with TypeScript, it brings strong typing and helps catch errors early, leading to more reliable and maintainable code. In this article, we dive deep into how to use Jest with TypeScript, exploring its powerful features through practical examples.

## Setting up Jest with TypeScript

Before harnessing the power of Jest in a TypeScript environment, you need to set up your project correctly. Start by installing TypeScript, Jest, and the necessary dependencies:

```bash
npm install --save-dev typescript jest @types/jest ts-jest
```

Then, initialize TypeScript in your project:

```bash
npx tsc --init
```

Configure Jest to work with TypeScript by editing your Jest configuration file (`jest.config.js`):

```typescript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
};
```

## Writing Your First Jest Test in TypeScript

With the setup ready, let's dive into writing a basic test. Consider a simple function in `sum.ts`:

```typescript
// sum.ts
export function sum(a: number, b: number): number {
  return a + b;
}
```

You can write a test for this function in `sum.test.ts`:

```typescript
// sum.test.ts
import { sum } from "./sum";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});
```

Run your tests using:

```bash
npx jest
```

## Exploring Matchers in Jest

Matchers are the heart of Jest's testing power, allowing you to write various assertions.

### Common Matchers

Matchers in Jest are methods that let you test values in different ways. These methods are used with the `expect` function to assert whether a particular value meets certain conditions. Jest offers a wide range of matchers, allowing you to handle various scenarios in your tests, from simple equality checks to more complex checks like testing for exceptions or checking array contents.

1. **`toBe` and `toEqual`**:

   - `toBe` uses `Object.is` to test exact equality. It's great for primitive types.
   - `toEqual` recursively checks every field of an object or array.

   ```typescript
   test("two plus two is four", () => {
     expect(2 + 2).toBe(4);
   });

   test("object assignment", () => {
     const data: { [key: string]: number } = { one: 1 };
     data["two"] = 2;
     expect(data).toEqual({ one: 1, two: 2 });
   });
   ```

2. **Truthiness**:

   - `toBeNull` matches only `null`.
   - `toBeUndefined` matches only `undefined`.
   - `toBeDefined` is the opposite of `toBeUndefined`.
   - `toBeTruthy` matches anything that an `if` statement treats as true.
   - `toBeFalsy` matches anything that an `if` statement treats as false.

   ```typescript
   test("null", () => {
     const n: null = null;
     expect(n).toBeNull();
     expect(n).toBeDefined();
     expect(n).not.toBeUndefined();
     expect(n).not.toBeTruthy();
     expect(n).toBeFalsy();
   });
   ```

3. **Numbers**:

   - Matchers like `toBeGreaterThan`, `toBeLessThan`, etc., are used for comparing numbers.

   ```typescript
   test("two plus two", () => {
     const value: number = 2 + 2;
     expect(value).toBeGreaterThan(3);
     expect(value).toBeLessThan(5);
   });
   ```

4. **Strings**:

   - `toMatch` is used to check strings against regular expressions.

   ```typescript
   test("there is no I in team", () => {
     expect("team").not.toMatch(/I/);
   });
   ```

5. **Arrays and Iterables**:

   - `toContain` checks if an array or iterable contains a particular item.

   ```typescript
   test("the shopping list has beer on it", () => {
     const shoppingList: string[] = [
       "diapers",
       "kleenex",
       "trash bags",
       "beer",
     ];
     expect(shoppingList).toContain("beer");
   });
   ```

6. **Exceptions**:

   - `toThrow` checks if a function throws an error when it's called.

   ```typescript
   function compileAndroidCode(): void {
     throw new Error("you are using the wrong JDK");
   }

   test("compiling android goes as expected", () => {
     expect(compileAndroidCode).toThrow();
     expect(compileAndroidCode).toThrow(Error);
     expect(compileAndroidCode).toThrow("you are using the wrong JDK");
     expect(compileAndroidCode).toThrow(/JDK/);
   });
   ```

### Custom Matchers

Jest allows you to extend its matchers by using `expect.extend` to add your custom matchers. This is useful when you want to add reusable test logic, or if you're testing something specific to your application.

```typescript
// Extend the expect type with a custom matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeDivisibleBy(argument: number): R;
    }
  }
}

expect.extend({
  toBeDivisibleBy(received: number, argument: number) {
    const pass = received % argument === 0;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be divisible by ${argument}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be divisible by ${argument}`,
        pass: false,
      };
    }
  },
});

test("even and odd numbers", () => {
  expect(100).toBeDivisibleBy(2);
  expect(101).not.toBeDivisibleBy(2);
});
```

Matchers are a powerful part of Jest, providing a rich vocabulary for writing tests. They help make your tests expressive and ensure that your code behaves as expected. The variety and extensibility of Jest matchers make them suitable for a wide range of testing scenarios.

## Setup and Teardown

Jest offers several functions that allow you to perform setup and teardown tasks in your tests. These functions are `beforeAll`, `beforeEach`, `afterAll`, and `afterEach`. They are particularly useful for preparing the environment for tests and cleaning up afterward. Here's a detailed look at each of these functions:

### 1. `beforeAll`

This function runs once before all the tests in a describe block. It's useful for setting up something that is needed by all the tests and is expensive to set up, like a database connection or a large dataset.

```typescript
beforeAll(() => {
  // Setup code that runs once before all tests
});
```

### 2. `beforeEach`

`beforeEach` runs before each test in a describe block. This is useful for resetting conditions to a known state before every test, such as resetting database records or clearing mocks.

```typescript
beforeEach(() => {
  // Setup code that runs before each test
});
```

### 3. `afterAll`

This function is called once after all the tests in a describe block have completed. It is used for cleanup activities that need to happen after all tests have run, like closing database connections or freeing up resources that were used during the tests.

```typescript
afterAll(() => {
  // Cleanup code that runs once after all tests
});
```

### 4. `afterEach`

`afterEach` is executed after each test in a describe block. It's often used for cleanup that should be performed after each test, like resetting mock functions or clearing changes made during the individual test.

```typescript
afterEach(() => {
  // Cleanup code that runs after each test
});
```

### Example Usage

Here's an example that demonstrates how these functions might be used in a test suite:

```typescript
describe("Test Suite", () => {
  beforeAll(() => {
    // This will run once before all the tests in this suite
    // Assuming initializeDatabase is a function you've defined
    initializeDatabase();
  });

  beforeEach(() => {
    // This will run before every test
    // Assuming resetTestData is a function you've defined
    resetTestData();
  });

  test("Test 1", () => {
    // Test code here
    // Example: expect(someFunction()).toBe(someValue);
  });

  test("Test 2", () => {
    // Test code here
    // Example: expect(someOtherFunction()).toEqual(someOtherValue);
  });

  afterEach(() => {
    // This will run after each test
    // Assuming clearMocks is a function you've defined
    clearMocks();
  });

  afterAll(() => {
    // This will run once after all the tests in this suite
    // Assuming closeDatabaseConnection is a function you've defined
    closeDatabaseConnection();
  });
});
```

In this example, `initializeDatabase` and `closeDatabaseConnection` are used for setting up and tearing down the database, which is a relatively heavy operation, so it's done once. `resetTestData` and `clearMocks` are lighter operations needed to ensure each test runs in a clean state, so they are done before and after each test.

These functions help in organizing the test code and managing resources efficiently, making the tests more reliable and maintainable.

## Wrapping it up 👏

Jest, when used with TypeScript, provides a robust framework for writing and managing your tests. Its rich set of matchers, combined with TypeScript's strong typing, ensures that your tests are both powerful and maintainable.

Cheers! 🍺
