---
title: Mastering the Open/Closed Principle for Enhanced Software Development
date: 2023-03-24T01:25:00-04:00
author: Yoonsoo Park
description: "Do you know about Open/Closed Principle in Software Development?"
categories:
  - Programming
  - OOP
tags:
  - Principle
---

The _Open/Closed Principle_ is an important principle used in software development. It falls under the **SOLID** principles of Object-Oriented Programming (OOP). The OCP states that a software module should be open for extension but closed for modification. This means that you should be able to extend a module’s behavior without changing its source code.

## Why Is the Open/Closed Principle Important?

Listen up peeps! The Open/Closed Principle is like a magic wand that makes your codebase rock-steady and finger snap highly maintainable. It's all about modularizing and reusing your code without breaking things open (you know how Frankenstein ended lol). And guess what? You'll get some pretty sweet perks for following the OCP, like code reuse (duh!), simpler maintenance (#winning), extensibility without headaches (no Advil needed), and fewer bugs to squash (phew). So, let's put on our wizard caps and make our codebase pure awesomeness!

## Example 1: Payment Gateway

Suppose you have a good old-fashioned vending machine that uses coins to dispense delicious candy bars. It only accepts pennies and nickels as payment, but over time, it needs some fancy upgrades like credit card readers, cash printers, or even Venmo support (if such a magical machine exists). If the OCP is implemented, there should be no need to modify the existing codebase of the vending machine in order to add the new payment feature.

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

Once upon a time, in a land far away, there was a _Payment Gateway_ module that had many payment methods. But the developers were wise and followed the OCP guideline which the King(YOPA) had imposed on all software development. So they created an **IPaymentMethod** interface to define the behavior that any payment method should have. The CreditCard and PayPal classes implemented this interface and made their own moves.

The _PaymentGateway_ class was designed in a royal way as it could receive an array of **IPaymentMethods**. No matter how many payment methods existed, the _PaymentGateway_ could handle them all like a pro. When it came time to call the `processPayment` method, all injected payment methods did their job as expected by the King(YOPA).

If the rulers desired to add more payment methods to the _PaymentGateway_, they wouldn't have to touch the old code base as new payment methods could implement the **IPaymentMethod** interface. And that's how the land remained safe from bugs and well-maintained despite the addition of new features.

P.S. Can you please give me your definition of **SOLID** principle? Don't worry, I won't judge – much. 😉 Cheers.
