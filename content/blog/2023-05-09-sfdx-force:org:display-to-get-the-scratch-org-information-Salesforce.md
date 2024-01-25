---
title: sfdx force:org:display to get the scratch org information Salesforce
date: 2023-05-09T01:25:00-04:00
author: Yoonsoo Park
description: "sfdx force:org:display"
categories:
  - Salesforce
tags:
  - sfdx
---

When working with Scratch Orgs, it is important to be able to retrieve information about the org, such as its username, expiration date, and edition. This article will show you how to retrieve this information using the `SFDX` CLI and the `force:org:display` command.

## Prerequisites
Before proceeding, make sure that you have the following:

- Salesforce CLI installed on your local machine
- A Salesforce DX project connected to your Dev Hub org
- At least one Scratch Org created and authorized for the project

## Retrieving Scratch Org Information
To retrieve information about a Scratch Org, open a terminal or command prompt and navigate to the root directory of your Salesforce DX project. Then, run the following command:

```bash
sfdx force:org:display --json
```
This will output a JSON object containing information about the Scratch Org and the output looks something like this:

```json
{
  id: '00DDa000000TZDFGCCG',
  accessToken: '00DDa000000TZng!ASDFC1sdfa3.1oAwna2JkTGFazCfxa9sJc6xWh5m37KpAcvdxxdaU0I2u5PdfEDfBBOKyJJj',
  instanceUrl: 'https://rookie-force-9991-dev-ed.scratch.my.salesforce.com',
  username: 'test-winkddbear@example.com',
  clientId: 'PremiumCLI',
  connectedStatus: 'Connected',
  alias: 'my-org-alias'
}
```

Cheers! 🍺
