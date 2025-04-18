---
title: Setting Up SSO Between AWS Cognito and Salesforce - A Beginner's Guide
date: 2025-04-11
author: Yoonsoo Park
description: "Learn how to implement Single Sign-On between AWS Cognito and Salesforce for a seamless user experience with complete step-by-step instructions."
categories:
  - Cloud Computing
  - Salesforce
  - Authentication
tags:
  - AWS Cognito
  - Salesforce
  - SSO
---

> Learn how to implement Single Sign-On between AWS Cognito and Salesforce for a seamless user experience with complete step-by-step instructions.

[AWS Cognito Identity Provider Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-provider.html)

## Introduction

Single Sign-On (SSO) between AWS Cognito and Salesforce can eliminate multiple login prompts. This guide will walk through the complete setup process, core concepts and implementation details for someone dives into the sso setup for the first time.

## Understanding AWS Cognito Components

### User Pools: The base of authentication

A **User Pool** is Cognito's user directory that handles:

- User registration and account creation
- Authentication (username/password validation)
- User attributes storage (email, phone, custom fields)
- Security features (MFA, password policies)

Think of a User Pool as your base database of users which answers the "who are you?" part of authentication.

### App Clients: The Connectors

Many beginners wonder why App Clients are needed when User Pools already manage users. (at least it was for me) Let's break it down:

An **App Client** defines:

- Which applications can use your User Pool
- What authentication flows are allowed (e.g., user password, refresh tokens)
- Token expiration settings
- Callback URLs (where users return after authentication)
- OAuth scopes (what user information can be accessed)

App Clients act as bridges between your applications and the User Pool that is answering the "how" and "where" authentication happens.

### External Identity Providers (IdPs)

When you connect external providers like Google to your User Pool, you're creating a "federation" where:

- Users authenticate with their existing accounts
- Cognito receives verification from the external provider
- Cognito creates or maps to a user in its User Pool
- Cognito issues its own tokens for your applications

## Authentication Flow Overview

![authentication flow](images/cognito-salesforce-sso.png)

## Step-by-Step Configuration Guide

### 1. Configuring AWS Cognito

#### User Pool Setup

1. Create or use an existing User Pool
2. Ensure your external IdP (Google) is already configured
3. Note your **User Pool ID** (format: `region_alphanumeric` e.g. `us-east-1_1234567890`)
4. Locate and save your **User Pool Domain** (format: `https://your-domain.auth.region.amazoncognito.com` e.g. `https://my-domain.auth.us-east-1.amazoncognito.com`)

#### App Client Configuration

1. Create a new App Client in your User Pool
2. Enable the OAuth 2.0 flows (Authorization code grant)
3. Add Salesforce's callback URL as an allowed callback (we'll get this later; I promise :) )
4. Enable the necessary OAuth scopes:
   - `openid` (required)
   - `email`
   - `profile`
5. Save your **App Client ID**
6. Note the full **OAuth Endpoints** from the App Integration > App client settings page

### 2. Configuring Salesforce

#### Create Auth Provider in Salesforce

1. Go to Setup > Identity > Auth. Providers
2. Create a new Auth Provider of type **OpenID Connect**
3. Name it `myFederatedIdP` (or your preferred name)
4. Enter details from Cognito:

   - **Consumer Key**: Your Cognito App Client ID (e.g. `1234567890`)
   - **Consumer Secret**: Your Cognito App Client Secret (e.g. `1234567890`)
   - **Authorize Endpoint URL**: The OAuth authorization endpoint from Cognito (e.g. `https://my-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize`)
   - **Token Endpoint URL**: The OAuth token endpoint from Cognito (e.g. `https://my-domain.auth.us-east-1.amazoncognito.com/oauth2/token`)
   - **User Info Endpoint URL**: The OAuth userinfo endpoint from Cognito (e.g. `https://my-domain.auth.us-east-1.amazoncognito.com/oauth2/userInfo`)
   - **Default Scopes**: `openid email profile`
   - **Custom Error URL**: Your error handling page
   - **Registration Handler**: Your custom Apex class (if needed)
   - **Execute Registration As**: A designated Salesforce user

5. Save the configuration

#### Update Cognito with Salesforce Callback URL

After creating the `Auth. Provider` in Salesforce, it will generate callback URLs. Find the **Callback URL** (format: `https://your-domain.my.salesforce.com/services/authcallback/myFederatedIdP`).

1. Return to AWS Cognito Console
2. Open your User Pool > App clients
3. Select your App client
4. Add this Salesforce callback URL to the "Callback URLs" field
5. Save the changes

### 3. Implementing the Redirect in Your Application

Using the redirect service pattern from the WebApp:

```typescript
// When a user clicks to access Salesforce:
// redirectWithToken is a function that you can implement in your application
RedirectService.redirectWithToken({
  relayState: "https://your-salesforce-domain.my.salesforce.com/lightning/page", // this is where you want to redirect the user after authentication
});

// In the redirect service:
const accessToken = getAccessToken(); // From cookies
const relayStateUrl = new URL(request.relayState);
const sfDomain = relayStateUrl.origin;
const relativePath =
  relayStateUrl.pathname + relayStateUrl.search + relayStateUrl.hash;

// Redirect to Salesforce SSO endpoint
const redirectUrl =
  `${sfDomain}/services/auth/sso/myFederatedIdP` +
  `?startURL=${encodeURIComponent(relativePath)}`;
window.location.href = redirectUrl;
```

## Common Pitfalls and Solutions

1. **Token Format Issues**: Ensure your Cognito tokens include required user claims
2. **Callback URL Mismatch**: Verify exact match between Salesforce and Cognito URLs
3. **Relative Path Requirements**: Salesforce needs relative paths in the startURL parameter (e.g. `/lightning/page`)
4. **Authorization Scopes**: Verify `openid` scope is enabled for proper OIDC authentication

## Wrapping it up 👏

Working on SSO is quite challenging because every bit of information should be correct and match. Even if one of them is off, it won't work.
But the advantage of SSO is that once you set it up, it will improve user experience and reduce the number of login prompts which is huge.
I hope this guide helps you to understand the core concepts and implementation details of SSO between AWS Cognito and Salesforce.

Cheers! 🍺

---

## References

- [How to Build SSO Solution on Top of Amazon Cognito](https://www.sphereinc.com/blogs/how-to-build-sso-solution-on-top-of-amazon-cognito/)
- [Cognito User Pools OIDC Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-flow.html)
- [Login with Salesforce using AWS Cognito OpenID Connect](https://stackoverflow.com/questions/51782571/login-with-salesforce-using-aws-cognito-openid-connect)
- [What is the difference between relayState and redirect_uri?](https://salesforce.stackexchange.com/questions/317978/what-is-the-difference-between-relaystate-and-redirect-uri)
- [login with external idp](https://www.miniorange.com/iam/login-with-external-idp/configure-aws-cognito-sso)
