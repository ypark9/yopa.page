---
title: "Owning the Learning Loop"
date: 2026-06-15T14:14:50-04:00
author: Yoonsoo Park
description: "Satya Nadella's framing of human capital and token capital points at something practical: you can offload a job, but you can never offload the learning. Here's what owning that learning loop actually looks like for a single engineer running their own agent, and why the loop, not the model, is the asset you keep."
categories:
  - AI
  - Engineering
tags:
  - agents
  - llm
  - learning-loop
  - private-evals
  - knowledge-base
---

There's a line in Satya Nadella's recent essay that I haven't been able to put down:

> You can offload a task, or even a job, but you can never offload your learning.

He frames the future of the firm around two kinds of capital. **Human capital** is the knowledge, judgment, and pattern recognition of your people. **Token capital** is the AI capability you build and *own*. His argument is that human capital doesn't shrink as token capital grows. It gets more valuable, because without human direction you just have "compute running in circles."

I want to take that one rung down the ladder, from the firm to the individual, because I've been living a small version of it for months and the framing finally gave me the right words.

## The model is rented. The learning is bought.

Here is the uncomfortable part of building on top of someone else's frontier model: the model is not yours. It can be deprecated, repriced, rate-limited, or quietly swapped for a worse checkpoint on a Tuesday. Every capability you depend on inside that model is borrowed.

So if the model is rented, what do you actually own?

You own whatever you accumulate *around* the model. The corrections you fed it. The evals that encode what "good" means for your work specifically. The traces of every task it got right and every task it botched. The knowledge base that turns six months of context into something queryable instead of something you re-explain every morning.

That accumulation is the learning loop. And unlike the model, it's yours. Nadella calls it the firm's new IP and describes it as a hill-climbing machine that compounds. At the scale of one person, it's the difference between an assistant that resets to zero every session and one that actually becomes a veteran of *your* work.

## What owning the loop actually looks like

The temptation is to treat "owning your AI" as picking the best model. That's the wrong layer. The model is the commodity. The loop is the asset. Concretely, the loop is three things sitting on top of whatever model you happen to be renting this quarter:

**Private evals.** Not MMLU, not someone's leaderboard. Evals that measure whether the thing is getting better at the outcomes *you* care about. For me that's "did it correctly reconstruct the state of a project I haven't touched in two weeks," not "did it score well on a public benchmark." If you can't articulate your own definition of good, you're outsourcing your standards to whoever made the benchmark.

**Real traces from real use.** Every session is a training signal if you keep it. The tasks the agent fumbled are worth more than the ones it nailed, because they're where the loop has room to climb. The point isn't to fine-tune a model tomorrow. It's that the raw material for improvement is being captured instead of evaporating.

**A queryable institutional memory.** This is the one most people skip, and it's the one that compounds hardest. A knowledge base, even a directory of plain Markdown notes, turns "what did we decide about X three months ago" from a re-derivation into a lookup. Institutional memory you can query is the difference between a tool and a colleague.

None of this requires owning a model. It requires owning the *context* around the model, and keeping it persistent.

## The real test: swap the model, keep the veteran

Nadella has a sharp way of stating the test:

> A company should be able to switch out a "generalist" model without losing the "company veteran" expertise built into their learning system.

That's the whole thing in one sentence. Sovereignty isn't "I run my own model." Sovereignty is "I can throw out the model I'm using and the veteran survives." If swapping models nukes everything your system knows about your work, you never owned anything. You were just a tenant in someone else's capability.

This reframes the commoditization fear, too. The anxiety that "AI is going to absorb my expertise and sell it back to everyone" is real, but it's aimed at the wrong target. What gets commoditized is *static* knowledge, the stuff that's already in the training set. What doesn't commoditize is a *compounding* loop fed by traces nobody else has: your decisions, your corrections, your context. The defense against being commoditized isn't to out-know the model. It's to own a loop the model can't see.

## Pitfalls I've actually hit

This is where the philosophy meets the floor. Things I learned by getting them wrong:

- **Persistent beats volatile, every time.** An agent that's brilliant for one session and amnesiac the next is not a veteran. It's a very expensive intern who quits every night. The single highest-leverage decision is making the loop *survive the session*. If your accumulated context isn't written down somewhere durable, you don't have a loop. You have a goldfish.
- **A knowledge base you don't maintain is a liability, not an asset.** Stale notes are worse than no notes, because they actively mislead. The loop only compounds if you prune as well as append. I treat outdated context like a leak, fix it the moment I notice it, not "later."
- **Keep the loop *outside* the model.** The instinct to lean on a single vendor's memory feature or fine-tune is a lock-in trap. The moment your learning lives inside one model's weights or one platform's proprietary store, you've failed the swap test. Keep evals, traces, and knowledge in formats you control and can carry to the next model.
- **Don't confuse activity with accumulation.** Running a thousand tasks and saving nothing is not a loop. It's a treadmill. Compounding requires that each task leave a deposit. If nothing is being written back, you're just generating tokens, not capital.

## What you should do

Start owning your loop now, at whatever scale you operate. You don't need a frontier model or an RL pipeline. You need three habits:

1. **Write down your own definition of good.** A handful of cases that matter to you, that you can re-run. That's your private eval, version zero.
2. **Make the context persistent.** A notes directory, a memory file, anything durable that survives the session. The bar is "tomorrow it remembers what today decided."
3. **Prune as ruthlessly as you append.** The asset isn't volume. It's a loop that stays true.

Nadella's worry is that a few models capture all the value while everyone else's knowledge gets commoditized out from under them. The defense, at every scale, is the same: own the learning loop. The model is the thing you rent. The loop is the thing you keep.
