terraform {
  backend "s3" {
    bucket = "terraform.yopa.page"
    key = "env/dev/terraform.tfstate"
    region = "us-east-1"
  }
}

provider aws {
  region = "us-east-1"
}

module "website" {
  source = "../../modules/website"
  bucket_name = "dev.yopa.page"
  domain_names = ["dev.yopa.page"]
}

output "cloudfront_distribution_id" {
  value = module.website.cloudfront_distribution_id
}
