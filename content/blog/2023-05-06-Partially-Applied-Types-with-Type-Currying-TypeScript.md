---
title: Partially Applied Types with Type Currying TypeScript
date: 2023-05-06T01:25:00-04:00
author: Yoonsoo Park
description: "Partially Applied Types with Type Currying"
categories:
  - TypeScript
tags:
  - Type Currying
  - Partially Applied Types
---

Type Currying is a technique used in functional programming that allows us to transform a function with multiple arguments into a series of functions that take a single argument. This makes the functions more flexible and easier to compose.

Partially Applied Types is another powerful technique that can be used in conjunction with Type Currying to further enhance the flexibility and composability of functions. In this article, we will explore these concepts and their applications in functional programming.

## Type Currying
Type Currying is named after Haskell Curry, a mathematician who introduced the concept of currying in the 20th century. The idea behind Type Currying is simple: transform a function that takes multiple arguments into a series of functions that each take a single argument.

For example, let's say we have a function add that takes two integers and returns their sum:
```ts
function add(x, y) {
  return x + y;
}
```
We can transform this function into a series of functions that each take a single argument:

```ts
function add(x) {
  return function(y) {
    return x + y;
  }
}
```

This new function add takes a single argument `x` and returns another function that takes a single argument `y` and returns their `sum`. We can use this function like this:

```ts
const add5 = add(5); // returns a new function that adds 5 to its argument
const result = add5(3); // returns 8
```

This technique can be used to create new functions from existing ones by partially applying some of the arguments.

## Partially Applied Types
`Partially Applied Types` is a technique that extends `Type Currying` to support partially applying type parameters. In other words, it allows us to create new types by partially applying some of the type parameters of an existing type.

For example, let's say we have a generic type `Result<T, E>` that represents the result of an operation that can either succeed with a value of type `T` or fail with an error of type `E`:

```ts
type Result<T, E> = Success<T> | Failure<E>;

interface Success<T> {
  kind: 'success';
  value: T;
}

interface Failure<E> {
  kind: 'failure';
  error: E;
}
```
We can use this type to represent the result of any operation that can fail, such as a network request that can either return data or an error.

Now, let's say we have a specific use case where we only care about the successful case and we don't need to handle errors. We can create a new type `SuccessResult<T>` by partially applying the `Result` type:

```ts
type SuccessResult<T> = Result<T, never>;

// Usage:
const result: SuccessResult<number> = { kind: 'success', value: 42 };
```

In this new type, we have partially applied the second type parameter `E` with the `never` type, which means we don't care about the error case. This new type can be used in place of the original `Result` type wherever we only care about the successful case.

Cheers! 🍺
