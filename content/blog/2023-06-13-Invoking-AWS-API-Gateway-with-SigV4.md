---
title: Invoking AWS API Gateway with SigV4 Using TypeScript
date: 2023-06-13T01:25:00-04:00
author: Yoonsoo Park
description: "A guide on how to invoke AWS API Gateway using Signature Version 4 (SigV4) for secure authentication."
categories:
  - AWS
tags:
  - SigV4
---

In this article, we will walk through the process of invoking an AWS API Gateway using Signature Version 4 (SigV4) for authentication in TypeScript.

## Prerequisites

Before we start, make sure you have Node.js and npm installed on your machine. You will also need an AWS account with access to API Gateway and the necessary permissions to invoke APIs.

## Step 1: Install the Necessary Libraries

We'll need the `aws-sdk` and `aws4` libraries. You can install them with npm:

```bash
npm install aws-sdk aws4 @types/aws4
```

## Step 2: Import the Libraries and Configure AWS

```typescript
import * as AWS from "aws-sdk";
import * as aws4 from "aws4";
import * as https from "https";

AWS.config.update({
  region: "us-west-2", // replace with your desired region
  accessKeyId: "YOUR_ACCESS_KEY", // replace with your access key
  secretAccessKey: "YOUR_SECRET_KEY", // replace with your secret key
});
```

## Step 3: Create a Request Object and Sign It

```typescript
let request: aws4.Request = {
  host: "API_ID.execute-api.REGION.amazonaws.com", // replace with your API Gateway URL
  method: "GET", // replace with your HTTP method
  path: "/Prod/path", // replace with your API path
  headers: {
    "Content-Type": "application/json",
  },
};

request = aws4.sign(request);
```

<details>
<summary>WHAT is **API path** ? </summary>

The `path` in the request object refers to the specific endpoint in your API Gateway that you want to invoke. This is usually mapped to a specific function in your backend service. If you're using AWS Lambda as your backend service, each path in your API Gateway would be mapped to a specific Lambda function.

For example, let's say you have an API for managing users, and you have the following Lambda functions:

- `CreateUserFunction`: Creates a new user.
- `GetUserFunction`: Gets the details of a user.
- `UpdateUserFunction`: Updates details of a user.
- `DeleteUserFunction`: Deletes a user.

You can set up your API Gateway with the following paths:

- `POST /users`: Invokes `CreateUserFunction`.
- `GET /users/{userId}`: Invokes `GetUserFunction`.
- `PUT /users/{userId}`: Invokes `UpdateUserFunction`.
- `DELETE /users/{userId}`: Invokes `DeleteUserFunction`.

If you wanted to get the details of a user with the ID `123`, you would set the `path` in your request object to `/users/123` and put the `method` to `GET`.

So, in the code example, `/Prod/path` is a placeholder for the path you want to invoke in your API Gateway. You would replace this with the actual path for your API. (e.g. if you're invoking the `GetUserFunction` in the example above, you might set the `path` to `/users/123`).

Here's how you can modify the request object for this example:

```typescript
let request: aws4.Request = {
  host: "API_ID.execute-api.REGION.amazonaws.com", // replace with your API Gateway URL
  method: "GET", // replace with your HTTP method
  path: "/users/123", // replace with your API path
  headers: {
    "Content-Type": "application/json",
  },
};
```

Do not forget to replace `API_ID`, `REGION`, and the path with your actual values!

</details>

## Step 4: Send the Request

```typescript
const req = https.request(request, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => console.log(body));
});

req.on("error", (e) => console.error(e));
req.end();
```

This will send a `SigV4` signed request to your API Gateway. The placeholders should be replaced with your actual values!

Please note that this is a basic example and you may need to adjust it accordingly based on your case. (e.g. if you are sending a `POST` request, you need to include the body in the request and sign it as well.)

<details>
<summary>POST example</summary>

Here's how you can modify the previous example to send a POST request with a body:

```typescript
import * as AWS from "aws-sdk";
import * as aws4 from "aws4";
import * as https from "https";

AWS.config.update({
  region: "us-east-1", // replace with your desired region
  accessKeyId: "YOUR_ACCESS_KEY", // replace with your access key
  secretAccessKey: "YOUR_SECRET_KEY", // replace with your secret key
});

let body = {
  key1: "value1",
  key2: "value2",
};

let request: aws4.Request = {
  host: "API_ID.execute-api.REGION.amazonaws.com", // replace with your API Gateway URL
  method: "POST", // replace with your HTTP method
  path: "/Prod/path", // replace with your API path
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
};

request = aws4.sign(request);

const req = https.request(request, (res) => {
  let responseBody = "";
  res.on("data", (chunk) => (responseBody += chunk));
  res.on("end", () => console.log(responseBody));
});

req.on("error", (e) => console.error(e));

req.write(request.body);
req.end();
```

In this example, we're sending a JSON object as the body of the request. We stringify the object and include it in the `body` part of the request object, and then we sign the request with `aws4.sign(request)`.

When sending the request, we use `req.write(request.body)` to include the body in the request. (The `body` object should be replaced with the actual data you want to send in your `POST` request)

</details>

Cheers! 🍺
