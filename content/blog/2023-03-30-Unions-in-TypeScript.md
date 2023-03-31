---
title: Unions in TypeScript
date: 2023-03-30T01:25:00-04:00
author: Yoonsoo Park
description: "Unions in TypeScript are like a group of friends who hang out together but each one of them has their own unique personality."
categories:
  - Programming
  - TypeScript
tags:
  - Union
---

## Why do you need unions in TypeScript

Well, let's say you have a function that can receive different types of arguments, but you don't want to write a different function for each type. You can use a union to define that the function can receive one type or another, or even a combination of them.

For example, imagine you have a function that calculates the area of a shape. You could define a union type that represents the different shapes that your function can handle:

```typescript
type Shape = Square | Circle | Rectangle;

type Square = {
  kind: 'square',
  size: number
};

type Circle = {
  kind: 'circle',
  radius: number
};

type Rectangle = {
  kind: 'rectangle',
  width: number,
  height: number
};

function calculateArea(shape: Shape): number {
  switch(shape.kind) {
    case 'square':
      return shape.size * shape.size;
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    default:
      throw new Error('Invalid shape');
  }
}

const square: Square = { kind: 'square', size: 5 };
const circle: Circle = { kind: 'circle', radius: 3 };
const rectangle: Rectangle = { kind: 'rectangle', width: 4, height: 2 };

console.log(calculateArea(square)); // Output: 25
console.log(calculateArea(circle)); // Output: 28.274333882308138
console.log(calculateArea(rectangle)); // Output: 8

```

In the example above, we define a union type `Shape` that can represent a `Square`, a `Circle`, or a `Rectangle`. Each type has its own properties, but they all share a common property kind that helps us determine which shape we are dealing with inside the `calculateArea` function.

We can also see that the function can handle different types of shapes thanks to the union type, and we don't need to write a different function for each shape.


## What is the best practice when using unions in TypeScript? 
One best practice is to use discriminants, like the kind property in the example above, to help you determine which type you are dealing with inside your functions. This way, you can avoid runtime errors by ensuring that you are only using the properties that are common to all types in the union.

Another best practice is to keep your union types as simple as possible. Unions can quickly become complex if you start nesting them or adding too many types, which can make your code harder to read and maintain.


P.S. Have you encountered a similar feature in other type-safe programming languages? If so, what was it? Do you think TypeScript has a similar feature as well? Then why does TS have Union? Think about it.
Cheer! 🍺
