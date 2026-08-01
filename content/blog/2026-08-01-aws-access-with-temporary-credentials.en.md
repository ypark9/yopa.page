---
title: "AWS Access in 2026: Federation and Temporary Credentials First"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A practical decision guide for giving people and workloads AWS access without making long-lived IAM access keys the default."
categories:
  - AWS
  - Security
tags:
  - AWS IAM
  - IAM Identity Center
  - Temporary Credentials
  - Security
---

The useful question is no longer “IAM user or IAM role?” It is “who needs access, where does the code run, and which temporary credential mechanism fits that boundary?”

AWS currently recommends temporary credentials for both people and workloads. IAM users still exist, but they are an exception for cases that cannot use federation or roles—not the normal starting point.

## The current mental model

An IAM user is a long-lived identity inside one AWS account. Its password and access keys remain usable until they are rotated or revoked. That persistence increases the cost of accidental disclosure.

An IAM role has permissions and a trust policy but no long-lived credentials. When a person, workload, or AWS service assumes it, AWS Security Token Service issues an access key, secret key, and session token that expire. The trust policy answers who may assume the role; its permissions answer what an assumed session may do.

Use these defaults:

1. **Workforce access:** federate through AWS IAM Identity Center or another identity provider. Assign permission sets to groups, not one-off user policies.
2. **AWS workloads:** attach a service role to Lambda, ECS tasks, EC2 instances, or other compute. Let the AWS SDK default credential provider discover it.
3. **External CI/CD:** use workload identity federation such as GitHub Actions OIDC to assume a narrowly scoped role.
4. **Cross-account access:** assume a role in the target account, with explicit trust and conditions.
5. **Unsupported legacy workload:** use an IAM user only after ruling out roles and federation. Scope and rotate its keys, monitor their use, and plan its removal.

## A safe local workflow

Configure IAM Identity Center with AWS CLI v2:

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
```

The last command is an important verification step: confirm the account and ARN before making changes. Applications should select the profile and let the SDK resolve temporary credentials. Do not copy the generated access key into source code or `.env` files.

```bash
AWS_PROFILE=engineering-dev aws s3api list-buckets
```

For an AWS-hosted workload, do not run `aws configure` in the container. Attach an execution or task role and construct SDK clients without explicit keys.

## Permission design

Temporary credentials reduce credential lifetime; they do not make broad permissions safe. Start with the access needed to get a workload running, then use IAM Access Analyzer and observed activity to tighten it. Add conditions where they meaningfully constrain the request: organization ID, source account, resource tags, or a specific OIDC subject.

Require phishing-resistant MFA where available for human access. Protect the root user separately and do not create root access keys. Review unused roles, permission sets, policies, and credentials on a schedule.

## Tradeoffs

Identity Center adds central configuration and depends on a working identity source, but it gives one place for account assignments and short-lived sessions. Service roles are easy on AWS compute but do not directly solve access from arbitrary external hosts. OIDC removes stored CI secrets but requires careful audience and subject conditions. IAM users can support a small set of legacy integrations, at the cost of rotation, storage, monitoring, and incident-response work.

## Migration checklist

- Inventory IAM users, access keys, last-used data, and their real owners.
- Classify each identity as human, AWS workload, external workload, or break-glass use.
- Create permission sets or roles with equivalent, preferably narrower, permissions.
- Test with `sts get-caller-identity` and representative read/write operations.
- Update applications to use the default provider chain rather than explicit keys.
- Monitor CloudTrail during a defined overlap period.
- Deactivate an old key before deleting it; roll back only if a verified dependency still uses it.
- Remove unused IAM users and document any justified exception.

Verified against official documentation on **2026-08-01**.

## Official sources

- [Security best practices in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Compare IAM identities and credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_identity-management.html)
- [AWS IAM Identity Center User Guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
