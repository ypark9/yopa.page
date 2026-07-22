terraform {
  required_providers {
    archive = {
      source = "hashicorp/archive"
    }
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  lambda_name = "${var.name}-handler"
}

resource "aws_dynamodb_table" "presence" {
  name         = var.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }

  attribute {
    name = "room_id"
    type = "S"
  }

  attribute {
    name = "last_seen"
    type = "N"
  }

  global_secondary_index {
    name            = "room-last-seen-index"
    hash_key        = "room_id"
    range_key       = "last_seen"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expire_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }
}

data "archive_file" "handler" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/article-atlas-presence.zip"
  excludes    = ["__pycache__", "*.pyc"]
}

resource "aws_iam_role" "handler" {
  name = "${var.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_cloudwatch_log_group" "handler" {
  name              = "/aws/lambda/${local.lambda_name}"
  retention_in_days = 14
}

resource "aws_iam_role_policy" "handler" {
  name = "${var.name}-lambda-policy"
  role = aws_iam_role.handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "${aws_cloudwatch_log_group.handler.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          aws_dynamodb_table.presence.arn,
          "${aws_dynamodb_table.presence.arn}/index/room-last-seen-index",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
        ]
        Resource = "${aws_apigatewayv2_api.presence.execution_arn}/*/POST/@connections/*"
      },
    ]
  })
}

resource "aws_lambda_function" "handler" {
  function_name                  = local.lambda_name
  role                           = aws_iam_role.handler.arn
  handler                        = "index.handler"
  runtime                        = "python3.13"
  architectures                  = ["arm64"]
  timeout                        = 10
  memory_size                    = 256
  reserved_concurrent_executions = 5

  filename         = data.archive_file.handler.output_path
  source_code_hash = data.archive_file.handler.output_base64sha256

  environment {
    variables = {
      ACTIVE_SECONDS   = tostring(var.active_seconds)
      ALLOWED_ORIGINS  = join(",", var.allowed_origins)
      MAX_ROOM_SIZE    = tostring(var.max_room_size)
      MOVE_INTERVAL_MS = "5000"
      TABLE_NAME       = aws_dynamodb_table.presence.name
      TTL_SECONDS      = tostring(var.ttl_seconds)
    }
  }

  depends_on = [aws_cloudwatch_log_group.handler]
}

resource "aws_apigatewayv2_api" "presence" {
  name                       = var.name
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "handler" {
  api_id             = aws_apigatewayv2_api.presence.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.handler.invoke_arn
  integration_method = "POST"
}

locals {
  routes = toset([
    "$connect",
    "$disconnect",
    "$default",
    "heartbeat",
    "hello",
    "move",
    "pause",
    "resume",
    "snapshot",
  ])
}

resource "aws_apigatewayv2_route" "handler" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.presence.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.handler.id}"
}

resource "aws_apigatewayv2_stage" "presence" {
  api_id      = aws_apigatewayv2_api.presence.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 24
    throttling_rate_limit  = 12
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      connectionId = "$context.connectionId"
      eventType    = "$context.eventType"
      requestId    = "$context.requestId"
      routeKey     = "$context.routeKey"
      status       = "$context.status"
    })
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.presence.execution_arn}/*"
}
