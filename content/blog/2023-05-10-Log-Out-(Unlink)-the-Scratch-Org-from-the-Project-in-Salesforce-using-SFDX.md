---
title: Log Out (Unlink) the Scratch Org from the Project in Salesforce using SFDX
date: 2023-05-10T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Log out (unlink) the Scratch org from the project in Salesforce"
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Scratch Orgs
  - OAuth
---

Logging out and deleting a scratch org are different operations. Logging out removes local authorization. Deleting a scratch org disposes of the remote org through its Dev Hub. Choose the operation that matches your intent.

## Prerequisites
Before proceeding, make sure that you have the following:

- Salesforce CLI installed on your local machine
- A Salesforce DX project connected to your Dev Hub org
- At least one Scratch Org created and authorized for the project

## Remove local authorization

```
sf org logout --target-org my-scratch
```

Then verify the local authorization list:

```
sf org list auth
```

This does not delete the scratch org. If the project still targets that alias, select another with `sf config set target-org=another-org`.

To dispose of the org, first verify its ID with `sf org display --target-org my-scratch`, then run `sf org delete scratch --target-org my-scratch`. Keep the confirmation prompt for interactive work. Reviewed against the [Salesforce CLI org reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html) on 2026-08-01.
