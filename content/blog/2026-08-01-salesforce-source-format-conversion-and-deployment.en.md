---
title: "Salesforce Source Format, Conversion, and Deployment"
date: 2026-08-01
author: Yoonsoo Park
description: "Deploy Salesforce source directly and reserve Metadata API conversion for real interoperability needs."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Metadata API
  - CI/CD
---

This guide was verified against Salesforce's current CLI reference on 2026-08-01.

## Why the old conversion-first flow changed

Salesforce DX source format splits large Metadata API files into smaller files that work better in Git. Older workflows often converted that source into Metadata API format before every deployment. Current Salesforce CLI deploys project source directly, including to sandboxes and production orgs. Conversion remains supported, but it is an interoperability tool rather than a required deployment stage.

The old `sfdx force:source:convert` command is also part of the unsupported `sfdx` CLI. Keeping it in a build adds an intermediate artifact, extra file-selection logic, and an opportunity for the converted package to drift from the reviewed source.

## Current mental model

Keep the repository in source format. Use `sf project deploy start` for delivery and `sf project retrieve start` for deliberate retrieval. Convert only at a boundary where another tool or process explicitly requires Metadata API format.

```bash
# See what the CLI intends to deploy.
sf project deploy preview --source-dir force-app --target-org staging

# Validate without committing the deployment.
sf project deploy start --source-dir force-app --target-org staging \
  --dry-run --test-level RunLocalTests

# Deploy the same reviewed scope.
sf project deploy start --source-dir force-app --target-org staging \
  --test-level RunLocalTests
```

Use a manifest when release scope is curated independently of a directory:

```bash
sf project deploy start --manifest manifest/package.xml \
  --target-org staging --dry-run
```

Always inspect the preview, identify destructive changes separately, and choose a test level appropriate to the target. Authentication belongs in the workstation keychain or CI secret store, not in the repository.

## When conversion is appropriate

Convert source format to Metadata API format when a downstream system accepts a `package.xml` bundle and cannot consume a Salesforce DX project:

```bash
sf project convert source --root-dir force-app \
  --output-dir build/mdapi --package-name ReleaseBundle
```

Convert a received Metadata API package into source format before maintaining it in Git:

```bash
sf project convert mdapi --root-dir incoming/unpackaged \
  --output-dir force-app
```

Conversion is useful for legacy integrations, package inspection, and migrations. Its costs are duplicated artifacts and lossy-looking structural changes: a single object file can become many source files, and recomposition can make diffs hard to reason about. Treat generated output as ephemeral and rebuild it from reviewed source.

## Migration checklist

1. Find `sfdx force:source:convert`, `mdapi:deploy`, and committed converted directories.
2. Confirm whether any downstream consumer truly requires Metadata API format.
3. Replace ordinary delivery with `sf project deploy preview` and `sf project deploy start --dry-run`.
4. Preserve manifests when they express intentional release scope.
5. If conversion remains necessary, write to a clean build directory and never edit both representations.
6. Test retrieval and deployment in a disposable org, including decomposed metadata such as Custom Objects.
7. Run the project test suite and compare the deployed component set before changing production automation.

## Verification

A successful command is not enough. Confirm that preview selected the expected components, validation ran the intended tests, the target org is explicit, and Git contains only the source representation. In CI, pin the CLI version and archive deployment reports rather than converted secrets or auth material.

## Official sources

- [Salesforce CLI command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html)
- [Migrate from sfdx to sf](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
- [Salesforce DX project structure](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm)
