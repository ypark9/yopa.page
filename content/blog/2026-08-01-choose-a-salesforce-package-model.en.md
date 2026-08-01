---
title: "Choose a Salesforce Package Model: 1GP, Managed 2GP, or Unlocked"
date: 2024-02-05
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-02-05-understanding-salesforce-packaging-a-comprehensive-comparison-of-1gp-vs-2gp.html"
author: Yoonsoo Park
description: "A lifecycle-based decision guide for Salesforce package models."
categories:
  - Salesforce
tags:
  - Salesforce Packaging
  - Salesforce DX
  - CI/CD
---

Verified against Salesforce documentation on 2026-08-01.

## Why the old comparison was archived

Packaging isn't a linear upgrade from 1GP to 2GP. The earlier article incorrectly suggested that a namespace-free package could later be promoted into a managed package and described dependencies as flexible version ranges. Package type, namespace, ancestry, and version dependencies are lifecycle decisions with constraints.

## Decision model

- Maintain an existing managed 1GP product when migration cost and compatibility outweigh 2GP benefits.
- Choose managed 2GP for a new commercial or partner-distributed application that needs namespacing, upgrade lineage, and AppExchange lifecycle.
- Choose unlocked packages for internal modular delivery where source control is authoritative and subscribers control installation.
- Use unmanaged packages only for templates or one-time sharing, not an upgradeable product.

Managed packages require deliberate namespace and Dev Hub planning. An unlocked package without a namespace does not become a managed package by promotion. Dependencies identify package versions; validate the exact dependency graph instead of assuming arbitrary semantic ranges.

## Safe workflow

```bash
sf package create --name BillingCore --package-type Unlocked \
  --path force-app --target-dev-hub dev-hub
sf package version create --package BillingCore \
  --installation-key-bypass --wait 20 --target-dev-hub dev-hub
sf package version promote --package 04t... --target-dev-hub dev-hub
sf package install --package 04t... --target-org test --wait 20
```

Never promote before installing the version in a clean org and running Apex, permission, upgrade, and dependency tests. Protect installation keys and do not print auth URLs in CI.

## Tradeoffs

Unlocked packages favor internal autonomy but don't provide the same intellectual-property and subscriber controls as managed packages. Managed 2GP improves source-driven releases but makes namespace, ancestry, and version choices durable. 1GP remains valid for established products, although new development loses many 2GP workflow benefits. Direct metadata deployment is simpler for a small org but provides no package installation boundary.

## Migration checklist

1. Inventory subscribers, namespace, package IDs, dependencies, and upgrade promises.
2. Decide internal versus external distribution and ownership of upgrades.
3. Prototype the chosen model in a separate Dev Hub and disposable org.
4. Define package directories and dependency versions in `sfdx-project.json`.
5. Test fresh install, upgrade, uninstall behavior, permissions, and data migration.
6. Promote only an immutable version that passed the release gate.
7. Document rollback; package promotion itself isn't a rollback mechanism.

## Verification and sources

Confirm the package/version IDs in the Dev Hub, install into an empty org, upgrade from the oldest supported version, and run the complete test suite.

- [Package Types](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm)
- [Unlocked Package Workflow](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_workflow.htm)
- [Salesforce CLI package commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_package.html)
