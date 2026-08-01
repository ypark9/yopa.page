---
title: Safely Remove Unwanted Files from a Pull Request
date: 2023-06-19T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-19-how-to-delete-unwanted-files-from-a-pull-request.html"
author: Yoonsoo Park
description: Remove an accidental file from a pull request by identifying its Git state and making the smallest reversible correction.
categories:
  - Git
tags:
  - Git
  - GitHub
  - CLI
---

Removing a file from a pull request is not one Git operation. The safe command depends on whether the file is untracked, staged, committed, pushed, or intentionally deleted. Treating these states as interchangeable is how unrelated work gets lost.

This guide was verified on 2026-08-01 against the official documentation for [`git status`](https://git-scm.com/docs/git-status), [`git restore`](https://git-scm.com/docs/git-restore), and [GitHub pull requests](https://docs.github.com/en/pull-requests). Run `git status --short` before and after every correction.

## Start with the pull request's actual difference

Fetch the target branch and inspect the merge-base comparison used by a pull request:

```bash
git fetch origin
git status --short
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD -- path/to/file
```

Replace `origin/main` with the PR's real base branch. Three dots compare the merge base with the proposed branch tip; two dots compare two endpoint trees and can include unrelated base-branch movement.

If GitHub CLI is available, `gh pr diff --name-only` is another useful view. Neither command changes files.

## Case 1: the file is only staged

Keep the working copy but remove it from the next commit:

```bash
git restore --staged -- path/to/file
git status --short
```

If the file should never be committed, add an appropriate shared pattern to `.gitignore`, or use `.git/info/exclude` for a personal local-only pattern. Ignore rules do not stop tracking a file that is already committed.

## Case 2: discard an uncommitted edit to a tracked file

Preview it, then restore only that path:

```bash
git diff -- path/to/file
git restore --source=HEAD --worktree -- path/to/file
```

This intentionally discards the path's unstaged change. Copy or stash the file first if any part is worth keeping. Avoid repository-wide `git restore .`, `git checkout -- .`, or `git reset --hard`: their scope is much larger than the stated task.

## Case 3: the unwanted change is already committed

Restore that file from the PR base, then commit the correction:

```bash
git fetch origin
git restore --source=origin/main --staged --worktree -- path/to/file
git diff --cached -- path/to/file
git commit -m "Restore path excluded from this pull request"
git push
```

This preserves published history and makes the correction reviewable. It works whether the PR accidentally modified or deleted the tracked file. If the branch deliberately needs a clean, rebased history, interactive rebase is an alternative, but rewriting pushed commits requires coordination and normally a guarded `--force-with-lease`. It is not the default cleanup method.

## Case 4: remove a file from the project

If the PR is supposed to delete the file, use `git rm` and review the staged deletion:

```bash
git rm -- path/to/file
git diff --cached -- path/to/file
git commit -m "Remove obsolete file"
```

To stop tracking a generated or local file while keeping the working copy, first add the correct ignore rule and then use:

```bash
git rm --cached -- path/to/file
git diff --cached -- path/to/file
```

This is a repository decision because collaborators will also stop receiving that path.

## Forks, generated files, and secrets

For a PR from a fork, push the correction to the same head branch. Creating another branch does not update the existing PR automatically.

Generated lockfiles, snapshots, and migrations should not be removed merely because they are large. Confirm the repository policy and reproduce the generator instead of hand-editing output.

If the file contains a credential, removing it in a later commit does not remove it from Git history. Revoke or rotate the secret immediately, notify the repository owner, and follow GitHub's [sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). History rewriting is a coordinated incident-response action.

## Verification checklist

```bash
git status --short
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD -- path/to/file
```

The final PR diff should contain only intended changes. Run the project's tests, check generated artifacts according to repository policy, and read the web PR once more before requesting review.

When several files are involved, repeat the path-scoped procedure instead of widening the command to the repository root. A sequence of small, named correction commits is easier to review and can be squashed later if the repository prefers a compact history. The important property is observability: before each write, know which Git state will change; after each write, confirm it with `status` and the PR diff. That discipline is more reliable than memorizing one cleanup command.
