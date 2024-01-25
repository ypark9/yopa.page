---
title: Retreive GitHub Pull Requests Code
date: 2023-06-20T01:25:00-04:00
author: Yoonsoo Park
description: ""
categories:
  - git
tags:
  - Pull-Requests
---

When collaborating on a shared repository, it's typical to review pull requests (PRs) made by other contributors. While it's possible to view these PRs through the GitHub web interface, there's an often-overlooked alternative that provides a more thorough review process - reviewing them directly from your local machine via the command line.

## The Advantages of Local Review

By fetching and checking out pull requests locally, you're not just reviewing the code - you're running it on your machine. This ability to execute the code offers a more practical and precise code review. It allows you to explore how the changes interact with the existing codebase, test the code in various scenarios, and identify potential bugs or issues that may not be immediately apparent when reviewing the code on the web interface.

Additionally, developers often find it more comfortable and efficient to read and understand code within their local development environment, as they can leverage familiar tools and configurations.

Without further ado, let's delve into the steps needed to review GitHub PRs locally.

## Step 1: Fetch the PR

Firstly, you need to fetch the PR from the remote repository using this git command:

```bash
git fetch origin pull/PR_NUMBER/head:pr-PR_NUMBER
```

Remember to replace `PR_NUMBER` with the actual number of the PR. For example, if you're fetching pull request #123, the command would be:

```bash
git fetch origin pull/123/head:pr-123
```

## Step 2: Checkout the PR

Having fetched the PR, it's now time to check it out into a new branch with the following command:

```bash
git checkout pr-PR_NUMBER
```

Again, replace `PR_NUMBER` with the actual number of the PR. So, if the PR number was 123, you'd use:

```bash
git checkout pr-123
```

This command switches your working directory to the new branch (`pr-123` in our example), giving you access to the proposed changes.

## Step 3: Review and Run the PR

With the PR branch checked out, you can now proceed with the code review. But now, you have the advantage of being able to actually run the code. This allows you to identify potential runtime errors, understand how the new changes behave under different scenarios, and check the compatibility with your existing codebase.

After a thorough assessment, you're now ready to provide constructive feedback, propose changes, or approve the pull request.

## Conclusion

Although the GitHub web interface is a convenient tool for reviewing PRs, checking them out locally allows for a more comprehensive review process. By fetching and running the changes proposed in a pull request on your machine, you can deliver higher quality feedback and help ensure the stability and efficiency of your shared codebase. After your review, remember to switch back to your original branch and clean up the PR branches to keep your local repo organized.

Cheers! 🍺
