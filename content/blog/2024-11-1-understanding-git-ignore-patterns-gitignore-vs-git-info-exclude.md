---
title: Understanding Git Ignore Patterns - .gitignore vs .git/info/exclude
date: 2024-11-02
author: Yoonsoo Park
description: Learn when to use .git/info/exclude instead of .gitignore for managing ignored files in Git, with practical examples and use cases
categories:
  - Git
  - Development Tools
tags:
  - git
  - source control
  - development workflow
---

> Learn when to use .git/info/exclude instead of .gitignore for managing ignored files in Git, with practical examples and use cases

[Git Documentation](https://git-scm.com/docs/gitignore)

When working with Git, we often need to specify files and directories that should be ignored by source control. While `.gitignore` is the most commonly used method, Git provides another powerful but lesser-known option: `.git/info/exclude`. Let's explore both approaches and understand when to use each one.

## The Traditional Approach: .gitignore

The `.gitignore` file is the standard way to specify which files Git should ignore. It's:

- Committed to the repository
- Shared with all collaborators
- Part of the project's source control
- Ideal for project-wide ignore patterns

## The Hidden Gem: .git/info/exclude

`.git/info/exclude` serves a similar purpose but with some key differences. This file:

- Lives inside the `.git` directory
- Is not committed to the repository
- Remains local to your machine
- Doesn't affect other collaborators

## When to Use .git/info/exclude

Here are several scenarios where using `.git/info/exclude` makes more sense than `.gitignore`:

1. **Personal IDE Settings**

   - You use a different IDE than your team
   - Example: Ignoring VSCode settings while others use IntelliJ

   ```
   .vscode/
   ```

2. **Local Development Tools**

   - You have specific development tools that others don't use
   - Example: Local debugging tools or profilers

   ```
   debug-tools/
   my-profiler.log
   ```

3. **Machine-Specific Build Outputs**

   - Custom build directories that vary by developer

   ```
   my-custom-build/
   local-dist/
   ```

4. **Personal Test Files**

   - Test files you create for local experimentation

   ```
   my-test-*.js
   scratch/
   ```

5. **Temporary Working Files**
   - Files you generate during development but don't want to share
   ```
   temp-*.txt
   working-draft/
   ```

## Real-World Example

Let's say you're working on a Node.js project where:

- The team uses `.gitignore` for common patterns:
  ```
  node_modules/
  dist/
  .env
  ```

But you personally:

- Use VSCode for debugging
- Have a custom build script
- Keep local notes

Instead of polluting the project's `.gitignore`, you can add to `.git/info/exclude`:

```
# Personal IDE
.vscode/
launch.json

# Custom build output
my-build/
build-*.log

# Personal notes
dev-notes.md
TODO.txt
```

## Benefits of Using .git/info/exclude

1. **Clean Repository**

   - Keep the project's `.gitignore` focused on truly project-wide patterns
   - Avoid cluttering with personal preferences

2. **No Conflicts**

   - Your ignore patterns won't conflict with other developers' workflows
   - No need for team discussions about personal ignore patterns

3. **Flexibility**

   - Easily modify ignore patterns without creating commits
   - Experiment with different tools without affecting the team

4. **Privacy**
   - Keep your working methods private
   - Don't expose personal tools or workflows

## Best Practices

1. Use `.gitignore` for:

   - Project-wide ignore patterns
   - Framework-specific files
   - Common development artifacts

2. Use `.git/info/exclude` for:
   - Personal tooling
   - Local development artifacts
   - Machine-specific patterns
   - Temporary working files

## Creating and Editing .git/info/exclude

To start using `.git/info/exclude`:

```bash
# Open the file in your default editor
git config core.editor "code" # If using VSCode
git config core.excludesfile .git/info/exclude

# Or edit directly
vim .git/info/exclude
```

Remember that the syntax is identical to `.gitignore`, so all your existing knowledge transfers over.

## Conclusion

While `.gitignore` remains the primary tool for specifying ignore patterns in Git, `.git/info/exclude` provides a valuable complement for managing personal ignore patterns. By understanding and using both tools appropriately, you can maintain a cleaner repository while accommodating individual development workflows.

Cheers! 🍺
