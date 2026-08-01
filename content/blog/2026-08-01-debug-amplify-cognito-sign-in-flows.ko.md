---
title: "AWS Amplify와 Cognito 로그인 흐름 디버깅하기"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Cognito app-client flow를 맞추고 모든 nextStep을 처리하며 SRP와 password auth를 의도적으로 선택하는 Amplify v6 로그인 진단법."
categories:
  - AWS
  - Authentication
tags:
  - AWS Amplify
  - Amazon Cognito
  - Authentication
  - Security
---

Amplify 로그인 오류에 `authFlowType: "USER_PASSWORD_AUTH"`를 추가하는 것은 보편적인 해결책이 아니다. Cognito app client가 해당 flow를 허용해야 하고, 이 방식은 TLS 안에서 사용자의 password를 서비스에 전달한다. username/password 인증의 기본 출발점으로는 Amplify의 SRP 방식이 보통 더 적합하다.

로그인 진단에서는 Amplify 설정, Cognito app-client 설정, 선택한 authentication flow, Amplify Auth가 반환하는 다단계 상태를 서로 맞춰야 한다.

## secret을 내장하지 않는 설정

React Native와 브라우저 앱은 secret을 보호할 수 없는 **public client**다. secret이 없는 Cognito app client를 만들고 callback·sign-out URL과 OAuth flow를 실제 앱에 필요한 값으로 제한한다.

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

설정이 없으면 시작 단계에서 실패하게 한다. user pool ID와 client ID는 식별자이지 secret은 아니지만 token, password, authorization code와 전체 인증 응답은 로그에 남기지 않는다.

## SRP에서 시작하고 `nextStep` 처리

```typescript
import { signIn, confirmSignIn } from "aws-amplify/auth";

const result = await signIn({ username, password });
switch (result.nextStep.signInStep) {
  case "DONE":
    break;
  case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
  case "CONFIRM_SIGN_IN_WITH_SMS_CODE":
  case "CONFIRM_SIGN_IN_WITH_EMAIL_CODE":
    // 사용자에게 challenge response를 받고 confirmSignIn을 호출한다.
    break;
  case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
    // 새 password와 필요한 attribute를 수집하고 검증한다.
    break;
  case "RESET_PASSWORD":
  case "CONFIRM_SIGN_UP":
    // 해당 recovery 또는 confirmation 흐름으로 이동한다.
    break;
  default:
    // 복구 가능한 UI와 비민감 오류 코드만 남긴다.
    break;
}
```

정확한 `nextStep`은 Amplify 버전과 Cognito 기능에 따라 달라진다. 모든 credential 성공이 `DONE`을 반환한다고 가정하지 말고 설치한 패키지의 type과 현재 문서를 기준으로 구현한다.

## `USER_PASSWORD_AUTH`를 선택할 때

문서화된 연동이 요구하고 app client가 `ALLOW_USER_PASSWORD_AUTH`를 명시적으로 허용할 때만 선택한다.

```typescript
await signIn({
  username,
  password,
  options: { authFlowType: "USER_PASSWORD_AUTH" },
});
```

이 방식은 단순하고 일부 migration과 호환되지만 SRP는 password 자체를 Cognito에 보내지 않는다. `CUSTOM_WITHOUT_SRP`는 구성된 custom challenge용이지 일반 fallback이 아니다. federation에서는 authorization code와 PKCE를 사용하는 hosted UI/managed login이 앱이 소유할 인증 UI를 줄일 수 있다.

## 진단 순서

1. Region, user pool, app client가 기대한 환경인지 확인한다.
2. app client의 allowed explicit auth flow를 확인한다. 오류를 숨기려고 여러 flow를 모두 켜지 않는다.
3. 사용자가 confirmed, disabled, password reset 대상, MFA 대상인지 확인한다.
4. pool의 username alias가 username, email, phone 중 무엇인지 확인한다.
5. network와 device clock을 확인하고 민감하지 않은 Amplify error name과 Cognito request ID를 수집한다.
6. production과 설정이 같은 비운영 pool에서 전용 test user로 재현한다.

모든 예외를 “unknown”으로 바꾸지 않는다. 알려진 상태는 사용자에게 안전한 메시지로 매핑하고 운영자를 위한 비민감 진단 코드를 남긴다. 계정 존재 여부 노출 방침에 맞춰 임의 email의 등록 여부를 공개하지 않는다.

## 마이그레이션과 검증 체크리스트

- 지원 중인 Amplify v6로 갱신하고 `aws-amplify/auth` 모듈 import를 사용한다.
- public app에서 client secret을 제거한다.
- 명시적 요구가 없으면 강제 `USER_PASSWORD_AUTH`를 제거한다.
- sign-up confirmation, MFA, new password, reset password, sign-out을 구현한다.
- 잘못된 password, unknown·disabled·unconfirmed user, expired code, resend, MFA, token refresh를 시험한다.
- 앱 재시작 시 session 복원과 global sign-out을 검증한다.
- privacy policy에 맞춰 로그를 비식별화하고 Cognito·CloudWatch event를 감시한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [Amplify 로그인 문서](https://docs.amplify.aws/react-native/build-a-backend/auth/connect-your-frontend/sign-in/)
- [Cognito authentication flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html)
- [Cognito app-client 설정](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)
