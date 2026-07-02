---
title: "Where Do You Run Agent-Generated Code? Lambda MicroVMs and the Isolation Tradeoff"
date: 2026-07-02T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda MicroVMs give you Firecracker VM-level isolation with suspend/resume for up to 8 hours. Here's the real decision: when you actually need this versus a Code Interpreter sandbox versus a plain container, and the pitfalls of running code your agent wrote."
categories:
  - AWS
tags:
  - lambda
  - firecracker
  - agentcore
  - security
  - agents
---

If you build agents, you eventually hit the question nobody wants: the model just wrote some code, and now something has to run it. Not your code. Code the LLM generated a second ago, possibly wrong, possibly hostile if a prompt injection got through. Where does that run?

In June 2026 AWS shipped [Lambda MicroVMs](https://aws-news.com/article/2026-06-22-aws-introduces-lambda-microvms-for-isolated-execution-of-user-and-ai-generated-code), a compute primitive built for exactly this. It is worth understanding not because it is new and shiny, but because it forces you to be honest about a tradeoff you were probably ignoring.

## The three things you want and can't all have

When you run untrusted code, you want three properties at once:

1. **Isolation** so a bad process can't read another tenant's data or escape into your infra.
2. **Speed** so the agent doesn't stall for seconds every time it runs a snippet.
3. **State** so a long task can pause, keep its working directory and memory, and resume later.

Historically you picked two. A shared container is fast and stateful but the isolation is a namespace, not a wall. A fresh Firecracker microVM per request is isolated and fast to boot but throws away all state. A full EC2 VM is isolated and stateful but nowhere near instant.

Lambda MicroVMs are AWS's claim that you can now have all three. It's the same Firecracker tech underneath Lambda (the announcement cites 15+ trillion invocations a month), but exposed as a primitive you launch directly.

## What it actually gives you

The concrete capabilities, stripped of marketing:

- **VM-level isolation** for multi-tenant execution, without you managing any virtualization layer.
- **Near-instant launch**, plus suspend and resume for **up to 8 hours**. This is the interesting part. A microVM can hold a paused task, and you resume it later instead of rebuilding context.
- **Images from a Dockerfile**, launched with a dedicated **HTTPS URL** that speaks HTTP/2, gRPC, and WebSockets.
- **Pay for baseline while running**, plus whatever you consume above baseline.

The suspend/resume window is what separates this from "just a fast sandbox." An agent that runs a multi-step task, waits on a human approval, then continues, can now sit in a suspended microVM instead of holding a container open or serializing its whole state to disk and rehydrating.

## The decision: do you actually need this?

This is the part that matters. Reaching for microVM isolation when a lighter option would do is over-engineering. Here's how I'd decide.

| Situation | What to reach for |
|-----------|-------------------|
| Agent runs short, pure-compute snippets you generated and control | A managed Code Interpreter sandbox. Don't build infra. |
| Untrusted / model-generated code, multi-tenant, needs network or filesystem | Lambda MicroVMs. This is the case they built it for. |
| Long task that pauses on human approval then resumes | Lambda MicroVMs, for the suspend/resume window. |
| Trusted code, your own logic, just needs to scale | Plain Lambda or a container. Isolation is already fine. |

The signal that you need real VM isolation is not "I'm running code." It's "I'm running code I did not write, on behalf of tenants who don't trust each other." If that sentence isn't true, a managed sandbox is cheaper and simpler.

## Pitfalls I'd watch for

- **Isolation is not a license to skip input handling.** VM-level isolation stops an escape. It does not stop the agent from cheerfully running `rm -rf` on the data volume you mounted, or exfiltrating a secret you passed in as an env var. Isolation contains blast radius; it doesn't decide what's inside the blast.
- **The 8-hour resume window is a cost trap if you forget about it.** A suspended microVM still bills baseline compute. An agent that suspends tasks and never cleans them up is a slow leak. Track and reap suspended VMs like you'd track idle connections.
- **Regional availability is narrow at launch.** N. Virginia, Ohio, Oregon, Tokyo, Ireland. If your agents run elsewhere, this isn't an option yet, and designing around it now means a migration later.
- **HTTPS-URL-per-microVM changes your network model.** Each VM gets its own endpoint. That's convenient, but it's also a lot of ephemeral surface. Front it, log it, and don't let those URLs leak into agent-visible context where a prompt injection could target them.

## What to do

If you run agents that execute code they generated, write down which of the four rows above you're actually in. Most teams are in row 1 or row 4 and don't need a microVM. The teams that genuinely need it, multi-tenant execution of untrusted code with pause/resume, now have a primitive built for the job instead of a pile of Firecracker glue. Pick based on the isolation you actually need, not the isolation that sounds safest.
