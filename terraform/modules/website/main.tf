locals {
  cloudfront_origin_id = "s3"
  presence_origin_id   = "article-atlas-presence"
  mime_types = {
    css   = "text/css"
    html  = "text/html"
    ico   = "image/vnd.microsoft.icon"
    jpeg  = "image/jpeg"
    jpg   = "image/jpeg"
    webp  = "image/webp"
    js    = "text/javascript"
    json  = "application/json"
    png   = "image/png"
    ttf   = "font/ttf"
    woff  = "font/woff"
    woff2 = "font/woff2"
    xml   = "text/xml"
    txt   = "text/plain"
  }
  upload_directory = "${path.root}/../../../public/"
  index_page       = "index.html"
}

resource "aws_cloudfront_origin_access_identity" "identity" {}

resource "aws_cloudfront_function" "draw_rewrite" {
  name    = var.draw_rewrite_name
  runtime = "cloudfront-js-1.0"
  comment = "Rewrite /draw and /draw/ to the draw app index"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      if (request.uri === '/draw' || request.uri === '/draw/') {
        request.uri = '/draw/index.html';
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_function" "presence_rewrite" {
  count = var.presence_origin_enabled ? 1 : 0

  name    = "article-atlas-presence-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrite /presence to the API Gateway WebSocket stage root"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      if (request.uri === '/presence' || request.uri === '/presence/') {
        request.uri = '/';
      }
      return request;
    }
  EOT
}

resource "aws_s3_bucket" "bucket" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.bucket.bucket
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket                  = aws_s3_bucket.bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "document" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.bucket.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.identity.iam_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "policy" {
  bucket = aws_s3_bucket.bucket.id
  policy = data.aws_iam_policy_document.document.json
}

data "aws_acm_certificate" "certificate" {
  domain = element(var.domain_names, 0)
  types  = ["AMAZON_ISSUED"]
}

data "aws_cloudfront_cache_policy" "cache_policy" {
  name = "caching-optimized"
}

data "aws_cloudfront_response_headers_policy" "headers_policy" {
  name = "security-headers-policy"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "distribution" {
  aliases             = var.domain_names
  enabled             = true
  default_root_object = local.index_page

  origin {
    domain_name = aws_s3_bucket.bucket.bucket_domain_name
    origin_id   = local.cloudfront_origin_id
    origin_path = "/${var.live_path}"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.identity.cloudfront_access_identity_path
    }
  }

  dynamic "origin" {
    for_each = var.presence_origin_enabled ? [var.presence_origin_domain] : []
    content {
      domain_name = origin.value
      origin_id   = local.presence_origin_id
      origin_path = var.presence_origin_path

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    target_origin_id           = local.cloudfront_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    cache_policy_id            = data.aws_cloudfront_cache_policy.cache_policy.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.headers_policy.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.draw_rewrite.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.presence_origin_enabled ? [1] : []
    content {
      path_pattern             = "/presence*"
      allowed_methods          = ["GET", "HEAD", "OPTIONS"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = false
      target_origin_id         = local.presence_origin_id
      viewer_protocol_policy   = "https-only"
      cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.presence_rewrite[0].arn
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.certificate.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2019"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "custom_error_response" {
    for_each = [400, 403, 404, 405, 414]
    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = var.error_page_path
      error_caching_min_ttl = 300
    }
  }
}
