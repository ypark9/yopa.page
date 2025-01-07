---
title: Understanding Terraform Commands Through Real-World Examples
date: 2024-12-24
author: Yoonsoo Park
description: A practical guide to understanding when and why to use different Terraform commands, illustrated through real-world infrastructure management scenarios.
categories:
  - Infrastructure as Code
  - DevOps
tags:
  - terraform
  - aws
  - infrastructure
---

> A practical guide to understanding when and why to use different Terraform commands, illustrated through real-world infrastructure management scenarios.

Have you ever wondered when exactly you need to run `terraform init` versus `terraform plan`? Let's explore these commands through practical, real-world scenarios that every DevOps engineer encounters.

## Scenario 1: Setting Up a New Web Application Infrastructure

Imagine you're tasked with setting up the infrastructure for a new web application. You'll need an EC2 instance, an RDS database, and an S3 bucket for static assets.

```hcl
# main.tf
provider "aws" {
  region = "us-west-2"
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "WebServer"
  }
}

resource "aws_db_instance" "database" {
  identifier        = "myapp-database"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
}

resource "aws_s3_bucket" "assets" {
  bucket = "myapp-static-assets"
}
```

First, you'll need to run `terraform init`. Why? Because:

1. This is a new project directory
2. You're using the AWS provider for the first time
3. Terraform needs to download provider plugins

## Scenario 2: Adding Application Load Balancer

A month later, your application grows, and you need to add a load balancer. You create a new file:

```hcl
# loadbalancer.tf
resource "aws_lb" "web_lb" {
  name               = "web-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
}
```

In this case, you don't need to run `terraform init` again because you're not adding any new providers or modules. Instead, start with `terraform plan` to see what changes will be made:

```bash
$ terraform plan
Terraform will perform the following actions:

  # aws_lb.web_lb will be created
  + resource "aws_lb" "web_lb" {
      + arn                        = (known after apply)
      + name                       = "web-lb"
      + internal                   = false
      + load_balancer_type        = "application"
      ...
    }
```

## Scenario 3: Introducing Remote State

As your team grows, you decide to store the Terraform state in an S3 backend. You add:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket = "company-terraform-state"
    key    = "myapp/terraform.tfstate"
    region = "us-west-2"
  }
}
```

This requires running `terraform init` again because:

1. You're changing the backend configuration
2. Terraform needs to migrate the state file

## When to Use Auto-Approve

While developing locally, you might be tempted to use:

```bash
terraform apply -auto-approve
```

However, in production, a safer approach is to use plan files:

```bash
# Generate and save the plan
terraform plan -out=production.tfplan

# Review the plan with your team

# Apply the exact changes you reviewed
terraform apply production.tfplan
```

## Best Practices Checklist

1. Always run `terraform plan` before `apply`
2. Use `-out` flag to save plans for critical environments
3. Run `terraform init` when:
   - Starting a new project
   - Adding/changing providers
   - Modifying backend configuration
   - Adding new modules
4. Use workspaces to manage multiple environments
5. Version your Terraform configurations in git

## When to Use Targeted Apply

You might face a situation where you need to manage specific resources rather than your entire infrastructure. This is where `terraform apply -target` comes in handy. However, use it cautiously as it can lead to state inconsistencies if not used properly.

```bash
terraform apply -target="aws_instance.web_server"
```

Good use cases for targeted apply:

1. **Emergency Fixes**: When you need to quickly update a specific resource

   ```bash
   # Update only the security group during a security incident
   terraform apply -target="aws_security_group.web_sg"
   ```

2. **Resource Dependencies**: When you need to ensure a specific resource is created first

   ```bash
   # Create the VPC first before other networking resources
   terraform apply -target="aws_vpc.main"
   ```

3. **Testing Changes**: When validating changes to specific resources in a large infrastructure
   ```bash
   # Test changes to RDS instance configuration
   terraform apply -target="aws_db_instance.database"
   ```

⚠️ Important: Always follow up targeted applies with a full `terraform plan` and `apply` to ensure your state is consistent. Using `-target` should be a temporary measure, not a regular practice.

## Common Gotchas

- State drift: Always run `terraform plan` before making changes to catch any manual modifications
- Provider versions: Specify versions to ensure consistency across team members
- Resource dependencies: Use `depends_on` when implicit dependencies aren't enough

Cheers! 🍺
