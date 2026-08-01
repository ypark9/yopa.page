---
title: Understanding Method Injection in Dependency Injection - A Guide to Avoid Common Pitfalls
date: 2023-03-26T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "do you know about Method Injection in Dependency Injection?"
categories:
  - Programming
  - Dependency Injection
tags:
  - Dependency Injection
  - Design Patterns
  - Software Design
---

## Method injection and its tradeoffs

Dependency injection (DI) is a powerful technique that allows you to write flexible, scalable code. One of its key features is method injection - the ability to pass dependencies to methods directly rather than through constructor injection.

But beware! This feature can be dangerous if used incorrectly. Here's what you need to know:

## So What Is The Problem with Method Injection?

Method injection can make your code more complex and harder to test. If you're not careful, it can lead to tightly-coupled code that's difficult to maintain.

One common mistake is to use method injection excessively, resulting in "hidden" dependencies that are hard to track down. Always remember: just because you can inject a dependency into a method doesn't mean you should.

Second!
It can lead to unnecessary object creation. When you inject a dependency into a method, you may end up creating a new instance of that object every time the method is called. This can be particularly problematic for expensive or resource-intensive objects.

## What Is A Better Way? ➡️ Constructor Injection

Constructor injection is the usual default when a dependency is required for every valid instance.

However, there are cases where method injection still makes sense. For example, if you have a single method that requires a specific dependency, it may be more appropriate to inject that dependency directly.

## Example

Let's say we have a `UserService` class that requires a `UserRepository` dependency. Rather than injecting the repository through the constructor, we'll use method injection to inject it directly into our `getUserById` method:

```typescript
class UserService {
  constructor(private logger: ILogger) {}

  public async getUserById(id: string, repo: UserRepository): Promise<User> {
    this.logger.info(`Getting user with ID ${id}`);
    return await repo.getUserById(id);
  }
}
```

Notice that we also inject a logger dependency into the constructor using the more traditional constructor injection.
