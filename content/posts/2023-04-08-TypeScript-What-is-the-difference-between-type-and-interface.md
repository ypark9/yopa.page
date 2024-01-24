---
title: TypeScript - What is the difference between type and interface?
date: 2023-04-08T01:25:00-04:00
author: Yoonsoo Park
description: "What is the difference between type and interface in TypeScript"
categories:
  - Programming
  - TypeScript
tags:
  - interface and type
---

## Type vs Interface: When to Use Each One?
While there is some overlap between `types` and `interfaces`, there are some **key differences** that make one a better choice than the other in specific scenarios.

### Use `types` when:

- You need to create a `union` or `intersection` type.
- You need to define a `tuple` type.
- You need to create a `type alias` that cannot be represented by an `interface`.
- You need to define a type that represents a complex data structure.

### Use `interfaces` when:

- You need to define the shape of an object.
- You need to enforce **contracts** in your code.
- You need to extend or implement `interfaces` in your code.
- You need to define `optional` properties or `readonly` properties.

In general, *types are more flexible than interfaces*, but *interfaces are more specific*. 

Types can represent more complex data structures and allow for more advanced type manipulation. 
Interfaces, on the other hand, are more rigid and allow for stricter type checking and code contracts.

Cheer! 🍺
