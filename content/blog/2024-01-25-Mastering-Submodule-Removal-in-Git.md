---
title: Mastering Submodule Removal in Git
date: 2024-01-25
author: Yoonsoo Park
description: "Step-by-step guide on how to properly remove a submodule from your Git repository, including finding the submodule's path."
categories:
  - git
tags:
  - git
  - Submodules
  - GitHub
---

![oni-aws-bug](images/oni-aws-bug.webp)

In the world of version control, Git submodules are a powerful feature that allows you to keep a Git repository as a subdirectory of another Git repository. This is particularly useful for including libraries or shared resources in your projects. However, there may come a time when you need to remove a submodule, whether it's due to project restructuring, deprecated dependencies, or simply a change in direction. Removing a submodule is not as straightforward as adding one, and it requires careful execution to ensure the integrity of your project. In this post, we'll guide you through the steps to properly remove a submodule from your Git repository.

### Understanding Submodule Path

Before diving into the removal process, it's crucial to understand the concept of the submodule path. The `path/to/submodule` refers to the location of the submodule within your repository's directory structure. It's where the submodule's files reside in relation to the root of your main project.

#### Finding the Submodule Path

To accurately remove a submodule, first, you need to identify its path. You can achieve this in several ways:

1. **List the Submodules:**
   Navigate to the root of your Git repository and list the configured submodules using the command:

   ```bash
   git submodule
   ```

   This will display the submodules along with their paths, providing you with a clear map of where each submodule is located within your project.

2. **Check the `.gitmodules` File:**
   The `.gitmodules` file, which resides in the root of your repository, contains essential information about your submodules. You can find each submodule's path by looking for the `path` key under the `[submodule "<submodule_name>"]` section.

3. **Use File System Tools:**
   If you're aware of specific files or directories within the submodule, utilize the `find` command in Unix-based systems or your file explorer's search feature to locate the submodule's path.

### Steps to Remove a Submodule

Once you've located the path of the submodule, follow these steps to remove it properly:

1. **Edit `.gitmodules`:**
   Open the `.gitmodules` file and delete the section corresponding to the submodule you wish to remove.

2. **Update `.git/config`:**
   Remove the submodule entry from your `.git/config` file by opening the file directly or using the command:

   ```bash
   git config --local --remove-section submodule.<submodule_name>
   ```

3. **Unstage and Remove the Submodule Directory:**
   Execute the following commands to unstage the submodule and remove its directory:

   ```bash
   git rm --cached path/to/submodule
   rm -rf .git/modules/path/to/submodule
   rm -rf path/to/submodule
   ```

4. **Commit and Push the Changes:**
   After removing the submodule, commit your changes with:
   ```bash
   git commit -m "Removed submodule <submodule_name>"
   ```
   Then, push the changes to your remote repository:
   ```bash
   git push
   ```

Removing a submodule involves careful attention to detail to ensure that the repository remains consistent and functional. By following these steps, you can effectively remove a submodule from your Git repository.

Wrapping it up 👏

Submodules are a potent feature in Git, offering a method to include external dependencies or libraries in your projects. However, the need to remove a submodule may arise, and understanding how to do this properly is crucial for maintaining the health and integrity of your repository. Each step in the removal process is significant, from finding the submodule path to pushing the final changes.

Cheers! 🍺
