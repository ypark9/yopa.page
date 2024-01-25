---
title: Level Up Your JavaScript Skills with Lodash
date: 2023-04-27T01:25:00-04:00
author: Yoonsoo Park
description: "Lodash is a powerful utility library"
categories:
  - JavaScript
tags:
  - Lodash
---

## Lodash

Lodash is a powerful utility library that provides a ton of helpful functions for working with arrays, objects, strings, and more.

You can import the entire library like this:

```javascript
import _ from "lodash";
```

One of the main benefits of Lodash is that it can help you write cleaner, more concise code. Let's take a look at a quick example.

```javascript
// Without Lodash
const numbers = [1, 2, 3, 4, 5];
let sum = 0;
for (let i = 0; i < numbers.length; i++) {
  sum += numbers[i];
}
console.log(sum); // Output: 15

// With Lodash
const sum = _.sum([1, 2, 3, 4, 5]);
console.log(sum); // Output: 15
```

In this example, we're calculating the sum of an array of numbers. Without Lodash, we need to use a `for` loop to iterate over the array and add up each value. With Lodash, we can use the `sum` function, which takes an array as its argument and returns the sum of all the values in the array. This saves us several lines of code and makes the logic much easier to read.

But that's just the tip of the iceberg when it comes to Lodash. Here are some other handy functions you can use:

### map

map creates a new array with the results of calling a provided function on every element in the original array.

```javascript
const numbers = [1, 2, 3, 4, 5];
const doubledNumbers = _.map(numbers, (num) => num * 2);
console.log(doubledNumbers); // Output: [2, 4, 6, 8, 10]

const names = ["Alice", "Bob", "Charlie"];
const nameLengths = _.map(names, (name) => name.length);
console.log(nameLengths); // Output: [5, 3, 7]
```

### filter

filter creates a new array with all elements that pass the test implemented by the provided function.

```javascript
const numbers = [1, 2, 3, 4, 5];
const evenNumbers = _.filter(numbers, (num) => num % 2 === 0);
console.log(evenNumbers); // Output: [2, 4]

const names = ["Alice", "Bob", "Charlie"];
const longNames = _.filter(names, (name) => name.length > 5);
console.log(longNames); // Output: ["Charlie"]
```

### find

find returns the first element in an array that satisfies a provided testing function.

```javascript
const numbers = [1, 2, 3, 4, 5];
const firstEvenNumber = _.find(numbers, (num) => num % 2 === 0);
console.log(firstEvenNumber); // Output: 2

const names = ["Alice", "Bob", "Charlie"];
const longName = _.find(names, (name) => name.length > 5);
console.log(longName); // Output: "Charlie"
```

### orderBy

orderBy sorts an array by one or more properties.

```javascript
const users = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
];
const sortedUsers = _.orderBy(users, ["age", "name"], ["asc", "desc"]);
console.log(sortedUsers);
/*
Output: [
  { name: "Bob", age: 25 },
  { name: "Alice", age: 30 },
  { name: "Charlie", age: 35 }
]
*/
```

Cheers! 🍺
