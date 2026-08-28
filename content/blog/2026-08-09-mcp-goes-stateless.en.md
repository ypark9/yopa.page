---
title: "MCP Goes Stateless (2026-07-28): Host, Client, Server, and What Changes on AWS"
date: 2026-08-09T09:00:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "The final 2026-07-28 MCP specification drops the protocol-layer session. Here is the host/client/server model that trips everyone up, what you have to change in an existing server, and where stateless MCP does — and does not — simplify AgentCore on AWS."
categories:
  - AWS
tags:
  - mcp
  - agentcore
  - bedrock
  - stateless
  - architecture
---

The [final 2026-07-28 MCP specification](https://blog.modelcontextprotocol.io/posts/2026-07-28/) is the biggest change to the protocol since it launched. The headline: MCP is now stateless at the protocol layer. A remote server that used to need sticky sessions, a shared session store, and a gateway that reads the request body can now sit behind a plain round-robin load balancer when its application state is also externalized or explicitly carried.

Before I get to the transport change, let me clear up the part everyone asks about first: what exactly is a host, a client, and a server?

## Host, client, server in three minutes

These three terms get mixed up constantly, usually because people can't place where "Claude" sits.

- **Host** is the LLM application itself. Claude Desktop, Cursor, ChatGPT, or an agent running on AgentCore Runtime. It is where the user and the model live, and it owns one or more clients.
- **Client** is a connector object living inside the host. There is exactly one client per server. It speaks the JSON-RPC protocol and sends `tools/list`, `tools/call`, and so on. If your host connects to a GitHub server and a Slack server, it spins up two clients. The user never sees them.
- **Server** is the process that exposes actual capabilities: tools, resources, prompts. The GitHub MCP server is the thing that advertises `create_issue()`, `search_repos()` and similar functions as tool specs.

So to answer the question directly: the GitHub MCP server is indeed the place that provides the tools. Claude (Desktop or Cursor) is the **host**. Inside Claude, the connector that talks 1:1 with the GitHub server is the **client**. Host is the container, client is the wire to one server, server is the capability provider. People stumble because "client" is an implementation detail hidden inside the host, so from the outside it looks like Claude is talking to the server directly. It is, but through a client it owns.

```
┌─ Host (Claude Desktop) ───────────────┐
│  user + model                          │
│    ├── Client A ──── GitHub MCP server │  create_issue(), search_repos()
│    └── Client B ──── Slack MCP server  │  post_message(), list_channels()
└────────────────────────────────────────┘
```

Hold onto that picture, because the stateless change is really a change in how the client and server talk to each other.

## What changed: the session left the protocol

In 2025-11-25, calling one tool meant establishing a session first. The client sent an `initialize` handshake, the server replied with an `Mcp-Session-Id`, and every request after that had to carry the same ID. That ID pinned the client to whichever server instance issued it.

The before/after from the final specification makes it concrete.

Before (2025-11-25), two round trips, and the second is pinned:

```http
POST /mcp HTTP/1.1
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize",
 "params":{"protocolVersion":"2025-11-25","capabilities":{},
           "clientInfo":{"name":"my-app","version":"1.0"}}}
```

```http
POST /mcp HTTP/1.1
Mcp-Session-Id: 1868a90c-3a3f-4f5b
Content-Type: application/json

{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"search","arguments":{"q":"otters"}}}
```

After (2026-07-28), one self-contained request that any instance can serve:

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: search
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"search","arguments":{"q":"otters"},
           "_meta":{"io.modelcontextprotocol/clientInfo":{"name":"my-app","version":"1.0"}}}}
