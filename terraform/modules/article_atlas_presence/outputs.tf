output "api_endpoint" {
  description = "Native API Gateway WebSocket endpoint without stage"
  value       = aws_apigatewayv2_api.presence.api_endpoint
}

output "origin_domain_name" {
  description = "API Gateway domain used as the CloudFront custom origin"
  value       = trimsuffix(trimprefix(aws_apigatewayv2_api.presence.api_endpoint, "wss://"), "/")
}

output "stage_name" {
  value = aws_apigatewayv2_stage.presence.name
}

output "table_name" {
  value = aws_dynamodb_table.presence.name
}

