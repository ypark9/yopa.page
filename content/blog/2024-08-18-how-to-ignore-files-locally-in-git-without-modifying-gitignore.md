---
title: How to Ignore Files Locally in Git Without Modifying .gitignore
date: 2024-08-18
author: Yoonsoo Park
description: Learn how to extend your .gitignore file for local use without affecting the shared repository
categories:
  - Git
  - Version Control
tags:
  - gitignore
  - local development
---

> Learn how to extend your .gitignore file for local use without affecting the shared repository

[Git Documentation](https://git-scm.com/docs)

Have you ever needed to ignore certain files or directories in your Git project, but didn't want to modify the shared .gitignore file? Perhaps you have some local development files or personal IDE settings that you don't want to track, but also don't want to burden your team with. There's a simple solution for this: the .git/info/exclude file.

## Using .git/info/exclude

The .git/info/exclude file works just like .gitignore, but it's not tracked by Git. This means you can add custom ignore rules that apply only to your local repository without affecting other team members or the remote repository.

Here's how to use it:

1. Navigate to your project's root directory.
2. Open the .git/info/exclude file in your favorite text editor. If it doesn't exist, create it.
3. Add your custom ignore rules to this file, one per line.

For example, you might add:

```
# Ignore local development environment file
.env.local

# Ignore personal IDE settings
.vscode/

# Ignore a specific local directory
local_scripts/
```

These rules will apply only to your local repository and won't be committed or pushed to the remote repository.

## Benefits of Using .git/info/exclude

- Keeps your personal ignore rules separate from the project's shared rules.
- Avoids cluttering the shared .gitignore file with personal preferences.
- Prevents conflicts that might arise from different team members having different ignore needs.

## When to Use .gitignore vs .git/info/exclude

- Use .gitignore for ignore rules that should apply to all copies of the repository.
- Use .git/info/exclude for personal ignore rules that are specific to your local setup.

By leveraging .git/info/exclude, you can maintain a clean and personalized local Git environment without affecting your team's workflow. It's a simple yet powerful feature that every Git user should know about.

Cheers! 🍺
