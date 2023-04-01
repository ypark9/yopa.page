---
title: Best Way to Shuffle an Array?
date: 2023-04-01T01:25:00-04:00
author: Yoonsoo Park
description: "Each element gets a turn to swap places with another random element until everyone has found a new seat."
categories:
  - Programming
  - Algorithm
tags:
  - Shuffle Algorithm
---

# Best Way to Shuffle an Array: The Fisher-Yates Shuffle Algorithm

Are you tired of boring, predictable arrays that always show up in the same order? Do you wish there was a fun and exciting way to randomize your arrays? Look no further than the Fisher-Yates shuffle algorithm, the best way to shuffle an array!

## What is the Fisher-Yates Shuffle Algorithm?

The Fisher-Yates shuffle algorithm, also known as the Knuth shuffle, is a way to randomly shuffle the elements of an array. It's like playing a game of musical chairs with your array elements – each element gets a turn to swap places with another random element until everyone has found a new seat.

## How does it work?

To use the Fisher-Yates shuffle algorithm, follow these simple steps:

1. Start at the last element in the array.
2. Generate a random number between 0 and the current index.
3. Swap the current element with the one at the randomly generated index.
4. Move backwards one index in the array and repeat steps 2-3 until you reach the first element.

And just like that, your array is now jumbled up and ready for action! There's no telling what order the elements will be in now, so get ready for some surprises.

## Why should I use the Fisher-Yates Shuffle Algorithm?

Not only is the Fisher-Yates shuffle algorithm a fun and unpredictable way to shuffle your arrays, but it's also mathematically sound. Each element in the array has an equal chance of ending up in any position, so you don't have to worry about any pesky biases or patterns.

Plus, it's super easy to implement and works for arrays of any size. Why settle for boring old sort functions when you can add some excitement to your code with the Fisher-Yates shuffle algorithm?

## Example

```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

const myArray = [1, 2, 3, 4, 5];
const shuffledArray = shuffleArray(myArray);
console.log(shuffledArray); // [2, 1, 4, 3, 5]
```

<details>
<summary>Explaining the Example</summary>

In this example, we have defined a function called shuffleArray that takes an array of any type and returns a new shuffled array.

We first create a copy of the input array using the spread operator (...) and assign it to the variable shuffledArray. This ensures that the original array remains unchanged.

Next, we iterate over the elements of the shuffledArray in reverse order using a for loop. For each iteration, we generate a random index j between 0 and the current index i using the formula Math.floor(Math.random() * (i + 1)).

We then swap the element at index i with the element at index j using destructuring assignment, which avoids the need for a temporary variable. By the end of the loop, all the elements of the shuffledArray will have been swapped around randomly, resulting in a shuffled array.

Finally, we return the shuffledArray from the function, and log it to the console to verify that it has been shuffled properly.

</details>


## Get Shufflin'!

So go ahead and give the Fisher-Yates shuffle algorithm a try – your arrays will never be the same again! Just remember to always have fun, and don't blame us if your code starts throwing curveballs.

Cheer! 🍺
