---
title: "Charters and Plumbing: Why AI Coding Guidelines Always Sound Generic"
date: 2026-07-18T09:05:00-04:00
author: Yoonsoo Park
description: "Every org's AI coding guidelines are correct and unmeasurable at the same time. Listing good values and making those values impossible to betray are two different jobs. The difference between a charter and plumbing."
categories:
  - Engineering
tags:
  - ai-agents
  - code-review
  - engineering-culture
  - verification
---

Every org is publishing AI coding guidelines now. They all look about the same. Quality over quantity. Keep PRs small enough that a human can actually review them. Don't use agents as a replacement for human review. We are each responsible for every line we submit. We critically evaluate AI outputs.

All correct. Nothing to argue with. And that's the problem.

## Correct and enforced are not the same thing

"We are responsible for every line" is a pledge, not an enforcement. "We critically evaluate AI outputs" is fine, but evaluate with what? How do you verify "we take pride in our craftsmanship"? You can't. A sentence you can't measure, however right, ends up as a framed poster on the wall.

These documents usually are what they are: not a document that grants new capability, but one that prevents accidents. That's not a knock. As a charter that aligns culture and blocks the worst outcomes, it does its job. The trouble starts when you mistake the charter for the plumbing.

## A loop can hit its stopping condition and still be wrong

I saw that line in a public agent-stack builder's guide. A loop can meet its stopping condition and still produce the wrong result. Every test can be green while not a single test actually passed. Two reviewers can both click approve, and that approval is an opinion, not evidence.

So good systems don't appeal to a person's conscience. They write facts into the environment. The gate is a script, not a meeting. "Done" is defined as "a passing test row exists in the database," not "a reviewer clicked green." A verdict is an opinion; a row is evidence. Mix the two and the lower layer hands the upper layer a summary instead of a fact, and the upper layer closes on top of a lie.

One more thing. Make models of the same lineage review each other and they share blind spots. Wherever the writer is wrong, a reviewer from the same family misses it in exactly the same way. Review should come from a different lineage when you can manage it. If the grader and the answer-writer run on the same brain, that isn't grading.

## You can't save cost with a pledge either

The one solid section in any of these guidelines is always the cost section. Route simple tool calls to a cheaper model. Turn on prompt caching. Keep your model tiers in one place instead of scattered per project. The most expensive model isn't required for every task. These aren't advice, they're switches. Flip them and the bill drops.

That's the difference from the rest of the virtues. Cost rules are verifiable. Whether the cache broke, whether the cheap model actually handled the tool call, you can read that off the logs. Only measured rules get followed. The rest are just hoped for.

A caution here. You often see a blanket rule: never spawn subagents. That's an overcorrection. The real problem isn't subagents, it's that a child inherits the parent's effort level, so the whole fleet runs at max cost and burns the context window in one shot. The thing to control is effort and a budget cap, not "don't." Forbidding a tool and capping a tool's cost are different moves.

## So what do you actually do

This isn't a case against guidelines. You need a charter. It sets direction and blocks the worst outcomes. But after you read the whole thing, ask yourself one question per line: if I betray this sentence, what stops me? If nothing stops you, it isn't a guideline, it's a wish.

One gate that refuses to pass when there's no passing test, even with the light green, keeps a team more honest than ten virtues you can't measure. Listing good values and making those values impossible to betray are completely different jobs. Most orgs stop at the first one.

Everyone already has the charter. What's always missing is the plumbing.
