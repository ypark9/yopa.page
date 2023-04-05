---
title: Injecting Properties Using Dependency Injection
date: 2023-03-27T01:25:00-04:00
author: Yoonsoo Park
description: "do you know about Property Injection in DI?"
categories:
  - Programming
  - Dependency Injection
tags:
  - Property Injection
---

## Property Injection in DI

Property injection is a way of providing dependencies to a class by setting them as properties. It's a simpler alternative to constructor injection, where dependencies are provided through the constructor.

## Example

```typescript
class Car {
  engine: Engine;

  start() {
    this.engine.turnOn();
  }
}

const myCar = new Car();
myCar.engine = new Engine();
myCar.start();
```

In this example, we have a `Car` class that has an `engine` property. Instead of injecting the `engine` dependency through the constructor, we're setting it as a property after creating the `Car` instance.

## Weaknesses

1. One major issue is that it can lead to unexpected behavior if the dependencies are not set correctly. Imagine if we forget to set the `engine` property before calling `start()` - the car won't start! **This can be especially tricky to debug in larger codebases**.

2. Another weakness is that it can make testing more difficult. In order to test the Car class, we need to create an instance and set its engine property. This can be cumbersome, especially if there are multiple dependencies that need to be set.

## Better Alternatives

- One option is to use a DI container that can handle property injection for us.
- Another option is to use **constructor injection instead**, which makes dependencies more explicit and easier to test.

P.S. Have you ever heard of the term **"Inversion of Control" (IoC)**? It's like a fancy way of saying that sometimes, **the things you depend on should depend on you instead**. And that's where Dependency Injection (DI) comes in - it's like a mediator that helps you and your dependencies communicate better. So, do you know about this cool duo? cheeers. 🍺
