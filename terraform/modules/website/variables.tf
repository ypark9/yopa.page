variable "bucket_name" {
  type        = string
  description = "The name of the bucket to create"
}

variable "live_path" {
  type        = string
  description = "The live path for the website"
  default     = "blue"
}

variable "domain_names" {
  type        = list(string)
  description = "The domain names for the website"
}

variable "draw_rewrite_name" {
  type        = string
  description = "CloudFront Function name used to route /draw to its static index"
  default     = "yopa-draw-index-rewrite"
}

variable "error_page_path" {
  type    = string
  default = "/404.html"
}
