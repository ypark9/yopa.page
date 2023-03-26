---
title: Construction Injection in Dependency Injection – No Hard Hats Required!
date: 2023-03-25T01:25:00-04:00
author: Yoonsoo Park
description: "do you know about Construction Injection in Dependency Injection?"
categories:
  - Programming
tags:
  - Dependency Injection
  - Construction Injection
---

# Construction Injection in Dependency Injection – No Hard Hats Required! #
Welcome to the construction site, where we're not building a new housing development but instead, we're working on some code. Let's talk about construction injection - it might not involve hard hats, but it's still the most recommended and important concept in dependency injection.

Let's say we have a simple example of a `Computer` class that depends on another class, `CPU`. We can use construction injection to provide the `CPU` class to the `Computer` constructor like so:

```typescript
class CPU {
  public brand: string;

  constructor(brand: string) {
    this.brand = brand;
  }
}

class Computer {
  public cpu: CPU;

  constructor(cpu: CPU) {
    this.cpu = cpu;
  }
}

const amd_cpu: CPU = new CPU("AMD");
const computer: Computer = new Computer(amd_cpu);

```

With construction injection, our Computer class is no longer responsible for creating its own dependencies. 
Instead, it's provided with everything it needs to work correctly.

P.S. Sure, because we all love injecting methods into our code without a second thought, right? But seriously, do you happen to know about `method injection`? ;-) cheeers. 🍺