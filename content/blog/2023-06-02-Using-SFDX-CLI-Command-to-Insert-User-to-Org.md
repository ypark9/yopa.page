---
title: Using SFDX CLI Command to Insert User to Org
date: 2023-06-02T01:25:00-04:00
author: Yoonsoo Park
description: ""
categories:
  - Salesforce
tags:
  - SFDX
---


## Prerequisites

Before getting started, make sure you have the following:

- Salesforce DX CLI installed on your system. You can download it from the [official Salesforce website](https://developer.salesforce.com/tools/sfdxcli).
- A Salesforce DX project set up on your system.
- An authenticated Salesforce Org where you want to insert the user.

## Steps to Insert a User

### Step 1: Create a JSON file with User details

First, you need to create a JSON file with the details of the user you want to insert. Here's an example:

```json
{
    "Username": "test@example.com",
    "LastName": "Test",
    "FirstName": "User",
    "Email": "test@example.com",
    "Alias": "tuser",
    "TimeZoneSidKey": "America/New_York",
    "LocaleSidKey": "en_US",
    "EmailEncodingKey": "UTF-8",
    "ProfileName": "Standard User",
    "LanguageLocaleKey": "en_US"
}
```

Save this file as `user.json`.

### Step 2: Use the SFDX CLI to Insert the User

To insert the user, run the following command in your terminal:

```bash
sfdx force:data:record:create -s User -v $(jq -r '. | to_entries | map("\(.key)=\(.value|tostring)") | join(" ")' user.json) --json
```

This command uses the `force:data:record:create` SFDX command to insert a new user record. The `-s User` flag specifies that the record is for the User sObject. The `-v` flag followed by the `jq` command reads the values from the `user.json` file and formats them as `key=value` pairs.

### Step 3: Verify the User Insertion

To verify that the user was inserted correctly, you can use the `force:data:soql:query` command:

```bash
sfdx force:data:soql:query -q "SELECT Id, Username FROM User WHERE Email = 'test@example.com'"
```

This command should return the Id and Username of the new user, confirming that the user was inserted successfully.

## Wrapping up.

With the Salesforce DX CLI, inserting a user into an organization becomes a straightforward task. This command line tool is a powerful asset for Salesforce developers, providing flexibility and control over data manipulation tasks.


Cheers! 🍺