```

Two things went away. The `initialize`/`initialized` handshake is removed (SEP-2575); the protocol version, client info, and capabilities now ride in `_meta` on every request, and a new `server/discover` method fetches server capabilities when the client wants them up front. And the `Mcp-Session-Id` header, plus the protocol-level session behind it, is removed (SEP-2567). With both gone, any request can land on any instance.

## What you have to change in an existing server

Stateless protocol does not mean your application has to be stateless. It means the protocol stops holding state for you, so you hold it explicitly.

- **Session state becomes an explicit handle.** Do what HTTP APIs have always done: a tool mints a `basket_id` or `browser_id` and returns it, and the model passes it back as a normal argument on the next call. The state is now visible to the model instead of hidden in transport metadata, which the spec authors argue is actually the more powerful pattern, because the model can compose and reason about the handles.
- **Server-to-client prompts move to Multi Round-Trip (SEP-2322).** Instead of holding an SSE stream open to ask "delete 3 files?", the server returns an `InputRequiredResult` with a `requestState` blob. The client collects the answer and re-issues the original call with `inputResponses` plus that echoed `requestState`. Any instance can pick up the retry because everything it needs is in the payload. Also note server-initiated requests are now only allowed while the server is actively handling a client request (SEP-2260), so no more prompts out of nowhere.
- **Cache your lists.** `tools/list` and resource reads now carry `ttlMs` and `cacheScope` (SEP-2549), modeled on HTTP Cache-Control. You no longer need a long-lived SSE stream just to learn a list changed.
- **Small breaking bits.** Roots, Sampling, and Logging are deprecated (SEP-2577, annotation-only for now). The missing-resource error code changes from the MCP-custom `-32002` to the standard `-32602 Invalid Params` (SEP-2164), so update any client matching on the literal value. Tool schemas move to full JSON Schema 2020-12 (SEP-2106).

## What changes when you deploy on AWS

This is where stateless earns its keep.

- **A plain round-robin load balancer is enough.** Before, horizontal scaling needed sticky sessions or a shared session store so the pinned `Mcp-Session-Id` always found its instance. That requirement is gone at the protocol layer, so an ALB with default routing works.
- **It fits Lambda and Fargate cleanly.** Any request landing on any instance is exactly the execution model serverless and autoscaled containers want. No instance affinity to fight.
- **The gateway routes on headers, not bodies.** The transport now requires `Mcp-Method` and `Mcp-Name` headers (SEP-2243), so a load balancer, gateway, or rate-limiter can route and throttle on the operation without deep packet inspection. Servers reject requests where the headers and body disagree.
- **Tracing is standardized.** W3C Trace Context propagation in `_meta` is now documented (SEP-414), fixing the `traceparent`/`tracestate`/`baggage` key names so a trace can follow a call from the host through the client SDK, the server, and downstream, and land as one span tree in an OpenTelemetry backend.

## How this relates to AgentCore

If you run MCP servers on AWS, you most likely meet the protocol through two AgentCore pieces:

- **AgentCore Runtime** hosts the server-side workload, an agent or an MCP server, in a managed container.
- **AgentCore Gateway** exposes tools as an MCP endpoint and puts SigV4 (IAM) in front of them, so an agent can load a gateway's tools as if it were any other MCP server.

The stateless rework is a natural fit here for the same reason it helps any AWS deployment: AgentCore can scale by adding container instances, and the protocol no longer requires every request to carry a protocol session. But do not turn that into a blanket claim that AgentCore never has sessions. AgentCore Gateway and Runtime can still manage optional stateful MCP sessions for older clients and for interactive features such as elicitation and sampling. Drop gateway affinity only after checking the client version, target behavior, and the session mode you actually configured.

One practical note from wiring a client against a deployed gateway: SigV4 is not native to the MCP client transport, so you inject a signing `fetch` into the Streamable HTTP transport rather than relying on an OAuth provider. If you want the auth side of this in depth, I wrote about [when MCP clients on AgentCore Gateway need OAuth auth code flow](/blog/2026-06-03-agentcore-gateway-mcp-oauth-auth-code.html), and about [architecture patterns for Strands and MCP](/blog/2025-12-11-architecture-patterns-for-strands-and-mcp.html) earlier. This post is the transport-layer companion to those.

## Pitfalls I expect people to hit

- **Assuming stateless means you delete all your state.** It does not. It means you move state out of the transport and into explicit handles that the model passes around. If your server genuinely had per-session state, you still need it, just in a place any instance can read.
- **Forgetting the header/body agreement rule.** If your gateway rewrites `Mcp-Method` or `Mcp-Name` but the body says something else, a conformant server rejects the request. Route on the headers, do not mutate them.
- **Matching on `-32002`.** If any client code branches on the old missing-resource error code, it breaks silently against a 2026-07-28 server. Grep for it.
- **Treating every implementation as final.** The 2026-07-28 document is now the final specification, but clients and gateways may still negotiate older versions. Verify the versions and stateful-session settings in your deployment before removing affinity or deleting session storage.

## What to actually do

If you own a remote MCP server, start planning the protocol-session removal now: find where you rely on `Mcp-Session-Id`, decide which state becomes an explicit handle, and switch server-to-client prompts to the Multi Round-Trip shape. If you deploy on AgentCore, first verify whether your clients and targets use the optional stateful session path; only then remove gateway affinity and let stateless requests scale flat. And if you are the person answering the host/client/server question for the tenth time, keep the one-liner handy: host owns clients, one client per server, server provides the tools.
