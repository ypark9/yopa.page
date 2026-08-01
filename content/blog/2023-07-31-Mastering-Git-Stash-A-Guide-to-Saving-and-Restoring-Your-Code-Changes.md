---
title: Using Git Stash to Save and Restore Work in Progress
date: 2023-07-31T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Learn how to effectively use git stash to save and restore your code changes, enabling smoother workflows."
categories:
    - Git
tags:
  - Git
  - CLI
  - Version Control
  - Developer Workflow
---

## Introduction

`git stash` is one of those Git commands that can be an absolute lifesaver when you're in the middle of a coding session. Imagine you're working on a new feature and suddenly need to switch context—perhaps to a different branch to work on a hotfix. You don't want to commit half-baked code, but you need to save your changes somewhere. Enter `git stash`.

In this article, we'll explore various ways to use `git stash` to your advantage, helping you to save, manage, and restore your code changes effectively.

## Basic Stashing

### Saving Changes

The basic form of the `git stash` command is straightforward. Simply run:

```bash
git stash
```

This command takes your modified tracked files and stages them along with any new files you've indicated with `git add`, and stashes them away for later use.

### Listing Stashes

You can view all your stashes using:

```bash
git stash list
```

This command will show you a list of all the stashes that you've created, making it easier to manage them.

## Advanced Stashing Techniques

### Applying the Latest Stash

You can apply the changes from the most recent stash using:

```bash
git stash apply
```

This command will keep the stash, allowing you to apply the same changes to multiple branches.

### Popping the Latest Stash

Alternatively, you can use:

```bash
git stash pop
```

This will apply the stashed changes and remove them from your stash list.

### Dropping a Stash

If you want to discard a stash, you can use:

```bash
git stash drop stash@{0}
```

This command will remove the specified stash from your stash list.

### Applying a Specific Stash

If you've created multiple stashes, you can specify which stash to apply:

```bash
git stash apply stash@{1}
```

Or, if you wish to apply and remove it from the stash list:

```bash
git stash pop stash@{1}
```

## Handling Conflicts

Just like with merges or rebases, conflicts can occur when you apply or pop a stash. You'll have to resolve these conflicts manually before you can continue your work.

## Conclusion

`git stash` temporarily records tracked changes when a short-lived clean working tree is useful. It is not a durable substitute for a branch or commit. Inspect the stash before applying it and retain it until any conflicts are resolved.

So the next time you find yourself needing to switch tasks but don't want to lose your changes, remember: just stash it!
