---
title: "캐시 파일을 읽지 않고 AWS 임시 자격 증명 사용하기"
date: 2023-06-15T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-15-leveraging-aws-sso-to-acquire-aws-secretaccesskey-and-sessiontoken.html"
author: Yoonsoo Park
description: "IAM Identity Center 토큰과 액세스 키, 갱신 로직을 직접 다루지 않고 credential provider를 중심으로 AWS 애플리케이션을 설계하는 방법."
categories:
  - AWS
  - Security
tags:
  - IAM Identity Center
  - AWS SDK for JavaScript
  - Temporary Credentials
  - Security
---

임시 자격 증명은 access key ID, secret access key와 보통 session token으로 구성된다. 애플리케이션은 AWS 요청 서명을 위해 이 값들이 필요하지만 이를 직접 조회, 저장, 갱신할 필요는 거의 없다. SDK가 요청을 서명할 때 **credential provider**에 요청하게 해야 한다.

이 구분은 중요하다. `~/.aws/sso/cache`의 첫 파일을 읽고 access token을 꺼내 `aws sso get-role-credentials`를 실행하면 내부 캐시 구조에 의존하고 다른 로그인을 선택할 수 있으며 bearer token이 셸 인자에 노출될 수 있다. 애플리케이션이 불완전한 credential manager 역할까지 떠안게 된다.

## 하나의 코드, 환경별 provider

AWS SDK for JavaScript v3의 기본 provider chain을 사용한다.

```typescript
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const result = await s3.send(new ListBucketsCommand({}));
console.log(result.Buckets?.map((bucket) => bucket.Name));
```

credential 객체가 의도적으로 없다. 로컬 Node.js에서는 provider가 IAM Identity Center를 포함한 shared config의 `AWS_PROFILE`을 해석한다. ECS와 EC2에서는 연결된 역할, EKS나 외부 CI에서는 web identity를 찾을 수 있다. 인증 방식이 business code 밖에 남고 SDK가 갱신을 처리한다.

로컬 운영 흐름은 다음과 같다.

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
AWS_PROFILE=engineering-dev aws sts get-caller-identity
AWS_PROFILE=engineering-dev node dist/list-buckets.js
```

배포 환경에서는 최소 권한 workload role을 연결하고 `AWS_PROFILE` 없이 같은 프로그램을 실행한다. 로컬 SSO 캐시를 컨테이너 이미지에 복사해서는 안 된다.

## 명시적 provider가 필요한 경우

로컬 도구가 의도적으로 프로필을 입력받거나 그 프로필에서 역할을 맡으면 `fromIni({ profile })`를 쓴다. 명시적 역할 체인은 `fromTemporaryCredentials`, web identity 환경은 `fromTokenFile`이 맞는다. provider는 SDK가 갱신할 수 있는 함수다. 한 번 해석한 raw key를 여러 클라이언트에 복사하지 않는다.

신뢰할 수 없는 요청이 임의의 로컬 프로필이나 role ARN을 고르게 하지 않는다. ID 선택은 allowlist가 있는 설정으로 취급한다. 인프라 변경 도구는 시작할 때 계정과 ARN을 검증한다.

## 실패와 관찰 가능성

credential source 없음, 대화형 세션 만료, role trust 거부, 서비스 action 거부를 구분한다. 직원 세션이 만료됐을 때 해결책은 명시적인 재로그인이지 다른 캐시 파일 탐색이 아니다. 프로필 이름, Region, 계정, role ARN, request ID와 오류 코드는 필요에 따라 기록하되 secret과 token은 기록하지 않는다.

CLI만 쓰는 흐름은 이미 shared provider를 사용하므로 SDK 코드가 필요 없을 수 있다. 환경 변수만 받는 레거시 프로그램에는 제한된 child process 범위로 CLI의 `export-credentials`를 쓸 수 있다. 정적 IAM 키는 지원되지 않는 workload의 마지막 선택지다.

## 마이그레이션 체크리스트

- SSO 캐시 파일 읽기와 access-token 파싱을 제거한다.
- `sso get-role-credentials` 셸 호출을 제거한다.
- 모듈형 SDK와 기본 provider 또는 문서화된 명시적 provider 하나를 사용한다.
- 직원, CI, 배포 workload의 인증을 분리한다.
- 예상 계정과 최소 권한 action을 검증한다.
- 장기 프로세스에서 만료와 자동 갱신을 테스트한다.
- 복사한 credential 파일을 삭제하고 노출된 세션은 폐기한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [표준 credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html)
- [AWS SDK for JavaScript v3 credential provider](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html)
- [IAM 모범 사례](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
