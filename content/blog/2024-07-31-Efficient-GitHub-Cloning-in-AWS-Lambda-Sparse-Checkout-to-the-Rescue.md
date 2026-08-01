---
title: Efficiently Read a Git Repository from AWS Lambda
date: 2024-07-31
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Choose archive downloads, shallow partial clones, or a longer-running service for repository analysis in Lambda, with safe refs and temporary storage."
categories:
  - AWS Lambda
  - Git
  - Python
tags:
  - AWS Lambda
  - Git
  - GitHub
  - Security
---

AWS Lambda still has a 15-minute execution limit, but `/tmp` is no longer fixed at 512 MB. Ephemeral storage is configurable from 512 MB to 10,240 MB. More space can make a job fit, but it does not fix unbounded clone time, unsafe credentials, concurrent capacity, or a workflow that needs to run longer than Lambda allows.

## Pick the lightest retrieval method

If you need files from one immutable commit or tag and do not need Git history, download a GitHub archive or use the Contents API. This avoids shipping a Git binary and object database in the Lambda package.

If you need Git semantics, combine three distinct controls:

- **shallow fetch** limits commit history;
- **partial clone/filter** avoids downloading unneeded object contents when the server supports it;
- **sparse checkout** limits which paths appear in the working tree.

Sparse checkout alone does not guarantee a small network transfer because objects outside the working tree may already have been fetched.

```bash
git clone --depth=1 --filter=blob:none --sparse \
  --branch v1.2.3 https://github.com/example/project.git /tmp/project
git -C /tmp/project sparse-checkout set --cone src config.json
git -C /tmp/project rev-parse --verify 'HEAD^{commit}'
```

Treat a tag, branch, repository URL, and sparse path received from an event as untrusted. Prefer a full commit SHA from an allowlisted repository. Do not build a shell string from those values. In Python, call a subprocess with an argument array, set a timeout, capture bounded output, and clean a unique invocation directory in `finally`.

## Authentication

For a private GitHub repository, prefer a GitHub App installation token with narrow repository permissions and short lifetime. Store the app private key in an approved secret store and never put a token in the clone URL, where logs and errors can reveal it. Configure a credential helper or an HTTP authorization header without logging it. A personal access token tied to one developer has weaker ownership and rotation characteristics.

Lambda's AWS execution role and GitHub identity solve different boundaries. Scope the execution role to required secrets, S3, logs, or other AWS actions.

## Storage and packaging

Set ephemeral storage from measured repository and concurrency needs, not the maximum by default. `/tmp` is isolated per execution environment and can survive warm reuse, so use unique directories and never trust leftovers from a previous invocation. Encrypting temporary storage is handled by Lambda, but the data still belongs in the threat model and retention design.

Git is not included in every Lambda runtime. Package a pinned Git build in a Lambda layer or container image and scan/update it. Verify architecture compatibility. Container image size and cold starts may make an archive/API approach simpler.

## When Lambda is the wrong runtime

Use Step Functions to coordinate bounded Lambda steps, AWS Batch or ECS/Fargate for long or resource-heavy repository analysis, or CodeBuild when the workload is fundamentally a build. Move away from Lambda when worst-case input approaches 15 minutes, needs large durable workspaces, or invokes many untrusted repository hooks/tools.

## Verification checklist

- Measure transfer, disk use, cold-start and runtime against the largest allowed repository.
- Test invalid and moved tags, annotated tags, missing sparse paths, timeout, rate limit, and partial-clone fallback.
- Verify commit SHA before analysis and reject unapproved repository hosts.
- Confirm tokens are absent from logs, exceptions, process arguments, and telemetry.
- Clean `/tmp` and cap subprocess time/output.
- Test duplicate events and make downstream writes idempotent.

Official documentation reviewed on **2026-08-01**:

- [Lambda ephemeral storage](https://docs.aws.amazon.com/lambda/latest/dg/configuration-ephemeral-storage.html)
- [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [Git partial clone](https://git-scm.com/docs/partial-clone)
- [Git sparse checkout](https://git-scm.com/docs/git-sparse-checkout)
- [GitHub App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
