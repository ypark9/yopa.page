---
title: Log Out (Unlink) the Scratch Org from the Project in Salesforce using SFDX
date: 2023-05-10T01:25:00-04:00
author: Yoonsoo Park
description: "Log out (unlink) the Scratch org from the project in Salesforce"
categories:
  - Salesforce
tags:
  - sfdx
---

 Once the work in the Scratch Org is completed, it is essential to log out (unlink) the Scratch Org from the project. This ensures that you can easily create and authorize new Scratch Orgs without any conflicts. In this article, we will discuss how to log out a Scratch Org from the project using the Salesforce CLI and the `force:auth:logout` command.

## Prerequisites
Before proceeding, make sure that you have the following:

- Salesforce CLI installed on your local machine
- A Salesforce DX project connected to your Dev Hub org
- At least one Scratch Org created and authorized for the project

## Logging Out (Unlinking) a Scratch Org from the Project
To log out a Scratch Org from the project, open a terminal or command prompt and navigate to the root directory of your Salesforce DX project. Then, run the following command:

```
sfdx force:auth:logout -u <Scratch Org Username> 
```

This command uses the `force:auth:logout` command to log out (unlink) the specified Scratch Org from the project. Here's what the parameter does:

- -u: Specifies the username of the Scratch Org you want to log out
For example, if you have a Scratch Org with the username `test-scratch-org`, you would run the following command:

```
sfdx force:auth:logout -u test-scratch-org
```

This will log out the specified Scratch Org from the project. You can verify that the Scratch Org is no longer linked to the project by running the `sfdx force:org:list` command.

Cheers! 🍺
