---
title: "Late vs. Early Binding for Agent Composition: Who Owns the Runtime Decides"
date: 2026-08-19T09:00:00-04:00
author: Yoonsoo Park
description: "When you run agents at scale, deciding what an agent is (its tools, persona, prompt, delegation backends) is a binding-time question. Whether you can bind late or must bind early is not a matter of taste. It is forced by whether you own the runtime."
categories:
  - AI
tags:
  - ai-agents
  - coding-agents
  - agent-architecture
  - runtime-design
---

If you run more than one agent for more than one kind of task, sooner or later you hit the same question: *what is this agent, exactly?* Its tools, its persona, the sections of its system prompt, the backends it can delegate to. Somewhere in your system, that composition gets decided. The interesting question is not *what* it is. It is *when* it gets decided, and who gets to change it.

This is a binding-time problem, and I want to argue something narrow: whether you can bind an agent's composition *late* or are stuck binding it *early* is not a design preference you get to make. It is forced on you by whether you own the runtime. If you have built any kind of agent tooling, this framing will save you an argument with yourself.

If you have read my [post on multi-agent systems](/blog/2025-12-12-designing-robust-multi-agent-systems.html), this is the layer underneath that: before you decide how many agents you need, you decide how each one is composed and when.

## The two binding times

Composition can happen at two moments, and the gap between them is the whole story.

```
Late binding   Composition is assembled per session, at session start.
               One process serves many sessions, each a different agent.
               Change the composition and the next session picks it up;
               running sessions keep what they were built with.

Early binding  Composition is projected onto a target once, at setup time,
               as files, symlinks, and hooks written into a checkout.
               To change it you re-run setup. The target carries no
               machinery to swap itself mid-flight.
```

Late binding feels obviously nicer. One long-lived process, a registry of compositions, and each session mounts the one it needs. Switch a session's identity without restarting anything. Compose a benchmark-minimal agent next to a full coding agent in the same process. It reads like the grown-up version of the design.

Early binding feels primitive by comparison. You decide the composition when you wire the target up, you stamp it into place, and if you want something different you wire it up again. No live swapping, no per-session identity, no registry of mountable parts.

So why would anyone choose early binding? They usually do not choose it. It is what is left when late binding is not on the table.

## What actually forces the choice

Late binding requires a place to mount a composition *into*. Concretely: a running process with a scope or layer system where a subtree of tools, prompt sections, and delegation backends can be plugged in for the duration of a session and unwound when the session ends. That mounting point is a property of a runtime you control.

If you own the runtime, you can build that seam. You decide what a session is, what a registry is, where a composition attaches, and when it detaches. Late binding is an option because the machinery to bind is yours to place.

If you do not own the runtime, there is no seam to mount into. Consider the case I know best: I built a tool that orchestrates context and configuration *for other people's coding agents*. It does not run the agents. It has no process serving their sessions, no registry of their tools, no layer where I could plug a composition in at session start. The agents boot themselves, read their own config, and load their own tools by their own rules.

In that position, the most you can do is *render* a composition and *place* it where the agent will look: write the config file, drop the hooks, lay down the symlinks, stamp a marker into the checkout. That is early binding, and it is not a limitation of my imagination. It is the ceiling imposed by not owning the thing that binds.

I learned this the expensive way. I once tried to make that orchestrator agent-agnostic, so a Claude-style agent and a different vendor's agent could share the same setup. I got the context files to render into both formats and thought I was most of the way there. I was not. The context markdown was the easy part. The hard part, the part that actually decides what each agent *is* at runtime, was the hook and settings contract, and that contract belongs to each agent's own runtime. Rendering the same document into two filenames gave me two files and zero shared behavior. I reverted the whole thing and split the vendors into separate tooling instead.

The lesson generalized into one line I now trust: **you can only bind late inside a runtime you own. Everywhere else, early binding is the ceiling, and the shared artifact is a rendered document, not live behavior.**

## Late binding is not free either

Owning the runtime unlocks late binding. It does not make late binding cheap. The moment composition becomes per-session and mountable, a set of costs shows up that early binding never had to pay. These are worth knowing *before* you build the seam, because they are easy to miss when the design still looks elegant on paper.

- **Nothing disposes a composition unless you make it.** Per-session mounting means per-session allocation, and if teardown is not wired as carefully as setup, every session you ever served stays resident. The elegant design leaks memory one session at a time. Idle eviction is not a nice-to-have you add later. It is part of the seam.
- **Resume has to rebuild the original composition, not today's default.** A session created last week under one composition, resumed today after you changed the default, must come back as *what it was*, not as *what the default now is*. That means recording the composition identity as a session fact and resolving it on resume, reading through to the live value rather than trusting a snapshot. Get this wrong and a resumed session silently runs a different agent than the one that produced its history.
- **A composition must not be allowed to mount into itself.** The seam that plugs a subtree into a session's scope has to refuse the case where the target is the mount point itself. Self-targeting is its own failure class, and a generic "is this wired correctly?" check will happily pass a thing that is wired correctly into the wrong place.
- **Authoring a composition is a privileged act.** A composition names the code a session will run. Reading one is reconnaissance; writing one is arbitrary capability. Editing compositions cannot be an ordinary, unguarded operation exposed to anything that can start a session. It needs to be pinned and treated as the escalation it is.

None of these bite early binding, because early binding has no live seam to leak through, no running session to resume into a stale identity, no mount point to target itself. Early binding pays for its rigidity by having almost nothing that can go wrong at runtime. That is the trade you are actually making.

## A decision guide

The framing collapses into a short sequence.

1. **Do you own the runtime that serves the sessions?** If no, stop here. You are binding early whether you like it or not. Spend your effort making the rendered artifact clean and making re-setup cheap, not chasing a live-swap you cannot build. If your goal is to support multiple agent vendors, accept that the shared thing is a rendered document, and that each vendor's runtime contract is separate work.
2. **If yes, do you actually need per-session variation?** If every session wants the same agent, you do not need late binding even though you could build it. A process-level composition fixed at boot is simpler and has none of the lifecycle costs above. Reach for late binding when different sessions genuinely need to be different agents inside one process.
3. **If you are building the seam, budget the four costs up front.** Disposal, resume-rebuild, self-target refusal, privileged authoring. They are not polish. They are the price of the elegance, and the memory leak in particular is the one that ships silently and bills you later.

## What to actually do

Stop treating late binding as the obviously correct target and early binding as the thing you settle for. They are answers to different constraints, and the constraint that selects between them is ownership of the runtime, not the sophistication of your design.

If you own the runtime and you have real per-session variation, build the seam, and build the teardown in the same breath you build the setup. If you do not own the runtime, do not spend a month trying to fake a mount point that cannot exist. Render a clean artifact, make setup idempotent and fast, and put your cross-vendor effort where the actual difficulty lives, which is each runtime's own hook and settings contract.

The prettier abstraction is not always available to you. Knowing which one your ownership boundary permits is the first design decision, and most of the pain I have seen came from people making the second decision before the first.

If your next question is how these composed agents should talk to each other once they are running, that is a separate problem, and I wrote about one concrete mechanism in [cross-session messaging between agents](/blog/2026-08-10-claude-code-cross-session-messaging.html).
