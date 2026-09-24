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

Here is the trap. Three different internal systems often get called "the registry" even though they belong to different layers. AWS Agent Registry is easy to confuse with the system that stores agent configuration and runs agents, but those systems have different responsibilities.

**Layer 1: the catalog and discovery layer.** "What agents and tools exist, where are they, who approved them, let me search." This is a read-and-find surface. It is exactly what AWS Agent Registry is.

**Layer 2: the agent configuration and execution layer.** This layer owns the agent's system prompt, model, tool list, ownership mode (managed or custom), and invocation path. It authors the configuration, stores it as the source of truth, and runs the agent. A catalog can list what this layer produces, but it does not author configurations or run agents.

**Layer 3: the provisioning and governance control plane.** When a capability is registered, this layer creates the backing resource, binds a region-specific model profile in each account, rolls back partial failures, and records who approved it. It creates infrastructure and binds that infrastructure to a model. Neither the catalog nor the agent configuration and execution layer does this.

The confusion is understandable. The agent configuration and execution layer has a list of agents, so it can look like a registry. The provisioning control plane registers capabilities, so it can look like one too. But AWS Agent Registry is layer 1. It does not author or run agents, and it does not create model resources. It indexes and governs what the other two layers produce.

## A concrete example

Say you run a support agent. It has a system prompt, one model, two tools, and it talks to one MCP server. Four questions, each landing on a different layer:

1. **Where do its prompt, model, and tool list live, and what invokes it?** That belongs to layer 2, the agent configuration and execution layer. AWS Agent Registry neither stores that configuration nor runs the agent.
2. **When it needs an LLM, who creates the region-bound model resource, in the right account, with rollback on failure?** That is layer 3, the control plane. AWS Agent Registry does not do this either.
3. **Can another team find this agent before building a duplicate?** That is layer 1, discovery. AWS Agent Registry answers it, and if the agent runs on AgentCore, auto-detection keeps the answer current for free.
4. **Who recorded the risk review and the approval that let it ship?** Split: AWS Agent Registry has an approval workflow and CloudTrail, which covers the discovery-layer governance. Domain-specific compliance forms usually live with layer 3.

Before AWS Agent Registry, someone maintained a separate catalog by hand, and it drifted whenever an update was missed. With AgentCore auto-detection, the catalog can keep itself current. That is a real improvement, but it does not remove the need for the agent configuration and execution layer or the control plane.

## Decision guide

Figure out which layer your "registry" actually is, then act:

- **It only stores metadata: find agents, approve them, audit them.** That is layer 1. Adopt AWS Agent Registry and delete your hand-maintained catalog. Clean case.
- **It authors agent configuration and runs agents (prompts, models, tool lists, invocation).** That is layer 2, the agent configuration and execution layer. Keep it. AWS Agent Registry cannot author configurations or run agents. If the agents run on AgentCore, use auto-detection to register them in AWS Agent Registry and provide organization-wide discovery without maintaining a second list.
- **It provisions backing resources on registration (model profiles, per-region binding, rollback).** That is a control plane, layer 3. Keep it. AWS Agent Registry cannot replace it. Feed your records into it for discovery.
- **Two or three layers are tangled together in one service called "the registry."** This is common and difficult to change. Name the layers first, then separate their responsibilities. Synchronize the catalog metadata with AWS Agent Registry while keeping the agent configuration and execution layer and the control plane responsible for their own work.

A practical division is for the agent configuration and execution layer to own configuration and runtime, the control plane to own provisioning and the authoritative governance record, and AWS Agent Registry to provide organization-wide discovery and search. These are three systems with three distinct responsibilities, one of which AWS now manages.

## Pitfalls I would watch for

- **Do not read "registry GA" as "your registry is obsolete."** First decide which layer your thing is. If it authors, runs, or provisions, the GA announcement is additive, not a replacement.
- **The name collision is the real risk.** When all three systems are called "the registry," someone may try to replace the agent configuration and execution layer or the control plane with a catalog, losing authoring, runtime, or provisioning capabilities. Name the layer explicitly before debating the architecture.
- **Auto-detection is scoped to AgentCore.** If your agents run somewhere else, records do not populate themselves and you are back to manual authoring or a custom feeder.
- **Region availability.** At GA it is in five regions: US East (N. Virginia), US West (Oregon), Tokyo, Sydney, and Ireland. Confirm your region is covered before you plan a migration.
- **Two catalogs is worse than one.** If you adopt AWS Agent Registry but keep a hand-maintained list "just in case," you now have two sources of truth that disagree. Pick one to be the catalog and make the other a producer.

## What to do

If you are reviewing an internal "registry" after this announcement, start by identifying its layer. Ask three questions: does it author and store agent configuration, does it invoke agents, and does it create backing resources during registration? If the answer to all three is no and the system stores only searchable metadata, AWS Agent Registry is a strong replacement candidate. If any answer is yes, the system is an agent configuration and execution layer or a control plane that AWS Agent Registry complements rather than replaces. Publish its catalog metadata to AWS Agent Registry and use AWS Agent Registry for discovery.
