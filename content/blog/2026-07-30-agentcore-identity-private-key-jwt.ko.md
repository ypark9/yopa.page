---
title: "공유 클라이언트 시크릿 없이 AgentCore Identity 사용하기"
date: 2026-07-30T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore Identity의 Private Key JWT 클라이언트 인증이 공유 클라이언트 시크릿을 어떻게 대체하는지, KMS는 어디에 쓰이는지, 세 가지 권한 부여 방식은 어떻게 선택하는지 살펴본다."
categories:
  - AWS
tags:
  - agentcore
  - identity
  - security
  - oauth
  - kms
  - bedrock
---

고객지원 에이전트가 내부 주문 API에서 고객의 주문 내역을 조회한다고 가정해 보자. 이 API는 ID 공급자(IdP)로 보호되어 있으므로 에이전트가 요청을 보내려면 액세스 토큰이 필요하다. 토큰을 받으려면 먼저 IdP에 자신의 신원을 증명해야 한다.

이 글에서 다룰 내용이 바로 이 인증 단계다. 2026년 7월 AWS는 [Amazon Bedrock AgentCore Identity에 Private Key JWT 클라이언트 인증을 추가](https://aws.amazon.com/blogs/machine-learning/authenticate-with-private-key-jwt-using-amazon-bedrock-agentcore-identity/)했다. 기존의 공유 클라이언트 시크릿을 대신할 수 있는 방식이다.

## AgentCore에서 Identity의 역할

에이전트는 보호된 다운스트림 리소스를 호출할 때 AgentCore Identity에 토큰을 요청한다.

```
agent → GetResourceOauth2Token → (access token) → orders API
```

AgentCore Identity는 IdP의 토큰 엔드포인트에 인증하고 액세스 토큰을 받은 뒤 에이전트에 전달한다. 에이전트는 이 토큰으로 주문 API를 호출한다.

여기서 중요한 점은 AgentCore Identity가 IdP에 인증하는 방법이다. IdP가 토큰을 발급하기 전에 클라이언트, 즉 에이전트를 대신하는 AgentCore Identity가 먼저 자신의 신원을 증명해야 한다.

## 기존 방식: 공유 클라이언트 시크릿

전통적인 OAuth 2.0 클라이언트 자격 증명 방식은 공유 시크릿을 사용한다. 에이전트를 IdP에 클라이언트로 등록해 `client_id`와 `client_secret`을 발급받고, 시크릿을 별도로 저장한다. AgentCore Identity는 토큰을 요청할 때 두 값을 함께 보낸다.

```
POST /token
grant_type=client_credentials
client_id=support-agent
client_secret=SUPER_SECRET_VALUE   ← 공유되는 문자열
```

이 방식은 단순하지만 수명이 긴 자격 증명을 직접 관리해야 한다. 시크릿은 Secrets Manager나 환경 변수, 설정 저장소 등에 보관해야 하고, IdP와 클라이언트 양쪽이 같은 값을 갖는다. 시크릿을 확보한 사람은 누구나 에이전트를 사칭할 수 있다. 운영 과정에서는 다음과 같은 문제가 생긴다.

- **보관:** 시크릿을 저장하는 위치마다 보호와 감사가 필요하다.
- **교체:** IdP와 내부 저장소의 값을 서비스 중단 없이 함께 바꿔야 한다.
- **유출:** 시크릿을 가진 사람은 에이전트 이름으로 토큰을 요청할 수 있으며, IdP는 이를 정상 요청과 구분할 수 없다.
- **확장:** 에이전트나 연동 대상이 늘어날 때마다 관리할 시크릿도 하나씩 늘어난다.

이 문제는 대칭형 신뢰 모델에서 비롯된다. 양쪽이 같은 값을 보관하기 때문에 시크릿을 소유했다는 사실만으로 인증이 성립한다.

## 대안: Private Key JWT

Private Key JWT는 대칭 시크릿을 비대칭 서명으로 대체한다. 키 쌍을 생성해 IdP에는 **공개 키**만 등록하고, **개인 키**는 AWS KMS에 보관한다.

토큰 요청은 다음 순서로 진행된다.

1. 에이전트가 AgentCore Identity의 `GetResourceOauth2Token`을 부른다.
2. AgentCore Identity가 자격 증명 공급자 설정(클라이언트 ID, KMS 키 ARN, 서명 알고리즘)을 읽고 수명이 짧은 JWT 클라이언트 어설션을 만든 뒤 KMS 키로 `kms:Sign`을 호출한다.
3. KMS가 어설션에 서명해 서명 값을 반환한다. **개인 키는 KMS를 벗어나지 않는다.**
4. AgentCore Identity가 서명된 어설션을 `grant_type=client_credentials`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`와 함께 IdP 토큰 엔드포인트로 보낸다.
5. IdP가 등록된 공개 키로 서명을 검증하고 액세스 토큰을 반환한다.
6. AgentCore Identity가 토큰을 에이전트에 전달하고, 에이전트는 이 토큰으로 주문 API를 호출한다.

에이전트와 주문 API는 그대로다. 달라지는 부분은 클라이언트 인증 방식뿐이다. 공유 시크릿을 전송하는 대신, 클라이언트는 외부로 꺼낼 수 없는 개인 키로 서명해 신원을 증명한다.

자격 증명 공급자 설정에서도 차이를 확인할 수 있다. 공유 시크릿 방식에서는 민감한 값이 설정에 직접 들어간다.

```
client_id:     support-agent
client_secret: SUPER_SECRET_VALUE     ← 우리가 지켜야 하는 그것
```

Private Key JWT 방식에서는 설정이 KMS 키를 가리키고, IAM으로 키 사용 권한을 제어한다.

```
client_id:      support-agent
kms_key_arn:    arn:aws:kms:us-east-1:111122223333:key/....
signing_alg:    ES256                 ← 설정에 개인 키가 없다
```

이 방식은 공유 시크릿의 운영 부담을 상당 부분 줄여 준다.

- **보관:** 개인 키는 KMS에 남고 설정에는 ARN만 저장된다.
- **교체:** 새 키를 만든 뒤 공개 키를 등록하고 기존 키를 폐기하면 된다. 개인 키를 복사할 필요가 없다.
- **유출:** 키 ARN만으로는 인증할 수 없으며, 해당 키에 대한 `kms:Sign` 권한도 필요하다.
- **확장:** 에이전트마다 키와 정책, 감사 기록을 분리할 수 있다.

## 권한 부여 방식 선택하기

Private Key JWT는 *클라이언트*를 인증한다. 발급된 토큰이 *누구의* 신원을 나타내는지는 별개의 문제다. AgentCore Identity는 세 가지 권한 부여 방식을 지원하며, 에이전트가 누구의 자격으로 동작하는지에 따라 선택할 수 있다.

- **머신 투 머신(M2M):** 에이전트가 사용자 신원 없이 자기 자신의 자격으로 동작한다. `client_credentials` 권한 부여를 사용하며 토큰의 주체는 클라이언트다. 이 글의 주문 내역 조회처럼 서비스 수준에서 수행하는 작업에 적합하다.

- **대리 인증(OBO):** 에이전트가 이미 토큰을 가진 특정 사용자를 대신해 동작한다. AgentCore Identity는 들어온 사용자 토큰을 다운스트림 토큰으로 교환하면서(RFC 8693 토큰 교환 또는 RFC 7523 JWT 권한 부여), 클라이언트 어설션으로 자신의 신원도 인증한다.

- **사용자 위임 액세스:** 기존 토큰이 없는 사용자를 대신하는 경우다. 사용자가 대화형 로그인과 동의 절차(3자 권한 부여 코드 흐름)를 거쳐 에이전트에 필요한 권한을 승인한다.

지원 에이전트가 고객의 신원과 권한으로 데이터를 읽어야 한다면 OBO가 더 적합하다. 이 글의 예시처럼 서비스 수준에서 조회한다면 M2M을 선택할 수 있다. Private Key JWT는 세 방식 모두에서 클라이언트 인증에 사용할 수 있다.

## 설정할 때 확인할 점

**서명 알고리즘은 세 시스템에서 일치해야 한다.** IdP가 요구하는 알고리즘을 AWS KMS와 AgentCore Identity가 모두 지원해야 하며, 자격 증명 공급자 설정도 같은 값을 사용해야 한다. 선택지는 RS256, PS256, ES256이며 KMS 키 사양도 이에 맞아야 한다. AWS 예제에서는 `ECC_NIST_P256`과 `ES256`을 사용한다. 알고리즘을 먼저 정한 뒤 이를 지원하는 KMS 키를 만드는 편이 좋다. 값이 일치하지 않으면 키를 만들 때가 아니라 토큰 엔드포인트에서 서명 검증 오류가 발생할 수 있다.

**`kms:ViaService`로 키 사용 경로를 제한한다.** KMS 키 정책에 `kms:Sign`을 허용하되, `bedrock-agentcore-identity.<region>.amazonaws.com`을 지정한 `kms:ViaService` 조건을 추가한다. 그러면 다른 주체가 `kms:Sign` 권한을 갖고 있더라도 AgentCore Identity를 거치지 않고는 이 키를 사용할 수 없다.

**키 쌍을 어디에서 생성할지 정한다.** KMS에서 키 쌍을 만든 뒤 공개 키를 IdP에 전달하거나(`kms:GetPublicKey`), IdP에서 키 쌍을 만들고 개인 키를 KMS로 가져올 수 있다(`kms:GetParametersForImport`, `kms:ImportKeyMaterial`). KMS에서 생성하면 개인 키가 처음부터 내보낼 수 없는 상태로 유지된다. IdP가 다른 방식을 요구하지 않는다면 이쪽이 더 안전하다.

**CloudTrail에서 서명 호출을 감사한다.** 자격 증명 공급자가 호출한 `kms:Sign`은 CloudTrail에 기록된다. 이를 통해 언제, 누구의 요청으로 키가 사용되었는지 확인할 수 있다. 공유 시크릿이 외부에서 재사용되는 경우에는 이와 같은 기록을 남기기 어렵다.

## 마이그레이션할 때

공유 클라이언트 시크릿을 사용하는 기존 자격 증명 공급자를 옮기려면 KMS 키를 만들고, IdP에 공개 키를 등록하고, 자격 증명 공급자 설정을 변경해야 한다. 이 과정을 거치면 인증 경로에서 수명이 긴 공유 시크릿을 제거할 수 있다.

IdP가 지원한다면 새 연동에는 Private Key JWT를 우선 검토할 만하다. 클라이언트가 서명으로 신원을 증명하면서 개인 키는 KMS 안에 유지할 수 있어, 시크릿 관리 부담과 자격 증명 유출 위험을 함께 줄일 수 있다.
