---
title: "Sign API Gateway Requests with SigV4 and AWS SDK for JavaScript v3"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Invoke an IAM-authorized API Gateway endpoint with the JavaScript v3 signer and temporary credentials, including body signing and verification."
categories:
  - AWS
  - TypeScript
tags:
  - Amazon API Gateway
  - SigV4
  - AWS SDK for JavaScript
  - Security
---

Signature Version 4 proves that an AWS request was signed by credentials authorized to perform an action. For API Gateway, it is useful when callers already have AWS identities: internal workloads, operators using federation, or CI using OIDC. It is not a replacement for end-user authentication in a public browser application.

The older pattern combined the end-of-support AWS SDK for JavaScript v2, a third-party signer, and access keys in source code. The current pattern uses modular v3 packages and the default credential provider chain.

## Configure the API and caller

Set the API Gateway route or method authorization type to `AWS_IAM`. Grant the caller `execute-api:Invoke` only on the required API, stage, method, and resource path. The API's resource policy and network policy may impose additional limits.

For local development, log in with IAM Identity Center. On Lambda, ECS, or EC2, attach a role. The same code can use both because it does not contain keys.

```bash
npm install @aws-sdk/signature-v4 @aws-sdk/protocol-http \
  @aws-sdk/credential-provider-node @aws-crypto/sha256-js
```

## Sign and send

```typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";

const region = "us-east-1";
const url = new URL(
  "https://abc123.execute-api.us-east-1.amazonaws.com/prod/orders"
);
const body = JSON.stringify({ orderId: "123" });

const signer = new SignatureV4({
  service: "execute-api",
  region,
  credentials: defaultProvider(),
  sha256: Sha256,
});

const request = new HttpRequest({
  protocol: url.protocol,
  hostname: url.hostname,
  method: "POST",
  path: `${url.pathname}${url.search}`,
  headers: {
    host: url.hostname,
    "content-type": "application/json",
  },
  body,
});

const signed = await signer.sign(request);
const response = await fetch(url, {
  method: signed.method,
  headers: signed.headers,
  body,
});

if (!response.ok) {
  throw new Error(`API returned ${response.status}: ${await response.text()}`);
}
```

The exact body, path, query string, host, and signed headers sent over the network must match what was signed. Do not mutate JSON or add a proxy path afterward. Temporary credentials require the session token; the provider supplies it to the signer.

## Debugging without exposing secrets

On a `403`, distinguish an API authorization failure from `SignatureDoesNotMatch`. Confirm the account and ARN with STS, Region, service name `execute-api`, deployed stage/path, clock synchronization, resource ARN, and API resource policy. Log request IDs and non-sensitive canonical inputs, never the Authorization header, session token, or credentials.

## Alternatives and tradeoffs

SigV4 gives strong workload identity and IAM policy control, but browsers cannot safely hold AWS credentials. Use Cognito/OIDC JWT authorization or another application identity layer for end users. For service-to-service calls outside AWS identity boundaries, OAuth 2.0 may provide a better contract. API keys in API Gateway identify usage-plan consumers; they are not authorization by themselves.

## Migration checklist

- Remove SDK v2, `aws4`, and explicit access keys.
- Enable `AWS_IAM` only for callers that can obtain AWS credentials safely.
- Use Identity Center, workload roles, or OIDC and the provider chain.
- Scope `execute-api:Invoke` to the necessary route.
- Test GET, query encoding, and non-empty body requests.
- Test expired credentials, wrong Region, wrong route, and denied IAM permissions.
- Verify CloudTrail/API logs without recording signed secrets.

## Canonicalization cases worth testing

SigV4 bugs often hide in inputs that a happy-path GET does not cover. Test repeated query keys, spaces and Unicode, an empty body, a JSON body, and a path containing percent-encoded characters. Build the final serialized body once, sign those bytes, and send those same bytes. If a library or proxy normalizes the path or host after signing, the service calculates a different canonical request.

Credential-provider behavior deserves its own test boundary. In unit tests, inject a fixed fake provider into the signer; never depend on a developer profile. In an integration environment, assume a dedicated low-privilege role, invoke an allowed route, and confirm a neighboring method and route are denied. This proves both the positive path and the resource ARN scope.

For cross-account invocation, the API owner may need a resource policy in addition to the caller's identity policy. For private APIs, endpoint and VPC policies add more policy layers. Diagnose each layer independently rather than broadening all of them until the call succeeds. A temporary `execute-api:*` grant can conceal an incorrect route ARN and is easy to leave behind.

Finally, retry only operations that are safe to retry. Signature or authorization errors will not recover with exponential backoff. For mutating APIs, use an application idempotency key so a network retry cannot create a duplicate business action.

Verified on **2026-08-01**.

## Official sources

- [Control access to an API with IAM permissions](https://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html)
- [Signing AWS API requests](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html)
- [AWS SDK for JavaScript v3 credential providers](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
