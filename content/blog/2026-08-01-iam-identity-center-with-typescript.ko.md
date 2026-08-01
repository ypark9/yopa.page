---
title: "TypeScript에서 IAM Identity Center 프로필을 안전하게 사용하기"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "캐시 파일 파싱, 키 내장, 셸 문자열 조합 없이 AWS SDK for JavaScript v3에서 IAM Identity Center 프로필을 사용하는 방법."
categories:
  - AWS
  - TypeScript
tags:
  - IAM Identity Center
  - AWS SDK for JavaScript
  - Temporary Credentials
  - Security
---

AWS Single Sign-On의 현재 이름은 **AWS IAM Identity Center**다. 이름보다 중요한 변화는 애플리케이션이 셸에서 `aws sso login`을 실행하거나 자격 증명을 직접 추출할 필요가 없다는 점이다. AWS CLI v2가 대화형 로그인을 맡고 AWS SDK for JavaScript v3가 임시 자격 증명의 해석과 갱신을 담당한다.

## 설정과 로그인

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
```

최신 CLI 설정은 보통 재사용 가능한 `sso-session`과 계정·permission set을 고르는 프로필로 구성된다. CLI가 이 구조를 쓰게 둔다. 캐시 디렉터리의 파일 형식과 순서는 구현 세부사항이며 여러 세션이 섞일 수 있으므로 애플리케이션 API로 사용하지 않는다.

로그인은 의도적으로 대화형이다. 서버 프로세스나 웹 요청 처리기 안에서 실행하지 않는다. 신뢰할 수 없는 프로필 이름을 `exec("aws sso login ...")` 문자열에 넣으면 command injection 위험도 생긴다.

## v3 provider chain 사용

```bash
npm install @aws-sdk/client-sts @aws-sdk/credential-providers
```

```typescript
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-providers";

const profile = process.env.AWS_PROFILE ?? "engineering-dev";
const sts = new STSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: fromIni({ profile }),
});

const identity = await sts.send(new GetCallerIdentityCommand({}));
console.log({ account: identity.Account, arn: identity.Arn });
```

`fromIni`는 Identity Center 프로필뿐 아니라 그 프로필을 source로 다른 역할을 맡는 구성도 처리한다. 단순 서비스 클라이언트라면 `AWS_PROFILE`만 지정하고 `credentials`를 생략해 Node.js 기본 provider chain을 쓰는 편이 더 간단하다. `fromSSO`는 직접 SSO 프로필을 읽을 때 유용하고, 역할 체인이 있으면 `fromIni`가 더 유연하다.

해석된 credential 객체를 로그로 남기지 않는다. 임시 액세스 키와 세션 토큰도 만료 전까지는 실제 권한을 가진다.

## 로컬 사용자와 배포 워크로드 구분

Identity Center 프로필은 직원용 도구와 로컬 개발에 적합하다. Lambda, ECS, EC2, EKS에 배포한 코드는 workload role과 기본 provider chain을 사용한다. CI는 OIDC federation을 우선한다. 서버가 개발자의 브라우저 세션이나 홈 디렉터리 캐시에 의존해서는 안 된다.

세션이 만료되면 운영자에게 해당 프로필로 다시 로그인하도록 안내한다. 다른 프로필로 조용히 fallback하지 않는다. 변경 명령 전에는 해석된 계정을 검증하고, 인프라를 바꾸는 스크립트에서는 모호한 `default` 프로필을 피한다.

## 마이그레이션 체크리스트

- 단일 `aws-sdk` v2에서 필요한 모듈만 쓰는 v3 클라이언트로 이동한다.
- 내장 키와 캐시 파싱을 기본 provider chain 또는 `fromIni`로 바꾼다.
- 대화형 로그인은 명시적인 운영자 단계에 둔다.
- STS로 계정과 ARN을 확인한다.
- 셸 문자열 실행을 SDK 호출로 바꾼다. CLI가 꼭 필요하면 인자 배열과 허용된 프로필만 사용한다.
- 만료·재로그인, 역할 체인, 잘못된 계정 차단을 테스트한다.

프로필 인증은 로컬에서 편하지만 CLI v2와 사용자 로그인이 필요하다. workload role은 배포 환경에, OIDC는 외부 자동화에 더 적합하다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [AWS CLI의 IAM Identity Center 인증](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [AWS SDK for JavaScript v3 credential provider](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
- [`@aws-sdk/credential-providers`](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/)
