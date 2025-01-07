---
title: AWS IAM User vs Role
date: 2023-05-22T01:25:00-04:00
author: Yoonsoo Park
description: "AWS IAM User vs Role"
categories:
  - AWS
tags:
  - IAM
---

# AWS IAM User vs Role

Amazon Web Services (AWS) Identity and Access Management (IAM) is a critical component of AWS that helps manage access to AWS services and resources. IAM allows you to manage users, security credentials (e.g. access keys), and permissions that controls which resources users and applications can use and perform actions on. IAM uses two main entities for these: Users and Roles. This post is about the details of IAM Users and Roles to understand their roles.

## AWS IAM Users

An IAM user is an entity that represents a person or a service that interacts with AWS. IAM users are created for specific individuals or applications that need access to your AWS resources.

```markdown
Key Features:

1. Permanent AWS identities.
2. Have unique security credentials (e.g. password & access keys).
3. Users can be added to IAM groups.
4. Directly attached with permissions.
5. Used by people or applications outside AWS.
```

### When to use IAM Users?

You should use IAM Users when you want to give permanent access to a specific person or application. It's also used when you want the entity to use AWS security credentials like passwords or access keys.

## AWS IAM Roles

An IAM Role is an IAM entity that is a set of permissions for making AWS service requests. Unlike users, roles DO NOT PERMANENTLY ASSIGNED credentials; instead, TEMPORARY security tokens are provided to a role when it is assumed.

```markdown
Key Features:

1. Does not have any credentials.
2. Temporary security tokens are created when the role is assumed.
3. Can be assumed by anyone with permissions to do so.
4. Can be used by services within AWS to perform actions on your behalf.
5. Roles are the recommended way to provide permissions to applications running on EC2 instances.
```

### When to use IAM Roles?

IAM Roles should be used for granting permissions to AWS services (e.g. AWS Lambda) to perform actions on your behalf. You should also use roles when you want to grant access to resources for users from a different AWS account or when you want to set permissions for applications running on EC2 instances.

## IAM Users vs IAM Roles: The Differences

The main differences between IAM Users and Roles are their purposes and the type of credentials they use. IAM Users are intended for long-term access for specific individuals or applications. In the other hand, Roles are usually used for short-term, temporary access or to allow AWS services to perform actions on your behalf.

IAM Users have their own AWS security credentials, while IAM Roles use temporary security tokens when they are assumed. IAM Roles are considered as a more secure way to access, as they do not require long-term credentials, which can be a security risk.

Cheers! 🍺
