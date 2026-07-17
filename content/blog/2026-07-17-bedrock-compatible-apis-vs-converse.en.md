---
title: "Bedrock Now Speaks OpenAI: Where the Compatible APIs Fit Next to Converse"
date: 2026-07-17T11:30:00-04:00
author: Yoonsoo Park
description: "Bedrock added OpenAI- and Anthropic-compatible endpoints you can hit with an API key. That's the third way to call a model on Bedrock, after InvokeModel and Converse. Here's what each layer is actually for, and what it means if your team standardized on Converse."
categories:
  - AWS
tags:
  - bedrock
  - converse
  - openai
  - api-design
  - llm
---

AWS just shipped a new Bedrock console experience with OpenAI- and Anthropic-compatible APIs. The headline is "use the OpenAI SDK against Bedrock with an API key." Nice DX win. But if you've been building on Bedrock for a while, the more useful question isn't "is this cool," it's "where does this sit relative to what I already use." Because this is now the *third* way to call a model on Bedrock, and the three layers don't replace each other. They point in different directions.

## The three layers

```
1. InvokeModel       Raw. Every provider has its own request/response body.
                     Switch models, rewrite the payload. Full control, zero
                     portability across providers.

2. Converse          AWS's unified abstraction. One request shape across
                     every model on Bedrock. tool use, streaming, system
                     prompts standardized. Swap models without touching code.
                     Auth is SigV4 + AWS SDK.

3. Compatible APIs   Industry-standard wire format (OpenAI / Anthropic).
                     Point the OpenAI SDK at a Bedrock endpoint, auth with an
                     API key, done. Existing OSS and tooling just work.
```

Layer 1 is where everyone started and nobody wants to live. Layer 2 is where most serious Bedrock teams landed, because "swap the model, keep the code" is exactly what you want when you're comparing Claude against Llama against Nova every other week. Layer 3 is the new one, and it's easy to misread it as "Converse but easier." It isn't.

## Converse and the compatible APIs unify *different* things

This is the whole point, so it's worth being precise.

Converse unifies **inside AWS**. It gives you one API shape across all the models Bedrock hosts, so your code stops caring whether it's talking to Anthropic or Meta or Amazon. The abstraction boundary is "the set of models on Bedrock."

The compatible APIs unify **outside AWS**. They give you the wire format the rest of the ecosystem already speaks, so code written for OpenAI, or a library that only knows the OpenAI schema, runs against Bedrock with almost no change. The abstraction boundary is "the industry's default request format."

One faces in, one faces out. That's why neither kills the other. If your problem is "I keep rewriting payloads every time I try a new Bedrock model," Converse solves it and the compatible API doesn't help. If your problem is "I have a pile of OpenAI-shaped code, or an OSS tool that only speaks OpenAI, and I want it on Bedrock," the compatible API solves it and Converse doesn't.

## The actual decision has two axes

Strip the marketing and you're choosing on exactly two things:

- **Auth.** SigV4 + IAM (Converse, InvokeModel) versus an API key (compatible APIs). IAM gives you fine-grained, role-scoped, rotatable, org-controlled access. API keys are portable and dead simple but weaker on scoping and rotation. In an enterprise account this axis alone usually decides it, and it decides for IAM.
- **Lock-in.** AWS-idiomatic (Converse) versus portable (compatible). Converse buys you the deep AWS-native features. The compatible layer buys you the ability to walk your code to another provider with minimal edits.

Prototype and multi-vendor teams tend to weight portability and simplicity, so the compatible APIs are genuinely attractive there. Enterprise teams tend to weight auth and governance, so they stay on Converse. Same platform, opposite defaults, and both are correct for who's choosing.

## If your team already standardized on Converse

Short version: you don't need to move, and you shouldn't move for the sake of it.

- **Nothing you built goes away.** Converse's guardrails integration, IAM scoping, and tool use spec are AWS-native. The compatible layer doesn't deprecate any of it. Your existing code keeps running exactly as it did.
- **What you gained is a cheaper on-ramp.** The real value isn't for the code you already wrote in Converse. It's for the code you *didn't* write. Any OpenAI-shaped snippet, any OSS agent framework that only speaks the OpenAI schema, any teammate's prototype built against the OpenAI SDK can now land on your Bedrock account with almost no porting. Migration-in cost dropped, and that's the win worth caring about.
- **You don't have to build the portability layer yourself anymore.** A lot of teams hand-rolled a thin translation shim so they could point non-AWS code at Bedrock, or so they weren't fully wedded to one vendor's schema. The compatible endpoint absorbs that layer. If you were maintaining a homegrown adapter for that reason, this is a candidate to delete.

The trap to avoid is treating a new managed convenience surface as a mandate to rewrite. It isn't. Converse is still the right default for anything that lives inside your AWS security boundary and needs the native features. The compatible API is the right door for things arriving from outside.

## What I'd actually do

Keep new first-party work on Converse if you're an AWS-native, IAM-governed team. Reach for the compatible endpoint specifically when you're importing outside code, evaluating an OSS tool that only speaks OpenAI, or standing up a throwaway prototype where an API key beats wiring up SigV4. And if you were maintaining a homemade OpenAI-to-Bedrock shim, read the compatible API docs before you touch that code again, because AWS may have just made your adapter dead weight.

Two unified APIs on one platform sounds like a contradiction. It only works because one faces in and one faces out. This time, that's a feature.
