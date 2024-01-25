---
title: An Introduction to Jest Mock Functionality
date: 2023-04-14T01:25:00-04:00
author: Yoonsoo Park
description: "Jest Mock Functionality"
categories:
  - Testing
  - Programming
tags:
  - Mock
  - jest
---

At times, when writing unit tests for your application, you may find it challenging to isolate the test subjects from their dependencies. `Mocking` is a technique that can help you overcome this challenge. By replacing dependencies with objects that you can control and inspect, you can isolate the test subjects and test them in isolation.

In this article, we will discuss the basics of mocking with **Jest**, a popular testing framework, and explore different ways to use the Mock Function in Jest.

## What is Mocking?

Mocking is a technique used in testing

- to replace dependencies with objects that you can control and inspect. (Dependencies can be anything your subject relies on, but they are typically modules that the subject imports.)

## The Mock Function in Jest

When we talk about mocking in Jest, we're typically referring to the Mock Function. The goal of mocking is to replace something we don’t control with something we do.

The Mock Function in Jest provides features...

- change the implementation.
- capture calls
- set return values

## Creating a Mock Function in Jest

The simplest way to create a Mock Function instance in Jest is with jest.fn(). With a Mock Function, we can easily test captured calls using Jest's expect function:

```typescript
test("example of testing captured calls", () => {
  const mock = jest.fn();

  mock("foo");
  expect(mock).toHaveBeenCalledWith("foo");
});
```

```typescript
// Assume we have a function `add` that adds two numbers.
// We want to test if `add` calls its arguments with the correct parameters.

function add(a, b) {
  return a + b;
}

test("add calls its arguments with the correct parameters", () => {
  const mockAdd = jest.fn(add);

  const result = mockAdd(2, 3);

  expect(mockAdd).toHaveBeenCalledWith(2, 3);
  expect(result).toBe(5);
});
```

<details>
<summary>Explained</summary>
In this example, we create a Mock Function `mockAdd` using `jest.fn()`, passing in the `add` function as its implementation. We then call `mockAdd` with arguments `2` and `3` and assert that it has been called with the correct parameters using Jest's `toHaveBeenCalledWith()` matcher. Finally, we assert that the result of `mockAdd(2, 3)` is `5`. This allows us to test that the `add` function is called with the correct parameters without having to call the real implementation of `add`.
</details>

## Changing the Return Value, Implementation, or Promise Resolution

Mock Functions in Jest can be used to change the return value, implementation, or promise resolution. Below are some examples of how to use the Mock Function to achieve this:

```typescript
test("mock implementation", () => {
  const mock = jest.fn(() => "bar");

  expect(mock("foo")).toBe("bar");
  expect(mock).toHaveBeenCalledWith("foo");
});
```

In this example, we create a Mock Function mock using jest.fn() and set its implementation to return "bar". We then call mock with the argument "foo" and assert that it returns "bar" using Jest's toBe() matcher. We also assert that mock has been called with the argument "foo" using Jest's toHaveBeenCalledWith() matcher.

```typescript
test("mock implementation using mockImplementation", () => {
  const mock = jest.fn().mockImplementation(() => "bar");

  expect(mock("foo")).toBe("bar");
  expect(mock).toHaveBeenCalledWith("foo");
});
```

This example is similar to the previous one but uses the `mockImplementation()` method to set the implementation of the Mock Function instead of passing it as an argument to jest.fn(). The result is the same: the implementation of mock is set to return "bar", and we assert that it returns "bar" when called with the argument "foo".

```typescript
test("mock implementation one time using mockImplementationOnce", () => {
  const mock = jest.fn().mockImplementationOnce(() => "bar");

  expect(mock("foo")).toBe("bar");
  expect(mock).toHaveBeenCalledWith("foo");

  expect(mock("baz")).toBe(undefined);
  expect(mock).toHaveBeenCalledWith("baz");
});
```

In this example, we use the `mockImplementationOnce()` method to set the implementation of the Mock Function to return "bar" only the first time it is called. We call mock with "foo" and "baz" and assert that it returns "bar" when called with "foo", and returns undefined when called with "baz". We also assert that mock has been called with both arguments using Jest's toHaveBeenCalledWith() matcher.

```typescript
test("mock return value using mockReturnValue", () => {
  const mock = jest.fn();
  mock.mockReturnValue("bar");

  expect(mock("foo")).toBe("bar");
  expect(mock).toHaveBeenCalledWith("foo");
});
```

In this example, we create a Mock Function mock using `jest.fn()` and set its return value to "bar" using the `mockReturnValue()` method. We call mock with the argument "foo" and assert that it returns "bar" using Jest's toBe() matcher. We also assert that mock has been called with the argument "foo" using Jest's toHaveBeenCalledWith() matcher.

```typescript
test("mock promise resolution using mockResolvedValue", () => {
  const mock = jest.fn();
  mock.mockResolvedValue("bar");

  expect(mock("foo")).resolves.toBe("bar");
  expect(mock).toHaveBeenCalledWith("foo");
});
```

In this example, we are testing a function that returns a Promise. We want to make sure that the Promise resolves to the expected value, "bar", and that it has been called with the expected argument, "foo".
First, we create a Mock Function called mock using jest.fn(). We then use the mockResolvedValue() method to set the Promise resolution value of mock to "bar".
Next, we call mock with the argument "foo". Since mock returns a Promise, we use the resolves property to wait for the Promise to resolve, and then use the toBe() matcher to ensure that the resolved value is "bar".
Finally, we use the toHaveBeenCalledWith() matcher to assert that mock has been called with the argument "foo".

Let's explore the topic of "Mocking Modules and Functions" tomorrow and learn how to use this powerful feature in our testing workflow.

Tomorrow is Friday!!! YES!
Cheers! 🍺
