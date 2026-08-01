---
title: Applying the Open/Closed Principle
date: 2023-03-24T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Do you know about Open/Closed Principle in Software Development?"
categories:
  - Programming
  - OOP
tags:
  - SOLID
  - Software Design
  - Design Patterns
---

The _Open/Closed Principle_ is an important principle used in software development. It falls under the **SOLID** principles of Object-Oriented Programming (OOP). The OCP states that a software module should be open for extension but closed for modification. This means that you should be able to extend a module’s behavior without changing its source code.

## Why Is the Open/Closed Principle Important?

The principle is useful where behavior changes along a known axis. A stable contract can let new implementations be added without repeatedly editing well-tested orchestration code. It does not mean source files must never change, and introducing an extension point before variation exists can create unnecessary complexity.

## Example 1: Payment Gateway

Suppose a vending machine initially accepts coins and later needs card or mobile payments. If payment behavior is a genuine extension point, the machine's orchestration can depend on a payment contract while each method supplies its own implementation.

```typescript
interface IPaymentMethod {
  pay(amount: number): void;
}

class CreditCard implements IPaymentMethod {
  pay(amount: number) {
    console.log(`Paid ${amount} using Credit Card`);
  }
}

class PayPal implements IPaymentMethod {
  pay(amount: number) {
    console.log(`Paid ${amount} using PayPal`);
  }
}

class PaymentGateway {
  private paymentMethods: IPaymentMethod[];

  constructor(paymentMethods: IPaymentMethod[]) {
    this.paymentMethods = paymentMethods;
  }

  processPayment(amount: number) {
    for (let method of this.paymentMethods) {
      method.pay(amount);
    }
  }
}
```

The `IPaymentMethod` interface defines the behavior expected from each payment implementation. `CreditCard` and `PayPal` implement that contract.

`PaymentGateway` receives the implementations instead of constructing them. Adding another implementation does not require changing the loop, provided the contract still represents the real payment behavior.

If the rulers desired to add more payment methods to the _PaymentGateway_, they wouldn't have to touch the old code base as new payment methods could implement the **IPaymentMethod** interface. And that's how the land remained safe from bugs and well-maintained despite the addition of new features.

In production code, payment methods normally represent alternatives rather than charging every method in an array. Treat this abbreviated example as an illustration of extension points, not a complete payment workflow.
