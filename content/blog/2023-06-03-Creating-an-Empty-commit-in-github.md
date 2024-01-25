---
title: Creating an Empty Commit in GitHub
date: 2023-06-03T01:25:00-04:00
author: Yoonsoo Park
description: "An Empty Commit in GitHub"
categories:
  - git
tags:
  - Empty Commit
---

When working with Git and GitHub, commits serve as important milestones that capture meaningful changes in your codebase. However, there may be situations where you need to create an empty commit without any actual code changes. (what if you need to trigger a **Semantic Release** by commiting.) Although GitHub's user interface doesn't provide a direct option to create an empty commit, you can achieve this through Git commands.

## Creating an Empty Commit

To create an empty commit, use the following Git command:

```bash
git commit --allow-empty -m "Empty commit"
```

The `--allow-empty` flag allows creating a commit without any changes. The `-m` option is used to provide a commit message. Replace `"Empty commit"` with a meaningful message for your empty commit.

## Pushing the Empty Commit

To push the empty commit to the remote repository, run the following command:

```bash
git push origin <branch-name>
```

Replace `<branch-name>` with the name of the branch where you want to push the empty commit.

## Conclusion

Even though GitHub's user interface doesn't offer a direct option to create an empty commit, you can achieve this by utilizing Git commands. By following the steps outlined in this article, you can successfully create an empty commit and push it to your remote repository. Empty commits can be useful in certain scenarios, such as triggering build processes or signaling specific events in your version control history. Remember to use them judiciously and ensure that your commit history accurately reflects the changes in your codebase.

Cheers! 🍺
