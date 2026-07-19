---
title: "Why MCP Clients on AgentCore Gateway Need OAuth Auth Code Flow (Not M2M)"
date: 2026-06-03T11:45:00-04:00
author: Yoonsoo Park
description: "AWS just published a guide for wiring auth code flow between MCP clients and AgentCore Gateway. The tutorial is fine; the harder question is when you actually need three-legged OAuth instead of machine-to-machine — and what breaks if you pick wrong."
categories:
  - AI
  - Security
tags:
  - agentcore
  - mcp
  - oauth
  - authentication
  - aws
---

AWS [published a walkthrough](https://aws.amazon.com/blogs/machine-learning/building-a-secure-auth-code-flow-setup-using-agentcore-gateway-with-mcp-clients/) for wiring OAuth 2.0 authorization code flow between an MCP client (Cursor, Claude Desktop, your own) and a Bedrock AgentCore Gateway acting as a tool server. It's a good tutorial. What it doesn't spell out — and what bit me when I started thinking about exposing internal tools to outside MCP clients — is the underlying decision: **when do you actually need three-legged OAuth here, and what breaks if you cheap out with client credentials?**

This post is the decision tree, not the tutorial.

## The setup, briefly

AgentCore Gateway sits between an MCP client and your Lambda-backed tools:

```
MCP Client (Cursor / Claude Desktop / custom)
        │  (MCP over HTTP+SSE, with bearer token)
        ▼
AgentCore Gateway   ──►   Cognito / Okta / Auth0 (token verification)
        │
        ▼  (signed invoke)
Lambda Tools  ──►  DynamoDB / Salesforce / Jira / whatever
```

Gateway is the OAuth resource server. The IdP issues tokens. The MCP client presents them. Two flavors of token are possible:

1. **Client credentials (M2M)** — the MCP client itself authenticates as a service account. One token, no user identity, no per-user scoping.
2. **Authorization code + PKCE** — a real human signs in once via a browser redirect, the MCP client stores the resulting access + refresh token and presents the access token on every tool call.

AWS's blog walks through option 2. The interesting question is why you'd bother.

## When client credentials is enough

Be honest first. You don't need auth code flow if all of these are true:

- The tools operate on **shared, non-user-scoped data** (a public knowledge base, an internal metrics aggregator, a read-only catalog).
- All callers are trusted (an internal agent platform, not a marketplace of third-party MCP clients).
- Audit trails don't need to attribute calls to a specific human.

In that world, one client_id + client_secret per MCP client is fine. Rotate the secret, scope the tools, ship it.

## When you actually need auth code flow

The moment any of these show up, M2M falls apart:

| Trigger | Why M2M breaks |
|---------|----------------|
| Tools query **per-user data** (this user's Salesforce records, this user's Jira tickets, this user's S3 prefix) | A shared service account either sees everything (over-privileged) or nothing (under-privileged). No middle ground without re-implementing auth inside the tool. |
| **Multi-tenant SaaS** integration | The tool needs to call a downstream API as the user. You'd otherwise have to store and impersonate per-user credentials in the tool — exactly the thing OAuth was invented to avoid. |
| **Audit/compliance** requires "who invoked this tool" | The token's `sub` claim is your audit trail. M2M tokens have a service `sub`, not a human one. |
| **Consent screens** are a product requirement | Only auth code flow shows the user "this MCP client wants to read your X" before tokens are minted. |

If you're building a tool gateway for an internal agent that does platform work, M2M is fine. If you're letting a user point Cursor at your gateway and have it act on their behalf, you need auth code flow. There is no middle option that doesn't eventually become a homebrew auth system.

## The three things that surprised me

The tutorial covers the happy path. These don't get enough airtime.

### 1. MCP transports and browser redirects don't naturally mix

OAuth auth code flow assumes a browser. MCP clients commonly run over **stdio** (Cursor, Claude Desktop) or **SSE**. Stdio has no browser. SSE has a browser but the MCP server doesn't drive it.

The MCP spec's answer is: the **client** opens a browser to the authorization endpoint when it doesn't have a valid token, captures the redirect, exchanges the code, and stores the result. The gateway never touches a browser. This works, but means:

- Every MCP client implements its own token cache and refresh logic. Cursor does it differently from Claude Desktop. Your custom client will too.
- A `redirect_uri` of `http://localhost:<random-port>` is the only realistic option for desktop clients. Register a wildcard or a generous range with your IdP, or expect to whitelist new ports forever.

### 2. Dynamic Client Registration is mostly a promise, not a reality

[RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) lets an MCP client self-register with the IdP at connection time, so users don't have to copy/paste a `client_id`. MCP 0.6 references it. **Cognito does not support it.** Okta supports it gated behind enterprise plans. Auth0 supports it but with a knob you have to turn on per-tenant.

Practical consequence: for now, you pre-create a client in the IdP, hand the `client_id` to the user, and have them paste it into the MCP client's config. Pretend dynamic registration doesn't exist until your IdP catches up.

### 3. Token lifetime ≠ agent session lifetime

A long-running agent session might span hours. Default access tokens are 60 minutes. Auth code flow gives you a refresh token, but:

- **Refresh in stdio MCP is non-trivial** — the client has to detect a 401 from the gateway, run the refresh, retry. Most stock MCP client libraries don't do this for you yet.
- **Refresh tokens are bearer secrets**. Store them in OS keychain (Keychain on macOS, Credential Manager on Windows), not a JSON file in `~/.config/`. Cursor and Claude Desktop do this; your custom client should too.
- **Idle expiration vs absolute expiration**: pick a refresh token policy that survives a 4-hour agent run but doesn't live forever. 30-day absolute, 24-hour idle is a reasonable starting point.

## Scope design — the part everyone underestimates

Two ways to design scopes:

**Per-tool scopes**: `tool:read-account`, `tool:create-opportunity`, `tool:run-report`. Fine-grained, audit-friendly, but the consent screen turns into a wall of checkboxes and you'll regret naming the 47th scope.

**Domain scopes**: `crm:read`, `crm:write`, `analytics:read`. Coarser, the consent screen is human-readable, but a single scope grants a basket of tools. Lateral movement risk if any one tool is compromised.

The right answer is usually **domain scopes for the consent UX, plus tool-level authorization inside the gateway** (the access token unlocks the door, the gateway's policy decides which Lambda you can actually invoke). That way users see five checkboxes, not fifty, and you still get fine-grained control.

## Pitfalls I've seen / expect to see

- **Mixing M2M and user clients in one Cognito resource server.** Works, but the scopes pollute each other and the consent screen shows M2M-only scopes to humans. Use two resource servers from day one.
- **Forgetting `redirect_uri` for `http://localhost` in non-prod.** Cognito, Okta, and Auth0 all let you register it; if you don't, local dev breaks and the error message points at the wrong layer.
- **Trusting the IdP's `aud` claim default.** AgentCore Gateway expects a specific audience. Cognito's default for user-pool tokens is the user pool's app client ID, which is not what Gateway wants if you've set up an explicit resource server. Configure the audience explicitly on both sides.
- **Skipping PKCE because "we're using a confidential client".** Auth code flow without PKCE on a public client (every desktop MCP client is public) is a downgrade attack waiting to happen. PKCE is free; turn it on.
- **Logging access tokens in CloudWatch.** Gateway request logs at debug level can include the `Authorization` header. Strip it before shipping logs anywhere durable.

## A decision tree, in one paragraph

If your tool reads or writes user-scoped data, or you'll ever need to know which human invoked a call, use auth code flow with PKCE. Use Cognito if you don't already have an IdP, Okta/Auth0 if you do. Design domain-level scopes for the consent screen, enforce tool-level policy inside Gateway. Pre-create OAuth clients per MCP client type until dynamic registration matures. Store refresh tokens in OS keychain. Set token lifetimes to match agent session expectations, not IdP defaults. Don't put both M2M and user clients in the same resource server. Test the local dev redirect path before you test the prod one.

The AWS tutorial is the right thing to follow once you've decided. The deciding is the part you have to do yourself.
