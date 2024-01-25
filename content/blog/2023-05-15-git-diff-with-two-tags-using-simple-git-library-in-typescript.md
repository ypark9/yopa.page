---
title: git diff with Two Tags using simple-git TypeScript
date: 2023-05-15T01:25:00-04:00
author: Yoonsoo Park
description: "git diff with Two Tags using simple-git"
categories:
  - git
tags:
  - simple-git
---

## Performing Git Diff with simple-git

First, make sure you have the simple-git library imported in your TypeScript file:

```typescript
import simpleGit, { SimpleGit, DiffResult } from "simple-git";
```

Create a function that will perform the `Git diff` operation between two tags. The function should accept the tag names as parameters and return a promise that resolves to the diff output string.

```typescript
async function getGitDiff(tag1: string, tag2: string): Promise<string> {
  const git: SimpleGit = simpleGit();

  const diff: DiffResult = await git.diff([`${tag1}..${tag2}`]);
  return diff.diff;
}
```

In the above code, we use the simpleGit function from the `simple-git` library to instantiate a new `SimpleGit` object. Then, we call the diff method with the tag range specified as `${tag1}..${tag2}`. This will retrieve the diff result as a `DiffResult` object, from which we extract the `diff` property containing the actual `diff output`.

Now you can call the getGitDiff function and retrieve the diff output between two tags:

```typescript
const tag1: string = "v1.0.0";
const tag2: string = "v1.1.0";

const diff: string = await getGitDiff(tag1, tag2);
console.log(diff);
```

## Use case: clone the repo to local drive then perform git diff

```typescript
import simpleGit, { SimpleGit, DiffResult } from "simple-git";
import * as fs from "fs-extra";

async function gitDiff(
  repositoryUrl: string,
  tag1: string,
  tag2: string
): Promise<void> {
  const git: SimpleGit = simpleGit();

  const tempDir = "./temp-repo";

  // Delete the temporary directory if it exists
  if (fs.existsSync(tempDir)) {
    console.log("tempDir exists, removing it");
    await fs.remove(tempDir);
  }

  // Create a new empty temporary directory
  console.log("creating tempDir");
  await fs.mkdir(tempDir);

  // Clone the repository from the provided URL
  await git.clone(repositoryUrl, "./temp-repo");

  // Change the working directory to the cloned repository
  git.cwd("./temp-repo");

  // Perform the 'git diff' operation
  let diff: string = "";
  try {
    diff = await git.diff([`${tag1}..${tag2}`]);
    console.log("diff", diff);

    // Rest of the code...
  } catch (error) {
    console.error("An error occurred while performing git diff:", error);
  }

  // Remove the temporary repository
  console.log(diff);
  await fs.remove(tempDir);
}
```

Cheers! 🍺
