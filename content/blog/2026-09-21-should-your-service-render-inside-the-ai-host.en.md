---
title: "Should Your Service Render Inside the AI Host? MCP Apps and the Cost of a Rich UI"
date: 2026-09-21T09:00:00-04:00
author: Yoonsoo Park
description: "MCP Apps turns MCP resources into interactive HTML widgets that the AI host renders. The pattern is portable across hosts, but it moves the interface out of your application and into someone else's canvas. Here is the decision, the auth tradeoff, and the parts I would not ship."
categories:
  - AI Agents
  - Architecture
  - AWS
tags:
  - AI Agents
  - MCP
  - Amazon Bedrock AgentCore
  - Security
  - ui-extension
---

For two years, the mental model for MCP has been "here are my functions, model, pick one". The Apps extension changes the unit of integration. Now a server can also hand the host an HTML widget, and the host renders it inside the conversation. That is a different product decision than adding a tool, and it deserves a different review.

AWS published a reference implementation on 2026-09-11 that builds one of these on AgentCore, with a sample called Unicorn Rentals. Reading it is a good way to see what the pattern actually costs.

## What the protocol actually does

MCP Apps extends MCP with interactive HTML widgets rendered inside AI hosts. A tool still does the work. A resource carries the widget.

The wiring is small enough to state in four steps. The host calls tool discovery and resource discovery on your server. When a tool is invoked, the tool config's `_meta.ui.resourceUri` field tells the host which widget belongs to that response, and the `structuredContent` payload carries the data the host will inject into it. The host then reads that resource URI and receives self-contained HTML. Finally the host renders the HTML inside a sandboxed iframe and passes the structured data in through the Apps lifecycle.

Two properties follow from that. The widget is your HTML served from your server, so the host is a rendering surface rather than the author of the interface. And the pattern is host-agnostic: the same server is expected to look the same in ChatGPT, Claude, and other hosts that implement the extension.

## What the reference implementation does

Unicorn Rentals lets a customer browse available unicorns, book one, view active bookings, and return one. The deployment is one MCP server on AgentCore runtime, fronted by AgentCore Gateway, with business logic in a Lambda function and persistence in DynamoDB. Images come from CloudFront backed by S3. Deployment is one CDK script, and connection is a connector URL entered in the host.

Three choices in it are worth separating from the specific app.

**The MCP layer is a thin protocol adapter.** The business Lambda knows nothing about MCP, and in a real deployment it could be your existing service on ECS or EKS. That separation is what makes the UI experiment reversible: if the widget experiment fails, the business logic never moved.

**Not every response gets a widget.** The reference returns text for viewing bookings and returning a unicorn, and only the browse and booking responses get cards. It states the principle directly: not every request needs a rich interface. I would treat that as the design rule rather than a sample shortcut, because it is the only thing keeping the widget count down.

**Inbound authentication is deliberately absent, and the edge carries the weight.** The gateway accepts requests with no auth and invokes the runtime with its own IAM execution role over SigV4, so the host never holds AWS credentials. The runtime's resource policy allows only the gateway role. Protection at the edge comes from web application firewall rules, an IP allowlist, and rate limiting.

That last choice is the one I would push on in review. It is coherent for a demo and defensible for an internal tool with a known client. It is a harder argument for anything customer-facing, because "no auth at the gateway" means the edge controls are the only thing between the public internet and your business logic.

## The decisions I would make explicitly

| Decision | Options | What I would pick |
| --- | --- | --- |
| Which responses render a widget | Everything, or only shapes that benefit from comparison and confirmation | Only comparison and confirmation shapes. Single values, errors, and status stay text |
| Where business logic lives | In the MCP server, or behind it | Behind it. The server stays a protocol adapter |
| Inbound authentication | Edge controls only, or an authenticated boundary at the gateway | An authenticated boundary for anything multi-tenant |
| Argument validation | Once, at the protocol layer | Twice: strict schema at the server, re-validate in the business layer |
| Untrusted text crossing the boundary | Pass through | Filter before it reaches the client |

The double-validation row is not theoretical. The reference states that the business layer must not trust input validated only at the protocol layer, which is the same conclusion I keep arriving at for tool calls generally: the layer that holds the resource has to make its own decision.

## Pitfalls I would expect

- **Reading "no auth inbound" as safe because a firewall exists.** Firewall rules are not an identity. If your service has tenants, the gateway needs to know who is calling.
- **Adding a widget because you can.** Every widget is HTML you now maintain, version, and support across hosts you do not control.
- **Assuming a widget update ships instantly.** Hosts may cache tool and resource listings, so a widget change can lag behind your deploy.
- **Putting logic in the widget.** It runs in a sandboxed iframe on someone else's page. It is a presentation layer.
- **Forgetting that state lives behind the server.** The widget is a view. Bookings, sessions, and their expiry are database concerns.
- **Skipping the local test path.** A widget you can only exercise by connecting a real host is a widget you will not iterate on.

## When I would not do this

If your users already have your app open, a widget inside a chat host is a second interface to maintain for a smaller canvas. If you need pixel-level control over layout, this is the wrong surface. And if the answer to the user's question is a number or a status, text is a better interface than a card, which is the rule the reference implementation already follows.

## What a cheap experiment looks like

Before deploying anything to AgentCore, the pattern can be exercised locally: an MCP server with the Apps extension, the SDK's app helpers, and a local inspector as the host stand-in to confirm that the resource URI resolves and the structured data arrives where the widget expects it. That needs no AWS account, which is the point.

What it does not test is the part that actually breaks in production: how a real host caches your resource listings, how the sandboxed iframe behaves with your asset loading, and whether the no-auth inbound choice survives your threat model. Those need a real host, which turns it into a decision with an access requirement rather than a two-hour task.

I have not run either step. This article is a reading of the published reference implementation and the protocol documentation, and the evidence class is documentation-derived.

## What to do

If you are considering shipping a widget into someone else's AI host, answer three questions first:

1. Which of your responses genuinely needs comparison or confirmation, rather than a sentence?
2. If the gateway accepted a request with no identity, what would stop it, and is that thing you control?
3. If the host never re-fetched your resource listing, what would your users see?

If the answer to the first is "most of them", the interface is probably a product rather than an extension, and the second question is the one to spend the review on.

## Sources

- AWS Machine Learning Blog, [Build interactive MCP Apps using Amazon Bedrock AgentCore](https://aws.amazon.com/blogs/machine-learning/build-interactive-mcp-apps-using-amazon-bedrock-agentcore/), September 11, 2026.
- Sample application, [aws-samples/sample-agentcore-mcp-apps](https://github.com/aws-samples/sample-agentcore-mcp-apps).
- MCP Apps extension overview, [modelcontextprotocol.io/extensions/apps/overview](https://modelcontextprotocol.io/extensions/apps/overview).

Related: [MCP and A2A as different contracts on AgentCore](/blog/2026-08-01-mcp-and-a2a-boundaries-on-agentcore.html) and [what changed when MCP went stateless](/blog/2026-08-09-mcp-goes-stateless.html).

Verified on 2026-09-21. Based on the published reference implementation and protocol documentation; no deployment or host connection was run for this article.
