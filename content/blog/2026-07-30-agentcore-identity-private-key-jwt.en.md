---
title: "Using AgentCore Identity Without a Shared Client Secret"
date: 2026-07-30T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore Identity now supports Private Key JWT client authentication. This post explains how it replaces a shared client secret, where KMS fits, and how to choose among the three supported grant flows."
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

Consider a customer-support agent that needs to read a customer's order history from an internal orders API. The API is protected by an identity provider (IdP), so the agent needs an access token before it can make the request. To obtain that token, it first has to authenticate itself to the IdP.

This authentication step is the focus of this post. In July 2026, AWS [added Private Key JWT client authentication to Amazon Bedrock AgentCore Identity](https://aws.amazon.com/blogs/machine-learning/authenticate-with-private-key-jwt-using-amazon-bedrock-agentcore-identity/), providing an alternative to shared client secrets. The [current AgentCore configuration docs](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/private-key-jwt.html) are the source of truth for supported algorithms, key policy, and regional placement.

## Where Identity fits in AgentCore

When an agent needs to call a protected downstream resource, it asks AgentCore Identity for a token:

```
agent → GetResourceOauth2Token → (access token) → orders API
```

AgentCore Identity authenticates with the IdP's token endpoint, obtains an access token, and returns it to the agent. The agent then uses the token to call the orders API.

The important detail is how that authentication works. Before the IdP issues a token, the client, in this case AgentCore Identity acting for the agent, must prove its identity.

## Before: the shared client secret

A traditional OAuth 2.0 client-credentials setup uses a shared secret. You register the agent as a client with the IdP, receive a `client_id` and `client_secret`, and store the secret. AgentCore Identity sends both values when it requests a token:

```
POST /token
grant_type=client_credentials
client_id=support-agent
client_secret=SUPER_SECRET_VALUE   ← the shared string
```

The approach works, but it leaves you responsible for a long-lived credential. The secret must be stored somewhere, such as Secrets Manager, an environment variable, or a configuration store. Both parties retain a copy, and anyone who obtains it can impersonate the agent. That creates several operational problems:

- **Storage:** The secret has to be protected and audited wherever it is stored.
- **Rotation:** The value must be changed at the IdP and in your own store without interrupting requests.
- **Exposure:** Anyone with the secret can request tokens as the agent, and the IdP cannot distinguish that request from a legitimate one.
- **Scale:** Each new agent or integration adds another secret to store and rotate.

The limitation comes from the symmetric trust model: both sides hold the same value, so possession of the secret is enough to authenticate.

## After: Private Key JWT

Private Key JWT replaces the symmetric secret with an asymmetric signature. You generate a key pair, register the **public key** with the IdP, and keep the **private key** in AWS KMS.

The token request then works as follows:

1. The agent calls `GetResourceOauth2Token` on AgentCore Identity.
2. AgentCore Identity reads the credential provider configuration (client ID, KMS key ARN, and signing algorithm), creates a short-lived JWT client assertion, and calls `kms:Sign` with the KMS key.
3. KMS signs the assertion and returns the signature. **The private key remains in KMS.**
4. AgentCore Identity posts the signed assertion to your IdP's token endpoint with `grant_type=client_credentials` and `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`.
5. The IdP verifies the signature against the public key you registered and returns an access token.
6. AgentCore Identity returns the token to the agent, which uses it to call the orders API.

The agent and downstream API do not change. Only the client-authentication step changes: instead of sending a shared secret, the client proves that it can use the private key without extracting or transmitting it.

The difference is also visible in the credential provider configuration. With a shared secret, the sensitive value is part of the configuration:

```
client_id:     support-agent
client_secret: SUPER_SECRET_VALUE     ← the thing you must guard
```

With Private Key JWT, the configuration points to a KMS key, and IAM controls who can use it. The KMS key must be in the same Region as the credential provider (cross-account use is supported when the key policy allows it):

```
client_id:      support-agent
kms_key_arn:    arn:aws:kms:us-east-1:111122223333:key/....
signing_alg:    ES256                 ← no private key in the config
```

This addresses many of the operational problems of a shared secret:

- **Storage:** The private key stays in KMS; the configuration stores only its ARN.
- **Rotation:** You can create a new key, register its public key, and then retire the old one without copying private key material.
- **Exposure:** A leaked key ARN is not sufficient to authenticate without `kms:Sign` permission.
- **Scale:** Each agent can have its own key, policy, and audit trail.

## Choosing a grant flow

Private Key JWT authenticates the *client*. It does not determine whose identity the resulting token represents. AgentCore Identity supports three grant flows, and the right choice depends on who the agent is acting as:

- **Machine-to-machine (M2M):** The agent acts as itself, without a user identity. It uses the `client_credentials` grant, and the token subject is the client. The example in this post fits this flow because the order-history lookup is a service-level operation.

- **On-behalf-of (OBO):** The agent acts for a specific user who already has a token. AgentCore Identity exchanges the incoming user token for a downstream token (RFC 8693 token exchange or the RFC 7523 JWT authorization grant) while authenticating the client with its assertion.

- **User-delegated access:** The agent acts for a user who does not yet have a token. The user completes an interactive sign-in and consent flow (a three-legged authorization-code flow) before the agent can act.

If the support agent had to read data using the customer's own identity and permissions, OBO would be a better fit. For a service-level lookup, M2M is appropriate. Private Key JWT can authenticate the client in all three flows.

## Details to check

**The signing algorithm must match across three systems.** The algorithm required by the IdP must be supported by AWS KMS and AgentCore Identity, and it must match the credential provider configuration. The available options are RS256, PS256, and ES256, with a compatible KMS key specification. The AWS example uses `ECC_NIST_P256` with `ES256`. Choose the algorithm first, then create a KMS key that supports it. A mismatch typically appears as a verification failure at the token endpoint rather than during key creation.

**Restrict the key with `kms:ViaService`.** Grant `kms:Sign` and `kms:DescribeKey` in the KMS key policy as required by the provider, but constrain use with a `kms:ViaService` condition for `bedrock-agentcore-identity.<region>.amazonaws.com`. This limits signing to requests made through AgentCore Identity, even if another principal has a broad KMS permission.

**Choose where the key pair is generated.** You can create the key pair in KMS and send the public key to the IdP (`kms:GetPublicKey`), or generate it at the IdP and import the private material into KMS (`kms:GetParametersForImport` and `kms:ImportKeyMaterial`). Generating the key in KMS keeps the private key non-exportable from the start and is preferable unless the IdP requires the second approach.

**Audit signing calls in CloudTrail.** Each `kms:Sign` call made by the credential provider is recorded in CloudTrail. These events provide a record of when and under whose request the key was used. A shared secret reused outside your environment does not provide the same visibility.

## Migration guidance

For an existing credential provider that uses a shared client secret, migration requires a KMS key, public-key registration at the IdP, and a credential provider configuration change. The main benefit is removing a long-lived shared secret from the authentication path.

For new integrations, Private Key JWT is a sensible default when the IdP supports it. It lets the client authenticate with a signature while keeping the private key inside KMS, reducing both secret-management work and the risk of credential exposure.
