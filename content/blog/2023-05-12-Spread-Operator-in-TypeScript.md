---
title: Spread Operator in TypeScript
date: 2023-05-12T01:25:00-04:00
author: Yoonsoo Park
description: "Spread Operator in TypeScript"
categories:
  - TypeScript
tags:
  - Spead Operator
---

`Spead Operator` provides an elegant syntax for copying or combining elements from existing arrays or objects into new ones.

## Array Manipulation
## Copying an Array
One of the most common use cases of the spread operator is to create a shallow copy of an array. Let's consider an example:

```ts
const originalArray = [1, 2, 3];
const copiedArray = [...originalArray];
```

In this code snippet, the spread operator `...` is used to spread the elements of the `originalArray` into a new array `copiedArray`. This ensures that modifying the `copiedArray` does not affect the `originalArray`, as they are separate instances.

## Concatenating Arrays
The spread operator can also be used to concatenate arrays effortlessly. Suppose we have two `arrays`, `array1` and array2, and we want to combine them into a new array `combinedArray`. We can achieve this using the spread operator:

```ts
const array1 = [1, 2, 3];
const array2 = [4, 5, 6];
const combinedArray = [...array1, ...array2];
```

The resulting `combinedArray` will contain all the elements from `array1` followed by all the elements from `array2`. This approach is much cleaner and more readable than using traditional methods like `Array.concat()`.

## Adding or Removing Elements
Using the spread operator, we can easily add or remove elements from an array. Consider the following example:

```ts
const originalArray = [1, 2, 3];
const newArray = [...originalArray, 4, 5];
```

In this case, the spread operator is used to spread the elements of the `originalArray` and append additional elements `4` and `5` to create a new array `newArray`. Similarly, you can remove elements by excluding them using the spread operator.

## Object Manipulation
## Copying an Object
Just like with arrays, the spread operator can be used to create a shallow copy of an object. Let's see an example:

```ts
const originalObject = { name: 'John', age: 30 };
const copiedObject = { ...originalObject };
```

In this case, the spread operator is used to spread the properties of the `originalObject` into a new object `copiedObject`. This ensures that modifying the `copiedObject` does not affect the `originalObject`.

## Merging Objects
The spread operator can also be used to merge multiple objects into a new object. Suppose we have two objects, `object1` and `object2`, and we want to merge them into a new object `mergedObject`. We can achieve this using the spread operator:

```ts
const object1 = { name: 'John' };
const object2 = { age: 30 };
const mergedObject = { ...object1, ...object2 };
```

The resulting `mergedObject` will contain all the properties from `object1` and `object2`. If there are overlapping properties, the value from `object2` will overwrite the value from `object1`.

## Modifying Object Properties
The spread operator can also be used to modify specific properties of an object while keeping the rest intact. Consider the following example:

```ts
const originalObject = { name: 'John', age: 30 };
const modifiedObject = { ...originalObject, age: 31 };
```

In the example above, the spread operator is used to spread the properties of the `originalObject` into a new object `modifiedObject`. The `age` property is also included and assigned a new value of `31`. This creates a new object with the same properties as the `originalObject`, except for the modified property.

By using the spread operator in this way, you can easily modify specific properties of an object without mutating the original object itself. It provides a clean and concise syntax for object manipulation.

## Rest Parameters
In addition to array and object manipulation, the spread operator can also be used with function parameters to handle variable-length arguments. This is often referred to as "rest parameters" in TypeScript.

```ts
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, curr) => acc + curr, 0);
}

const result = sum(1, 2, 3, 4, 5);
console.log(result); // Output: 15
```

In this example, the spread operator `...` is used in the function parameter declaration `...numbers: number[]`. It allows you to pass any number of arguments to the `sum` function, and TypeScript collects them into an array called `numbers`. The function then performs the sum operation on all the numbers in the array.

Rest parameters provide flexibility when dealing with functions that need to handle a variable number of arguments. The spread operator simplifies the process of passing and manipulating these arguments.

Cheers! 🍺
