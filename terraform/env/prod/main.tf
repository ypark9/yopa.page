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
}

output "cloudfront_distribution_id" {
  value = module.website.cloudfront_distribution_id
}
