---
title: How to Rename a Git Branch Using the CLI
date: 2023-10-30T01:25:00-04:00
author: Yoonsoo Park
description: "This blog post walks you through the process of renaming a local and remote Git branch using the command-line interface."
categories:
  - Git
  - Development
tags:
  - git
  - branch
  - cli
  - rename
---

## Introduction

Renaming a Git branch may seem like a trivial task, but it can become complex, especially when you've already pushed the branch to a remote repository. In this blog post, we'll go through the steps to rename a local and remote Git branch using the Command-Line Interface (CLI).

## Step 1: Switch to the Branch You Want to Rename

Before you can rename a branch, you need to switch to it. Open your terminal and run the following command:

```bash
git checkout old-branch-name
```

## Step 2: Rename the Local Branch

Once you're on the branch you wish to rename, use the following command to rename it:

```bash
git branch -m new-branch-name
```

The `-m` flag stands for "move," which effectively renames the branch.

## Step 3: Update the Remote Branch

If you have already pushed the branch to a remote repository and you wish to rename it there as well, you'll need to delete the old branch and then push the new one. Here's how you do it:

```bash
git push origin --delete old-branch-name
git push origin -u new-branch-name
```

The `-u` flag sets the upstream, so future `git pull` and `git push` commands on this branch will automatically know which remote branch to interact with.

## Step 4: Update Any Open Pull Requests

If you have any open pull requests that involve the old branch name, remember to update those manually to point to the new branch name.

## Step 5: Inform Your Team Members

Renaming a remote branch is a significant change that can affect all team members who are using the same repository. It's good practice to inform everyone about the change. Team members can update their local branches with the following commands:

```bash
git branch -m old-branch-name new-branch-name
git fetch origin
git branch --unset-upstream
git branch -u origin/new-branch-name
```

Cheers! 🍺
