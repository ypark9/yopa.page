---
title: "AWS Agent Registry Is GA. Do You Still Need to Build Your Own?"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Agent Registry gives you a governed catalog and discovery layer for agents, tools, skills, and MCP servers. The word registry hides three different layers, and only one of them is what AWS just shipped. Here is how to tell which one you actually built."
categories:
  - AWS
  - AI Agents
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - agent-registry
  - governance
  - platform-engineering
---

AWS Agent Registry went generally available on August 31, 2026. It is a private, governed catalog and discovery layer for agents, tools, skills, MCP servers, and custom resources inside your organization. You reach it from the Agent Registry console, the AWS CLI, or the SDK, and you can also discover its records from AgentCore, Amazon Quick, and Kiro without switching context.

If your platform team already stood up something you call a "registry," the announcement lands as an awkward question: did we just rebuild what AWS now hands us for free? I went and compared the GA feature set against the things my org already built. The answer is not "rip yours out." The answer is that the word registry is doing the work of three different systems, and AWS only shipped one of them.

## What AWS Agent Registry actually does

Strip the marketing and it is a **catalog plus discovery** layer:

- Register agents, tools, skills, MCP servers, and custom resources as records.
- Search them by semantic or keyword query, so teams find an existing capability instead of rebuilding it.
- Route records through an approval workflow.
- Audit every action through CloudTrail.
- Provision and manage registries as code with CloudFormation, Terraform, or CDK, and tag records for cost allocation and access control.
- Auto-detect agents on AgentCore runtime and gateways across the org, so records stay current without manual authoring.

That last point is the one that made me stop. Auto-detection means you do not keep the catalog honest by hand. If your agents run on AgentCore, they show up whether or not anyone remembers to register them.

## The three layers the word "registry" hides

Here is the trap. I looked at three different internal systems, and every one of them gets casually called "the registry" in a hallway conversation. They are not the same layer. Watching a coworker point at the AWS announcement and say "isn't this just our agent studio?" is what made the confusion concrete. It is a fair question, and the answer is no, but for a reason worth spelling out.

**Layer 1: the catalog and discovery layer.** "What agents and tools exist, where are they, who approved them, let me search." This is a read-and-find surface. It is exactly what AWS Agent Registry is.

**Layer 2: the config store plus runtime.** "This agent's system prompt, its model, its tool list, its ownership (managed vs custom), and the thing that actually invokes it." This is an agent studio: a place where you author an agent's configuration, store it as the source of truth, and run it. It owns the config and it executes. A catalog can list what a studio produced, but it does not author or run anything.

**Layer 3: the provisioning and governance control plane.** "When this capability registers, create the backing resource: a region-bound model profile, per account, with rollback if any step fails, and a governed compliance record of who signed off." This layer makes infrastructure exist and binds it to a model. No catalog and no studio does this.

Now the confusion is obvious. A studio (layer 2) has a list of agents, so it feels like a registry. A provisioning control plane (layer 3) registers capabilities, so it also feels like a registry. But AWS Agent Registry is layer 1. It does not author or run agents, and it does not create model resources. It indexes and governs what the other two layers produce.

## A concrete example

Say you run a support agent. It has a system prompt, one model, two tools, and it talks to one MCP server. Four questions, each landing on a different layer:

1. **Where do its prompt, model, and tool list live, and what invokes it?** That is layer 2, the studio. AWS Agent Registry does not store or run this.
2. **When it needs an LLM, who creates the region-bound model resource, in the right account, with rollback on failure?** That is layer 3, the control plane. AWS Agent Registry does not do this either.
3. **Can another team find this agent before building a duplicate?** That is layer 1, discovery. AWS Agent Registry answers it, and if the agent runs on AgentCore, auto-detection keeps the answer current for free.
4. **Who recorded the risk review and the approval that let it ship?** Split: AWS Agent Registry has an approval workflow and CloudTrail, which covers the discovery-layer governance. Domain-specific compliance forms usually live with layer 3.

Before AWS Agent Registry, someone hand-maintained a catalog on the side, and it drifted the moment a person forgot to update it. After, the catalog maintains itself from AgentCore. That is a real win, and it is orthogonal to whether you still need a studio or a control plane. You do.

## Decision guide

Figure out which layer your "registry" actually is, then act:

- **It only stores metadata: find agents, approve them, audit them.** That is layer 1. Adopt AWS Agent Registry and delete your hand-maintained catalog. Clean case.
- **It authors agent config and runs the agents (prompts, models, tool lists, invocation).** That is a studio, layer 2. Keep it. AWS Agent Registry cannot author or run anything. But if your agents run on AgentCore, let auto-detection project them into AWS Agent Registry so you get org-wide discovery without maintaining a second list.
- **It provisions backing resources on registration (model profiles, per-region binding, rollback).** That is a control plane, layer 3. Keep it. AWS Agent Registry cannot replace it. Feed your records into it for discovery.
- **You have two or three of these tangled in one service called "the registry."** Most common, most painful. Name the layers, then decide per layer: the catalog view is a thin projection you can hand to AWS Agent Registry; the studio and the control plane stay yours.

The layering that usually wins: your studio owns config and runtime, your control plane owns provisioning and the authoritative governance record, and AWS Agent Registry sits on top as the org-wide discovery and search surface. Three systems, three jobs, one of them now managed by AWS.

## Pitfalls I would watch for

- **Do not read "registry GA" as "your registry is obsolete."** First decide which layer your thing is. If it authors, runs, or provisions, the GA announcement is additive, not a replacement.
- **The name collision is the actual risk.** When three systems all get called "the registry," someone will try to replace a studio or a control plane with a catalog and lose authoring, runtime, or provisioning. Force the layer name into the conversation before the architecture debate.
- **Auto-detection is scoped to AgentCore.** If your agents run somewhere else, records do not populate themselves and you are back to manual authoring or a custom feeder.
- **Region availability.** At GA it is in five regions: US East (N. Virginia), US West (Oregon), Tokyo, Sydney, and Ireland. Confirm your region is covered before you plan a migration.
- **Two catalogs is worse than one.** If you adopt AWS Agent Registry but keep a hand-maintained list "just in case," you now have two sources of truth that disagree. Pick one to be the catalog and make the other a producer.

## What to do

If you are staring at your own "registry" after this announcement, do not start with an architecture debate. Start by naming the layer. Ask three questions of the code: does it author and store agent config, does it invoke the agent, and does it create a backing resource on registration? If the answer to all three is no and it only stores searchable metadata, AWS Agent Registry is a strong candidate to replace it. If the answer to any of them is yes, you are looking at a studio or a control plane that AWS Agent Registry complements, not replaces, and the right move is to feed your records into it and let it own discovery.
