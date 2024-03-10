---
title: Solving DynamoDB Conditional Update Challenges with AWS CDK
date: 2024-03-09
author: Yoonsoo Park
description: "An exploration into resolving DynamoDB conditional update issues in AWS CDK using the Condition class."
categories:
  - AWS
  - CDK
  - DynamoDB
tags:
  - AWS CDK
  - DynamoDB
  - JSONPath
  - Condition Class
---

![Solving DynamoDB Conditional Update Challenges](images/oni-aws-bug.png)

In AWS CDK projects, manipulating DynamoDB table entries is a common task. However, developers often face challenges when attempting to conditionally update items based on certain criteria, particularly when these criteria involve evaluating JSON path expressions. A typical scenario involves updating a DynamoDB item to reflect a new state based on a condition evaluated from a JSON input. Let's dive into a specific problem and its elegant solution.

## The Challenge

Consider a scenario where you need to update a DynamoDB table's record based on a reserved status indicated by a JSON attribute. The goal is to set an `org_state` attribute to either 'reserved' or 'available', depending on whether the `$.reserved` JSON path in the input message is 'true' or not. Here's an initial approach using the AWS CDK:

```javascript
const updateOrgRecordAvailable = new DynamoUpdateItem(
  this.stack,
  "Update Org Record to Available",
  {
    key: {
      orgId: DynamoAttributeValue.fromString(
        JsonPath.stringAt("$.create_org_output.org_id")
      ),
    },
    table: this.props.scratchOrgTable,
    expressionAttributeValues: {
      ":available_status":
        JsonPath.stringAt("$.reserved").toLowerCase() === "true"
          ? DynamoAttributeValue.fromString("reserved")
          : DynamoAttributeValue.fromString("available"),
    },
    updateExpression: "SET org_state=:available_status",
    conditionExpression: "attribute_exists(orgId)",
    resultPath: "$.updateOrgRecordAvailableOutput",
  }
);
```

The expected behavior is straightforward: if the `reserved` field in the input JSON is 'true' (regardless of case), the `org_state` should be updated to 'reserved'. Otherwise, it should be 'available'. However, developers may find that the condition does not evaluate as expected due to the way JSONPath expressions are handled in AWS CDK.

## The Solution

The crux of the issue lies in the evaluation of the condition directly within the expression attribute values. This method may not work as intended because `JsonPath.stringAt('$.reserved').toLowerCase()` does not execute in the runtime environment as one might expect; it's more of a compile-time directive for the AWS Step Functions to interpret.

The solution involves leveraging the AWS CDK's `Condition` class, specifically, the `Condition.stringEquals()` method, to ensure accurate runtime evaluation. Here's how you can apply this solution:

1. **Refactor the Update Expression:** Instead of directly evaluating the condition within the `expressionAttributeValues`, use the `Condition` class to create a condition that compares the `reserved` field to a string literal 'true'.
2. **Apply Condition in Decision Logic:** Use this condition to control the flow in your AWS Step Functions, ensuring that the update operation only proceeds when the condition is met.

3. **Update DynamoDB Accordingly:** Based on the outcome of the condition, set the `org_state` attribute value accordingly.

This approach decouples the condition evaluation from the DynamoDB update logic, leveraging AWS Step Functions' ability to execute conditional logic based on the input JSON.

## Wrapping it up 👏

Conditional updates in DynamoDB, especially when based on JSON path expressions, can introduce complexity into your AWS CDK applications. The key takeaway is to use the CDK's `Condition` class to accurately evaluate conditions before proceeding with database operations. This not only simplifies your code by separating concerns but also ensures that your application logic is more robust and easier to debug.

By understanding and utilizing the tools provided by the AWS CDK, developers can more effectively manage complex conditional logic in their cloud applications. This example underscores the importance of thoroughly reviewing and testing your CDK constructs to ensure they behave as expected in all scenarios.

Cheers! 🍺
