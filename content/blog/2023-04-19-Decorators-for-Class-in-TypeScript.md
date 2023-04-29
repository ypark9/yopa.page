---
title: Decorators for Class in TypeScript
date: 2023-04-19T01:25:00-04:00
author: Yoonsoo Park
description: "Decorators for Class in TypeScript"
categories:
  - Programming
  - TypeScript
tags:
  - Decorators
---

Decorators in TypeScript are functions that can be applied to classes, methods, properties, and parameters to modify their behavior or add metadata. In this article, we will focus on decorators for classes and how they can be useful.

## Basic Syntax

```ts
@decorator
class MyClass {
  // class members
}
```

The `@decorator` is the decorator that is being applied to the class. Decorators can be applied in any order and can be applied multiple times.

## Example

Let's say we have a class called `MyService` that provides a method called `getData()` to fetch data from an API. We want to **log** the time it takes for `getData()` to complete. We can achieve this using a decorator.
Here is the decorator function:

```ts
function logTime(target: any, name: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();
    console.log(`Method ${name} took ${(end - start).toFixed(2)} milliseconds`);
    return result;
  };
  return descriptor;
}
```

This **decorator** logs the time it takes for a method to complete. We can apply this decorator to the `getData()` method in the `MyService` class like this:

```ts
class MyService {
  @logTime
  async getData() {
    const response = await fetch("https://api.example.com/data");
    const data = await response.json();
    return data;
  }
}
```

Now whenever we call `MyService.getData()`, the time it takes to complete will be **logged** to the console.

## So Why Use Decorators?

- we've got reusability. That's right, these bad boys can be applied to multiple classes, which means you can reuse functionality like it's nobody's business.
- we've also got modularity. Decorators can be applied in any order and combined to create complex behaviors. It's like playing with legos, but for coding.
- Decorators can also add metadata to your classes, making it easier to understand and work with code. It's like having a personal assistant that organizes your code for you.

Cheers! 🍺
