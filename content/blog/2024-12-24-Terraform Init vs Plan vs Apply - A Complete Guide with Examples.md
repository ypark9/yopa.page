---
title: A Safe Terraform Init, Plan, and Apply Workflow
date: 2024-12-24
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use Terraform initialization, validation, saved plans, remote state, review, and exceptional targeting without turning convenience flags into deployment policy."
categories:
  - Infrastructure as Code
  - DevOps
tags:
  - Terraform
  - Infrastructure as Code
  - State Management
  - DevOps
  - Security
---

`terraform init`, `plan`, and `apply` are not three maturity levels. They perform different parts of one workflow: initialize a working directory, calculate a proposed change, and execute an approved change.

## Initialize reproducibly

Run `terraform init` in a new checkout and after changing provider requirements, modules, or backend configuration. It installs providers/modules, prepares the backend, and writes dependency selections to `.terraform.lock.hcl`.

```bash
terraform init
terraform fmt -check -recursive
terraform validate
```

Commit `.terraform.lock.hcl` for a root configuration so CI and teammates use reviewed provider selections. Constrain Terraform and provider versions. Do not commit `.terraform/`, state files, plan files, or credentials.

Changing a backend can migrate state. Back up and inspect the current state location, authenticate to both backends, and review the migration prompt. `-reconfigure` and `-migrate-state` solve different problems; do not choose one blindly in automation.

## Plan against the right state

`terraform plan` refreshes relevant remote objects and compares them with configuration and state. A clean plan means “no difference detected for this configuration, state, credentials, and refresh,” not that the infrastructure is secure or complete.

For an approved deployment pipeline, save the reviewed plan:

```bash
terraform plan -out=release.tfplan
terraform show release.tfplan
terraform apply release.tfplan
```

The saved plan can contain sensitive values and is tied to the configuration, state, provider selections, and environment used to create it. Treat it as a protected, short-lived artifact. Do not generate it on one untrusted machine and apply it much later elsewhere.

Always inspect replacements and destroys, IAM broadening, network exposure, data migration, and cost-sensitive changes. A textual plan review is strongest when policy checks and tests enforce known invariants.

## State and environment boundaries

Use a remote backend with locking and encryption for team workflows, restrict state access, and version/backup it according to the backend. State often contains sensitive values even when configuration marks outputs sensitive.

Terraform CLI workspaces are separate state instances in one working directory/backend. They are useful for temporary or closely related copies, but they are not strong isolation for production environments that need different credentials and access controls. Prefer separate root configurations/backends or appropriately isolated HCP Terraform workspaces for those boundaries, sharing reusable modules rather than one state for everything.

## `-target` is exceptional

Resource targeting is for exceptional recovery or troubleshooting, not routine dependency ordering, partial environment deployment, or a faster test cycle. Terraform's dependency graph already determines order. A targeted plan omits unrelated changes and can produce a misleading view of policy or cost.

When an exceptional target is approved:

```bash
terraform plan -target=aws_instance.example
# Review and apply the exceptional operation.
terraform plan
```

Finish with a full plan and reconcile configuration/state. If teams repeatedly need targeting, split the configuration along lifecycle and ownership boundaries.

## Apply and rollback

Without a saved plan, `terraform apply` creates a new plan and asks for confirmation. `-auto-approve` belongs only in controlled automation with preceding policy and approval gates. It is not a safe local shortcut for production.

Terraform has no universal rollback command. Revert configuration and apply another reviewed plan when the provider supports reversal. Stateful replacements and schema changes may require backups, restore procedures, or application migration. Test those paths before deployment.

## Verification checklist

- Confirm binary/version, backend, workspace, cloud account, and caller identity.
- Run format check, validation, tests/policy checks, and a full plan.
- Review destroys, replacements, permissions, exposure, state moves, and unknown values.
- Apply exactly the saved plan in the same trusted pipeline.
- Run service-level smoke tests and observe alarms after apply.
- Run a final plan to detect unexpected drift.
- Store evidence and delete the sensitive plan artifact according to policy.

Official documentation reviewed on **2026-08-01**:

- [Terraform initialization](https://developer.hashicorp.com/terraform/cli/commands/init)
- [Terraform planning](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [Terraform apply](https://developer.hashicorp.com/terraform/cli/commands/apply)
- [CLI workspace guidance](https://developer.hashicorp.com/terraform/cli/workspaces)
- [Resource targeting](https://developer.hashicorp.com/terraform/enterprise/workspaces/run/modes-and-options)
