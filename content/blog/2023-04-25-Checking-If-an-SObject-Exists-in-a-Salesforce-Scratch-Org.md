---
title: Checking If an SObject Exists in a Salesforce Scratch Org
date: 2023-04-25T01:25:00-04:00
author: Yoonsoo Park
description: "How to check SObject Exists in a Salesforce Scratch Org"
categories:
  - Salesforce
tags:
  - SObject
---

# Checking If an SObject Exists in a Salesforce Scratch Org

To check if an SObject exists in a Salesforce scratch org, we can use the `sfdx force:schema:sobject:list` command. This command lists all the SObjects in the scratch org, along with their API names.

```bash
sfdx force:schema:sobject:list -c DeveloperName -u MyScratchOrg
```

In this command, `-c DeveloperName` specifies that the output should display the DeveloperName field of each SObject. `-u MyScratchOrg` specifies that the command should be executed on the MyScratchOrg scratch org.

The output of this command will be a list of all the SObjects in the scratch org, along with their API names. You can use this list to determine if a specific SObject exists in the scratch org.

## Checking for SObject Metadata Programmatically

If you want to check if an SObject exists programmatically, you can use the Salesforce API or the sfdx CLI. Here's an example of how to use the sfdx CLI to check for SObject metadata:

```bash
sfdx force:schema:sobject:describe --json -s MyCustomObject__c
```

In this command, `MyCustomObject__c` is the name of the custom object that you want to check for. The `--json` flag specifies that the output should be in JSON format.

If the object exists, the command will return a JSON string that contains the metadata for the object. If the object doesn't exist, the command will return an error message.

Cheers! 🍺
