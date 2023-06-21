---
title: How to Delete Unwanted Files from a Pull Request 
date: 2023-06-19T01:25:00-04:00
author: Yoonsoo Park
description: ""
categories:
  - Git
tags:
  - Pull-Request
---

Sometimes, while working on a project and preparing to create a Pull Request (PR), you might realize that there are certain files you accidentally staged for commit. These could be files that don't contribute to the PR's purpose, such as temporary logs, unrequired backups, or any file that you didn't intend to change.

The good news is, Git provides a way to unstage such files before finalizing the PR. Here is a step-by-step guide to help you exclude unwanted files from your PR:

## Prerequisites

Before proceeding, make sure you have:

1. Git installed on your system.
2. Command-line Interface (CLI) terminal available.
3. A working Git repository.

## Steps

### 1. Checkout to the Relevant Branch

The first step is to switch to the branch from which you're going to create the PR. You can do this by using the `git checkout` command followed by the branch name. Replace `pr-branch` with the actual name of your branch:

```bash
git checkout pr-branch
```

### 2. Reset the Unwanted File

Next, we use the `git reset` command to unstage the file we don't want to include in the PR. Replace `/path/to/file` with the relative path of your file from the repository root:

```bash
git reset origin -- /path/to/file
```

### 3. Commit the Changes

After you've unstaged the file, commit the changes:

```bash
git commit
```

This will open a text editor (typically VI/VIM) for you to enter a commit message. Make sure to provide a meaningful message describing why you're making this commit.

### 4. Reset Other Unstaged Changes

If there are other unstaged changes in your repository, you might want to discard those too. You can achieve this by running one of the following commands:

```bash
git checkout -- . # Discard unstaged changes, but keep untracked files
git reset --hard @ # Discard all changes including untracked files
```

Choose the command that suits your situation.

### 5. Push the Changes

Finally, push your changes to the remote repository:

```bash
git push
```

## Wrapping Up

By following these steps, you have now successfully removed the unwanted file(s) from your PR. Remember, Git is a powerful tool, but with great power comes great responsibility. Always double-check your actions before executing commands, especially when discarding changes or altering commit history.

Cheers! 🍺
