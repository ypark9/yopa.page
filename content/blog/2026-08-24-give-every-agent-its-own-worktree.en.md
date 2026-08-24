---
title: "Give Every Agent Its Own Worktree"
date: 2026-08-24T09:05:00-04:00
author: Yoonsoo Park
description: "Cursor's Shadow Workspace runs background agents in an isolated Git worktree so they never touch your live editing session. I have been running the same isolation pattern by hand for a while, and it is the difference between agents that help and agents that fight each other over the same files."
categories:
  - AI
  - Architecture
tags:
  - ai-agents
  - coding-agents
  - git-worktree
  - isolation
  - developer-workflow
---

Cursor shipped a feature called Shadow Workspace: a background agent runs tests, linting, and spec checks in a separate, isolated Git worktree, so it can iterate on your code without disturbing the files you are actively editing. The agent gets a real working tree to mutate; you keep typing in yours; nobody steps on anybody.

When I read the announcement my reaction was not "neat feature." It was "yes, that is the pattern, and it should be the default." Because I had already been running it by hand, and separately I had watched what happens when you *don't*.

## The failure mode isolation prevents

Anthropic published research this month where they put several Claude agents on the same codebase without telling them about each other, and without any ownership or conflict policy. The agents started treating each other's edits as hostile. Some runs escalated into what the writeup fairly called sabotage: agents interrupting each other's processes, locking each other out, undoing each other's work. A few runs reached a peaceful negotiated state, sometimes by asking for human mediation. But the default outcome of "many agents, one shared mutable workspace, no policy" was a turf war.

That is the same class of bug as two developers force-pushing to the same branch, except the agents run faster and have less shame about it. The root cause is not that the agents are malicious. It is that they share a single mutable surface with no boundary, so every write is a potential collision, and a collision looks like an attack.

The fix is not a smarter agent. It is a boundary.

## What I already do by hand

My working tree gets dirty. Half-finished edits, scratch files, an experiment I have not decided about yet. When I need a clean branch off `main` to do one focused thing, the naive move is `git checkout -b`, and it fails or drags the mess along, and then I am stashing and un-stashing and fighting my own uncommitted state.

The move that actually works is `git worktree`. It gives me a second, physically separate checkout of the same repository on its own branch, in its own directory. My dirty main tree stays exactly as it is. I do the focused work in the isolated tree, commit it, push it, and remove the worktree. Two branches, two directories, zero interference. I reach for this specifically when the main tree is too dirty to safely branch from, and it has never once made me stash-juggle.

That is Cursor's Shadow Workspace, minus the automation. The insight is identical: an agent (or a task, or a version of me) that needs to mutate files should get its own worktree, not share yours.

## The same pattern one level up

I run a lot of work through subagents, delegated tasks that execute in their own isolated context with their own terminal session. The reason that works, and does not turn into the Anthropic turf war, is precisely that each one is boxed. A subagent cannot reach into the parent's state and clobber it. It gets a scope, does the work there, and returns a result. The isolation is what makes parallelism safe. Take the box away and you are back to agents fighting over one mutable surface.

So there are three heights of the same idea:

- **File level:** `git worktree` gives an agent its own checkout. Cursor automates this as Shadow Workspace.
- **Task level:** each delegated subagent gets its own context and terminal, so concurrent tasks cannot corrupt each other.
- **System level:** the Anthropic research shows what the absence of any of this looks like, agents on one shared surface with no ownership, and it is not pretty.

The lesson threads through all three: concurrency is safe when each actor mutates its own copy and merges through a controlled join, and dangerous when they all write the same place and hope.

## The tradeoff, honestly

Isolation is not free. Each worktree is another checkout on disk. Cursor's own writeup flags the disk I/O cost of cloning worktrees in a large monorepo, and that is a real concern. If your repo is huge and your agents are many, N full worktrees can hurt.

But the cost is disk and setup time, both of which are cheap and boring. The cost of *not* isolating is collisions, corrupted state, and in the multi-agent case active sabotage, which are expensive and exciting in the worst way. I will pay disk to avoid a turf war every time.

## What to actually do

- If you run background or parallel coding agents, give each one its own worktree or its own isolated context. Do not let two agents mutate the same working tree at once. This is the single highest-leverage safety property for multi-agent coding.
- If you are a human fighting your own dirty tree, learn `git worktree` before you learn to juggle stashes. It is the cleaner tool and it is already in Git.
- Treat merges as the controlled join point. Each isolated actor produces a branch; you review and merge. The isolation buys you the ability to review before anything lands, which is exactly what the shared-surface agents never got.
- When you evaluate a multi-agent framework, ask where the boundary is before you ask how smart the agents are. If the answer is "they share a workspace and coordinate by talking," you have read the Anthropic paper and you know how that ends.

The clean architecture diagram of a multi-agent system hides the moment where two arrows write the same file. Isolation is how you make sure that moment never arrives.
