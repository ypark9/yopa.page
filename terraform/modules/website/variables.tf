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

variable "error_page_path" {
  type    = string
  default = "/404.html"
}

variable "draw_api_domain_name" {
  type        = string
  description = "API Gateway hostname for /draw-api requests"
  default     = ""
}
