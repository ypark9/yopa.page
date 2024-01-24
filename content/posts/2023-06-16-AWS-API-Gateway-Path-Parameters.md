---
title: AWS API Gateway - Path Parameters
date: 2023-06-16T01:25:00-04:00
author: Yoonsoo Park
description: "Defining Path Parameters"
categories:
  - AWS
tags:
  - AWS API Gateway
---

This article aims to clarify the use of AWS API Gateway, specifically focusing on path parameters - defined with `{}` braces - and the best practices for their utilization.

## AWS API Gateway Overview

AWS API Gateway allows you to process hundreds of thousands of concurrent API calls and handles traffic management, authorization and access control, monitoring, and API version management. It supports RESTful APIs and WebSocket APIs and is incredibly versatile in serving a variety of different API types.

## Defining Path Parameters in AWS API Gateway

Path parameters are dynamic parts of the request URL, allowing you to pass data directly within the endpoint path. In AWS API Gateway, these parameters are specified using `{}` braces. For instance:

```
GET /users/{userId}
```

In this example, `userId` is a path parameter that can be replaced with an actual user ID, such as:

```
GET /users/1234
```

The AWS API Gateway service can extract these parameters from the path and provide them to your application logic, enabling you to build dynamic responses based on the input parameters.

## Real-Life Example: Using Path Parameters

Let's delve into a real-life example to better illustrate the use of path parameters. Consider a social media application where users can have posts. We would want to perform CRUD operations on these posts. Below are some example API endpoints:

- `GET /users/{userId}/posts` - Retrieves all posts for a specific user.
- `GET /users/{userId}/posts/{postId}` - Retrieves a specific post from a specific user.
- `POST /users/{userId}/posts` - Creates a new post for a specific user.
- `PUT /users/{userId}/posts/{postId}` - Updates a specific post from a specific user.
- `DELETE /users/{userId}/posts/{postId}` - Deletes a specific post from a specific user.

Here `{userId}` and `{postId}` are path parameters. When a client sends a request to the server, it replaces these placeholders with actual values.

For example, to get the post with the ID of `999` for the user with ID `123`, the client would send a `GET` request to `/users/123/posts/999`.

## Using Path Parameters on the Backend

On the server-side, the code would use these path parameters to perform the requested operations. Here's a simple Node.js example using Express:

```javascript
const express = require('express');
const app = express();

app.get('/users/:userId/posts/:postId', (req, res) => {
  const userId = req.params.userId;
  const postId = req.params.postId;
  
  // You would usually fetch the user and post from a database here
  // For simplicity, we're returning dummy data
  res.json({
    userId: userId,
    postId: postId,
    title: 'Sample Post',
    content: 'This is a sample post.'
  });
});

app.listen(3000, () => console.log('Server is running on port 3000'));
```

In this code, we define a route `/users/:userId/posts/:postId`. Express uses `:` to denote path parameters. When a `GET` request is made to this route, Express extracts the `userId` and `postId` from the path and makes them available as properties of `req.params`.

In this way, path parameters provide a dynamic and flexible way to define routes and handle requests, making them a key aspect of developing user-friendly and efficient APIs.

Cheers! 🍺
