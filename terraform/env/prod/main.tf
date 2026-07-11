terraform {
  backend "s3" {
    bucket = "terraform.yopa.page"
    key    = "env/prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

module "website" {
  source               = "../../modules/website"
  bucket_name          = "yopa.page"
  domain_names         = ["yopa.page", "www.yopa.page"]
  live_path            = var.live_path
  draw_api_domain_name = module.draw_api.api_domain_name
}

module "draw_api" {
  source          = "../../modules/draw-api"
  allowed_origins = ["https://yopa.page", "https://www.yopa.page", "http://127.0.0.1:5173"]
  callback_urls   = ["https://www.yopa.page/draw/", "http://127.0.0.1:5173/draw/"]
  logout_urls     = ["https://www.yopa.page/draw/", "http://127.0.0.1:5173/draw/"]
}

output "draw_api_url" {
  value = module.draw_api.api_url
}

output "draw_cognito_user_pool_id" {
  value = module.draw_api.user_pool_id
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
