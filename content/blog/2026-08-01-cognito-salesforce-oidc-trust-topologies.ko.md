---
title: Cognito와 Salesforce OIDC 신뢰 토폴로지 설계
date: 2026-08-01
author: Yoonsoo Park
description: Cognito와 Salesforce 중 어느 쪽이 IdP인지 먼저 정하고 discovery, callback, claim, provisioning, logout, test를 그 방향에 맞춰 구성한다.
categories:
  - Authentication
  - Salesforce
  - AWS Cognito
tags:
  - OIDC
  - OAuth
  - Security
  - Amazon Cognito
  - Salesforce
---

“Cognito와 Salesforce 사이의 SSO”에는 서로 반대인 두 신뢰 방향이 있다. 설계 중간에 Identity Provider(IdP), Relying Party(RP), token issuer, callback 소유자가 바뀌면 설정은 맞아 보여도 흐름이 실패한다. Console을 열기 전에 사용자 여정에서 토폴로지 하나를 선택하고 그림으로 남긴다.

이 글은 2026년 8월 1일 AWS 공식 [Cognito OIDC IdP](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-idp.html), [federation endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints.html), [Cognito 보안 권장사항](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-security-best-practices.html), Salesforce [External Client App](https://developer.salesforce.com/docs/platform/accsdk/guide/acc-sdk-setup-auth-external.html), [OIDC Single Logout](https://help.salesforce.com/s/articleView?id=xcloud.security_auth_slo_oidc_idp_configuring.htm&language=en_US&type=5) 문서를 기준으로 확인했다.

## 토폴로지 A: Cognito가 IdP, Salesforce가 RP

Cognito user pool의 identity로 Salesforce에 들어가야 할 때 사용한다. Salesforce의 OpenID Connect Authentication Provider가 Cognito를 신뢰한다. Browser는 Salesforce에서 시작해 Cognito authorize endpoint로 이동하고 Salesforce가 생성한 정확한 callback URL로 돌아온다.

1. User pool domain과 authorization code grant를 사용하는 app client를 만든다.
2. Salesforce에 OIDC Auth Provider를 만들고 생성된 callback URL을 그대로 Cognito allowed callback에 등록한다.
3. Endpoint를 추측하지 말고 Cognito discovery metadata와 JWKS를 사용한다. `kid`로 key를 cache하고 알 수 없는 key이면 갱신하며 issuer, audience, signature, expiry, nonce를 검증한다.
4. `openid`와 승인된 최소 profile claim만 요청한다.
5. Salesforce Registration Handler에서 변하지 않는 외부 subject를 기존 user에 연결하거나 통제된 JIT provisioning을 수행한다.

Salesforce가 token endpoint에서 인증하는 Cognito app client secret은 플랫폼의 Auth Provider용 보안 설정에만 둔다. Browser code, source control, screenshot, 일반 사용자가 읽을 수 있는 Apex 설정에 넣지 않는다.

Registration Handler는 변경 가능한 email만으로 계정을 연결하지 않는다. 신뢰한 issuer와 `sub` 조합을 우선하고 외부 식별자를 보존한다. Tenant·group claim은 allowlist로 제한하고 최소 권한 profile과 permission set을 적용한다. Source에서 비활성화된 사용자를 어떻게 끊을지도 정한다. Deprovisioning 없는 JIT는 오래된 접근 권한을 남긴다.

## 토폴로지 B: Salesforce가 IdP, Cognito가 RP이자 broker

Salesforce identity로 애플리케이션에 로그인하고 애플리케이션은 Cognito token을 받아야 할 때 사용한다. Salesforce가 Cognito OIDC client를 authorize하고, Cognito가 Salesforce token과 claim을 검증한 뒤 자신의 user-pool token을 발급한다.

1. My Domain을 구성하고 Salesforce가 authorization server인 새 OAuth 통합에는 **External Client App**을 만든다. Authorization code flow와 조직이 요구하는 policy를 활성화한다.
2. Cognito의 정확한 OIDC callback을 Salesforce에 등록한다. Cognito user-pool OIDC provider callback은 AWS 문서의 `https://<user-pool-domain>/oauth2/idpresponse` 형식을 따른다.
3. Cognito에 Salesforce OIDC IdP를 추가하고 My Domain discovery URL `https://<my-domain>.my.salesforce.com/.well-known/openid-configuration`을 사용한다.
4. Discovery가 Cognito와 호환되는 HTTPS authorize, token, user-info, JWKS endpoint를 제공하는지 확인한다. AWS OIDC IdP prerequisite에 명시된 client authentication 방식도 확인한다.
5. Salesforce claim을 Cognito의 required·mutable attribute에 의도적으로 map한다. Cognito는 upstream `sub`를 federated identity에 연결하므로 표시 이름으로 identity key를 덮지 않는다.
6. 대상 Cognito app client에서 IdP를 활성화하고 Cognito managed login 또는 authorize endpoint로 시작한다. 애플리케이션은 upstream Salesforce token이 아니라 Cognito token을 검증한다.

External Client App policy에서 authorize 가능한 사용자, scope, session, refresh token, 관리자 사전 승인을 제한한다. Public browser·native client는 PKCE를 사용하는 authorization code flow를 쓰고 secret을 포함하지 않는다. 이 토폴로지에서는 Cognito가 Salesforce의 server-side OIDC client이므로 public-client 예제를 복사하지 말고 양 제품이 지원하는 client authentication을 확인한다.

## Browser 요청 보호

애플리케이션에서 Cognito로 가는 authorization request는 authorization code와 PKCE `S256`을 사용한다. 높은 entropy의 `state`를 browser transaction에 묶고 callback에서 비교해 login CSRF를 막는다. OIDC replay 방지를 위해 `nonce`도 생성하고 검증한다. Redirect URI는 정확한 HTTPS 값만 허용하며 wildcard, substring match, 호출자가 제공한 origin을 쓰지 않는다.

로그인 후 목적지는 `redirect_uri`와 분리한다. Allowlist된 상대 경로를 server-side 또는 integrity가 보호된 state에 저장한다. 호출자가 넘긴 임의 `startURL`, RelayState, query URL로 바로 redirect하지 않는다.

## Claim, JIT, authorization

OIDC는 인증 사건을 증명하지만 애플리케이션 권한을 정의하지 않는다. 필요한 claim마다 issuer, type, mutability, destination을 문서화한다. Group과 role은 issuer를 검증하고 allowlist를 적용한 뒤 authorization 입력으로 사용한다. 개인정보 claim을 최소화하고 browser가 볼 수 있는 token에 민감한 내부 속성을 넣지 않는다.

기존 user 연결, 첫 로그인, email 변경·중복, 비활성 사용자, 누락 claim, 예상하지 않은 tenant, 허용 role이 없는 사용자를 시험한다. JIT는 fail closed하고 audit event를 남긴다. Lifecycle automation, 짧은 session, token revocation 등을 위험도에 맞춰 deprovisioning에 사용한다.

## Logout은 별도 설계다

애플리케이션 cookie 삭제만으로 Cognito, Salesforce, upstream corporate IdP session이 끝나지 않는다. “로그아웃”이 종료할 session을 정의한다. Cognito는 managed-login logout endpoint를 제공하고 Salesforce가 provider일 때 Salesforce는 browser 기반 front-channel OIDC SLO를 문서화한다. 지원이 대칭적이지 않으므로 RP initiated logout, 지원되는 IdP initiated logout, post-logout redirect allowlist, refresh-token revocation, shared browser 재로그인을 시험한다.

## Migration과 검증 체크리스트

1. Browser, app, Cognito, Salesforce를 그리고 authorize, callback, token, user-info, logout 화살표를 표시한다.
2. Issuer, discovery, JWKS, client 소유자, 정확한 callback, scope, secret 소유자를 기록한다.
3. Non-production org와 권한 없는 test account로 시작한다.
4. PKCE, `state`, `nonce`, issuer, audience, expiry, signature, key rotation을 검증한다.
5. Salesforce·identity 관리자와 claim mapping, JIT, deprovisioning을 검토한다.
6. Callback mismatch, invalid state·nonce, expired code, unknown `kid`, disabled user, logout, rollback을 시험한다.
7. Code, token, secret을 log하지 않으면서 Cognito, Salesforce Login History, application audit를 수집한다.
8. Infrastructure 또는 change control로 정확한 설정을 승격하고 production callback을 기억으로 다시 입력하지 않는다.

승인 기준은 선택한 토폴로지의 완전한 browser trace, 로그인 후 최소 권한, 예측 가능한 logout, 그리고 관리자를 잠그지 않고 새 trust를 끌 수 있는 rollback 문서다.
