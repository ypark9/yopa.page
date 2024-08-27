---
title: Resolving 'No Default Dev Hub' Error When Creating Salesforce Scratch Orgs
date: 2024-08-26
author: Yoonsoo Park
description: Learn how to fix the 'No Default Dev Hub' error when creating Salesforce scratch orgs using Salesforce CLI, with step-by-step solutions and explanations.
categories:
  - Salesforce Development
  - Troubleshooting
tags:
  - Salesforce CLI
  - Scratch Orgs
  - DevHub
---

> Learn how to fix the 'No Default Dev Hub' error when creating Salesforce scratch orgs using Salesforce CLI, with step-by-step solutions and explanations.

[Salesforce Developer Documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm)

As a Salesforce developer, you're likely familiar with the power and flexibility of scratch orgs for development and testing. However, you may occasionally encounter errors when trying to create these temporary environments. One common issue is the "No Default Dev Hub" error, which can be frustrating if you're not sure how to resolve it. In this article, we'll explore this error and provide two straightforward solutions to get you back on track.

## The Problem: No Default Dev Hub Error

Let's say you're trying to create a scratch org using the Salesforce CLI with a command like this:

```bash
sf org create scratch --definition-file=config/project-scratch-def.json --alias=my-scratch --set-default --duration-days=30 --wait=15
```

But instead of creating your scratch org, you're met with this error:

```
Error (NoDefaultDevHubError): No default dev hub found. Use -v or --target-dev-hub to specify an environment.
```

This error occurs when the Salesforce CLI can't find a default DevHub to use for creating your scratch org. Even if you have a DevHub set up and can see it when you run `sf org list`, the CLI may not know which one to use by default.

## Solution 1: Set a Default DevHub

The first and most straightforward solution is to set a default DevHub for your Salesforce CLI to use. Here's how:

1. First, identify your DevHub username. You can find this by running `sf org list`. Look for the org with the "DevHub" type.

2. Once you have the username, set it as the default DevHub with this command:

   ```bash
   sf config set target-dev-hub your-devhub-username@example.com
   ```

   Replace `your-devhub-username@example.com` with your actual DevHub username.

3. After setting the default, you should be able to run your original scratch org creation command without any issues.

This method is particularly useful if you primarily work with one DevHub, as you won't need to specify it every time you create a scratch org.

## Solution 2: Specify the DevHub in Your Command

If you work with multiple DevHubs or prefer not to set a default, you can explicitly specify which DevHub to use in your scratch org creation command. Here's how:

1. Modify your original command to include the `-v` or `--target-dev-hub` flag, followed by your DevHub username:

   ```bash
   sf org create scratch --definition-file=config/project-scratch-def.json --alias=my-scratch --set-default --duration-days=30 --wait=15 -v your-devhub-username@example.com
   ```

   Again, replace `your-devhub-username@example.com` with your actual DevHub username.

2. Run this modified command, and it should create your scratch org without the "No Default Dev Hub" error.

This method gives you more flexibility if you need to switch between different DevHubs for various projects or teams.

## Conclusion

The "No Default Dev Hub" error is a common hurdle in Salesforce development, but it's easily overcome with these simple solutions. Whether you choose to set a default DevHub or specify it in each command, you'll be able to create scratch orgs smoothly and continue your development work without interruption.

Cheers! 🍺
