variable "name" {
  type        = string
  description = "Resource name prefix for Article Atlas presence"
  default     = "article-atlas-presence"
}

variable "stage_name" {
  type        = string
  description = "API Gateway WebSocket stage name"
  default     = "production"
}

variable "allowed_origins" {
  type        = list(string)
  description = "Exact browser origins accepted by the WebSocket connect route"
  default = [
    "https://www.yopa.page",
    "https://yopa.page",
  ]
}

variable "active_seconds" {
  type        = number
  description = "Seconds after last activity before a visitor is removed from snapshots"
  default     = 60
}

variable "ttl_seconds" {
  type        = number
  description = "DynamoDB cleanup TTL refreshed on activity"
  default     = 3600
}

variable "max_room_size" {
  type        = number
  description = "Hard MVP room capacity and callback cost boundary"
  default     = 20
}

