---
title: "AWS Agent Registry Is GA. Do You Still Need to Build Your Own?"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Agent Registry gives you a governed catalog and discovery layer for agents, tools, skills, and MCP servers. That is not the same thing as the control plane that provisions and governs them. Here is how to tell which one you actually need."
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

If your platform team already stood up its own registry, the announcement lands as an awkward question: did we just rebuild something AWS now hands us for free? I spent a while comparing the GA feature set against a home-grown registry, and the answer is not "rip yours out." It is "these two things solve different problems, and the word registry is doing too much work."

## What AWS Agent Registry actually does

Strip the marketing and it is a **catalog plus discovery** layer:

- Register agents, tools, skills, MCP servers, and custom resources as records.
- Search them by semantic or keyword query, so teams find an existing capability instead of rebuilding it.
- Route records through an approval workflow.
- Audit every action through CloudTrail.
- Provision and manage registries as code with CloudFormation, Terraform, or CDK, and tag records for cost allocation and access control.
- Auto-detect agents on AgentCore runtime and gateways across the org, so records stay current without manual authoring.

That last point is the one that made me stop and think. Auto-detection means you do not have to keep the catalog honest by hand. If your agents run on AgentCore, they show up whether or not anyone remembers to register them.

## The distinction the word "registry" hides

Here is the trap. A lot of internal platform teams built something they also called a "registry," but it is not a catalog. It is a **provisioning and governance control plane**. Mine looked like this:

- A team registers a capability. If it is an LLM capability, the system provisions the actual backing resource: a Bedrock inference profile, created per region, per trust zone, with rollback if any step fails.
- Registration carries governance artifacts: a risk and compliance form, an explanation form, a lifecycle state machine.
- The record is the source of truth that other services call to resolve which model, in which account, a given capability maps to.

None of that is discovery. The catalog answers "what exists and where." The control plane answers "make this exist, bind it to a model in the right region, and keep a governed record of who approved it." AWS Agent Registry does the first. It does not create inference profiles, it does not do per-region model binding, and it does not own your capability governance forms.

So the real question is not "AWS vs mine." It is "which of the two jobs am I actually doing, and is the other one already handled?"

## A concrete example

Say you run a support agent. It uses two tools and talks to one MCP server. Three questions:

1. **Can another team find this agent and its tools before building a duplicate?** That is discovery. AWS Agent Registry answers it, and auto-detection keeps the answer current for free.
2. **When the agent needs an LLM, who creates the region-bound model resource, in the right account, with rollback on failure?** That is provisioning. AWS Agent Registry does not do this. You either build it or you accept manual model wiring.
3. **Who recorded the risk review, the lifecycle state, and the approval that let this agent ship?** AWS Agent Registry has an approval workflow and CloudTrail, which covers part of this. Your domain-specific compliance forms are not part of it.

Before AWS Agent Registry, a team hand-maintained a catalog on the side, and it drifted the moment someone forgot to update it. After, the catalog maintains itself from AgentCore. That is a real win, and it is orthogonal to whether you still need a provisioning control plane.

## Decision guide

Work top to bottom:

- **You only need discovery and governance metadata (find agents, approve them, audit them).** Adopt AWS Agent Registry and delete your hand-maintained catalog. This is the clean case.
- **Your "registry" actually provisions backing resources (inference profiles, per-region model binding, rollback).** Keep it. AWS Agent Registry cannot replace this. But consider making your control plane a producer that feeds records into AWS Agent Registry, so you get discovery without maintaining a second catalog.
- **You have both jobs tangled in one service.** This is the most common and the most painful. Split them. The provisioning and governance logic is your control plane and stays yours. The catalog view is a thin projection you can hand to AWS Agent Registry, especially if your agents run on AgentCore and auto-detection does the cataloging.

The layering that usually wins: your control plane owns provisioning and the authoritative governance record, and AWS Agent Registry sits on top as the discovery and search surface. One system creates and governs, the other one finds.

## Pitfalls I would watch for

- **Do not read "registry GA" as "your registry is obsolete."** Check whether your thing provisions resources. If it does, the GA announcement is additive, not a replacement.
- **Auto-detection is scoped to AgentCore.** If your agents run somewhere else, records do not populate themselves and you are back to manual authoring or a custom feeder.
- **Region availability.** At GA it is in five regions: US East (N. Virginia), US West (Oregon), Tokyo, Sydney, and Ireland. Confirm your region is covered before you plan a migration.
- **Two catalogs is worse than one.** If you adopt AWS Agent Registry but keep a hand-maintained catalog "just in case," you now have two sources of truth that disagree. Pick one to be the catalog and make the other a producer or a consumer.

## What to do

If you are staring at your own registry after this announcement, run one grep before any architecture debate: does your code create a backing resource on registration, or does it only store metadata? If it only stores metadata, AWS Agent Registry is a strong candidate to replace it. If it provisions and binds models, you are looking at a control plane that AWS Agent Registry complements, not replaces, and the right move is to feed your records into it and let it own discovery.
