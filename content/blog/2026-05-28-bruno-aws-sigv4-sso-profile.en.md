---
title: "Bruno + AWS SigV4 with an SSO Profile (No More Pasting Access Keys)"
date: 2026-05-28T11:50:00-04:00
author: Yoonsoo Park
description: "Bruno's AWS SigV4 auth supports profileName, which means you can sign requests against API Gateway using your SSO profile directly — no copy-pasting temporary access keys, no expiring secrets in your collection. Here's the full setup."
categories:
  - AWS
tags:
  - bruno
  - aws-sso
  - sigv4
  - tooling
  - api-gateway
---

If you've been hitting an IAM-protected API Gateway with Bruno (or Postman, or Insomnia) the old way, you know the dance: `aws configure export-credentials`, copy three values, paste them into the auth panel, hit send, hit send again two hours later, swear, repeat. Everyone who works with SSO ends up with a TODO buried somewhere that says "automate this."

Turns out you don't have to. Bruno's AWS SigV4 auth has a `profileName` field that reads directly from `~/.aws/config` and `~/.aws/sso/cache/`. Set it once, log in to SSO once a day, and Bruno does the rest.

## The setup

Two files. `opencollection.yml` at the collection root for the auth config, and an environment file per AWS account/profile.

### Collection-level auth — `opencollection.yml`

```yaml
request:
  auth:
    type: awsv4
    accessKeyId: ""
    secretAccessKey: ""
    sessionToken: ""
    service: execute-api
    region: "{{aws_region}}"
    profileName: "{{aws_profile}}"
```

The three credential fields stay empty strings. When Bruno sees a non-empty `profileName`, it ignores them and resolves credentials through the AWS SDK's profile chain — which means SSO sessions, role assumptions, and credential_process all just work.

`service: execute-api` is for API Gateway. Swap it for `lambda`, `s3`, `bedrock`, whatever you're hitting. `region` and `profileName` come from the environment.

### Environment files — `environments/dev.yml`

```yaml
name: Dev
variables:
  - name: aws_profile
    value: gap-dev
  - name: aws_region
    value: us-east-1
  - name: api_base_url
    value: https://abc123.execute-api.us-east-1.amazonaws.com/blue
```

One file per environment. Switching account is now a click in Bruno's environment dropdown — no auth panel to touch.

### Daily login

```bash
aws sso login --profile gap-dev
```

That's the only ritual. SSO tokens last 8–12 hours depending on your org's config; once a day in the morning, done.

## Why this is worth the five minutes

A few things you stop doing:

- **Pasting credentials into a collection file.** Even with gitignore, temp creds end up in chat, in a screenshot, in a `.env.local` you forgot about.
- **Re-exporting every two hours.** SSO temp creds are short-lived. With a static paste, you're refreshing constantly. With `profileName`, the SDK refreshes for you.
- **Mixing up environments.** The auth block is the same across dev/qa/prod — only the environment variable changes. There's no profile-specific access key sitting in the wrong panel.

## Pitfalls I've actually hit

- **SSO token expired.** Bruno will sign with a stale session and you'll get a confusing 403. `aws sso login --profile <name>` and retry. If you hit a lot of these, alias `aws sso login --profile <name>` to something short.
- **Wrong profile name.** Bruno fails silently to "no credentials found" if `profileName` doesn't match anything in `~/.aws/config`. Run `aws configure list-profiles` to confirm the exact string.
- **Mixing auth modes.** If you accidentally leave a real access key in `accessKeyId`, Bruno may use it instead of the profile depending on version. Keep those fields strict empty strings.
- **`credential_process` profiles work too.** If your org uses `credential_process` (corporate SSO wrapper, Granted, etc.), Bruno picks it up — same `profileName` field, no extra config.
- **Region mismatch.** SigV4 signatures include the region. If your env file says `us-east-1` but you're calling a `us-west-2` endpoint, the signature is invalid. Easy to miss when you copy a URL across environments.
- **Collection-level vs request-level auth.** If a single request overrides `auth` to something else, your collection-level SigV4 doesn't apply. Check `auth: { type: inherit }` or remove the override.

## SigV4 fields Bruno supports

For reference, when you open the AWS Sig auth panel in the UI:

1. Access Key ID
2. Secret Access Key
3. Session Token
4. Service (e.g. `execute-api`, `s3`, `lambda`, `bedrock`)
5. Region (e.g. `us-east-1`)
6. **Profile Name** — the one that makes the other three obsolete

If `profileName` is set, the first three are ignored. That's the whole trick.

## The short version

Empty strings in the credential fields, `profileName: "{{aws_profile}}"`, one env var per environment, `aws sso login` in the morning. Stop pasting temp creds into your API client.
