---
title: aws sso get-role-credentials
date: 2023-06-08T01:25:00-04:00
author: Yoonsoo Park
description: "Using-AWS-SSO-Get-Role-Credentials-in-Real-World-Scenarios"
categories:
  - AWS
tags:
  - AWS SSO
---

AWS Single Sign-On (SSO) is a cloud-based service that makes it easy to centrally manage access to multiple AWS accounts and business applications. One of the essential features it provides is the `get-role-credentials` command, which is an AWS CLI v2 operation that returns the STS (Security Token Service) credentials for an IAM role in AWS.

In this article, we'll discuss what the `get-role-credentials` command is and how it can be used in real-world scenarios.

## What is `aws sso get-role-credentials`?

The `get-role-credentials` operation provides short-term credentials for an IAM role with SSO access. This function is particularly useful when you need to manage multiple AWS accounts and roles. 

Here is the command syntax:

```bash
aws sso get-role-credentials --profile my-sso-profile --role-name SSOReadOnly --account-id 123456789012
```

This will return something similar to:

```json
{
  "roleCredentials": {
    "accessKeyId": "ASIAxxxxxxxxxxxx",
    "secretAccessKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "sessionToken": "FwoGZXIvYXdzEHsaDGFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "expiration": 1596414957
  }
}
```

These are the temporary credentials that you can use with AWS CLI and SDKs.

## Real-World Scenario: Multi-Account AWS Management

Let's consider a situation where a company has different AWS accounts for development, testing, and production environments. They use AWS SSO for managing access to these accounts. An engineer, YOPA, needs to access resources in both the development and production accounts, but with different permissions.

For the development account, YOPA has full access permissions, and for the production account, he has read-only permissions. To switch between these accounts seamlessly, he uses different SSO profiles configured in the AWS CLI.

When YOPA needs to list all the S3 buckets in the production account, he can get the role credentials for the SSO profile associated with the production account's read-only role using the `aws sso get-role-credentials` command. Then, he can use these temporary credentials to list the S3 buckets without affecting her other active sessions.

```bash
# get role credentials
aws sso get-role-credentials --profile prod-readonly --role-name SSOReadOnly --account-id 123456789012 > temp_credentials.json

# use jq to parse the json and export the credentials to environment variables
export AWS_ACCESS_KEY_ID=$(jq -r .roleCredentials.accessKeyId < temp_credentials.json)
export AWS_SECRET_ACCESS_KEY=$(jq -r .roleCredentials.secretAccessKey < temp_credentials.json)
export AWS_SESSION_TOKEN=$(jq -r .roleCredentials.sessionToken < temp_credentials.json)

# list s3 buckets
aws s3 ls
```

## SO!!

The `aws sso get-role-credentials` command is a powerful tool for managing access to AWS resources across multiple accounts. With careful planning and proper use of SSO and IAM roles, you can ensure secure and efficient access management in your AWS environments.

Whether you're an individual developer or part of a larger team, leveraging these tools can help to streamline your workflows and enhance the security of your operations.


Cheers! 🍺
