---
title: "I Rebuilt the AWS Restaurant Pricing Swarm as a Surf School, Then Ran It 33 Times"
date: 2026-08-20T09:00:00-04:00
author: Yoonsoo Park
description: "AWS's dynamic-pricing blog draws a clean five-agent swarm. I rebuilt the same pattern as a surf-school booking assistant on Strands and Bedrock, ran it 33 times, and logged what the diagram hides: 81.8% completion, 136s median latency, 65k tokens a run, and six failures the arrows never show."
categories:
  - AWS
  - Architecture
tags:
  - strands
  - bedrock
  - multi-agent
  - swarm
  - agentcore
  - observability
---

AWS published a nice reference architecture: [a dynamic pricing solution for restaurants using Strands Agents](https://aws.amazon.com/blogs/industries/build-a-dynamic-pricing-solution-for-restaurants-using-agentic-ai-strands-agents/). An orchestrator fans out to specialist agents (demand, weather, local events, competitor pricing), each talks to its own data source through an MCP server, and a swarm parent aggregates everything into a price. The diagram is clean. Every arrow points forward. Nothing fails.

I wanted to know what that diagram costs when you actually run it. So I rebuilt the exact same pattern in a different domain, a surf school booking assistant, and then I ran it 33 times on Bedrock and logged every hop.

If you read my [post on designing multi-agent systems only when one agent is not enough](/blog/2025-12-12-designing-robust-multi-agent-systems.html), this is the empirical follow-up. Less "should you", more "here is the bill".

## The pattern, retargeted to a surf school

A surf school has the same shape as the restaurant. Demand fluctuates, external signals drive it, and there is a hard constraint you cannot cross. For a restaurant that constraint is the cost floor (never sell below cost). For a surf school it is safety (never put a beginner in the water when the swell and gusts are dangerous).

So I mapped the five specialists like this:

```
orchestrator
  └── swarm
        conditions_agent   → get_surf_conditions   (Open-Meteo Marine: swell height/period)
        weather_agent      → get_weather           (Open-Meteo Forecast: wind, gusts, temp)
        availability_agent → get_instructor_availability (local seed, stands in for DynamoDB)
        safety_agent       → (no tool: reasons over prior output; owns the safety veto)
        pricing_agent      → get_base_pricing       (premium/discount, never below floor)
```

The two ocean signals are real. [Open-Meteo](https://open-meteo.com/) serves swell and wind with no API key, so `conditions_agent` and `weather_agent` pull genuine data. Instructors and base prices are a local JSON seed, the same role DynamoDB plays in the AWS version. The safety rule lives as a sentence in `safety_agent`'s prompt and is re-asserted in `pricing_agent`, so a pricing incentive can never override a safety veto. That is the whole "policy in prompts" premise the AWS example rests on.

The Strands wiring is almost exactly what the AWS sample shows:

```python
from strands import Agent, tool
from strands.models import BedrockModel
from strands.multiagent import Swarm

swarm = Swarm(
    build_specialists(),          # the five agents above, in order
    max_handoffs=6,
    max_iterations=6,
    execution_timeout=300.0,
    node_timeout=90.0,
)
result = swarm(f"Recommend surf lesson slots and pricing for {location} on {day}. lat={lat} lon={lon}")
```

Handoffs are not code. Each specialist ends its prompt with "then hand off to `next_agent`", and the model decides to call the `handoff_to_agent` tool. Keep that fact in mind, because it is where the diagram starts lying.

To make the runs comparable I froze one live Open-Meteo snapshot, derived 11 stress scenarios from it (high swell, strong gusts, cold-calm, a beginner-boundary day, a snapshot with a missing observation hour), and ran each scenario three times at temperature zero. Same inputs, same seed, 33 Bedrock calls. Model was `claude-sonnet-4-6`.

## What the diagram shows vs. what 33 runs showed

Here is the honest scoreboard.

```
Runs:              33  (11 scenarios x 3 repeats)
Completed:         27  (81.8%)
Failed:             6  (18.2%)
Exact 5-agent path: 27  (81.8%)
Latency:           mean 136.7s | median 132.5s | p95 159.6s | range 115-186s
Tokens/run:        mean 65,730 | median 67,476 | p95 76,275
Batch tokens:      2,169,078 total (1.81M in / 356k out)
Est. batch cost:   ~$10.78  (at $3/M in, $15/M out)
AWS throttles:     0
Timeouts:          0
```

Read that again. **One in five runs did not complete the clean path in the diagram, and not a single failure was AWS's fault.** No throttling, no timeout. The failures were all internal to the swarm, and they cluster in a way the architecture picture actively hides.

### 1. The last agent is the most expensive and the most fragile

In the diagram every specialist is the same size box. In the logs they are not. Each agent reads all the prior agents' output and rewrites it into its handoff. Context amplifies down the chain, so the agents near the end carry the biggest payloads. In a representative run:

```
conditions_agent   9,286 tokens
weather_agent     11,267
availability_agent 13,255
safety_agent      16,303   <- output tokens 3,676, the largest generation
pricing_agent     16,481
```

Four of my six failures were `safety_agent` hitting the 4,000-token generation limit while serializing its handoff (in one case, 21 approved slots). The agent that owns the most important rule, the safety veto, is also the one most likely to choke, precisely because it sits late in the chain and has to restate everything before it. The clean left-to-right arrows give you no hint that the right side of the chain is where it breaks.

### 2. Temperature zero did not make it deterministic

I ran every scenario three times with identical frozen inputs at temperature zero. Five scenarios failed once and then succeeded twice. Same snapshot, same seed, same prompts. The failure location moved between runs, and in one case the *agent path itself* changed: `cold-calm` repeat 1 finished pricing with a valid eight-slot result, then handed control *backward* to `conditions_agent`, looped, and exhausted the iteration budget. Repeats 2 and 3 went straight through.

Temperature zero pins next-token sampling. It does not pin tool-call formatting, handoff length, or routing decisions. A multi-agent swarm has too many model-driven control points for "temperature 0" to mean "reproducible". If you were counting on determinism to test a swarm, stop counting on it.

### 3. The arrows hide malformed tool calls and SDK edges

Things the diagram cannot show that the logs did:

- **Argument-free tools fail to parse.** Tools like `get_base_pricing()` that take no arguments repeatedly logged `failed to parse tool input json, defaulting to empty dict`. Strands substituted `{}` and continued, so the final answer often validated anyway, but the tool-call layer was quietly malformed on nearly every run.
- **`SwarmResult` has no `final_response` in Strands 1.52.0.** The AWS sample reads `result.final_response`. In the version I ran that field does not exist; you read the pricing node out of `result.results`. The published sample and the shipped SDK had already drifted.
- **Bedrock rejects assistant-prefill continuations.** One `pricing_agent` failure was Bedrock refusing to continue a conversation that ended on an assistant message. That is an SDK-and-model conversation-shape constraint, not anything you would ever infer from an architecture drawing.
- **Schema drift between runs.** The same agent returned `slots` as a bare list on some runs and as an object with `approved_slots` on others. I had to write a validator that normalizes known shapes just to check the output. It observes; it never rewrites the model's recommendation.

### 4. Compact handoffs cut cost almost in half, and it still wasn't cheap

My first naive build passed full hour-by-hour observations between agents and used 108,827 swarm tokens at 285 seconds per run. Switching to compact lesson-hour handoffs plus an eight-recommendation cap dropped the same-snapshot run to 64,781 tokens and 125 seconds, with the identical five-agent path. That is a huge win from one prompt-engineering change. And the batch still averaged 65,730 tokens and 136 seconds a run. A five-agent swarm is a genuinely expensive way to answer "what should today's lessons cost".

## About that safety veto

The comforting part: across every recommendation my validator could parse, there were zero beginner safety-threshold violations and zero price-floor violations. High-swell and strong-gust scenarios removed unsafe beginner slots in all completed outputs. Prompt-only policy looked like it held.

The honest part: that does not prove prompt-only safety is reliable. Six runs never produced a usable result at all. Five were classified as malformed output. Two `missing-hour` repeats recommended slots at an absent observation hour, which the validator flagged as `unverifiable` rather than safe. And the validator only checks the final extracted slots, not every natural-language claim or every intermediate handoff. The defensible conclusion is narrow: *no measurable violation occurred in the verifiable completed recommendations of this batch.* It is not "prompt-only safety works". If safety actually mattered here, the veto belongs in deterministic code after the swarm, not in a prompt sentence you hope the last, most overloaded agent restates correctly.

## So should you build the restaurant swarm?

Build it to learn the pattern. It genuinely works: five specialists collaborated over real Bedrock calls, pulled live ocean data, and produced safe, floor-respecting price recommendations 27 out of 33 times. The Strands `Swarm` primitive is a real thing you can stand up in an afternoon.

But price it before you ship it:

- **Budget the tail, not the average.** ~65k tokens and ~136s *per recommendation*, and the failure modes live at the end of the chain where context is fattest.
- **Do not trust temperature zero to give you reproducible swarm behavior.** It won't. Test with repeats and expect a spread.
- **Put hard constraints in code, not prompts.** The safety veto and the price floor should be deterministic post-processing. Let the swarm propose; let code dispose.
- **Log every hop from day one.** Node path, per-node tokens, tool calls, validation result, failure class. The single most useful thing I built was the run log, and it is the one thing the AWS diagram doesn't have.

The clean architecture diagram is the marketing. The 18.2% failure rate, the backward loop, the choking last agent, and the ~$10.78 for 33 runs are the engineering. If you're going to run one of these in front of real customers, deploy on [AgentCore Runtime](/blog/2026-08-06-agentcore-runtime-instances.html) for the managed parts, but budget for the messy parts the reference picture leaves out. For the wider "when is a swarm even the right tool" question, I still stand by [designing multi-agent systems only when one agent is not enough](/blog/2025-12-12-designing-robust-multi-agent-systems.html), and if you're choosing a framework, [Strands vs LangGraph on Bedrock](/blog/2026-02-28-Strands-vs-LangGraph.html) is the companion read.

The diagram never fails. Your swarm will. Log it so you know how.
