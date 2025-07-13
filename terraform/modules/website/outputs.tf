output "cloudfront_distribution_id" {
    value = aws_cloudfront_distribution.distribution.id
}

output "bucket_name" {
  value = aws_s3_bucket.bucket.bucket
}

output "live_path" {
  value = var.live_path
}
