---
title: TypeScript's `Pick` and `Omit`
date: 2023-04-11T01:25:00-04:00
author: Yoonsoo Park
description: "TypeScript's Pick and Omit"
categories:
  - TypeScript
tags:
  - Pick and Omit
---

TypeScript's `Pick` and `Omit` are two utility types that allow you to create new types based on existing types. These types can be very useful in creating new types that are more specialized for a specific use case.

## Pick
The Pick type allows you to create a new type by selecting only the specified properties from an existing type. Here's an example:

```TypeScript
type Person = {
  name: string;
  age: number;
  email: string;
};

type PersonNameAndAge = Pick<Person, "name" | "age">;

// PersonNameAndAge is equivalent to:
// {
//   name: string;
//   age: number;
// }
```

In this example, `PersonNameAndAge` is a new type that only includes the `name` and `age` properties from the `Person` type. The syntax for using `Pick` is as follows:

```typescript
Pick<Type, Keys>
```
Here, `Type` is the type you want to pick properties from, and `Keys` is a union of the keys you want to include in the new type.


## Omit
The `Omit` type allows you to create a new type by excluding the specified properties from an existing type. Here's an example:

```typescript
type Person = {
  name: string;
  age: number;
  email: string;
};

type PersonWithoutEmail = Omit<Person, "email">;

// PersonWithoutEmail is equivalent to:
// {
//   name: string;
//   age: number;
// }

```
In this example, `PersonWithoutEmail` is a new type that includes all the properties from the `Person` type except for the `email` property. The syntax for using `Omit` is as follows:

```typescript
Omit<Type, Keys>
```

Here, `Type` is the type you want to exclude properties from, and `Keys` is a union of the keys you want to exclude from the new type.


Cheer! 🍺
