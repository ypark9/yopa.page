---
title: "AWS SDK for JavaScript v3로 API Gateway SigV4 요청 서명하기"
date: 2023-06-13T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-13-invoking-aws-api-gateway-with-sigv4.html"
author: Yoonsoo Park
description: "임시 자격 증명과 JavaScript v3 signer를 사용해 IAM 인증 API Gateway를 호출하고 body 서명과 실패를 검증하는 방법."
categories:
  - AWS
  - TypeScript
tags:
  - Amazon API Gateway
  - SigV4
  - AWS SDK for JavaScript
  - Security
---

Signature Version 4는 AWS 요청이 특정 자격 증명으로 서명됐음을 증명한다. API Gateway에서는 내부 workload, federation으로 로그인한 운영자, OIDC를 사용하는 CI처럼 이미 AWS ID가 있는 호출자에게 적합하다. 공개 브라우저 애플리케이션의 최종 사용자 인증을 대신하는 방식은 아니다.

과거 예제는 지원 종료된 AWS SDK for JavaScript v2, 별도 signer와 소스 코드 안의 액세스 키를 조합했다. 현재는 모듈형 v3 패키지와 기본 credential provider chain을 사용한다.

## API와 호출자 설정

API Gateway route 또는 method의 authorization type을 `AWS_IAM`으로 설정한다. 호출자에게 필요한 API, stage, method, resource path에만 `execute-api:Invoke`를 허용한다. API resource policy와 network policy가 추가 제한을 둘 수 있다.

로컬은 IAM Identity Center로 로그인하고 Lambda, ECS, EC2에는 역할을 연결한다. 코드에 키가 없으므로 같은 구현을 두 환경에서 사용할 수 있다.

```bash
npm install @aws-sdk/signature-v4 @aws-sdk/protocol-http \
  @aws-sdk/credential-provider-node @aws-crypto/sha256-js
```

```typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";

const region = "us-east-1";
const url = new URL(
  "https://abc123.execute-api.us-east-1.amazonaws.com/prod/orders"
);
const body = JSON.stringify({ orderId: "123" });
const signer = new SignatureV4({
  service: "execute-api",
  region,
  credentials: defaultProvider(),
  sha256: Sha256,
});
const request = new HttpRequest({
  protocol: url.protocol,
  hostname: url.hostname,
  method: "POST",
  path: `${url.pathname}${url.search}`,
  headers: { host: url.hostname, "content-type": "application/json" },
  body,
});
const signed = await signer.sign(request);
const response = await fetch(url, {
  method: signed.method,
  headers: signed.headers,
  body,
});
if (!response.ok) {
  throw new Error(`API returned ${response.status}: ${await response.text()}`);
}
```

네트워크로 보내는 body, path, query string, host와 signed header는 서명한 값과 정확히 같아야 한다. 서명 뒤 JSON이나 proxy path를 바꾸지 않는다. 임시 자격 증명에는 session token이 필요하며 provider가 signer에 전달한다.

`403`에서는 API 권한 거부와 `SignatureDoesNotMatch`를 구분한다. STS로 계정과 ARN을 확인하고 Region, `execute-api` 서비스명, stage/path, 시스템 시간, resource ARN과 resource policy를 점검한다. request ID와 민감하지 않은 입력만 기록하고 Authorization header, session token, credential은 로그로 남기지 않는다.

SigV4는 workload identity와 IAM 정책 제어가 강점이지만 브라우저에 AWS 자격 증명을 안전하게 둘 수는 없다. 최종 사용자에는 Cognito/OIDC JWT authorizer 같은 애플리케이션 인증을 사용한다. AWS ID 경계 밖의 service-to-service에는 OAuth 2.0이 더 나을 수 있다. API Gateway API key는 usage plan 식별자이지 단독 인증 수단이 아니다.

## 마이그레이션 체크리스트

- SDK v2, `aws4`, 명시적 액세스 키를 제거한다.
- AWS 자격 증명을 안전하게 얻는 호출자에만 `AWS_IAM`을 사용한다.
- Identity Center, workload role, OIDC와 provider chain을 쓴다.
- `execute-api:Invoke` 범위를 필요한 route로 제한한다.
- GET, query encoding, body가 있는 요청을 모두 테스트한다.
- 만료, 잘못된 Region·route, IAM 거부를 테스트한다.
- 서명 비밀값 없이 CloudTrail과 API 로그를 검증한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [IAM 권한으로 API 접근 제어](https://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html)
- [AWS API 요청 서명](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html)
- [AWS SDK for JavaScript v3 credential provider](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
