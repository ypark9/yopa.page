# The article's second unverified claim, as the smallest thing that can test it.
#
#   "one end-to-end session to confirm that the worker's role really cannot
#    read the launcher's parameter"
#
# The claim is about IAM and SSM. It is not about MicroVMs, so none are here.
# Four parameters, two roles, and a script that tries all eight combinations.
#
# Deliberately NOT part of the blog's prod state. Separate directory, local
# state file, separate test account, one-command destroy. Nothing here is referenced
# by terraform/env/{global,prod}.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  # Empty string means "do not set a profile", so the provider falls back to
  # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment. That is
  # the escape hatch for `apply`: my test profile's credential helper
  # wraps a long-lived key in sts:GetSessionToken without MFA, and those
  # session credentials cannot call the IAM API at all. Reads work, so plan
  # and the verification step are fine on the profile; only apply needs this.
  profile = var.profile != "" ? var.profile : null

  default_tags {
    tags = {
      Project    = "yopa.page"
      Experiment = "sandbox-launcher-iam-boundary"
      Lifecycle  = "disposable"
      ManagedBy  = "opentofu"
    }
  }
}

variable "profile" {
  description = "AWS CLI profile for a disposable test account."
  type        = string
  default     = ""
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "prefix" {
  description = "Name prefix, so every resource is obviously disposable."
  type        = string
  default     = "sandbox-launcher-exp"
}

data "aws_caller_identity" "current" {}

locals {
  path = "/${var.prefix}"

  # The principal allowed to assume both test roles: whoever is running this.
  # Scoped to exactly that ARN rather than the account root, so applying this
  # does not widen anything for any other principal in the account.
  assumer_arn = data.aws_caller_identity.current.arn
}

# ---------------------------------------------------------------------------
# Parameters
#
# Two pairs. The String pair isolates the SSM policy as the only boundary.
# The SecureString pair adds the AWS-managed alias/aws/ssm key, which is where
# a second boundary MIGHT exist - whether it actually does is the question the
# experiment measures rather than assumes. Neither role is granted kms:Decrypt
# in its identity policy, on purpose.
#
# Values are inert strings. Nothing here is a credential for anything.
# ---------------------------------------------------------------------------

resource "aws_ssm_parameter" "launcher_secret_plain" {
  name  = "${local.path}/launcher/signing-secret-plain"
  type  = "String"
  value = "inert-fixture-value-launcher-plain"
}

resource "aws_ssm_parameter" "worker_key_plain" {
  name  = "${local.path}/worker/environment-key-plain"
  type  = "String"
  value = "inert-fixture-value-worker-plain"
}

resource "aws_ssm_parameter" "launcher_secret_secure" {
  name  = "${local.path}/launcher/signing-secret-secure"
  type  = "SecureString"
  value = "inert-fixture-value-launcher-secure"
}

resource "aws_ssm_parameter" "worker_key_secure" {
  name  = "${local.path}/worker/environment-key-secure"
  type  = "SecureString"
  value = "inert-fixture-value-worker-secure"
}

# ---------------------------------------------------------------------------
# Roles
#
# This is the article's Decision 3 table expressed as IAM: each role can read
# the parameters for its own job and nothing else.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = [local.assumer_arn]
    }
  }
}

resource "aws_iam_role" "launcher" {
  name                 = "${var.prefix}-launcher"
  description          = "Disposable experiment role. Reads the webhook signing secret only."
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  max_session_duration = 3600
}

resource "aws_iam_role" "worker" {
  name                 = "${var.prefix}-worker"
  description          = "Disposable experiment role. Reads the worker environment key only."
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "launcher_reads" {
  statement {
    effect  = "Allow"
    actions = ["ssm:GetParameter"]
    resources = [
      aws_ssm_parameter.launcher_secret_plain.arn,
      aws_ssm_parameter.launcher_secret_secure.arn,
    ]
  }
}

data "aws_iam_policy_document" "worker_reads" {
  statement {
    effect  = "Allow"
    actions = ["ssm:GetParameter"]
    resources = [
      aws_ssm_parameter.worker_key_plain.arn,
      aws_ssm_parameter.worker_key_secure.arn,
    ]
  }
}

resource "aws_iam_role_policy" "launcher" {
  name   = "read-own-parameters"
  role   = aws_iam_role.launcher.id
  policy = data.aws_iam_policy_document.launcher_reads.json
}

resource "aws_iam_role_policy" "worker" {
  name   = "read-own-parameters"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker_reads.json
}

# ---------------------------------------------------------------------------
# Outputs, consumed by verify_boundary.py
# ---------------------------------------------------------------------------

output "roles" {
  value = {
    launcher = aws_iam_role.launcher.arn
    worker   = aws_iam_role.worker.arn
  }
}

output "parameters" {
  value = {
    launcher_plain  = aws_ssm_parameter.launcher_secret_plain.name
    launcher_secure = aws_ssm_parameter.launcher_secret_secure.name
    worker_plain    = aws_ssm_parameter.worker_key_plain.name
    worker_secure   = aws_ssm_parameter.worker_key_secure.name
  }
}

output "region" {
  value = var.region
}
