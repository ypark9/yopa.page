---
title: "Use IAM Identity Center Profiles Safely from TypeScript"
date: 2023-05-23T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-23-aws-sso-with-typescript.html"
author: Yoonsoo Park
description: "Use AWS SDK for JavaScript v3 with IAM Identity Center profiles without parsing cache files, embedding keys, or interpolating shell commands."
categories:
  - AWS
  - TypeScript
tags:
  - IAM Identity Center
  - AWS SDK for JavaScript
  - Temporary Credentials
  - Security
---

AWS Single Sign-On was renamed **AWS IAM Identity Center**. More importantly, application code no longer needs to launch `aws sso login` through a shell or extract credentials itself. AWS CLI v2 performs the interactive login; the AWS SDK for JavaScript v3 resolves and refreshes the resulting temporary credentials.

## Configure and authenticate

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
```

Modern CLI configuration normally contains a reusable `sso-session` section plus a profile that selects the account and permission set. Let the CLI write this structure. Do not depend on its exact cache-file layout: it is an implementation detail, can contain multiple sessions, and is not an application API.

Login is deliberately interactive. Keep it outside a server process and outside a web request handler. A program that interpolates an untrusted profile name into `exec("aws sso login ...")` also creates command-injection risk.

## Use the v3 provider chain

Install only the service client you use and the credential provider package:

```bash
npm install @aws-sdk/client-sts @aws-sdk/credential-providers
```

```typescript
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-providers";

const profile = process.env.AWS_PROFILE ?? "engineering-dev";

const sts = new STSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: fromIni({ profile }),
});

const identity = await sts.send(new GetCallerIdentityCommand({}));
console.log({ account: identity.Account, arn: identity.Arn });
```

`fromIni` supports profiles that use IAM Identity Center and profiles that assume another role from that source. For a simple service client, the Node.js default provider chain is often enough: set `AWS_PROFILE` and omit `credentials` entirely. `fromSSO` is useful when the selected profile itself is an SSO profile, but `fromIni` is more flexible for role chaining.

Never log the resolved credential object. The access key, secret key, and session token are short-lived, but still authorize requests until they expire.

## Local people and deployed workloads are different

Identity Center profiles are intended for workforce tools and local development. Code deployed to Lambda, ECS, EC2, or EKS should use its workload role through the default provider chain. CI should prefer OIDC federation. A server must not depend on a developer's browser session or home-directory cache.

## Failure handling

If the session expired, the SDK error should tell the operator to run `aws sso login --profile ...`; the application should not silently switch to another profile. Validate the resolved account before destructive operations. Avoid `default` for scripts that can change infrastructure, because an implicit profile makes account mistakes harder to see.

## Migration checklist

- Upgrade from the monolithic `aws-sdk` v2 package to modular v3 clients.
- Replace embedded keys and custom cache parsing with the default provider chain or `fromIni`.
- Move interactive login to an explicit operator step.
- Validate account and ARN with STS before changes.
- Replace shell-string execution with SDK calls; if a CLI process is unavoidable, use argument arrays and an allowlisted profile.
- Test expiry and re-login behavior, role chaining, and a wrong-account guard.

Tradeoff: profile-based authentication is convenient for local tools, but it requires AWS CLI v2 and an interactive session. Workload roles are non-interactive and better for deployment, while OIDC is better for external automation.

## Account guard for mutating tools

For a deployment or cleanup utility, make the expected account an explicit input and stop before the first mutation when it differs. This protects against a valid session for the wrong account—a failure that credential refresh cannot detect.

```typescript
const expectedAccount = process.env.EXPECTED_AWS_ACCOUNT_ID;
if (!expectedAccount || identity.Account !== expectedAccount) {
  throw new Error(
    `Refusing to continue: expected ${expectedAccount}, resolved ${identity.Account}`
  );
}
```

Also test three negative paths: no cached session, a profile that is configured but not authorized for the account, and a permission set that can authenticate but cannot perform the service action. Authentication success and authorization success are separate facts. When reporting failure, include the non-sensitive profile, account, role ARN, Region, AWS request ID, and error name; redact tokens and signed headers.

For long-running local processes, keep the provider function attached to each SDK client so it can refresh. Resolving it once at startup and converting it into a plain credential object discards that advantage. If the process must run unattended for days, a human SSO session is the wrong operational identity; move it to a managed workload or an external workload federation flow.

Verified on **2026-08-01**.

## Official sources

- [IAM Identity Center authentication in the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [AWS SDK for JavaScript v3 credential providers](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
- [`@aws-sdk/credential-providers`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/)
