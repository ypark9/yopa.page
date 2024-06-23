---
title: Why `forEach` Cannot Handle Async - A Real-Life Example and Solutions
date: 2024-06-22
author: Yoonsoo Park
description: "Explore why `forEach` is not suitable for handling asynchronous operations and discover how to use `for...of` loops or `map` with `Promise.all` for effective async handling in JavaScript."
categories:
  - JavaScript
  - Async Programming
  - Best Practices
tags:
  - JavaScript
  - Async
  - forEach
---

In JavaScript, handling asynchronous operations can be tricky, especially when dealing with collections of data. One common pitfall is using the `forEach` method for asynchronous tasks. This article explains why `forEach` cannot handle async operations properly and presents solutions using `for...of` loops or the `map` method combined with `Promise.all`.

## The Problem with `forEach` and Async

The `forEach` method is great for iterating over arrays, but it doesn't handle asynchronous operations as you might expect. When you use `forEach` with an async function, it does not wait for the promises to resolve before moving on to the next iteration. This can lead to unexpected behavior and incomplete operations.

### Real-Life Example: Uploading Files

Imagine you are building a file upload feature that processes and uploads multiple files to a server. You might think using `forEach` with an async function is a good approach. Let's see what happens when you do this:

```javascript
async function uploadFiles(filePaths) {
  filePaths.forEach(async (filePath) => {
    const fileContent = await readFile(filePath); // Assume readFile is a function that reads file content
    await uploadToServer(fileContent); // Assume uploadToServer is a function that uploads the file content
    console.log(`Uploaded ${filePath}`);
  });
  console.log("All files uploaded");
}

const files = ["file1.txt", "file2.txt", "file3.txt"];
uploadFiles(files);
```

You might expect to see log messages for each file upload followed by "All files uploaded", but instead, you'll likely see "All files uploaded" before any individual file upload messages. (surprise!) This happens because `forEach` does not wait for the async operations to complete.

## Solution 1: Using `for...of` Loop

A more reliable way to handle asynchronous operations in a loop is using the `for...of` statement. This approach ensures that each iteration waits for the async operations to finish before moving on to the next one.

```javascript
async function uploadFiles(filePaths) {
  for (const filePath of filePaths) {
    const fileContent = await readFile(filePath); // Assume readFile is a function that reads file content
    await uploadToServer(fileContent); // Assume uploadToServer is a function that uploads the file content
    console.log(`Uploaded ${filePath}`);
  }
  console.log("All files uploaded");
}

const files = ["file1.txt", "file2.txt", "file3.txt"];
uploadFiles(files);
```

With this approach, you will see each file upload log message in sequence, followed by "All files uploaded" at the end, as expected.

## Solution 2: Using `map` with `Promise.all`

Another solution is to use the `map` method to create an array of promises and then wait for all of them to resolve using `Promise.all`. This approach is useful when you want to perform async operations in parallel.

```javascript
async function uploadFiles(filePaths) {
  const uploadPromises = filePaths.map(async (filePath) => {
    const fileContent = await readFile(filePath); // Assume readFile is a function that reads file content
    await uploadToServer(fileContent); // Assume uploadToServer is a function that uploads the file content
    console.log(`Uploaded ${filePath}`);
  });

  await Promise.all(uploadPromises);
  console.log("All files uploaded");
}

const files = ["file1.txt", "file2.txt", "file3.txt"];
uploadFiles(files);
```

This code will log the upload messages for each file, potentially out of order, but "All files uploaded" will be logged only after all files have been processed.

## Wrapping it up 👏

Handling asynchronous operations in JavaScript requires careful consideration, especially when dealing with loops. The `forEach` method is not suitable for async tasks because it does not wait for promises to resolve. Instead, use `for...of` loops to handle async operations sequentially or `map` with `Promise.all` to handle them in parallel.

Another day to learn another stuff! Life is wonderful.
Cheers! 🍺
