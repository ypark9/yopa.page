---
title: Promises in TypeScript
date: 2023-04-21T01:25:00-04:00
author: Yoonsoo Park
description: "sfdx force:source:push vs sfdx force:source:deploy"
categories:
  - Programming
  - TypeScript
tags:
  - Promise
---

## What is a Promise?

A Promise is an object that represents a value that may not be available yet, but will be at some point in the future. It provides a way to handle asynchronous operations in a more structured and readable way than using callbacks.
It has three states:

- Pending: The initial state of the Promise.
- Fulfilled: The state of the Promise representing a successful operation.
- Rejected: The state of the Promise representing a failed operation.

## Creating a Promise

In TypeScript, we can create a Promise using the Promise constructor. The constructor takes a single argument, which is a function that will be executed immediately when the Promise is created. This function takes two arguments: a `resolve` function and a `reject` function.

```ts
const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
```

In this example, we've defined a function called `delay` that takes a number of milliseconds as an argument. The function returns a new `Promise` that resolves after the specified number of milliseconds using `setTimeout`.

## Consuming a Promise

Once we've created a `Promise`, we need to be able to consume it. We can do this using the `then` method, which takes two callback functions: one to handle the fulfillment of the Promise, and one to handle the rejection.

Here is an example of how to consume the `delay` Promise we defined earlier:

```ts
delay(1000)
  .then(() => {
    console.log("Promise fulfilled!");
  })
  .catch((err) => {
    console.error(`Promise rejected: ${err}`);
  });
```

In this example, we're calling the `delay` function with a delay of 1000 milliseconds. We then attach a `then` callback that logs a message to the console when the Promise is fulfilled, and a `catch` callback that logs an error message if the Promise is rejected.

## Chaining Promises

This allows us to write code that executes multiple asynchronous operations in sequence, without getting stuck in callback hell.

To chain Promises, we use the `then` method. When we attach a `then` callback to a Promise, we return a new Promise that will be resolved with the return value of the callback. This allows us to chain multiple `then` callbacks together, with each one receiving the result of the previous callback.

```ts
const add = (x: number) => (y: number) => x + y;

const delayAdd = (x: number, ms: number) => new Promise<number>((resolve) => {
  setTimeout(() => {
    resolve(x);
  }, ms);
}).then(add(x));

delayAdd(1, 1000)
  .then((result) => {
    console.log(Result: ${result}); // Output: Result: 6
})
.catch((err) => {
console.error(Promise rejected: ${err});
});
```

In this example, we've defined two functions: `add`, which takes a number `x` and returns a function that takes another number `y` and returns the sum of `x` and `y`, and `delayAdd`, which takes a number `x` and a delay time in milliseconds and returns a Promise that resolves with the value of `x` after the specified delay time.

We then chain these two functions together using the `then` method. We call `delayAdd` with `1` and `1000`, which returns a Promise that resolves with the value `1` after a delay of 1000 milliseconds. We then attach a `then` callback to the Promise that calls `add(5)` with the result of the previous Promise, which returns a new Promise that resolves with the sum of `1` and `5`. Finally, we attach another `then` callback that logs the result to the console.

Cheers! 🍺
