---
title: "Use AWS Temporary Credentials Without Reading Cache Files"
date: 2023-06-15T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-15-leveraging-aws-sso-to-acquire-aws-secretaccesskey-and-sessiontoken.html"
author: Yoonsoo Park
description: "Design AWS applications around credential providers instead of handling IAM Identity Center tokens, access keys, and refresh logic yourself."
categories:
  - AWS
  - Security
tags:
  - IAM Identity Center
  - AWS SDK for JavaScript
  - Temporary Credentials
  - Security
---

Temporary credentials contain an access key ID, secret access key, and usually a session token. Applications need them to sign AWS requests, but applications usually should not retrieve, store, or refresh those values directly. They should ask a **credential provider** when the SDK needs to sign a request.

This distinction matters. Reading the first file under `~/.aws/sso/cache`, extracting its access token, and running `aws sso get-role-credentials` assumes an internal cache layout, may select another login, and can expose a bearer token through shell arguments. It also turns application code into a partial credential manager.

## One application, different providers

Use the SDK for JavaScript v3 default provider chain:

```typescript
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const result = await s3.send(new ListBucketsCommand({}));
console.log(result.Buckets?.map((bucket) => bucket.Name));
```

There is deliberately no credential object. In local Node.js development, the provider can resolve `AWS_PROFILE` from shared config, including IAM Identity Center. In ECS or EC2 it can resolve the attached role. In EKS or external CI it can resolve web identity. This keeps environment-specific authentication outside business code and allows refresh.

Local operator flow:

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
AWS_PROFILE=engineering-dev aws sts get-caller-identity
AWS_PROFILE=engineering-dev node dist/list-buckets.js
```

Deployed workload flow: attach a least-privilege workload role and run the same program without `AWS_PROFILE`. Never copy a local SSO cache into a container image.

## When to choose an explicit provider

Use `fromIni({ profile })` when a local tool intentionally accepts a named profile or assumes a role from it. Use `fromTemporaryCredentials` for an explicit role-assumption chain. Use `fromTokenFile` for web identity environments. These providers return functions so the SDK can refresh values. Avoid resolving once and spreading the raw keys into many clients.

Do not let an untrusted request choose an arbitrary local profile or role ARN. Treat identity selection as configuration with an allowlist. Verify account and ARN at startup for tools that can mutate infrastructure.

## Failure and observability

Differentiate “no credential source”, “interactive session expired”, “role trust denied”, and “service action denied”. The remedy for an expired workforce session is an explicit login—not scanning other cache files. Record the selected profile name, Region, account, role ARN, request ID, and error code where appropriate; never record secrets or tokens.

## Alternatives and migration

AWS CLI commands already use the shared provider behavior, so a shell-only workflow may not need SDK code. A legacy program that only accepts environment variables may use the CLI-supported `export-credentials` command for a bounded child process. Static IAM access keys should remain a last resort for unsupported workloads.

Migration checklist:

- Remove filesystem reads of SSO cache and access-token parsing.
- Remove shell calls to `sso get-role-credentials`.
- Use modular SDK clients and the default provider, or one documented explicit provider.
- Separate workforce, CI, and deployed workload authentication.
- Verify the expected account and least-privilege action set.
- Test expiration and automatic refresh during a long-running process.
- Delete copied credential files and revoke any accidentally exposed session.

## Make the provider boundary visible in design

A useful application interface accepts an SDK client or a provider function, not three credential strings. That keeps authentication in the composition root and lets tests inject a client with a mock transport. It also avoids a common refresh bug: one module obtains temporary credentials, serializes them into configuration, and other modules continue using them after expiry.

For role assumption, set a meaningful role session name and use source identity or session tags only when the trust and authorization design needs them. Keep role chains short because each hop adds policy reasoning and session-duration constraints. External IDs are for confused-deputy protection in third-party cross-account access; they are not secrets and do not replace a narrow trust principal.

Operationally, alert on access denied patterns and unexpected role assumption, not on the presence of an access key ID. CloudTrail records the assumed-role session and is the place to connect activity to the workload. Use IAM Access Analyzer to validate policies and reduce permissions after observing the actions required by the application.

Before removing a legacy credential path, run a canary with the provider-based build, force a credential refresh, and verify representative calls. Disable an old IAM key before deletion and watch for failed dependencies during a bounded rollback window. This separates a recoverable migration from indefinite dual authentication.

Verified on **2026-08-01**.

## Official sources

- [Standardized credential providers](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)
- [AWS SDK for JavaScript v3 credential providers](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
- [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
