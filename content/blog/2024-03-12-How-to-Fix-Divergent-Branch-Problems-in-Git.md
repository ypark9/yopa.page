---
title: How to Fix Divergent Branch Problems in Git - A Step-by-Step Guide.
date: 2024-03-12
author: Yoonsoo Park
description: "An in-depth guide to understanding and resolving the 'divergent branches' issue in Git, focusing on different reconciliation strategies."
categories:
  - Version Control
tags:
  - Git
  - GitHub
  - Version Control
  - Programming
---

![Git Branching](images/github-watching-you.webp)

When working with Git, you might encounter a situation where your branches have diverged, leading to confusion and potential merge conflicts. This blog post will delve into what causes divergent branches in Git and how to reconcile them effectively.

## Understanding Divergent Branches in Git

Divergent branches occur when your **local branch and the corresponding remote branch have different commits**. This situation typically arises when multiple people are working on the same branch or when changes are made to the remote branch after you've cloned or fetched it but before you try to push your local changes.

When you attempt to `git pull`, Git may show a message indicating that you have divergent branches and need to specify how to reconcile them. This is because Git wants to prevent unintentional loss of work and ensure that you are making a conscious decision about how to integrate the changes.

## Strategies to Reconcile Divergent Branches

There are three main strategies to reconcile divergent branches in Git:

### 1. Merge

Merging is the most straightforward approach. It combines the histories of the two branches, creating a new merge commit. This approach maintains the full history of both branches but can lead to a more complex commit history.

```bash
git config pull.rebase false
git pull origin <branch-name>
```

### 2. Rebase

Rebasing rewrites the commit history by applying your local changes on top of the remote branch's latest commit. It results in a cleaner, linear history but should be used with caution as it changes commit hashes.

```bash
git config pull.rebase true
git pull origin <branch-name>
```

<details>
<summary>The Significance of the Rebase Warning</summary>

The warning "but should be used with caution as it changes commit hashes" during a rebase is crucial to understand. When you rebase a branch, Git essentially creates new commits for each commit in your branch since it diverged from the base branch. This process changes the commit hashes, which are the unique identifiers for each commit.

#### Why is this Important?

- **Collaboration Impact**: If you've already pushed your branch and then rebase it, the rebased branch will not align with the remote branch since the commit hashes have changed. If someone else is working on the same branch, they will encounter conflicts when they try to pull your changes.

- **Data Integrity**: Changing commit hashes can also impact any references to those commits, such as in submodules, or when using commit hashes in documentation or issue tracking.

- **Force Pushing**: After a rebase, you'll need to force push (`git push --force`) to update the remote branch with the rewritten history. Force pushing can be risky as it can overwrite changes on the remote branch, so it should be done with caution and clear communication among team members.

</details>

### 3. Fast-forward only

The fast-forward only approach refuses to merge if the local branch has diverged from the remote branch, ensuring that your history only ever moves forward linearly from the base.

```bash
git config pull.ff only
git pull origin <branch-name>
```

## Setting a Default Reconciliation Strategy

You can set your preferred strategy globally or per repository, providing flexibility and control over your project's version control strategy.

```bash
# Set globally
git config --global pull.rebase false

# Set for a specific repository
git config pull.rebase false
```

You can set this setting globally by adding `--global` to the git config command, but it's generally safer to set them **per-repository** (which I prefer) unless you are certain about this.

## Conclusion

Understanding how to manage divergent branches in Git is critical for maintaining a clean workflow in your development. By choosing the appropriate strategy to reconcile branches, you can ensure that your project's history is manageable, reducing potential integration headaches down the line. (ultimate goal!)

## Wrapping it up 👏

Whether you prefer merging, rebasing, or fast-forwarding, Git provides the ways you need to maintain a consistent history in your version control.

Cheers! 🍺
