---
title: Method Injection in Dependency Injection - How to Shoot Yourself in the Foot
date: 2023-03-26T01:25:00-04:00
author: Yoonsoo Park
description: "do you know about Method Injection in Dependency Injection?"
categories:
  - Programming
  - Dependency Injection
tags:
  - Method Injection
---

## Method Injection in DI: How to Shoot Yourself in the Foot!

Dependency injection (DI) is a powerful technique that allows you to write flexible, scalable code. One of its key features is method injection - the ability to pass dependencies to methods directly rather than through constructor injection.

But beware! This feature can be dangerous if used incorrectly. Here's what you need to know:

## So What Is The Problem with Method Injection?

Method injection can make your code more complex and harder to test. If you're not careful, it can lead to tightly-coupled code that's difficult to maintain.

One common mistake is to use method injection excessively, resulting in "hidden" dependencies that are hard to track down. Always remember: just because you can inject a dependency into a method doesn't mean you should.

Second!
It can lead to unnecessary object creation. When you inject a dependency into a method, you may end up creating a new instance of that object every time the method is called. This can be particularly problematic for expensive or resource-intensive objects.

## What Is A Better Way? ➡️ Constructor Injection

Oh, you want to learn about Constructor Injection? How bold of you! Well, look no further - I have all the juicy details waiting for you on my blog. Ready or not, here comes the knowledge! ;)

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

P.S. when it comes to DI, method injection is like a gun - it can be quite dangerous if not handled carefully. ;-) cheeers. 🍺
