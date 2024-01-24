---
title: Understanding TypeScript's Record Type
date: 2023-04-09T01:25:00-04:00
author: Yoonsoo Park
description: "Understanding TypeScript's Record Type"
categories:
  - Programming
  - TypeScript
tags:
  - Record type
---

In TypeScript, the `Record` type is a built-in utility type that represents an `object` type whose `property` keys are of a `specified type` and whose property values are of a `specified type`. It's essentially an object type that maps keys of one type to values of another type.

The syntax for `Record` is as follows:

```typescript
Copy code
Record<KeysType, ValueType>
```
where `KeysType` is the type of the keys, and `ValueType` is the type of the values.

## Example using custom types
Here's an example of how to use `Record` with custom types to define an object type that maps an `enum` to an object with properties of `specific types`:

```typescript
Copy code
enum MyEnum {
  A,
  B,
  C,
}

type MyObject = {
  name: string;
  value: number;
};

type MyRecord = Record<MyEnum, MyObject>;

const myRecord: MyRecord = {
  [MyEnum.A]: { name: 'A', value: 1 },
  [MyEnum.B]: { name: 'B', value: 2 },
  [MyEnum.C]: { name: 'C', value: 3 },
};
```

In this example, we define an enum `MyEnum` and an object type `MyObject` with two properties, name of type string and value of type number. We then define a `MyRecord` type using `Record` that maps `MyEnum` keys to `MyObject` values.

We then create a value of type `MyRecord` called `myRecord` using object literals to set the values for each key.

## Advanced usage

### keyof + Record type

In TypeScript, the keyof operator is a type operator that can extract the keys of an object type as a union type. When combined with the Record type, it allows you to define an object type with specific key and value types based on the keys of an existing type.

Let's see the example.

```typescript
interface MyInterface {
  foo: number;
  bar: string;
  baz: boolean;
}

type MyRecord = Record<keyof MyInterface, { value: any }>;

const myRecord: MyRecord = {
  foo: { value: 123 },
  bar: { value: "hello" },
  baz: { value: true },
};
```
<details>
<summary>Example Explained</summary>
In this example, we define an interface `MyInterface` with three properties of different types. We then define a `MyRecord` type using `Record` and `keyof` that maps the keys of `MyInterface` to an object type with a single value property of type any.

We then create a value of type `MyRecord` called `myRecord` using object literals to set the values for each key. This allows us to create an object with the same keys as `MyInterface`, but with a uniform value property for each key.
</details>

Cheer! 🍺
