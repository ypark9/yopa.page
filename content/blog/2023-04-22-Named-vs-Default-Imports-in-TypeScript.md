---
title: Named vs. Default Imports in TypeScript
date: 2023-04-22T01:25:00-04:00
author: Yoonsoo Park
description: "Named vs. Default Imports in TypeScript"
categories:
  - TypeScript
tags:
  - Named vs. Default Imports
---

# Named vs. Default Imports in TypeScript

TypeScript provides two different ways to import functionality from a module: named imports and default imports. While both types of imports allow you to use code from other modules in your application, they have some key differences in terms of syntax and behavior.

## Named Imports

A named import allows you to selectively import specific functionality from a module using a named identifier. You can import multiple named exports from a module by separating them with commas inside a set of curly braces `{}`.

```typescript
// Import a single named export
import { sum } from "./math";

// Use the imported function
console.log(sum(2, 3)); // Output: 5
```

## Default Imports

A default import allows you to import a single default export from a module using any identifier you choose. You can only have one default export per module.

```ts
// Import the default export
import math from "./math";

// Use the imported function
console.log(math.sum(2, 3)); // Output: 5
```

In this example, we use a default import to import the **default** export from the math module. Since the default export is an object with a `sum` property that contains the `sum` function, we can access the `sum` function using dot notation.

## Exporting Named and Default Exports

A single named export: `sum`

```ts
// math.ts

export function sum(a: number, b: number) {
  return a + b;
}
```

A single default export:

```ts
// math.ts
export default {
  sum(a: number, b: number) {
    return a + b;
  },
};
```

Cheers! 🍺
