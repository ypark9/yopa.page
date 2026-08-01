---
title: Efficient Dependency Injection for Testable Code
date: 2023-03-29T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use explicit dependencies to make unit boundaries testable without hiding integration behavior."
categories:
  - Programming
  - Dependency Injection
tags:
  - Dependency Injection
  - Design Patterns
  - Software Design
---

Dependency injection makes a component's collaborators explicit. A unit test can supply a small fake at that boundary, while separate integration tests verify the real adapter and external system.

## Dependency Injection and test boundaries

Dependency Injection provides us with everything we need to make our code easier to test. Just like Batman's utility belt, it equips us with tools we can use to fight the evils of untestable code.

### Testing example 1:

For example, let's say you have a class that needs to communicate with an external API. With Dependency Injection, you can pass a fake or mock API client to your class during testing, and voila! You can test your code without ever having to connect to an actual API.

## Tired of Being Bitten by Integration Tests?

Integration tests are slow, cumbersome, and often just a big old mess. But Dependency Injection makes integration testing much more comfortable, like getting a hug from your dog.
By using DI to provide dependencies to your application, you can isolate different parts of your codebase better. This means **you can write integration tests that only test how these isolated components work together**, without having to worry about everything else in your system.

### Testing example 2:

For example, let's say you have a class that relies on a database connection. By injecting the database connection via DI, you can write tests that only focus on that class's behavior rather than worrying about the entire database setup.

## Best Practices - Because Nobody deserves Sloppy Code

### K.I.S.S. (Keep It Simple S**\***)

Keep DI configuration small enough that the runtime object graph remains understandable.

Inject only the dependencies the class actually uses. A growing constructor often signals that the class has accumulated too many responsibilities.

## A Real-World Example

Let's say you're building an e-commerce website that needs to communicate with a payment gateway. Instead of hard-coding the payment gateway client into your checkout controller, you can use DI to pass in the client as a dependency.

```typescript
interface PaymentGateway {
  charge(amountInCents: number): Promise<{ transactionId: string }>;
}

class CheckoutService {
  constructor(private readonly paymentGateway: PaymentGateway) {}

  processPayment(amountInCents: number) {
    return this.paymentGateway.charge(amountInCents);
  }
}

```

The unit test can inject a deterministic fake gateway. Keep at least one integration or contract test for the production gateway adapter; dependency injection improves isolation but does not make integration behavior unnecessary.
