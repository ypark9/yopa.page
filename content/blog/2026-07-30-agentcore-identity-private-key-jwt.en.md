---
title: "AgentCore Identity, Now Without the Shared Secret"
date: 2026-07-30T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore Identity now supports Private Key JWT client authentication. Same agent, same goal, but the shared client secret is gone and the private key never leaves KMS. Here's the before/after with a running example, the three grant flows, and the pitfalls."
categories:
  - AWS
tags:
  - agentcore
  - identity
  - security
  - oauth
  - kms
  - bedrock
---

Let's start with one concrete agent and keep it the whole way through.

A customer-support agent needs to read a customer's order history from an internal orders API. That API is protected by your identity provider (IdP). So before the agent can call the API, it needs an access token, and to get that token it has to prove to the IdP *who it is*.

That last step, how the agent proves its identity to the IdP, is the whole subject of this post. In July 2026 AWS [added Private Key JWT client authentication to Amazon Bedrock AgentCore Identity](https://aws.amazon.com/blogs/machine-learning/authenticate-with-private-key-jwt-using-amazon-bedrock-agentcore-identity/), and it changes the answer in a way worth understanding.

## Where Identity fits in AgentCore

When an agent needs to call a protected downstream resource, it doesn't hardcode a token. It asks AgentCore Identity for one:

```
agent → GetResourceOauth2Token → (access token) → orders API
```

AgentCore Identity is the piece that goes to your IdP's token endpoint, authenticates, gets an access token back, and hands it to the agent. The agent then calls the orders API with that token and reads the order history.

The interesting question hides inside "authenticates." The IdP won't hand out a token to just anyone. The client (here, AgentCore Identity acting for your agent) has to authenticate itself first. There are two ways to do that, and moving from the old one to the new one is the point.

## Before: the shared client secret

The classic OAuth 2.0 client-credentials setup uses a shared secret. You register the agent as a client on your IdP, get back a `client_id` and a `client_secret`, and store the secret on your side. When AgentCore Identity requests a token, it sends both:

```
POST /token
grant_type=client_credentials
client_id=support-agent
client_secret=SUPER_SECRET_VALUE   ← the shared string
```

That works. But look at what you now own: a long-lived secret that has to live somewhere on your side (Secrets Manager, an env var, a config store), that both parties hold a copy of, and that grants full impersonation of the agent to anyone who reads it. So you inherit all the usual secret-lifecycle chores:

- **It sits at rest** somewhere you now have to protect and audit.
- **Rotation is manual and bilateral.** You rotate on the IdP, then update your store, and hope nothing calls in the gap.
- **Leak = identity theft.** Anyone with the string can mint tokens as your agent, and nothing about the request distinguishes them from you.
- **It doesn't scale.** Every additional agent or integration is another secret to store, rotate, and worry about.

The root problem is the trust model. A shared secret is *symmetric*: both sides hold the same string, so possession is identity. The IdP can't tell "the real agent" from "someone who copied the string."

## After: Private Key JWT

Private Key JWT swaps the symmetric secret for an *asymmetric* signature. You generate a key pair, register only the **public** key with your IdP, and keep the **private** key in AWS KMS, where it never leaves.

Now when the agent needs a token:

1. The agent calls `GetResourceOauth2Token` on AgentCore Identity.
2. AgentCore Identity reads your credential provider config (client ID, KMS key ARN, signing algorithm), builds a short-lived JWT client assertion, and calls `kms:Sign` against your KMS key.
3. KMS signs the assertion and returns the signature. **The private key never leaves KMS.**
4. AgentCore Identity posts the signed assertion to your IdP's token endpoint with `grant_type=client_credentials` and `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`.
5. The IdP verifies the signature against the public key you registered and returns an access token.
6. AgentCore Identity hands the token to the agent, which calls the orders API and reads the order history.

Same agent, same orders API, same end result. What changed is the middle. Instead of shipping a secret string, the client proves identity by signing something with a key it can use but can never extract.

The credential-provider config tells the whole story of the shift. Before, the sensitive material *is* the config:

```
client_id:     support-agent
client_secret: SUPER_SECRET_VALUE     ← the thing you must guard
```

After, the config just *points* at a key, and the secret part lives in KMS under an IAM policy:

```
client_id:      support-agent
kms_key_arn:    arn:aws:kms:us-east-1:111122223333:key/....
signing_alg:    ES256                 ← no secret in sight
```

Walk down the same list of chores from before and they mostly evaporate:

- **Nothing sensitive at rest on your side.** The private key is in KMS; you only store an ARN.
- **Rotation is one-sided and clean.** Roll the key, register the new public key, retire the old. The private material never has to be copied anywhere.
- **A leaked config isn't a leaked identity.** The ARN is useless without `kms:Sign` permission on the key.
- **It scales down to per-agent keys** with per-key policies and per-key audit trails.

## Which grant flow? Map it to your case

Private Key JWT authenticates the *client*, and that's orthogonal to *whose* identity the resulting token represents. AgentCore Identity supports three grant flows, and choosing is really a question about who the agent is acting as:

- **Machine-to-machine (M2M)**: the agent acts as *itself*. No human in the loop. Any support agent can read the data regardless of who triggered it. Uses the `client_credentials` grant; the token's subject is the client. **Our running example lands here**: reading order history is a service-level read, not tied to a specific signed-in user.

- **On-behalf-of (OBO)**: the agent acts *for a specific user* using that user's existing token. A user already signed in somewhere, and you want their permissions and identity to carry through to the downstream call. AgentCore Identity exchanges the inbound user token for a downstream one (RFC 8693 token exchange or the RFC 7523 JWT authorization grant), while still authenticating itself with the client assertion.

- **User-delegated access**: the agent acts for a user, but there's no pre-existing token, so the user goes through an interactive login/consent (three-legged authorization-code flow) and approves what the agent can do first.

If our support agent needed to read data *as the customer* with the customer's own permissions, we'd move to OBO. Since it reads at the service level, M2M is the right fit. Private Key JWT works the same way underneath all three.

## Pitfalls I'd watch for

**The signing algorithm is a three-way agreement.** The algorithm your IdP requires for Private Key JWT has to be supported by AWS KMS *and* by AgentCore Identity *and* match what you configure. Options are RS256, PS256, or ES256, and the KMS key spec has to line up (the AWS example uses `ECC_NIST_P256` with `ES256`). Pick the algorithm first, then create a KMS key whose spec supports it. Getting these out of sync produces confusing verification failures at the token endpoint, not at key-creation time.

**Lock the key to AgentCore with `kms:ViaService`.** In the KMS key policy, grant `kms:Sign` but constrain it with a `kms:ViaService` condition scoped to `bedrock-agentcore-identity.<region>.amazonaws.com`. That means the key can only be used to sign when the request originates through AgentCore Identity, not by anything else that happens to hold `kms:Sign`. It's the difference between "this key exists" and "this key can only do the one job you built it for."

**Decide who owns the key material.** Two paths: create the key pair in KMS and export the public key to your IdP (`kms:GetPublicKey`), or let the IdP generate the pair and import the private material into KMS (`kms:GetParametersForImport` + `kms:ImportKeyMaterial`). The first keeps the private key born-in-KMS and never exportable, which is the stronger posture. Prefer it unless your IdP forces the second.

**Audit the signing calls in CloudTrail.** Every `kms:Sign` your credential provider triggers shows up in CloudTrail. That gives you a record of when a token was minted for the agent and under whose request, which is exactly the visibility a shared secret never gave you (a secret leaking and being reused elsewhere leaves no trace on your side).

## What to actually do

If you have a credential provider still using a shared client secret, put it on the migration list. The mechanics are modest (a KMS key, a public-key registration, a config change) and the payoff is deleting a long-lived secret from your surface area.

For anything new, start with Private Key JWT. There's little reason to introduce a fresh shared secret in 2026 when the client can prove itself with a signature and never hold the private key at all. The trust model quietly moved from "we both know the password" to "I can sign, but I can't tell you how," and that's the version you want your agents running.
