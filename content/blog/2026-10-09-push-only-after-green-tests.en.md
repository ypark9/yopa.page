---
title: "Push Only After Green Tests: Where Should My Agent's Gate Keep the History?"
date: 2026-10-09T09:00:00-04:00
author: Yoonsoo Park
description: "A per-call gate cannot check 'tests passed in the last 15 minutes'. I ran the same nine traces through a stateless gate, a ten-line in-memory check, and AWS's new Dogwood Local Engine. The stateless gate let three bad pushes through. The in-memory check forgot everything on restart. Dogwood got both right, then blocked good pushes after a policy reload, and its cost depends far more on the window than on the disk."
categories:
  - AI Agents
  - Security
  - Architecture
tags:
  - AI Agents
  - Security
  - authorization
  - tool-calling
  - Rust
---

Two weeks ago I measured [where an agent's refusal should live](/blog/2026-09-26-where-should-agent-refusals-live.html) and ended up recommending a small deterministic gate in front of the tools. That gate had one weakness I wrote down and then left alone: it only sees the call. It does not know what happened before.

Some rules are all about what happened before. The one every coding agent needs: **push only if the tests passed in the last 15 minutes and nothing has failed since.** A gate that reads only the push request cannot check that.

On 2026-09-30 AWS released the [Dogwood Local Engine](https://aws.amazon.com/blogs/opensource/introducing-the-dogwood-local-engine-temporal-governance-for-agent-actions/), an Apache-2.0 Rust library that decides each tool call against policies that can look back at earlier calls and their results. Its launch post uses exactly this rule. So the question for me was not "is Dogwood good". It was: **if my gate needs history, do I keep it myself, or do I embed an engine like this, and what does each choice cost per tool call?**

## Short answer

- A per-call gate cannot enforce a "recently passed" rule. It can only trust what the agent writes in the request. In my test it allowed 3 of 4 pushes that should have been blocked.
- A ten-line in-memory check gets every rule right until the harness restarts. Then it blocks a push that should have gone through, because it forgot the test run.
- Dogwood got all of those right, including after a restart. But **re-applying the same policy set, or changing one policy, wiped the history**, and good pushes were blocked until the tests ran again. That is documented, deliberate, and easy to miss.
- Cost per decision is small with a 15-minute window: about 0.4 to 0.7 ms on disk. With a 24-hour window it grew with session length, to about 18 ms or 242 ms at 12 hours depending on how many matching events were in the window. For scale, trials in my earlier agent experiment took a median of 2 to 6 seconds each.

## The setup

One rule, three gates, nine event traces. Nothing runs: no git, no tests, no model. The harness feeds fake events to each gate and records the verdict on the last push. The clock is injected, so "17 minutes later" takes no real time.

| Gate | What it is | What it can see |
| --- | --- | --- |
| A, stateless | A per-call check, the shape of a Cedar rule on a gateway | Only the push request. The best it can do is trust a `tests_passed` field the agent fills in. |
| B, in-memory | Ten lines in the harness: remember the last test result and its time | Everything since the process started |
| C, Dogwood | `dogwood-local-engine` 1.0 tree (commit `d2cba92`), durable store on disk, the policy from the AWS post | Everything it was shown, kept on disk |

The Dogwood policy is the one from the launch post:

```text
@id("push_after_green_tests")
permit (principal, action == Sandbox::Action::"git:push", resource)
when temporal {
    !Sandbox::Action::"tests"::response{ output.passed: false }
    since within 15m
    Sandbox::Action::"tests"::response{ output.passed: true }
};
```

Gate B is what most of us would write first:

```rust
fn push_allowed(last: Option<(bool, i64)>, now: i64) -> bool {
    matches!(last, Some((true, ts)) if now - ts <= 15 * 60 * SEC)
}
```

## Result 1: who gets the verdict right

"Rule says" is what the owner of the rule wants. A mark means the gate disagreed.

| Trace | What happens | Rule says | A stateless | B in-memory | C Dogwood |
| --- | --- | --- | --- | --- | --- |
| T1 | Tests fail, push 5 s later | DENY | DENY | DENY | DENY |
| T2 | Tests pass, push 5 s later | ALLOW | ALLOW | ALLOW | ALLOW |
| T3 | Tests pass, push 17 min later | DENY | **ALLOW** | DENY | DENY |
| T4 | Pass, then fail, then push | DENY | **ALLOW** | DENY | DENY |
| T5 | No test run, agent claims they passed | DENY | **ALLOW** | DENY | DENY |
| T6 | Tests pass, harness restarts, push | ALLOW | ALLOW | **DENY** | ALLOW |
| T7 | Tests pass, owner re-applies the same policies with `install()`, push | ALLOW | ALLOW | ALLOW | **DENY** |
| T8 | Tests pass, owner widens the push window to 30 min with `batch(Update)`, push | ALLOW | ALLOW | ALLOW | **DENY** |
| T9 | Same as T8, then tests run again, push | ALLOW | ALLOW | ALLOW | ALLOW |

Gate A's three misses are the point of this post. In T5 nothing was tested at all; the agent just said so. My [older post on irreversible actions](/blog/2026-08-24-gate-irreversible-actions-in-code.html) has the rule for this: if the model can write the token that unlocks the action, it is not a gate. A `tests_passed: true` field is that token.

Gate B's miss is the honest cost of the simple version. It fails closed, so the restart in T6 cost one extra test run, not a bad push. Whether that matters depends on how often your harness restarts and how slow your tests are.

## Result 2: two things about Dogwood the launch post does not stress

**Re-applying policies resets their history.** T7 is the one that surprised me. I called `install()` again with the exact same policy text, the way a deploy script or a config reload would, and the next push was denied. The source says this is intended. The comment on `install` in `durable.rs` (around lines 1299 to 1303 at `d2cba92`) calls it "reborn-all": every policy starts with an empty window. `batch` with `Update` resets only the policy you changed, which is T8. The launch post explains the reason (the engine prunes events it no longer needs, so a new policy cannot look back), but it only shows the single-policy case.

In practice this means a policy change is also a "run the tests again" event. It fails closed, which is the right direction. But if your harness reloads policies on every deploy, your agent will be blocked after every deploy until it runs the tests again, and unless your harness says why, the agent only sees a deny.

**A store refuses to open if the clock went back more than five minutes.** `DurableConfig` sets `max_future_skew` to 5 minutes (`durable.rs` line 673), and recovery fails closed when the last stored event is further ahead of the host clock than that.

| Host clock at restart vs last stored event | Store opens? |
| --- | --- |
| 60 s behind | yes |
| 299 s behind | yes |
| 301 s behind | no |
| 600 s behind | no |

The error tells you to fix the host clock or the store. A host that comes back with a stale clock, for example a VM restored from a snapshot before time sync catches up, could leave the agent unable to do anything until someone fixes it.

## Result 3: what a decision costs, next to a model turn

I simulated a 12-hour session at 360 events per hour, the rate in the AWS post, and timed each push decision. Each `submit` writes the event to disk with an fsync before it evaluates (`log.rs` line 355 sets `Durability::Immediate`). To separate the disk from the evaluation, I ran the same session on `/dev/shm`, which is RAM.

The AWS post does not say how many of its events matched the policy, so I ran two mixes. In "dense", every other event is a passing test run (180 per hour). In "sparse", there are 12 test runs per hour and the rest are file reads.

Median push-decision time, in milliseconds:

| Session length | 15 min window, disk | 24 h window, disk, sparse | 24 h window, disk, dense |
| --- | --- | --- | --- |
| 1 h | 0.39 to 0.60 | 0.63 | 1.4 |
| 4 h | 0.37 to 0.67 | 2.4 | 25.6 |
| 8 h | 0.45 to 0.64 | 8.2 | 115.0 |
| 12 h | 0.46 to 0.71 | 18.3 | 242.5 |

The 15-minute column shows the range across both mixes. On RAM the 15-minute window took 0.11 to 0.25 ms, so half or more of the disk time is the sync. With the 24-hour window, RAM and disk were almost the same (243.2 ms vs 242.5 ms at 12 hours, dense): the time is evaluation, not the disk.

Two things stand out.

**The window is what grows, and it grows faster than the session.** In the dense run, every doubling of session length made a push decision about four times slower. The AWS post reports 6 ms per decision at 12 hours with a 24-hour window. I did not get 6 ms on either mix. My box is an 8-vCPU VM, not their server-class host, and I do not know their event mix, so I would not call that a contradiction. The direction is the same as theirs. The size is not.

**Next to a model turn, the short window is free and the long one is not.** In my [refusal experiment](/blog/2026-09-26-where-should-agent-refusals-live.html) the median gap between trial records was 2.0 s for Claude Haiku 4.5, 2.2 s for Amazon Nova Pro, and 5.8 s for Claude Sonnet 5. Each trial includes one to three model calls, so this is an upper bound on one model turn, not a measurement of it. Against 2 seconds, 0.7 ms is noise. 243 ms on every push is about an eighth of a fast turn, and in the dense 24-hour run the average cost of *every* event in hour 12, not just pushes, was 8.5 ms.

The in-memory check, for the record, took about 1 ns per decision.

## So where should the history live

| Your situation | Where I would keep the history |
| --- | --- |
| One harness process, short sessions, restarts are rare, losing history only costs an extra test run | In your own gate. Ten lines, fails closed, about 1 ns. Gate B. |
| History has to survive restarts, several agents share one gate, or you have more than a couple of these rules | An embedded engine like Dogwood, with short windows. Treat every policy reload as "history starts now" and tell the agent why it was blocked. |
| The rule needs a long window ("$100 of refunds per day") | Still an engine, but measure it with your own event mix first. Keep the long window on the rarest event you can, and keep high-frequency events out of its scope. |
| You only have a per-call gate | Do not express a history rule as a field the agent fills in. Either add state somewhere the agent cannot write, or leave the rule to a human approval step. |

Whichever you pick, the engine only decides. The harness still has to send it every event, make sure the events are true, and actually block the call on a deny. The [engine's README](https://github.com/dogwood-policy/dogwood-local-engine) lists those duties, and they are the same duties my gate B has.

## What I did not test

- **No real agent, no real tests, no real git.** Fake events only. The verdicts are about the gate logic, not about any model's behavior.
- **One rule.** Dogwood also has `previous`, `count`, and `sum`, and I did not test them.
- **Concurrency and crash in the middle of a write.** I restarted between events, not during one. The engine's own test suite covers crash recovery; I did not try to break it.
- **The latency numbers are from one 8-vCPU VM** with `/tmp` on overlayfs. Your disk will change the 15-minute column. The 24-hour column is mostly CPU.
- **The model-turn numbers come from trial timestamps** in my earlier experiment, not from timing single model calls.
- **I did not wire this into AgentCore Policy or any hosted gateway.** Everything ran locally and cost nothing.

## What to do this week

1. List the rules your agent's gate has that mention time or order: "after", "since", "within", "at most N per day". Each one needs history.
2. For each, find where that history lives today. If the answer is "in a field the agent fills in", that rule is not enforced.
3. If you keep history in memory, restart your harness in the middle of a session and see what your agent is allowed to do.
4. If you try Dogwood, reload your policies once in a test session and check that your agent gets a clear message when the next push is blocked.

## Related posts

- [Your agent's refusal only covers the rules you wrote down](/blog/2026-09-26-where-should-agent-refusals-live.html): the per-call gate this post extends.
- [Irreversible actions cannot be gated by a prompt](/blog/2026-08-24-gate-irreversible-actions-in-code.html): why the check has to be code the model cannot talk past.

## References

- AWS Open Source Blog, [Introducing the Dogwood Local Engine: temporal governance for agent actions](https://aws.amazon.com/blogs/opensource/introducing-the-dogwood-local-engine-temporal-governance-for-agent-actions/), September 30, 2026.
- [dogwood-policy/dogwood-local-engine](https://github.com/dogwood-policy/dogwood-local-engine) on GitHub (Apache-2.0), commit `d2cba92`.
- [dogwood-local-engine on crates.io](https://crates.io/crates/dogwood-local-engine), version 1.0.0.

The harness and the full output of the run used here are in [yopa-experiments](https://github.com/ypark9/yopa-experiments/tree/experiment/push-only-after-green-tests-20261009/2026-10-09-push-only-after-green-tests). It ran on 2026-10-09 on a Linux VM with rustc 1.99.0. No cloud resources, no model calls, cost $0.
