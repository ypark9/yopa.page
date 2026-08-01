---
title: Get Access Token from Salesforce
date: 2023-05-01T01:25:00-04:00
maintenance_status: archived
reviewed_at: 2026-08-01
archive_reason: "The workflow exposes a bearer token in terminal output and uses the unsupported sfdx CLI."
replacement_url_en: "/blog/2026-08-01-salesforce-cli-authentication-without-token-leaks.html"
replacement_url_ko: "/ko/blog/2026-08-01-salesforce-cli-authentication-without-token-leaks.html"
author: Yoonsoo Park
description: "Get Access Token with SFDX CLI"
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - OAuth
  - Security
---

Access tokens are unique strings of characters that authenticate a user's identity and provide secure access to Salesforce APIs. In this article, we will discuss how to obtain an access token using SFDX CLI.

## Steps to Get Access Token
1. Authorize an org: To use SFDX CLI to get an access token, you first need to authorize an org. Use the following command to authorize an org:

```bash
sfdx force:auth:web:login -a <org_alias>
```

This command will open a web browser window, where you will be prompted to log in to your Salesforce account. Once you have logged in, your org is authorized, and you can use it to get an access token.

2. Get Access Token: To get an access token for the authorized org, use the following command:

```bash
sfdx force:org:display -u <org_alias> --verbose | grep "Access Token" | awk '{print $NF}'
```

This command will display the access token for the authorized org.

Cheers! 🍺
