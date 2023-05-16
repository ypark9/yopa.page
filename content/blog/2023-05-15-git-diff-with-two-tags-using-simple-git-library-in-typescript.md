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
import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
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
const tag1: string = 'v1.0.0';
const tag2: string = 'v1.1.0';

const diff: string = await getGitDiff(tag1, tag2);
console.log(diff);
```

## What if you want to perform git diff on a remote Git repository?
To run the Git diff operation on a remote Git repository, you will need to provide the necessary credentials and repository information to the `simple-git` library. Here's an updated version of the code that includes the steps to run the diff on a remote repository:

```typescript
import simpleGit, { SimpleGit, DiffResult } from 'simple-git';

async function getGitDiff(tag1: string, tag2: string): Promise<string> {
  const git: SimpleGit = simpleGit({
    baseDir: '/path/to/repository', // Specify the local path to the Git repository
    binary: 'git', // Path to the Git executable if it's not in the system's PATH
  });

  await git.fetch(); // Fetch the latest changes from the remote repository

  const diff: DiffResult = await git.diff([`${tag1}..${tag2}`]);
  return diff.diff;
}

const tag1: string = 'v1.0.0';
const tag2: string = 'v1.1.0';

const diff: string = await getGitDiff(tag1, tag2);
console.log(diff);
```

Cheers! 🍺
