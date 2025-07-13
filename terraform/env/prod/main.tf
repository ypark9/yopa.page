terraform {
  backend "s3" {
    bucket = "terraform.yopa.page"
    key = "env/prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider aws {
  region = "us-east-1"
}

module "website" {
  source = "../../modules/website"
  bucket_name = "yopa.page"
  domain_names = ["yopa.page", "www.yopa.page"]
  live_path = var.live_path
}

variable "live_path" {
  type        = string
  description = "The live path for blue/green deployment"
  default     = "blue"
}

output "cloudfront_distribution_id" {
  value = module.website.cloudfront_distribution_id
}

output "bucket_name" {
  value = module.website.bucket_name
}

output "live_path" {
  value = module.website.live_path
}
