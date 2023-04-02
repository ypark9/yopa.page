---
title: Cool Trick to Write Better TypeScript Code 1
date: 2023-03-31T01:25:00-04:00
author: Yoonsoo Park
description: "Write Better TypeScript Code 1"
categories:
  - Programming
  - TypeScript
tags:
  - mapped types
---

A cool trick to write better TypeScript code is to use **mapped types**. 

## What is Mapped types
Mapped types allow you to create new types by transforming properties of existing types, making your code more flexible, and less prone to errors. Let's take a look at an example:

Suppose you have a type representing a User:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}
```

Now, you want to create a new type with optional properties based on the `User` type. You can use a mapped type to achieve this:

```typescript
type Optional<T> = {
  [P in keyof T]?: T[P];
};

type OptionalUser = Optional<User>;
```

`OptionalUser` will now have the same properties as `User`, but all of them will be optional:

```typescript
const user1: OptionalUser = {
  id: 1,
  name: "Alice",
};

const user2: OptionalUser = {
  id: 2,
  email: "bob@example.com",
};
```

You can even go further and create a utility type to make any property of a given type readonly:

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type ReadonlyUser = Readonly<User>;
```

Now you have a ReadonlyUser type where all properties are immutable:

```typescript
const user3: ReadonlyUser = {
  id: 3,
  name: "Carol",
  email: "carol@example.com",
  age: 30,
};

// This will produce a TypeScript error, as the name property is readonly:
user3.name = "Catherine";
```

Mapped types can help you create more versatile and maintainable TypeScript code by reducing duplication and allowing for easy transformation of existing types. 
Cheer! 🍺
