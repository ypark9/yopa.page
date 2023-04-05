---
title: Master TypeScript with Conditional Types - Tips for Cleaner, More Efficient Code
date: 2023-04-02T01:25:00-04:00
author: Yoonsoo Park
description: "Write Better TypeScript Code 2"
categories:
  - Programming
  - TypeScript
tags:
  - conditional types
---

Another cool trick in TypeScript is to use conditional types. Conditional types enable you to create new types by conditionally selecting different types based on the input type. This can help you make your code more flexible and adaptable.

Here's an example using conditional types:

Suppose you have a type `Response` that can have either an `error` or a `data` property:

```typescript
type Response<T> = {
  error?: string;
  data?: T;
};
```

You want to create a utility type that extracts the `data` type if it exists, or returns `never` if it doesn't.
You can use a conditional type to achieve this:

```typescript
type ExtractDataType<T> = T extends Response<infer U> ? U : never;
```

<details>
<summary>More detailed explanation</summary>
Here, `ExtractDataType` is a generic type that takes a type parameter `T`. It checks if `T` extends the `Response` type. If it does, the type `U` is inferred from the `Response<U>` type and returned. If it doesn't, the `never` type is returned.
</details>

Now, you can use `ExtractDataType` to get the type of the `data` property from a `Response` type:

```typescript
type NumberResponse = Response<number>;
type ExtractedNumber = ExtractDataType<NumberResponse>; // This will be 'number'

type StringResponse = Response<string>;
type ExtractedString = ExtractDataType<StringResponse>; // This will be 'string'
```

You can also use this utility type with more complex types:

```typescript
interface User {
  id: number;
  name: string;
}

type UserResponse = Response<User>;
type ExtractedUser = ExtractDataType<UserResponse>; // This will be 'User'
```

The `ExtractDataType` utility type is a good example of a conditional type that simplifies working with complex types, making the code more maintainable and less error-prone.
Cheer! 🍺
