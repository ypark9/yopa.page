---
title: Optional Chaining in TypeScript
date: 2023-04-06T01:25:00-04:00
author: Yoonsoo Park
description: "Optional Chaining in TypeScript"
categories:
  - Programming
  - TypeScript
tags:
  - Optional Chaining
---

## What is Optional Chaining?
Optional chaining is a syntax feature that allows you to access deeply nested properties within an object without having to check for the existence of each intermediate property. With optional chaining, if any property in the chain is null or undefined, the entire chain evaluates to undefined without throwing an error.

Let's consider a simple example. Suppose we have an object `user` with a nested property `address.street`:
```typescript
interface Address {
  street: string;
  city: string;
  country: string;
}

interface User {
  name: string;
  age: number;
  address?: Address;
}

const user: User = {
  name: "Alice",
  age: 30,
};
```

Without optional chaining, you would need to check for the existence of the `address` property before accessing the `street` property:

```typescript
const street = user.address ? user.address.street : undefined;
```

**With optional chaining**, you can access the street property more concisely:

```typescript
const street = user.address?.street;
```

If the `address` property is null or undefined, the entire expression evaluates to undefined without throwing an error.

## Optional Chaining with Function Calls

```typescript
interface User {
  name: string;
  age: number;
  greet?: () => string;
}

const user: User = {
  name: "Alice",
  age: 30,
};

```

You can use optional chaining to call the `greet` method only if it exists:

```typescript
const greeting = user.greet?.();
```

## You can even use this with Array Indices!
Consider an example where you have an array of users, and you want to access the first user's name:

```typescript
const users: User[] | undefined = [
  {
    name: "Alice",
    age: 30,
  },
  {
    name: "Bob",
    age: 25,
  },
];

const firstName = users?.[0]?.name;

```
In this example, the optional chaining operator is used twice: once to check if the `users` array exists, and once to check if the first element in the array exists. If either the `users` array or the first element is null or undefined, the expression evaluates to undefined without throwing an error.

Cheer! 🍺
