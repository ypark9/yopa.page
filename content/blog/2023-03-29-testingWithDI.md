---
title: Testing with Dependency Injection
date: 2023-03-29T01:25:00-04:00
author: Yoonsoo Park
description: "Dependency Injection – Testing Made Easy and Fun!"
categories:
  - Programming
  - Dependency Injection
tags:
  - Testing
---

Testing is an essential part of software development, but it can be a real pain in the butt. (you know it..)
In comes Dependency Injection, the superhero we didn't know we needed until now.

## Dependency Injection, the Superhero you deserve

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

One of the best practices for using DI is to keep the configuration simple. It's like trying to build a Lego tower without getting frustrated and throwing it away in anger because you don't understand the instructions.

Another practice is to inject only the dependencies needed by the class. It's like ordering food off the menu instead of eating everything on the table, including the centerpiece.

## A Real-World Example

Let's say you're building an e-commerce website that needs to communicate with a payment gateway. Instead of hard-coding the payment gateway client into your checkout controller, you can use DI to pass in the client as a dependency.

```typescript
class CheckoutController {
    private PaymentGatewayClient $paymentGateway;

    public function __construct(PaymentGatewayClient $paymentGateway) {
        $this->paymentGateway = $paymentGateway;
    }

    public function processPayment(Request $request) {
        // Code to process payment
    }
}

```

By doing this, your testing code can inject a fake or mock payment gateway client to test the checkout controller behavior without actually communicating with a real payment gateway.

P.S. With DI, testing becomes more comfortable, more manageable, and even fun (well, maybe never fun, but definitely less painful). Cheer! 🍺
