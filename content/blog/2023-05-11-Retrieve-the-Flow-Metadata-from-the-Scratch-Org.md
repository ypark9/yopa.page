---
title: Retrieve Flow Metadata from a Salesforce Scratch Org
date: 2023-05-11T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Retrieve selected Flow metadata from a Salesforce scratch org with the current sf CLI."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Salesforce Flow
  - Metadata API
---

Retrieve only deliberate Flow changes and review the resulting source before committing it. The supported command is `sf project retrieve start`.

## Prerequisites
Before we dive into the solution, make sure you have the following set up:

- The current `sf` CLI installed
- A Salesforce DX project connected to your Dev Hub org
- A Scratch Org with the Flows you want to retrieve

## Retrieving Flow Metadata
To retrieve the metadata for Flows from your Scratch Org, open a terminal or command prompt and navigate to the root directory of your Salesforce DX project. Then, execute the following command:

```sh
sf project retrieve start --metadata "Flow:<flowApiName>" --target-org my-scratch
```

Replace `<flowApiName>` with the API name of the specific Flow you want to retrieve. If you want to retrieve multiple Flows, you can specify multiple Flow API names, separated by a comma.

For example, let's say you have a Flow with an API name of `"MyFlow"`. To retrieve its metadata, you would run the following command:

```bash
sf project retrieve start --metadata "Flow:MyFlow" --target-org my-scratch
```

The CLI converts retrieved metadata into project source format under the matching package directory, commonly `force-app`.

## Example
Let's consider a practical example where we have a Scratch Org containing two Flows: `"AccountFlow"` and `"OpportunityFlow"`. To retrieve the metadata for both Flows, we would execute the following command:

```sh
sf project retrieve start \
  --metadata "Flow:AccountFlow" \
  --metadata "Flow:OpportunityFlow" \
  --target-org my-scratch
```

Flow metadata can include version and activation details. Inspect `git diff`, confirm that unrelated local work wasn't overwritten, and test the retrieved Flow in a disposable org. Source tracking helps identify changes, but Git remains the source of truth. Reviewed against the [Salesforce CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html) on 2026-08-01.
