---
title: How to Uninstall Salesforce CLI from a Specific Node.js Version on macOS
date: 2023-12-01T01:25:00-04:00
author: Yoonsoo Park
description: "a systematic approach to troubleshoot to Uninstall Salesforce CLI from a Specific Node.js Version on macOS"
categories:
  - Salesforce
tags:
  - Nodejs
  - sfdx
  - npm
  - DevelopmentEnvironment
---

**Introduction:**

When working with multiple versions of Node.js, especially in a development environment that leverages Salesforce CLI, it's not uncommon to encounter challenges in managing different package versions. This can often lead to confusion and, sometimes, a frustrating experience when trying to uninstall or switch between versions of Salesforce CLI (sfdx-cli) across different Node.js versions. In this article, we'll explore a systematic approach to troubleshoot and resolve these issues, ensuring a smoother development experience.

**Understanding the Environment:**

Before diving into the solution, it's crucial to understand how Node.js versions and npm (Node Package Manager) work in tandem. Node.js is a runtime environment for executing JavaScript outside the browser, and npm is its package manager. When you install Node.js, npm comes bundled with it. If you are using a version manager like `nvm` (Node Version Manager), each version of Node.js can have its own separate npm environment and set of global packages.

**The Challenge with Salesforce CLI:**

Salesforce CLI (`sfdx-cli`) is a powerful command-line interface that simplifies development and build automation when working with Salesforce applications. However, when you have multiple Node.js versions, each with its own Salesforce CLI installation, managing these versions can become complex.

**Step-by-Step Troubleshooting:**

1. **Identifying the Active Node.js Version:**
   Begin by determining which version of Node.js is active. If you're using `nvm`, you can switch between versions easily. For example, `nvm use 20` activates Node.js version 20.

2. **Listing Global npm Packages:**
   To see if Salesforce CLI is installed under the active Node.js version, use `npm list -g --depth=0`. This command lists all globally installed packages.

3. **Uninstalling Salesforce CLI:**
   If you find `sfdx-cli` listed, uninstall it using `npm uninstall -g sfdx-cli`. This should remove it from the global npm environment of the active Node.js version.

4. **Navigating Multiple npm Instances:**
   Remember, each Node.js version has its own npm environment. Repeat the listing and uninstallation process for each Node.js version where `sfdx-cli` is installed.

5. **Checking the PATH:**
   Your system's PATH environment variable might still reference `sfdx-cli`. Inspect it with `echo $PATH` and manually search the directories for any lingering `sfdx-cli` instances.

6. **Manual Removal:**
   If necessary, manually remove the `sfdx-cli` executable. Locate it with `which sfdx` and delete it using `rm`.

7. **Reinstalling Salesforce CLI:**
   If you accidentally remove the wrong version, simply reinstall Salesforce CLI under the correct Node.js version.

8. **Restarting the Terminal:**
   After uninstallation, restart your terminal to ensure all changes take effect.

9. **Verification:**
   Verify the removal by executing `sfdx --version`. An error message should indicate successful uninstallation.

Happy Friday.
Cheers! 🍺
