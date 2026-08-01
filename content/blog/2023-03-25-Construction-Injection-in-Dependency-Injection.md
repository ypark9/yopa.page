---
title: Understanding Constructor Injection in Dependency Injection - A Comprehensive Guide
date: 2023-03-25T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Do you know about Construction Injection in Dependency Injection?"
categories:
  - Programming
  - Dependency Injection
tags:
  - Dependency Injection
  - Design Patterns
  - Software Design
---

# Constructor Injection in Dependency Injection

Constructor injection supplies required dependencies when an object is created. It is a useful default because a successfully constructed instance has everything it needs to operate.

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
