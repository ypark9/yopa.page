---
title: "Export IAM Identity Center Credentials Only When a Tool Requires Them"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A bounded workflow for legacy tools that require AWS environment credentials, using AWS CLI-supported export rather than SSO token-cache parsing."
categories:
  - AWS
  - Security
tags:
  - IAM Identity Center
  - AWS CLI
  - Temporary Credentials
  - Security
---

Most AWS-aware applications should receive a profile name and use the standard credential provider chain. Occasionally, a legacy tool understands only `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`. That is an interoperability exception, not a reason to parse `~/.aws/sso/cache` or call the IAM Identity Center API yourself.

## Why the old approach changed

An Identity Center cache can hold several sessions. Selecting the first JSON file may choose the wrong identity, and the cache schema is not a supported integration contract. Passing an access token on a shell command line can also expose it through logs or process inspection. The AWS CLI already knows which cached session belongs to a profile and how to exchange it for role credentials.

## Prefer direct profile support

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
AWS_PROFILE=engineering-dev aws sts get-caller-identity
```

If the target tool supports AWS profiles, stop here:

```bash
AWS_PROFILE=engineering-dev your-tool
```

For SDK code, omit explicit keys and use the default provider chain. For CI or hosted workloads, use OIDC or a workload role instead of a human Identity Center session.

## Supported export for a legacy process

AWS CLI v2 provides `aws configure export-credentials`. Verify your CLI exposes the command, then export only into the current shell immediately before launching the tool:

```bash
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
eval "$(aws configure export-credentials --profile engineering-dev --format env)"
your-legacy-tool
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
```

`eval` executes generated shell text, so use it only with the trusted AWS CLI binary, a fixed or allowlisted profile, and the `env` format. Do not accept the profile value from untrusted input. Do not echo the output or put it in shell history, a ticket, a `.env` file, or CI variables.

For a child process, prefer `env-no-export` output and parse it without logging, or configure a `credential_process` when the consumer supports the shared AWS config contract. A wrapper should verify the expected account and fail closed before launching the target.

## Tradeoffs and lifetime

Environment variables are widely compatible, but every child process inherits them and some diagnostic tools capture environments. A profile provider has a smaller exposure surface and can refresh credentials. Exported role credentials expire no later than their source session, so a long-running process must handle expiration; repeatedly scraping the cache does not solve refresh safely.

## Migration checklist

- Confirm the tool truly lacks profile, `credential_process`, web identity, or workload-role support.
- Upgrade AWS CLI v2 and configure a named Identity Center profile.
- Verify account and ARN with STS.
- Export credentials only for the child process or current short-lived shell.
- Test expiration and make failures explicit.
- Remove copied keys and custom SSO-cache parsing.
- Record the legacy exception and an owner/date for eliminating it.

## A tighter wrapper pattern

When the tool is invoked from a script, keep exported variables out of the parent shell. Ask the CLI for `env-no-export`, parse only the three expected names, construct a child environment, start the process without a shell, and discard the map afterward. Reject duplicate or unexpected keys. This is more code than `eval`, but it prevents later commands in an interactive shell from inheriting the credentials and avoids shell expansion.

Before launch, call STS using the same profile and compare the returned account with a configured account ID. The wrapper should also set a maximum runtime shorter than the remaining session lifetime when the legacy tool cannot refresh credentials. A halfway-completed destructive operation is a poor way to discover expiry.

Audit without collecting secrets: record the tool version, profile name, resolved account and role ARN, start/end time, exit status, and AWS request IDs emitted by the tool. Never record the export output. On incident response, end the Identity Center session and revoke or narrow the permission set as appropriate; deleting a local cache file alone does not undo actions already authorized.

This workaround is best for an interactive migration window. If it becomes a permanent daemon, redesign it around a provider-aware SDK, `credential_process`, web identity, or a managed AWS compute role.

Verified on **2026-08-01**.

## Official sources

- [`aws configure export-credentials`](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html)
- [IAM Identity Center authentication in AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [Sourcing credentials with an external process](https://docs.aws.amazon.com/sdkref/latest/guide/feature-process-credentials.html)
