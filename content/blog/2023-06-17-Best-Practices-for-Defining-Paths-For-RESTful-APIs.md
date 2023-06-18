---
title: Best Practices for Defining Paths for RESTful APIs
date: 2023-06-17T01:25:00-04:00
author: Yoonsoo Park
description: "Defining Path Parameters"
categories:
  - REST API
tags:
  - Paths
---

## Best Practices for Defining Paths for RESTful APIs

When creating RESTful APIs, it's important to adhere to the best practices for defining paths. Below are a few guidelines:

1. **Use nouns, not verbs:** RESTful APIs should use nouns (not verbs) to indicate the resources being manipulated. The HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, etc.) should define the operation. For example, use `/users/{userId}` instead of `/getUser/{userId}`.

2. **Pluralize resources:** It's generally recommended to use plural forms of resources to indicate a collection. For instance, `/users` represents all users, while `/users/{userId}` represents a specific user.

3. **Avoid deep nesting:** While it may be tempting to deeply nest resources, this can lead to complex and less manageable APIs. Instead, limit your API paths to two levels if possible. For example, use `/users/{userId}/posts` rather than `/users/{userId}/posts/{postId}/comments`.

4. **Lowercase letters and hyphens:** Use lowercase letters in the path. If you need to separate two words, use hyphens (`-`) instead of underscores (`_`) or camel case.

5. **Consistency:** Above all, be consistent in your naming and structuring conventions. Consistency helps to maintain clarity for all developers who are using your API.

7. **Use Meaningful Resource Names**

Ensure that resource names are intuitive and meaningful. They should clearly indicate what kind of data is being represented by the API. For example, `/employees` is a more intuitive resource name than `/people` when you're dealing with an API for a human resources application.

8. **Avoid Query Parameters for Mandatory Data**

While query parameters can provide flexibility, they should not be used for mandatory data. Mandatory data should be provided as path parameters instead. For instance, use `/users/{userId}` instead of `/users?userId={userId}`.

9. **Versioning Your APIs**

It's recommended to include a version in your API path to prevent breaking changes for your API consumers. For instance, `/v1/users/{userId}`. This allows you to evolve your API without interrupting service for existing clients.

## Real-Life Examples

Let's look at a real-life example - an API for a blog application. Here are some endpoints that follow the best practices:

1. `GET /v1/posts` - Retrieves all blog posts.
2. `GET /v1/posts/{postId}` - Retrieves a specific blog post.
3. `POST /v1/posts` - Creates a new blog post.
4. `PUT /v1/posts/{postId}` - Updates a specific blog post.
5. `DELETE /v1/posts/{postId}` - Deletes a specific blog post.
6. `GET /v1/users/{userId}/posts` - Retrieves all posts from a specific user.

Note that we have a version number in the paths, we're using plural and meaningful resource names (`posts`), and we're not using query parameters for mandatory data (`postId` and `userId` are path parameters).

---

Adhering to these best practices when defining paths will help to create APIs that are not only powerful and scalable, but also user-friendly and easy to maintain. Consistency, intuitive resource names, correct use of path and query parameters, and proper versioning are all essential for a well-structured API.

Cheers! 🍺
