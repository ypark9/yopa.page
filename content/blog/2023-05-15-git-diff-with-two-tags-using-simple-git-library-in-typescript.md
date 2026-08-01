---
title: git diff with Two Tags using simple-git TypeScript
date: 2023-05-15T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "git diff with Two Tags using simple-git"
categories:
  - git
tags:
  - Git
  - CLI
  - TypeScript
  - Node.js
---

## Repository and reference safety

Treat repository URLs, refs, and output paths as untrusted input. Use a unique temporary directory, pass refs as separate arguments, validate that they resolve to commits, and remove the directory in `finally`. Confirm the installed `simple-git` version because its TypeScript return types have changed across releases.

## Performing Git Diff with simple-git

First, make sure you have the simple-git library imported in your TypeScript file:

```typescript
import simpleGit, { SimpleGit } from "simple-git";
```

Create a function that will perform the `Git diff` operation between two tags. The function should accept the tag names as parameters and return a promise that resolves to the diff output string.

```typescript
async function getGitDiff(tag1: string, tag2: string): Promise<string> {
  const git: SimpleGit = simpleGit();

  await git.revparse(["--verify", `${tag1}^{commit}`]);
  await git.revparse(["--verify", `${tag2}^{commit}`]);
  return git.diff([tag1, tag2]);
}
```

The refs are verified as commits before they are passed as separate `git diff` arguments. Current `simple-git` releases return the textual diff from this overload. Pin the package version and compile the example because older releases exposed different typings.

Now you can call the getGitDiff function and retrieve the diff output between two tags:

```typescript
const tag1: string = "v1.0.0";
const tag2: string = "v1.1.0";

const diff: string = await getGitDiff(tag1, tag2);
console.log(diff);
```

## Use case: clone the repo to local drive then perform git diff

```typescript
import simpleGit from "simple-git";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function gitDiff(
  repositoryUrl: string,
  tag1: string,
  tag2: string
): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "tag-diff-"));
  try {
    await simpleGit().clone(repositoryUrl, tempDir, ["--no-checkout"]);
    const git = simpleGit(tempDir);
    await git.revparse(["--verify", `${tag1}^{commit}`]);
    await git.revparse(["--verify", `${tag2}^{commit}`]);
    return await git.diff([tag1, tag2]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
```

This function is appropriate only when the caller is allowed to clone the supplied repository. Production services should also restrict protocols and hosts, set time and size limits, and avoid logging credentials embedded in a URL.
