---
title: "I Built an Agent-to-Agent Messaging Loop. Then I Deleted It."
date: 2026-08-10T09:00:00-04:00
author: Yoonsoo Park
description: "A retrospective on building a file-based coordination channel that let two coding-agent sessions ping-pong to convergence, and why the right move a few months later was to deprecate it."
categories:
  - AI
tags:
  - ai-agents
  - coding-agents
  - orchestration
  - engineering-judgment
---

Some of the code I'm proudest of building is code I later deleted. This is one of those stories. I once wrote about [designing multi-agent systems only when one agent is not enough](/blog/2025-12-12-designing-robust-multi-agent-systems.html); this is the story of me breaking that rule myself and paying for it.

## The problem: two sessions, one human courier

I run coding-agent sessions in separate terminals, each scoped to a different part of a system. One session sees a backend service. Another session works on the frontend that consumes that backend's API. They need to talk: when the backend session changes a route or a field name, the frontend session has to know, and vice versa.

The way this worked at first was embarrassingly manual. I was the courier. One session would produce a structured block ("here are the 5 things the other side must change: route X now takes an ID path segment, field Y renamed to Z..."), and I would copy that block and paste it into the other terminal. Then the reply came back the same way. I was a human message bus, shuttling clipboard contents between two agents that could not see each other.

## What I built: a self-converging ping-pong loop

So I automated the courier. I built a file-based handoff channel: a message was a markdown file with YAML frontmatter (from, to, status, subject) and a body, mirror-written into both a sender outbox and a receiver inbox so both sessions saw the same thing. Status moved open then acked then resolved, which stopped an automated loop from re-processing the same message forever.

On top of that channel I built the part I actually liked: an auto-convergence loop. Each session set the same shared goal, and then the two of them ping-ponged without me. The loop engine re-fed an iteration prompt every time a session tried to end its turn, and each iteration did the same procedure: check the inbox, do any actionable work, send the peer anything they now had to handle, flag your own side done, then check whether the shared goal was complete. Completion was an AND-gate: every participant flagged done and every inbox clear of open messages.

I did not stop there. I added a stall counter that fingerprinted all the inboxes and, if nothing changed for N iterations, broke the loop and surfaced it to me instead of spinning forever. I added peer-visible states so a session that hit an external blocker (a deploy is needed, a PR must merge) could park itself as `blocked` and the peer would see `PEER-BLOCKED` and stop instead of idle-spinning. There was `abort` for a deliberate give-up and `resume` for coming back. It was, honestly, a tidy little distributed-systems state machine.

It worked. The two sessions converged on real cross-repo work without me copy-pasting a single block.

## Why I deprecated it anyway

A few months later I looked at the usage and it was dead. The last real convergence had happened once, early on, and nothing had touched it since. That is the first and bluntest signal: a thing you built for automation that nobody (including you) reaches for is not load-bearing. But dead-by-disuse is a symptom, not the diagnosis. Two things had quietly made it redundant.

### Reason 1: a single orchestrator beats peer ping-pong

The ping-pong design assumes there is no one in charge. Two peers negotiate to convergence because neither is the boss. But in practice I almost always *did* have a boss available: one orchestrator agent that could spawn the worker sessions itself, read each result, and decide the next step.

Once you have a supervisor, the entire self-converging machinery is redundant. You don't need a stall counter, because the supervisor notices a session that returned nothing. You don't need peer `blocked`/`abort`/`resume` states, because the supervisor is the one who decides to wait, retry, or give up. You don't need an AND-gate on distributed flags, because the supervisor knows when it is done. The state machine I was proud of was solving a coordination problem I had mostly designed away by having a single driver.

The lesson lands hard: peer-to-peer auto-convergence is the expensive shape. Reach for it only when there is genuinely no orchestrator. If one agent can hold the plan and drive the others, that is simpler, more debuggable, and easier to interrupt.

### Reason 2: the platform grew the feature

The second reason is the one that should keep every tool-builder humble. Claude Code shipped native cross-session messaging. One session can now list the other sessions it can reach and send a message straight to one of them, no file channel, no courier, no plugin.

I want to be precise about what it does and does not replace, because this is where honesty matters more than a clean narrative. The native feature is real and it is on by default in recent versions, but it reaches *same-machine* sessions over a per-session socket. Sessions on different machines can only reply to a message, not start one. And a session inside a container and a session on the host cannot message each other at all, because they see different filesystems. So it is not a drop-in replacement for cross-host or cross-container coordination. What it *does* cleanly replace is exactly the case that started this whole thing: two sessions in two terminals on one machine, with a human copy-pasting between them. That courier is now a platform primitive.

## What actually survives: a decision, not a tool

So I did not delete anything in a rage. I marked the loop deprecated, left the implementation in place for anything mid-flight, and put a banner on every surface that advertised it. Deprecation is a message to future-me as much as a code change.

Here is the decision tree I would give myself before building something like this again:

- **One agent can hold the plan and drive the rest?** Use a single orchestrator. Spawn workers, read results, decide next step. No coordination protocol needed. This is the default and it is right far more often than it feels.
- **Two peer sessions on the same machine need to trade findings, with a human around?** Use the platform's native cross-session messaging. Do not build a channel.
- **Sessions genuinely cannot reach each other (different machines, a container and its host) and there is no orchestrator?** Only now do you need something like what I built. And even then, build the smallest possible primitive: a message with a status, not a self-converging state machine with stall detection and peer-lifecycle states.

I over-built. I added stall counters and peer-lifecycle states for a self-organizing swarm, when the actual job was almost always "one boss, some workers." Coordination primitives are seductive to build because they feel like real distributed systems, and that is exactly the trap.

The harder skill, the one I'm still practicing, is deleting your own scaffolding when the ground shifts under it. The platform caught up. My clever channel became a maintenance liability and a second, worse way to do a thing the platform now does natively. Keeping it out of attachment to the code I wrote would have been the actual mistake.

Build the minimum coordination primitive. Prefer a supervisor to a swarm. And when the platform grows the feature you hand-rolled, have the discipline to tear out your own version. The code you delete cleanly is worth as much as the code you write. If you want to reason about which coordination pattern to reach for in the first place, my post on [designing multi-agent systems only when one agent is not enough](/blog/2025-12-12-designing-robust-multi-agent-systems.html) is the companion to this one. This piece is what it costs when you get that decision wrong.
