---
title: Master TypeScript with Advanced Tricks - Partial Application of Generic Types
date: 2023-04-04T01:25:00-04:00
author: Yoonsoo Park
description: "Write Better TypeScript Code 4"
categories:
  - Programming
  - TypeScript
tags:
  - Partial Application of Generic Types
---

Another cool trick in TypeScript is to use **Partial Application of Generic Types**. This feature enables you to create a new type by applying some of the type parameters of a generic type. This can help you to create reusable and modular types that can be combined in various ways.

Let's take a look at an example:

Suppose you have a generic type called `ApiResponse` which represents the response from an API. This type has two type parameters, `Data` and `Meta`:

```typescript
type ApiResponse<Data, Meta> = {
  data: Data;
  meta: Meta;
};
```

Now, you want to create a reusable `PaginatedResponse` type that partially applies the `ApiResponse` type with a fixed `meta` property. You can achieve this using a generic type with a single type parameter:

```typescript
interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
}

type PaginatedResponse<Data> = ApiResponse<Data, PaginationMeta>;
```

In this example, we first define an interface called `PaginationMeta` that represents the metadata for a paginated response. Next, we create a new type `PaginatedResponse` that takes a single type parameter Data and partially applies the `ApiResponse` type by fixing the `Meta` type parameter to `PaginationMeta`.

Now, you can use the `PaginatedResponse` type with different data types:

```typescript
type User = {
  id: number;
  name: string;
};

type PaginatedUsers = PaginatedResponse<User[]>;

const users: PaginatedUsers = {
  data: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ],
  meta: {
    currentPage: 1,
    totalPages: 10,
    itemsPerPage: 2,
  },
};
```

In this example, we define a User type and then create a `PaginatedUsers` type that represents a paginated response containing an array of users. The `PaginatedResponse` type simplifies creating paginated responses for different data types without having to redefine the metadata properties for each type.

Partial Application of Generic Types can help you create more versatile and maintainable TypeScript code by allowing you to create reusable types that can be combined in various ways. This can reduce duplication and make your code more modular and easier to work with.

Cheer! 🍺
