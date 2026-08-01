---
title: Understanding and Applying the Liskov Substitution Principle in Object-Oriented Programming
date: 2023-03-22T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use behavioral contracts to decide whether one subtype can safely replace another."
categories:
  - Programming
  - OOP
tags:
  - SOLID
  - Software Design
  - Design Patterns
---

The **Liskov Substitution Principle** (LSP) is about behavioral compatibility. Code written for a base type should continue to work when it receives any valid subtype. Sharing a method name is not enough: the subtype must preserve the base type's promises, including valid inputs, results, side effects, and invariants.

## Let say...

If `B` is a subtype of `A`, clients that depend on `A` should not need type checks or special recovery logic when given `B`. A subtype must not require stricter preconditions or provide weaker postconditions than its base contract.

## Example

Now, let's see an interesting example of LSP, shall we? Imagine you have a **_Bird_** base class and two subclasses: **Penguin** and **Eagle**. The **Penguin** class cannot fly, whereas the **Eagle** class can. However, both classes can make sounds by overriding the `makeSound()` method of the **Bird** base class.

```typescript
class Bird {
  makeSound(): void {
    console.log("Chirp chirp");
  }
}

class Penguin extends Bird {
  makeSound(): void {
    console.log("Honk honk");
  }
}

class Eagle extends Bird {
  makeSound(): void {
    console.log("Screech");
  }

  fly(): void {
    console.log("Soaring through the skies");
  }
}
```

Now, imagine you have a function called `letTheBirdsSing(Bird: Bird)`, which calls the makeSound() method on the **Bird** object passed to it. According to LSP, you should be able to pass in either a **Penguin** or an **Eagle** object, and the function should work as expected.

```typescript
function letTheBirdsSing(bird: Bird): void {
  bird.makeSound();
}
```

## Where a violation actually appears

Here's where it gets interesting.
The `Bird` type above promises only `makeSound`, so both subtypes satisfy that contract. Adding a `fly` requirement to every bird would create the modeling error. A client should depend on a narrower capability instead:

What can be a solution to this problem?

```typescript
interface FlyingBird extends Bird {
  fly(): void;
}

function letTheBirdFly(bird: FlyingBird): void {
  bird.fly();
}
```

This design makes the required behavior explicit and avoids an `instanceof` branch. Composition and small capability interfaces are often clearer than forcing every real-world category into one inheritance hierarchy.
