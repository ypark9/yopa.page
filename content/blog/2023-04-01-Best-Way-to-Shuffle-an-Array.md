---
title: Top Techniques for Efficient Array Shuffling
date: 2023-04-01T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Each element gets a turn to swap places with another random element until everyone has found a new seat."
categories:
  - Programming
  - Algorithm
tags:
  - JavaScript
  - TypeScript
  - Node.js
---

# Best Way to Shuffle an Array: The Fisher-Yates Shuffle Algorithm

Fisher–Yates produces an unbiased shuffle when its random-number source is uniform. It runs in linear time and can be implemented without mutating the input array.

## What is the Fisher-Yates Shuffle Algorithm?

The algorithm walks backward through the array and swaps each element with a uniformly selected element at or before its current position.

## How does it work?

To use the Fisher-Yates shuffle algorithm, follow these simple steps:

1. Start at the last element in the array.
2. Generate a random number between 0 and the current index.
3. Swap the current element with the one at the randomly generated index.
4. Move backwards one index in the array and repeat steps 2-3 until you reach the first element.

And just like that, your array is now jumbled up and ready for action! There's no telling what order the elements will be in now, so get ready for some surprises.

## Why should I use the Fisher-Yates Shuffle Algorithm?

Not only is the Fisher-Yates shuffle algorithm a fun and unpredictable way to shuffle your arrays, but it's also mathematically sound. Each element in the array has an equal chance of ending up in any position, so you don't have to worry about any pesky biases or patterns.

Do not use `array.sort(() => Math.random() - 0.5)`, which does not produce a reliable uniform shuffle. The example below uses `Math.random`, so it is suitable for ordinary UI behavior and simulations, not cryptographic selection, gambling, or security tokens. Those cases require a cryptographically secure random source and domain-specific review.

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

Next, we iterate over the elements of the shuffledArray in reverse order using a for loop. For each iteration, we generate a random index j between 0 and the current index i using the formula Math.floor(Math.random() \* (i + 1)).

We then swap the element at index i with the element at index j using destructuring assignment, which avoids the need for a temporary variable. By the end of the loop, all the elements of the shuffledArray will have been swapped around randomly, resulting in a shuffled array.

Finally, we return the shuffledArray from the function, and log it to the console to verify that it has been shuffled properly.

</details>

## Get Shufflin'!

Fisher–Yates is a sound default for ordinary array shuffling. Select the randomness source according to the risk of the application.
