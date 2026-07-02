---
title: "WAF Comes to AgentCore Gateway: Perimeter Security for the MCP Front Door"
date: 2026-07-02T09:05:00-04:00
author: Yoonsoo Park
description: "AWS WAF now protects Amazon Bedrock AgentCore Gateway. One Gateway-level config covers every downstream tool, agent, and integration. Here's why the MCP gateway is the right place to put the perimeter, and how to decide which rules to actually turn on."
categories:
  - AWS
tags:
  - waf
  - agentcore
  - security
  - mcp
  - bedrock
---

If you expose an agent to the outside world, the scary part isn't the model. It's the front door. The gateway that fans a single request out to a dozen MCP tools, a memory store, and downstream integrations is the highest-leverage thing an attacker can hit. One malformed or abusive request there touches everything behind it.

In June 2026 AWS made [AWS WAF generally available for Amazon Bedrock AgentCore Gateway](https://aws-news.com/article/2026-06-29-aws-waf-adds-support-for-amazon-bedrock-agentcore-gateway). This is a small announcement with an outsized architectural implication: the perimeter for agentic workloads now sits at the gateway, where it belongs.

## Why the gateway is the right control point

AgentCore Gateway is the MCP front door. A caller hits the gateway, and the gateway routes to whatever tools, agents, and integrations sit behind it. That fan-out is exactly why it's the correct place to enforce protection:

- **One config, everything covered.** A single Gateway-level WAF association protects all downstream tools and integrations at once. You don't bolt WAF onto each tool.
- **It's where abuse concentrates.** Rate abuse, bot traffic, and known-bad payloads all funnel through the same entry point. Defend the funnel, not each cup.
- **It's the trust boundary.** Everything upstream of the gateway is untrusted; everything downstream you built. That's the definition of a perimeter.

Before this, securing that boundary meant custom infrastructure in front of the gateway. Now it's a managed association.

## What you actually get to turn on

The announcement lists concrete capabilities. Mapped to what they defend against:

| Control | What it stops |
|---------|---------------|
| IP-based access controls | Callers from where you don't do business |
| Rate-based rules | A single client hammering the gateway (cost + DoS) |
| Managed Rule Group: Bot Control | Automated scraping and abuse traffic |
| Managed Rule Group: Known Bad Inputs | Payloads matching published exploit signatures |
| WAF protection packs | A curated bundle applied consistently |

Available in every region where both WAF and AgentCore Gateway are supported, so unlike some launches this isn't gated to a handful of regions.

## The decision tree: which rules, when

Turning everything on is not the goal. Each rule has a false-positive cost, and agent traffic is weirder than normal web traffic. Here's how I'd sequence it.

1. **Rate-based rules first, always.** The cheapest, highest-value control. An agent gateway with no rate limit is a cost incident waiting to happen, before you even get to security. Set a ceiling that's generous for real clients and lethal for a runaway loop.
2. **IP controls if your caller set is knowable.** Internal or partner-only gateway? Allowlist the org's ranges. Public gateway? Skip the allowlist, it'll just cause pages.
3. **Known Bad Inputs, in count mode first.** Turn it on counting, not blocking, watch for a week. Agent payloads (big JSON, tool schemas, embedded code) can trip signatures written for web forms. Promote to block only after you've confirmed the false-positive rate.
4. **Bot Control last, and carefully.** Legitimate agent-to-agent (A2A) traffic can look exactly like a bot, because it is one. If your gateway serves other agents, Bot Control can shoot your own callers. Scope it or leave it off.

The theme: the more an agent gateway is used by other machines, the more the "block bots" instinct works against you. Web WAF assumes humans are good and bots are bad. Agent WAF can't.

## Pitfalls

- **WAF is perimeter, not authorization.** It blocks abusive traffic shapes. It does not decide whether an authenticated caller is allowed to invoke a specific tool. You still need real authz at the gateway (scoped roles, OAuth, tool-level permissions). WAF in front, authz inside.
- **Count mode before block mode, every managed rule.** The single most common WAF self-inflicted outage is enabling a managed group in block mode and discovering it eats legitimate traffic. Agent payloads make this worse. Count, observe, then block.
- **Rate limits need a per-client key, not just per-IP.** Many agents call through NAT or a shared egress, so per-IP rate limiting can lump distinct tenants together. If you can key on an auth identity, do it.
- **Don't let WAF become your only layer.** A gateway WAF is one ring. The downstream tools still need input validation and least privilege. Perimeter security that assumes the inside is safe is how one bypass becomes total.

## What to do

If you run an AgentCore Gateway that anything outside your own account can reach, associate a WAF, and start with a rate-based rule today. That one control alone closes the most likely incident (a runaway or abusive client). Then walk the rest of the tree in count mode. And keep the framing straight: WAF secures the shape of traffic hitting the front door. It is not a substitute for deciding, inside the gateway, who's allowed to open which door.
