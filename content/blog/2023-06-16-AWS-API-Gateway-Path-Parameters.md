---
title: Path Parameters in Amazon API Gateway
date: 2023-06-16T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Design and validate API Gateway route parameters without confusing gateway templates, backend framework syntax, and authorization."
categories:
  - AWS
tags:
  - Amazon API Gateway
  - REST APIs
  - Security
---

Path parameters identify a resource inside a route: `GET /users/{userId}`. API Gateway matches the route and passes the captured value to the integration. The braces belong to the API Gateway route definition; a backend framework may use different syntax, such as Express `/users/:userId`.

## HTTP API and REST API events

For a Lambda proxy integration, read the decoded route values from `pathParameters` rather than parsing the raw path yourself.

```typescript
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = event.pathParameters?.userId;
  if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
    return { statusCode: 400, body: JSON.stringify({ error: "invalid userId" }) };
  }

  // Authorization must confirm the caller may read this user.
  return { statusCode: 200, body: JSON.stringify({ userId }) };
};
```

Payload shapes differ between HTTP API payload versions and REST API proxy events. Type and test against the integration actually deployed. A greedy route such as `/{proxy+}` captures multiple path segments; use it when the backend intentionally owns routing, not as a shortcut that hides the API contract.

## Resource modeling

Use a path value for the identity or hierarchy of the addressed resource, for example `/orders/{orderId}`. Use query parameters for filtering, sorting, pagination, and optional views, for example `/orders?status=open&cursor=...`. “Required” does not automatically mean “path”: a required search filter can still be a query parameter, while a resource identifier naturally belongs in the path.

Nested paths such as `/users/{userId}/posts/{postId}` are useful when the relationship is part of the authorization or identity. Avoid deep nesting when the child has a stable independent identifier. Consistency and a documented OpenAPI contract matter more than a universal pluralization or depth rule.

## Validation and security

A syntactically valid path parameter is not authorization. Prevent insecure direct object references by checking the caller's access to the resolved resource. Validate length and character set, handle percent-encoding consistently, and do not concatenate an unchecked value into SQL, filesystem paths, log formats, or downstream URLs.

Return consistent error semantics: usually `400` for malformed input, `401/403` for authentication or authorization failure, and `404` when the resource is absent according to the API's disclosure policy. Configure route-level throttling and observe latency and errors by route without putting sensitive IDs into high-cardinality metric dimensions.

## Verification checklist

- Test missing, empty-equivalent, oversized, Unicode, encoded slash, and invalid-character values.
- Confirm HTTP API or REST API event shape and payload version.
- Test a valid ID owned by another user.
- Verify greedy-route precedence and the deployment stage/base path.
- Keep the OpenAPI route, infrastructure definition, and handler tests aligned.

Official documentation reviewed on **2026-08-01**:

- [HTTP API routes](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-routes.html)
- [Lambda proxy integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [REST API request parameters](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-request.html)
