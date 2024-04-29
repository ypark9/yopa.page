---
title: How to Fork a Repository, Make Changes, and Update a Submodule in Your Main Project
date: 2024-04-20
author: Yoonsoo Park
description: "Learn how to fork a GitHub repository, make custom changes, and update a submodule in your main project to incorporate these modifications."
categories:
  - GitHub
  - Version Control
tags:
  - git
  - GitHub
  - submodule
  - forking
---

### How to Fork a Repository, Make Changes, and Update a Submodule in Your Main Project

Forking a repository on GitHub allows you to freely experiment with changes without affecting the original project. This is particularly useful in software development where you might want to customize a library, theme, or any other shared project to suit your own needs. In this blog, we will walk through the process of forking a repository, making updates, and then using those changes in a main project by updating a submodule.

#### **Step 1: Forking a Repository**

**Forking** creates a copy of someone else's repository under your GitHub account, allowing you to make changes without impacting the original repo. Here's how to fork a repository:

1. **Navigate to the Repository**: Go to the GitHub page of the repository you want to fork.
2. **Fork the Repository**: Click the "Fork" button usually located at the top right of the page. This action will create a copy of the repository in your GitHub account.

#### **Step 2: Cloning Your Fork**

Once you have forked the repository, you will need to clone it to your local machine to make changes:

1. **Copy the Repository URL**: On your fork’s GitHub page, click the "Code" button and copy the URL provided.
2. **Clone the Repository**: Open a terminal and run `git clone [URL]`, replacing `[URL]` with the repository URL you copied. This downloads the repository to your local machine.

#### **Step 3: Making Changes in Your Fork**

With the repository cloned, you can now navigate into the directory and start making changes:

1. **Navigate to the Repository Directory**: `cd repository-name`
2. **Create a New Branch** (optional but recommended): `git checkout -b your-new-branch-name`
3. **Make Your Changes**: Use your favorite code editor to make the changes you desire.
4. **Commit the Changes**: Use `git add .` to stage changes, and `git commit -m "your commit message"` to save them.

#### **Step 4: Pushing Changes and Updating Your Fork**

After committing your changes locally, you need to push them back to your GitHub fork:

1. **Push the Changes**: `git push origin your-new-branch-name`
2. **Create a Pull Request** (if you want to contribute back to the original repository): Go to your fork on GitHub, switch to your branch, and click "Pull request".

#### **Step 5: Updating a Submodule in Your Main Project**

If your fork is used as a submodule in another project, update your main project to use the latest changes:

1. **Navigate to the Submodule Directory**: `cd path-to-main-project/submodule-directory`
2. **Pull the Latest Changes**: `git checkout main` (or whichever branch you want), then `git pull origin main`
3. **Commit the Submodule Changes in the Main Project**: Navigate back to the root of your main project, then run `git add submodule-directory` and `git commit -m "Update submodule to latest commit"`
4. **Push the Updates**: `git push origin main`

### Removing and Re-Adding a Submodule to Use a Fork in Your Main Project

Sometimes you might find it necessary to replace a submodule in your project with a fork that you have customized. This section will guide you through removing the existing submodule and adding your fork as the new submodule. In this example, we will assume that you have forked the [hugo-tania](https://github.com/WingLim/hugo-tania) theme and want to use it in your project. (the blog you are reading is using this theme).

#### **Step 1: Navigate to Your Main Project**

Ensure you are in the root directory of your main project where the submodule is integrated:

```bash
cd path/to/your/main/project
```

#### **Step 2: Remove the Existing Submodule Reference**

To change the submodule reference, first, remove the existing submodule. This includes deleting the submodule's entries from `.gitmodules`, `.git/config`, and the actual submodule directory:

```bash
git submodule deinit -f themes/hugo-tania
rm -rf .git/modules/themes/hugo-tania
git rm -f themes/hugo-tania
```

#### **Step 3: Commit the Removal of the Submodule**

Commit these changes to ensure your repository correctly reflects the removal of the submodule:

```bash
git commit -m "Remove old submodule reference"
```

#### **Step 4: Add Your Fork as the New Submodule**

Now, add your fork as the new submodule. This step points the submodule reference to your forked repository:

```bash
git submodule add https://github.com/yourusername/hugo-tania.git themes/hugo-tania
```

#### **Step 5: Initialize and Update the Submodule**

After adding the new submodule, initialize and update it to make sure it's correctly set up:

```bash
git submodule update --init --recursive
```

#### **Step 6: Commit the New Submodule Reference**

Once the submodule is added and updated, you need to commit these changes to your project’s repository:

```bash
git add .gitmodules themes/hugo-tania
git commit -m "Update submodule to point to my fork"
```

#### **Step 7: Push Your Changes**

Finally, push the changes to your remote repository to ensure that everything is up-to-date:

```bash
git push origin main
```

This procedure ensures that your main project now uses the updated fork as a submodule, allowing you to benefit from your custom changes or enhancements. This approach is ideal for developers who need to modify dependencies while keeping track of their changes separately from the original submodule source.

Cheers! 🍺
