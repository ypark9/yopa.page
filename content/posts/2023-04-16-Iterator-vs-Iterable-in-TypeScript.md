---
title: Iterator vs Iterable in TypeScript
date: 2023-04-16T01:25:00-04:00
author: Yoonsoo Park
description: "Iterator vs Iterable in TypeScript"
categories:
  - TypeScript
tags:
  - Iterator vs Iterable
---

## Iterator vs Iterable in TypeScript

In TypeScript, an iterator is an object that provides a sequence of values through a series of iterations. An iterable, on the other hand, is an object that can be iterated over using an iterator.

## Iterators

In TypeScript, an iterator is an object that implements the `Iterator protocol`. The Iterator protocol defines a single method called `next()`, which returns an object with two properties: `value` and `done`.

The `value` property is the next value in the sequence, and the `done` property is a boolean value that indicates whether the sequence has ended. When the `done` property is `true`, there are no more values in the sequence.

Here's an example of an iterator that produces the sequence of numbers 1 to 5:

```typescript
const numberIterator = {
  next: function () {
    let value = 1;
    return {
      value,
      done: value++ > 5,
    };
  },
};
```

In this example, the `next()` method returns an object with the `value` property set to the current number, and the `done` property set to false if there are more numbers in the sequence, or true if the sequence has ended.

## Iterables

In TypeScript, an `iterable` is an object that implements the `Iterable` protocol. The `Iterable` protocol defines a single method called Symbol.iterator, which returns an iterator object.

Here's an example of an iterable that produces the same sequence of numbers as the iterator above:

```typescript
const numberIterable = {
  [Symbol.iterator]: function () {
    let value = 1;
    return {
      next: function () {
        return {
          value,
          done: value++ > 5,
        };
      },
    };
  },
};
```

In this example, the `numberIterable` object implements the `Symbol.iterator` method, which returns an iterator object with the same implementation as the numberIterator object in the previous example.

## Using Iterators and Iterables

`Iterators` and `iterables` are commonly used in TypeScript and JavaScript to iterate over arrays, sets, and maps.

For example, here's how you can use the `numberIterator` object to iterate over the sequence of numbers it produces:

```typescript
let iteratorResult = numberIterator.next();
while (!iteratorResult.done) {
  console.log(iteratorResult.value);
  iteratorResult = numberIterator.next();
}
```

And here's how you can use the `numberIterable` object to iterate over the same sequence of numbers:

```typescript
for (const number of numberIterable) {
  console.log(number);
}
```

Cheers! 🍺
