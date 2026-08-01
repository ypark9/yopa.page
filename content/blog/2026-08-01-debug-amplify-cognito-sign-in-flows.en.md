---
title: "Debug AWS Amplify and Cognito Sign-In Flows"
date: 2024-12-30
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-12-30-troubleshooting-aws-amplify-authentication.html"
author: Yoonsoo Park
description: "Diagnose Amplify v6 sign-in by aligning Cognito app-client flows, handling every nextStep, and choosing SRP or password auth deliberately."
categories:
  - AWS
  - Authentication
tags:
  - AWS Amplify
  - Amazon Cognito
  - Authentication
  - Security
---

Adding `authFlowType: "USER_PASSWORD_AUTH"` is not a universal fix for an Amplify sign-in error. Cognito must allow that flow on the app client, and it sends the user's password to the service over TLS rather than using Secure Remote Password (SRP). Amplify's default SRP flow is usually the better starting point for username/password authentication.

The reliable way to debug sign-in is to align four layers: Amplify configuration, Cognito app-client settings, the selected authentication flow, and the multi-step state machine returned by Amplify Auth.

## Configure without embedding secrets

A public React Native or browser application is a **public client**. It cannot protect a Cognito app-client secret. Create an app client without a secret and restrict callback/sign-out URLs and OAuth flows to the actual application.

```typescript
import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: required("EXPO_PUBLIC_COGNITO_USER_POOL_ID"),
      userPoolClientId: required("EXPO_PUBLIC_COGNITO_CLIENT_ID"),
      signUpVerificationMethod: "code",
    },
  },
});
```

Fail at startup when configuration is missing. A client ID and user pool ID are identifiers, not secrets, but do not log tokens, passwords, authorization codes, or full authentication responses.

## Start with SRP and handle `nextStep`

```typescript
import { signIn, confirmSignIn } from "aws-amplify/auth";

const result = await signIn({ username, password });

switch (result.nextStep.signInStep) {
  case "DONE":
    break;
  case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
  case "CONFIRM_SIGN_IN_WITH_SMS_CODE":
  case "CONFIRM_SIGN_IN_WITH_EMAIL_CODE":
    // Ask the user for the challenge response, then:
    // await confirmSignIn({ challengeResponse: code });
    break;
  case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
    // Collect and validate the new password and required attributes.
    break;
  case "RESET_PASSWORD":
  case "CONFIRM_SIGN_UP":
    // Route to the corresponding recovery or confirmation flow.
    break;
  default:
    // Show a recoverable UI and record only a sanitized error code.
    break;
}
```

The exact `nextStep` variants depend on the Amplify version and enabled Cognito features. Use the installed package types and current documentation rather than assuming every successful credential check returns `DONE`.

## When `USER_PASSWORD_AUTH` is justified

Select it only when a documented integration requires it and the Cognito app client explicitly enables `ALLOW_USER_PASSWORD_AUTH`.

```typescript
await signIn({
  username,
  password,
  options: { authFlowType: "USER_PASSWORD_AUTH" },
});
```

Tradeoff: this flow is simple and compatible with some migrations, but SRP avoids sending the password itself to Cognito. `CUSTOM_WITHOUT_SRP` is for a configured custom authentication challenge, not a generic fallback. Hosted UI/managed login with authorization code and PKCE can reduce the amount of authentication UI the app owns and is often preferable for federation.

## A diagnostic sequence

1. Confirm the app points to the expected Region, user pool, and app client.
2. Inspect the app client's allowed explicit auth flows; do not enable several flows merely to hide the error.
3. Check whether the user is confirmed, disabled, forced to reset a password, or subject to MFA.
4. Confirm the username alias used by the pool: username, email, or phone.
5. Verify network reachability and device clock, then collect a sanitized Amplify error name and Cognito request ID.
6. Reproduce with a dedicated test user in a non-production pool whose settings match production.

Avoid converting every exception into “unknown.” Map known states to user-safe messages while preserving a non-sensitive diagnostic code for operators. Do not reveal whether an arbitrary email exists if that conflicts with the account-enumeration policy.

Authentication tests need a cleanup strategy. Create purpose-specific users rather than sharing one account across parallel tests, keep MFA seeds and recovery channels in approved test-only storage, and delete or reset test identities predictably. Test against a pool configuration produced from the same infrastructure definition as production; a hand-edited test pool can make the application look correct while a required explicit auth flow or callback URL differs in production.

## Migration and verification checklist

- Upgrade to a supported Amplify v6 release and use modular `aws-amplify/auth` imports.
- Remove app-client secrets from public applications.
- Remove forced `USER_PASSWORD_AUTH` unless the flow is explicitly required and allowed.
- Implement sign-up confirmation, MFA, new-password, reset-password, and sign-out paths.
- Test invalid password, unknown user, disabled user, unconfirmed user, expired code, resend, MFA, and token refresh.
- Verify app restart/session restoration and global sign-out behavior.
- Redact logs and monitor Cognito/CloudWatch events under the approved privacy policy.

Verified on **2026-08-01**.

## Primary sources

- [Amplify sign-in documentation](https://docs.amplify.aws/react-native/build-a-backend/auth/connect-your-frontend/sign-in/)
- [Cognito authentication flows](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html)
- [Cognito app-client settings](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)
