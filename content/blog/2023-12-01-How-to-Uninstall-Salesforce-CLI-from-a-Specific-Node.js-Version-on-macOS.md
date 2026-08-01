---
title: How to Uninstall Salesforce CLI from a Specific Node.js Version on macOS
date: 2023-12-01T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Identify and remove an npm-installed Salesforce CLI from one Node.js version without deleting authentication state."
categories:
    - Software Development
tags:
  - Salesforce CLI
  - Developer Tools
  - Security
---

## Identify the active installation

Node version managers give each Node.js version its own global npm directory. Before removing anything, determine whether the active `sf` executable came from npm or Salesforce's native installer.

```bash
type -a sf
command -v sf
sf version --verbose
npm prefix --global
npm list --global --depth=0 @salesforce/cli sfdx-cli
```

If `command -v sf` points outside the reported npm prefix, changing npm packages will not remove that executable.

## Remove only the package owned by this Node version

The supported npm package is `@salesforce/cli`; `sfdx-cli` is legacy. Switch to the intended Node version, confirm its prefix again, and uninstall the package it owns:

```bash
npm uninstall --global @salesforce/cli
# If the listing showed the retired package:
npm uninstall --global sfdx-cli
hash -r
type -a sf
```

Do not manually delete whichever file `which` returns, and do not remove `~/.sfdx` or other CLI state directories. Those actions bypass the package owner and can destroy authorization or configuration unrelated to this Node version.

If another `sf` remains in `type -a`, identify its owner before deciding whether it should stay. A native installer is a good workstation default because it does not move when `nvm` changes Node versions; npm is reasonable when the team deliberately manages global tools per Node version.

Verify removal in a fresh shell. If you intend to keep Salesforce CLI, install one supported distribution and run `sf doctor` plus a read-only command against a nonproduction org. Reviewed on 2026-08-01 against [Install Salesforce CLI](https://developer.salesforce.com/docs/platform/salesforce-cli-guide/guide/install-sfdx-cli.html).
