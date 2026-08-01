---
title: How to Switch Scratch Orgs for a VS Code Project Using CLI
date: 2023-04-30T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "How to Switch Scratch Orgs for a VS Code Project Using CLI"
categories:
  - SalesForce
tags:
  - Salesforce CLI
  - Scratch Orgs
  - OAuth
---

Salesforce CLI uses the `target-org` configuration value when a command doesn't receive an explicit target. Give each org a recognizable alias, and prefer an explicit `--target-org` in automation.

## Authorize and select the org

Authorize the org only if it isn't already available locally:
```bash
sf org login web --instance-url https://test.salesforce.com --alias my-scratch
```

Setting an alias during login does not guarantee that the org becomes this project's default. Set that choice explicitly from the project directory:

2. Update your project's configuration file to use the new Scratch Org by running the following command:
```bash
sf config set target-org=my-scratch
sf org display --target-org my-scratch
```

Verify that VS Code shows the same alias in its status bar. If it doesn't, use the Salesforce extension's org-selection command and check `sf config get target-org`. In CI or before a destructive operation, pass `--target-org my-scratch` rather than relying on ambient configuration.

Reviewed against the [Salesforce CLI org reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html) on 2026-08-01.
