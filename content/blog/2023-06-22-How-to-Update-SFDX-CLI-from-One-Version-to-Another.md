---
title: How to Update SFDX CLI from One Version to Another
date: 2023-06-22T01:25:00-04:00
author: Yoonsoo Park
description: "A simple guide to updating your Salesforce CLI (SFDX) to the latest version."
categories:
  - Salesforce
tags:
  - SFDX
---

From time to time, updates and improvements to the SFDX CLI are released and users may need to update their CLI version. Here is a step-by-step guide on how to do this.

## Prerequisites

Before proceeding, make sure you have:

1. Node.js and npm installed on your system. Salesforce CLI is an npm package.
2. SFDX CLI installed. You can confirm by running `sfdx --version` in your terminal.
3. Access to a command-line interface.

## Steps

### 1. Uninstall the Current SFDX CLI

The first step is to uninstall the currently installed SFDX CLI. We can do this using the npm `uninstall` command:

```bash
npm uninstall -g sfdx-cli
```

### 2. Install the Desired Version of SFDX CLI

Next, we install the version of SFDX CLI we need. Replace `<version-#>` with the desired version number. For example, if you want to install version `7.185.0`, you would run:

```bash
npm i -g sfdx-cli@7.185.0
```

### 3. Remove SFDX Directories (Optional)

In some cases, you may need to remove existing SFDX directories before reinstalling. Please be aware that this step should be taken with caution, as it will delete all the SFDX related data from your local machine:

```bash
sudo rm -rf /usr/local/sfdx
sudo rm -rf /usr/local/lib/sfdx
sudo rm -rf /usr/local/bin/sfdx
sudo rm -rf ~/.local/share/sfdx ~/.config/sfdx ~/.cache/sfdx
sudo rm -rf ~/Library/Caches/sfdx
```

### 4. Confirm the Update

To ensure that the update was successful, check the version of your SFDX CLI:

```bash
sfdx --version
```

This should display the version number that you just installed.

## Wrapping Up

You have now successfully updated your SFDX CLI version. Remember, always ensure compatibility with your project's dependencies before upgrading.

---

Cheers! 🍺
