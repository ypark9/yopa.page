output "api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

output "api_domain_name" {
  value = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
}

output "user_pool_id" {
  value = aws_cognito_user_pool.users.id
}
