---
title: Choosing When to Use Amazon API Gateway
date: 2023-06-10T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A practical comparison of API Gateway HTTP APIs, REST APIs, Lambda Function URLs, and load balancers."
categories:
  - AWS
tags:
  - Amazon API Gateway
  - AWS Architecture
  - Security
---

Amazon API Gateway is a managed front door for HTTP, REST, and WebSocket APIs. It can provide routing, authorization, throttling, metrics, stages, and integrations without requiring a team to operate an API proxy fleet. That does not mean every service needs it.

## Start with the requirement

Choose **API Gateway HTTP API** for a relatively simple Lambda or HTTP proxy API when JWT/OIDC authorization, IAM authorization, custom domains, CORS, and lower cost are important. Choose **API Gateway REST API** when a required feature is available only there, such as usage plans/API keys, request validation or transformation capabilities, or particular caching and private API patterns. Check the official feature comparison because the two products are not interchangeable.

Consider alternatives:

- **Lambda Function URL:** one Lambda, simple ingress, and no need for API Gateway's broader management features.
- **Application Load Balancer:** existing container or instance services, long-lived connections, or load-balancer-native routing.
- **AWS AppSync:** GraphQL and managed real-time/data-source integration requirements.
- **Direct service-to-service integration:** asynchronous EventBridge, SNS, or SQS may be a better boundary than a synchronous API.

## Security is configuration, not a default outcome

Pick authorization for the caller: IAM/SigV4 for AWS workloads, JWT authorizers for OIDC identities, Cognito user pools where appropriate, or a Lambda authorizer for genuinely custom logic. An API key identifies a usage-plan consumer; it is not authentication by itself.

Apply throttling and quotas intentionally, validate input at the application boundary, restrict backend roles, and avoid logging tokens or sensitive request bodies. A private API or resource policy can reduce network exposure, but authorization remains necessary.

## Operations and cost

API Gateway scales the managed entry point, not the backend. Set Lambda concurrency, database connection limits, retries, and timeouts so a traffic spike does not move the failure downstream. Emit access logs with request IDs, metrics and alarms for latency, 4xx/5xx responses, integration errors, and throttles. Sample tracing where it answers an operational question.

Pricing differs by API type, Region, request volume, payload and data transfer. Compare the live pricing page with ALB or direct alternatives for the expected traffic shape rather than assuming pay-per-request is always cheaper.

## A small decision checklist

1. Identify protocol, caller identity, traffic shape, payload size, and latency target.
2. List the required authorization, transformation, caching, WebSocket, and private-network features.
3. Pick HTTP API by default when it meets the list; use REST API only for a required REST-specific capability.
4. Test throttling, authorization denial, backend timeout, malformed input, and deployment rollback.
5. Verify logs and alarms without collecting secrets.

Official documentation reviewed on **2026-08-01**:

- [Choose between HTTP APIs and REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html)
- [API Gateway security](https://docs.aws.amazon.com/apigateway/latest/developerguide/security.html)
- [API Gateway quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html)
