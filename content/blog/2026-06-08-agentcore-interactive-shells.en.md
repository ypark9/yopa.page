---
title: "Interactive Shells in Bedrock AgentCore Runtime — The Debugging Blind Spot Just Closed"
date: 2026-06-08T02:30:00-04:00
author: Yoonsoo Park
description: "Amazon Bedrock AgentCore Runtime now lets you attach a real PTY-backed terminal to a live agent session over WebSocket. Here's why running agents as VPC containers made debugging a black box, what the new InvokeAgentRuntimeCommandShell API actually changes, and how to decide when to enable it — and when to lock it down."
categories:
  - AWS
  - Bedrock
tags:
  - bedrock
  - agentcore
  - debugging
  - observability
  - security
---

If you run agents on Bedrock AgentCore Runtime, you already know the shape of the problem. Your agent isn't a Lambda you can re-invoke locally — it's a Docker container living in a private VPC subnet, holding session state you can't see, talking to an MCP gateway and a memory store you can only observe through logs. When a session misbehaves, your entire toolbox has been: *tail CloudWatch and guess.*

In June 2026, AWS [closed that gap](https://aws-news.com/article/2026-06-05-amazon-bedrock-agentcore-runtime-introduces-interactive-shells-for-terminal-access-into-agent-sessions): AgentCore Runtime now supports **interactive shells** into running agent sessions, via a new `InvokeAgentRuntimeCommandShell` API. You can attach a real terminal to a live session and look around.

This sounds like a developer-experience footnote. For anyone running agents as containers, it's the difference between forensics-by-logfile and walking into the room.

## Why this was a black box

The thing that makes AgentCore Runtime good in production is the same thing that made it opaque to debug:

- The agent runs as a **container in a private subnet** — no public ingress, no SSH, no direct reach.
- Session state lives **inside the running process**: environment variables, working directory, in-memory context, whatever the agent has loaded.
- Everything you knew about a session came **after the fact**, from logs — and only what you remembered to log.

So when a tool call silently failed, or a cross-account role assumption didn't fire, or the wrong context got injected into a session, you couldn't go *look*. You added log lines, redeployed, and waited for it to happen again. For a class of bugs that only reproduce under specific session state, that loop is brutal.

## What landed

The new API gives you a persistent, PTY-backed terminal over WebSocket. The headline capabilities:

- **`InvokeAgentRuntimeCommandShell`** — opens an interactive shell into a running agent session.
- Complements the existing **`InvokeAgentRuntimeCommand`** — which runs a single one-shot command and returns.
- **Full terminal features**: colors, tab completion, `Ctrl+C`, terminal resize, automatic reconnect.
- **Persistent state across commands**: environment variables, working directory, and command history survive between commands in the same shell.
- **Reconnectable**: sessions are addressed by a runtime session ID plus a shell ID, so you can drop and re-attach to the *same* shell.
- **Up to 10 concurrent shells** per agent runtime — parallel debugging across sessions.
- Access via the AgentCore CLI: `agentcore exec --it --runtime <runtime-arn>`.

## One-shot vs interactive — pick the right one

The two APIs answer different questions. Don't reach for the interactive shell when a one-shot command would do.

| | `InvokeAgentRuntimeCommand` | `InvokeAgentRuntimeCommandShell` |
|---|---|---|
| Shape | Single command, returns output | Persistent interactive session |
| State | Stateless per call | Env vars / cwd / history persist |
| Transport | Request/response | WebSocket (PTY) |
| Reconnect | N/A | Re-attach by session + shell ID |
| Best for | Scripted checks, CI probes, "is X set?" | Live exploration, multi-step investigation |

If you're scripting a health check or a deterministic probe, `Command` is cheaper and auditable. The shell is for the *I don't know what I'm looking for yet* case.

## When you actually reach for the shell

This isn't an everyday tool. It earns its keep on the bugs that don't reproduce on demand:

- **Verify injected configuration.** Is the runtime actually seeing the gateway URL, memory ID, and account config you think you wired in? `printenv` inside the live session beats reading CDK output and hoping.
- **Diagnose connectivity from inside the network.** The container sits in a private subnet. From the shell you can `curl` the MCP gateway endpoint, test a cross-account `sts assume-role`, or confirm a downstream agent (A2A) is reachable — instead of inferring failure from a stack trace.
- **Inspect session context.** In a multi-tenant runtime, "did this session boot with the *right* tenant context?" is a question you've never been able to answer at runtime. Now you can.
- **Parallel investigation.** Ten concurrent shells means you can pin one session, compare against a known-good one, and not lose your place when you step away — the reconnect-by-ID semantics keep the shell alive.

## Pitfalls and the security conversation

A live shell into a running agent is powerful, which is exactly why it's dangerous. Before you enable it, walk through these:

- **A shell into a production agent session is a privilege.** It's interactive code execution inside a process that holds real credentials, real session data, and (in multi-tenant setups) potentially other tenants' context. Treat it like SSH-into-prod, because that's what it is.
- **Gate it with IAM, not goodwill.** The action that opens a shell is distinct from the action that invokes the agent. Grant `InvokeAgentRuntimeCommandShell` (and the one-shot `Command` variant) explicitly, to a small set of principals, and *deny it in production* unless you have a break-glass process. Don't let it ride along on your existing invoke permissions.
- **Default to dev/QA.** The overwhelming majority of the value is in non-prod, where you're chasing reproductions. Enable the shell there freely; in prod, make it an audited, time-boxed exception.
- **Check your CLI version.** `agentcore exec --it` needs an AgentCore CLI build that speaks the new API. Confirm before you plan a debugging session around it.
- **Mind the idle timeout.** Runtimes often carry an idle session timeout (e.g. 15 minutes). A shell holds a session open — know whether your attach resets that clock or races it.

## What you should do

If you run agents on AgentCore Runtime, the move is small and worth making:

1. Add `bedrock-agentcore:InvokeAgentRuntimeCommandShell` (and `InvokeAgentRuntimeCommand`) to a **dev/QA-scoped** IAM policy, attached to your team's debugging principals — not to the agent's own runtime role.
2. Keep it **denied in production** behind a documented break-glass exception.
3. Confirm your AgentCore CLI supports `exec --it`.
4. The next time a session bug won't reproduce, stop adding log lines. Attach, look, and fix.

The pattern shift is the whole story: agent debugging goes from *guess-from-logs* to *walk-in-and-look*. That's worth a one-line IAM change and a guardrail.
