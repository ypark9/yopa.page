---
title: "Run Anonymous Apex Safely with sf CLI"
date: 2023-05-07T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-07-running-apex-cls-file-on-cli.html"
author: Yoonsoo Park
description: "Run reviewed .apex scripts with sf CLI without shell interpolation."
categories:
  - Salesforce
  - Security
tags:
  - Apex
  - Salesforce CLI
  - Security
---

Verified on 2026-08-01. A `.cls` file defines a class; it is not an anonymous script. The retired TypeScript wrapper also built a shell command from paths, creating an injection risk.

Put intentional executable statements in a reviewed `.apex` file and run:

```bash
sf apex run --file scripts/apex/seed-data.apex --target-org scratch --json
```

For a Node wrapper, use `spawn`/`execFile` with an argument array, accept only `.apex` files beneath an allowlisted directory, and parse JSON plus the process exit code. Never run every file discovered in a directory. Use Apex tests or a deployable class when code belongs in the application; anonymous Apex is best for controlled administration and repeatable setup scripts.

Migration: rename only genuine scripts to `.apex`, move class definitions to `force-app`, review DML/callouts, test in a disposable org, then record the target alias explicitly.

Reference: [Apex commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex.html).

## Current mental model

Anonymous Apex is an administrative script evaluated in one org context. A `.cls` file is deployable source with metadata and lifecycle. Running every class file as a script confuses those boundaries and can execute DML against the wrong org.

## Build a controlled runner

Keep scripts under `scripts/apex`, review them like migrations, and make target selection explicit:

```bash
sf org display --target-org scratch
sf apex run --file scripts/apex/seed-data.apex \
  --target-org scratch --json >apex-result.json
jq '{status, success: .result.success, logs: .result.logs}' apex-result.json
```

The script itself should be idempotent where possible: query by a stable key, insert only missing records, and fail on unexpected duplicates. Avoid printing customer data, credentials, or full HTTP responses. Use Named Credentials for callouts and a disposable org for the first execution.

A programmatic wrapper must resolve each candidate beneath the allowed directory, reject symlinks or extensions outside policy, and invoke the executable with an argument array. Limit concurrency, stop on the first failure unless independence is proven, and return a nonzero process exit code.

## Alternatives and tradeoffs

Anonymous Apex is fast for reviewed one-off work but has weak deployment history. A deployable Apex class plus tests is better for reusable application behavior. Data plans or `sf data` commands are clearer for seed data, while Metadata API is for configuration rather than records.

## Migration checklist

Classify every old `.cls`: deploy classes, convert only true statement scripts to `.apex`, delete generated copies, and record ownership. Review DML, limits, sharing mode, callouts, and rollback. Test twice to prove idempotency, inspect the JSON success value, confirm expected records, and ensure no script output contains secrets.
