---
title: "Bruno + AWS SigV4 with SSO 프로필 — 더 이상 access key 복붙 안 함"
date: 2026-05-28T11:50:00-04:00
author: Yoonsoo Park
description: "Bruno의 AWS SigV4 auth는 profileName을 지원한다. 즉 SSO 프로필로 직접 API Gateway에 sign된 요청을 보낼 수 있다. 임시 credential 복붙 X, 컬렉션에 만료되는 secret X. 셋업 정리."
categories:
  - AWS
tags:
  - bruno
  - aws-sso
  - sigv4
  - tooling 
  - api-gateway
---

IAM으로 잠긴 API Gateway를 Bruno(또는 Postman, Insomnia)로 두드려본 사람은 이 콤보 다 앎 — `aws configure export-credentials`, 값 세 개 복사, auth 패널에 붙여넣기, send, 두 시간 뒤 다시 send, 욕, 반복. SSO 쓰는 사람들 "이거 제발 자동화하기"라는 TODO가 박혀 있다.

근데 그럴 필요 없다. Bruno의 AWS SigV4 auth엔 `profileName` 필드가 있고, `~/.aws/config`와 `~/.aws/sso/cache/`에서 직접 읽어간다. 한 번 셋업, 하루 한 번 SSO 로그인, 끝.

## 셋업

파일 두 개. 컬렉션 루트의 `opencollection.yml`에 auth 설정, AWS 계정/프로필별 환경 파일.

### Collection-level auth — `opencollection.yml`

```yaml
request:
  auth:
    type: awsv4
    accessKeyId: ""
    secretAccessKey: ""
    sessionToken: ""
    service: execute-api
    region: "{{aws_region}}"
    profileName: "{{aws_profile}}"
```

credential 세 필드는 빈 문자열. `profileName`이 비어있지 않으면 Bruno는 그 세가지를 무시하고 AWS SDK의 profile chain으로 credential을 풀어낸다 — SSO 세션, role assume, `credential_process` 다 알아서 동작.

`service: execute-api`는 API Gateway용. Lambda 직접 호출이면 `lambda`, S3면 `s3`, Bedrock이면 `bedrock`. `region`과 `profileName`은 환경 변수로 빠진다.

### Environment 파일 — `environments/dev.yml`

```yaml
name: Dev
variables:
  - name: aws_profile
    value: gap-dev
  - name: aws_region
    value: us-east-1
  - name: api_base_url
    value: https://abc123.execute-api.us-east-1.amazonaws.com/blue
```

환경마다 파일 하나. 계정 전환은 이제 Bruno 환경 드롭다운으로 설정 한 번 — auth 패널 건드릴 일 없음.

### 매일 로그인

```bash
aws sso login --profile gap-dev
```

이 한 줄만 하면 됨. SSO 토큰은 조직 설정에 따라 8–12시간. 아침에 한 번, 끝. ez

## 왜 5분 투자할 가치가 있나

이런 걸 안 해도 된다:

- **컬렉션 파일에 credential 붙여넣기.** gitignore 잘 해놨다 해도 임시 cred는 채팅, 스크린샷, 잊어버린 `.env.local`에 남는다.
- **두 시간마다 다시 export.** SSO 임시 cred는 짧다. 정적 복붙은 계속 새로 갱신해야 한다. `profileName`이면 SDK가 알아서 갱신.
- **환경 헷갈리기.** auth 블록은 dev/qa/prod 다 똑같고 환경 변수만 바뀐다. 프로필별 access key가 엉뚱한 패널에 박혀있는 일 없음.

## 실제로 밟은 함정들

- **SSO 토큰 만료.** Bruno가 stale 세션으로 sign 시도하고, 403이 돌아온다. `aws sso login --profile <name>` 하고 재시도. 자주 일어나면 짧은 alias 만들어두기.
- **Profile 이름 오타.** `profileName`이 `~/.aws/config`의 어느 항목과도 안 맞으면 Bruno는 "no credentials found"로 조용히 실패. `aws configure list-profiles`로 정확한 문자열 확인.
- **Auth mode 혼용.** `accessKeyId`에 실수로 진짜 access key 남겨두면 버전에 따라 그걸 우선 쓸 수 있다. 이거 진짜 키보드 부술수 있음 credential 세 필드는 무조건 빈 문자열로 유지.
- **`credential_process` 프로필도 OK.** 회사가 `credential_process`(corporate SSO wrapper, Granted 등) 쓰면 Bruno가 그것도 알아서 picks up — 같은 `profileName` 필드, 추가 설정 no no.
- **Region mismatch.** SigV4 서명에 region이 들어간다. env가 `us-east-1`인데 호출 endpoint가 `us-west-2`면 서명 무효. 환경 간에 URL 복사할 때 놓치기 쉬움.
- **Collection-level vs request-level auth.** 특정 요청이 `auth`를 다른 걸로 override하면 컬렉션 레벨 SigV4가 안 먹힌다. `auth: { type: inherit }` 확인하거나 override 제거.

## Bruno의 SigV4 필드 전체

UI 기준 AWS Sig auth 패널을 열면 보이는 것들:

1. Access Key ID
2. Secret Access Key
3. Session Token
4. Service (예: `execute-api`, `s3`, `lambda`, `bedrock`)
5. Region (예: `us-east-1`)
6. **Profile Name** — 위 셋을 무용지물로 만드는 그것

`profileName`이 설정되면 위 셋은 무시. 그게 트릭의 전부.

## 짧게 요약

Credential 세 필드는 빈 문자열, `profileName: "{{aws_profile}}"`, 환경마다 env var 하나, 아침에 `aws sso login`. API client에 임시 cred 복붙 이제 안녕!.
