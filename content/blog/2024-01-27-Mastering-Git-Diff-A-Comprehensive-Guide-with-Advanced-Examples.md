---
title: Mastering Git Diff: A Comprehensive Guide with Advanced Examples
date: 2024-01-27
author: Yoonsoo Park
description: "Dive deeper into the advanced functionalities of 'git diff' with detailed examples."
categories:
    - git
tags:
    - Git
    - Programming
    - Software Development
---

![oni-github](/images/oni-github-1.webp)

In the realm of version control with Git, understanding the `git diff` command is crucial for developers. This post not only explores the basics but also dives into advanced uses of `git diff`, complete with detailed examples and code blocks for a comprehensive understanding.

## Basic Usage of Git Diff

### **1. Viewing Uncommitted Changes**

`git diff`

This command shows the differences between your working directory and the index (staging area). It's helpful to review changes before staging them.

#### **Example**:

Suppose `file.txt` originally contains "Hello, World!" and you add "New line" to it. Running `git diff` will show:

```sh
diff --git a/file.txt b/file.txt
index ce01362..b6fc4c8 100644
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 Hello, World!
+New line
```

### **2. Viewing Changes That Are Staged for Commit**

`git diff --staged`

This compares your staged changes with the last commit, useful for a final review before committing.

### **3. Comparing Two Files Within the Working Directory**

`git diff -- file1.txt file2.txt`

This compares two local files, showing differences even if they aren't tracked by Git.

## Advanced Usage of Git Diff

### **1. Difference Between Two Branches**

`git diff main..feature-branch`

This shows the changes between the `main` branch and `feature-branch`, useful for reviewing changes before merging branches.

#### **Example**:

Suppose in your `main` branch, you have a file `hello.txt` with "Hello, World!", and in your `feature-branch`, it's changed to "Hello, Git World!". The command `git diff main..feature-branch` will show the differences.

### **2. Difference Between Two Commits**

`git diff <HASH-OLDER-COMMIT>..<HASH-NEWER-COMMIT>`

This is for comparing specific commits, perhaps to understand the changes introduced in a feature branch.

### **3. Diff a File Across Branches or Commits**

`git diff main feature-branch file.txt`

This focuses on how a single file (`file.txt`) differs between the `main` branch and `feature-branch`.

### **4. Diff a File Over Time in the Same Branch**

First step: `git log --before="2023-01-01" --after="2022-01-01" --follow -- file.txt`

Then: `git diff <old-commit-hash>..<new-commit-hash>`

This combination is great for tracking a file's evolution over a specified period.

### **5. Diff a File That Has Been Renamed**

`git diff <old-commit-hash>..<new-commit-hash>`

Git automatically tracks renamed files post Git 2.9, making it easier to see changes to files even after renaming.

## Advanced Features

### **Combining Diffs**

`git diff <commit1>..<commit2>..<commit3>`

This aggregates changes from multiple commits into one view, simplifying code review or audits.

### **Diff with Context**

`git diff --unified=5 <commit1>..<commit2>`

This shows more surrounding lines (context) around changes for better understanding.

### **Word Diff**

`git diff --word-diff <commit1>..<commit2>`

It breaks down the differences to the word level, offering a more granular view.

### **Ignoring Space Changes**

`git diff -w <commit1>..<commit2>`

This ignores white space changes, focusing only on actual content changes.

## Wrapping it up 👏

Understanding `git diff` at both basic and advanced levels empowers developers to effectively track and understand changes in their codebase. Whether it's a quick check of unstaged changes or a detailed comparison of branches, `git diff` proves to be an invaluable tool in the software development lifecycle. A deep dive into `git diff` not only enhances your Git proficiency but also contributes to better collaboration and code quality in your projects.

Cheers! 🍺
