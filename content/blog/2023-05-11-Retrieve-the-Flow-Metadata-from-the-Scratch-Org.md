---
title: Retrieve Flow metadata from the sratch org Salesforce
date: 2023-05-11T01:25:00-04:00
author: Yoonsoo Park
description: "Retrieve Flow metadata from the sratch org"
categories:
  - Salesforce
tags:
  - SFDX
---

When working with Salesforce Scratch Orgs, it's crucial to be able to retrieve specific metadata components for further development or deployment. One common requirement is finding the metadata for Flows within your Scratch Org. In this article, we will explore how to achieve this using the SFDX and the `force:source:retrieve` command.

## Prerequisites
Before we dive into the solution, make sure you have the following set up:

- SFDX installed on your local machine
- A Salesforce DX project connected to your Dev Hub org
- A Scratch Org with the Flows you want to retrieve

## Retrieving Flow Metadata
To retrieve the metadata for Flows from your Scratch Org, open a terminal or command prompt and navigate to the root directory of your Salesforce DX project. Then, execute the following command:

```sh
sfdx force:source:retrieve -m Flow:<flowApiName>
```

Replace `<flowApiName>` with the API name of the specific Flow you want to retrieve. If you want to retrieve multiple Flows, you can specify multiple Flow API names, separated by a comma.

For example, let's say you have a Flow with an API name of `"MyFlow"`. To retrieve its metadata, you would run the following command:

```bash
sfdx force:source:retrieve -m Flow:MyFlow
```

This command tells the SFDX to retrieve the metadata for the specified Flow(s). The retrieved metadata will be stored in the `"force-app"` directory of your Salesforce DX project.

## Example
Let's consider a practical example where we have a Scratch Org containing two Flows: `"AccountFlow"` and `"OpportunityFlow"`. To retrieve the metadata for both Flows, we would execute the following command:

```sh
sfdx force:source:retrieve -m Flow:AccountFlow,Flow:OpportunityFlow
```

The SFDX will retrieve the metadata for these two Flows and store them in the `"force-app"` directory of your Salesforce DX project.

Cheers! 🍺
