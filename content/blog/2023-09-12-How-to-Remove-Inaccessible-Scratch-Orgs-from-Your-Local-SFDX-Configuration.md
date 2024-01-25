---
title: How to Remove Inaccessible Scratch Orgs from Your Local SFDX Configuration
date: 2023-09-12T01:25:00-04:00
author: Yoonsoo Park
description: "Learn how to remove inaccessible or problematic scratch orgs from your local Salesforce DX configuration."
categories:
    - Salesforce
    - Development
    - Troubleshooting
tags:
    - Salesforce DX
    - Scratch Orgs
    - SFDX
---

## Introduction

If you're working with Salesforce DX, you're probably already familiar with the concept of Scratch Orgs. These are temporary Salesforce orgs where you can do your development and testing. But what happens when a scratch org that you're done with still shows up in your local list, and attempts to remove it result in errors? This article aims to tackle precisely this issue.

## Identifying the Problem

You run `sfdx force:org:list` and notice an org that you no longer need. When you try to remove it using `sfdx force:org:delete`, you get an error message like `DomainNotFoundError` or "The org cannot be found". These issues often occur when the scratch org has already been deleted on the Salesforce side but still exists in your local SFDX configuration.

**Symptoms:**

1. Running `sfdx force:org:list` displays the problematic scratch org.
    ```
    force-nforce-003jsL test-ry0x7ndfdivv@example.com 00D040000003jsLEAQ DomainNotFoundError
    ```
2. Attempting to delete the org results in an error.
    ```
    ERROR running force:org:delete:  The org cannot be found
    ```

## Solutions

### 1. Directly Remove from Local Configuration

Navigate to the `.sfdx` folder, usually located in your home directory. Inside, you'll find `orgs.json`. Open it and manually remove the entry for the problematic scratch org.

```bash
# Navigate to the .sfdx folder in your home directory
cd ~/.sfdx

# Open the orgs.json file in a text editor and manually remove the entry
```

### 2. Use `sfdx force:org:list --clean`

Running this command will clean your local list of orgs, removing any that it can't find on the server.

```bash
sfdx force:org:list --clean
```

### 3. Re-authenticate the Org (If Possible)

If the org still exists on the Salesforce server, sometimes re-authenticating can resolve these issues.

```bash
sfdx force:auth:web:login -r https://test.salesforce.com -a My_Scratch_Org
```

After re-authenticating, try to delete the org again.

### 4. Use `sfdx force:config:set`

Set another default org to potentially resolve some edge cases.

```bash
sfdx force:config:set defaultusername=mynewdefaultorg@example.com
```

Cheers! 🍺
