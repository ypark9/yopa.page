---
title: "Salesforce CI/CD with AWS CodePipeline and CodeBuild"
date: 2024-06-15
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-06-15-automating-salesforce-package-deployment-with-aws-code-services-a-comprehensive-guide.html"
author: Yoonsoo Park
description: "Build a supported Salesforce deployment pipeline on AWS with explicit authentication, validation, approval, and rollback boundaries."
categories:
  - AWS
  - Salesforce
  - DevOps
tags:
  - CI/CD
  - Salesforce CLI
  - AWS CodeBuild
  - Salesforce Packaging
---

Verified against AWS and Salesforce documentation on 2026-08-01.

## Why the old architecture was archived

AWS CodeDeploy deploys applications to AWS compute targets; it is not a Salesforce metadata deployment engine. A Salesforce source tree also doesn't become a deployable “package” merely by converting it and putting the directory in S3. The archived pipeline mixed invalid CloudFormation, deprecated `sfdx` commands, an unnecessary plugin install, and no credible authentication or rollback boundary.

Use AWS only when the organization already operates CodePipeline/CodeBuild or needs its account controls. GitHub Actions, Salesforce DevOps Center, or another CI platform can be simpler. The important design is the release gate, not the vendor running the shell.

## Supported pipeline

1. **Source:** AWS CodeConnections delivers the reviewed Git revision to CodePipeline. Restrict the connection to the repository and branch required by the pipeline.
2. **Validation:** CodeBuild uses a pinned image with the supported `sf` CLI, authenticates without printing credentials, and runs tests plus `sf project deploy start --dry-run`.
3. **Evidence:** Store the commit, CLI version, target, component set, test results, and validation/deploy ID as build evidence. Do not store auth URLs, tokens, private keys, or customer data.
4. **Approval:** A production stage requires an explicit manual approval after validation. The approver checks the exact commit and target org.
5. **Deploy:** A separate CodeBuild action deploys the same immutable revision. When Salesforce permits quick deploy for the validated result, use the validation/deploy ID; otherwise run the same scoped deployment again.
6. **Verify:** Run smoke tests and check the deployment result and application behavior.

CodeDeploy isn't in this flow. Lambda is unnecessary unless orchestration requires a narrowly defined custom action that CodeBuild can't perform.

## Authentication boundary

CodeBuild's AWS role should receive only the AWS permissions needed for source artifacts, logs, and a specific secret. Store Salesforce authentication material in AWS Secrets Manager and inject it only into the build that needs it. Prefer an approved workload/OIDC federation when the Salesforce and CI design supports it. Otherwise, use a dedicated least-privileged integration user and a supported noninteractive OAuth flow such as JWT bearer authentication, protecting and rotating the private key.

Never bake a token or key into the image, repository, buildspec, environment-variable declaration, or artifact. Disable shell tracing around authentication. A Salesforce SFDX auth URL is a credential too.

## Validation build

Pin the CLI version in the image or dependency lock and print only its version:

```yaml
version: 0.2
phases:
  install:
    commands:
      - sf version
  pre_build:
    commands:
      - ./scripts/authenticate-salesforce-from-secret
      - python3 scripts/validate_frontmatter.py
  build:
    commands:
      - sf project deploy preview --manifest manifest/package.xml --target-org prod
      - sf project deploy start --manifest manifest/package.xml --target-org prod --dry-run --test-level RunLocalTests --wait 60 --json > deploy-validation.json
artifacts:
  files:
    - deploy-validation.json
```

The authentication helper must read the secret without echoing it, authorize the explicit alias, and remove temporary key material on exit. Add project-specific static analysis and unit tests before validation. Fail the build on any test, component, or JSON status failure; don't rely only on the shell command producing a file.

## Deployment, rollback, and tradeoffs

Quick deploy reduces repeated test time but is valid only within Salesforce's permitted window and for the exact successful validation. Preserve its ID with the immutable commit. If it is unavailable, deploy the same manifest and commit normally.

Metadata deployment is not a universal rollback system. Prepare a forward fix or a previously tested reverse deployment. Destructive changes, irreversible data migrations, package version promotion, and permission changes need separate gates and recovery plans. Keep data migration outside the metadata action and make it idempotent.

CodePipeline provides AWS-native approvals and account audit trails, but CodeBuild startup and cross-cloud authentication add complexity. DevOps Center offers Salesforce-native workflows. GitHub Actions can reduce infrastructure when the source already lives on GitHub. Choose the platform the team can secure and operate; preserve the same validation, approval, identity, and rollback controls.

## Migration checklist

1. Remove CodeDeploy, legacy `sfdx force:*`, and generated S3 “package” assumptions.
2. Establish CodeConnections with least repository access and an explicit trigger.
3. Pin `sf`, the build image, and project dependencies.
4. Create a least-privileged Salesforce integration identity and Secrets Manager boundary.
5. Separate validation and production deploy actions around manual approval.
6. Prove the same commit, manifest, target org, and validation ID cross the gate.
7. Test authentication failure, Apex failure, timeout, approval rejection, stale quick-deploy ID, and rollback.
8. Add post-deploy smoke checks and alerts without exposing Salesforce payloads.

## Official sources

- [AWS CodePipeline connections](https://docs.aws.amazon.com/codepipeline/latest/userguide/connections.html)
- [AWS CodeBuild build specification](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)
- [AWS Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Salesforce CLI deploy commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project.html)
- [Salesforce CLI migration](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
