---
title: "도구가 요구할 때만 IAM Identity Center 자격 증명 내보내기"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "SSO 토큰 캐시를 파싱하지 않고 AWS CLI가 지원하는 방식으로 레거시 도구에 임시 환경 자격 증명을 전달하는 제한된 흐름."
categories:
  - AWS
  - Security
tags:
  - IAM Identity Center
  - AWS CLI
  - Temporary Credentials
  - Security
---

AWS를 이해하는 대부분의 애플리케이션에는 프로필 이름만 주고 표준 credential provider chain을 쓰게 해야 한다. 하지만 일부 레거시 도구는 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`만 이해한다. 이는 상호운용성 예외이지 `~/.aws/sso/cache`를 파싱할 이유가 아니다.

## 과거 방식이 바뀐 이유

Identity Center 캐시에는 여러 세션이 있을 수 있다. 첫 JSON 파일을 선택하면 다른 ID를 고를 수 있고 캐시 스키마는 지원되는 연동 계약이 아니다. access token을 셸 명령 인자로 넘기면 로그나 프로세스 정보에 노출될 수도 있다. AWS CLI는 어떤 캐시가 프로필에 해당하는지, 이를 role credential로 어떻게 교환하는지 이미 알고 있다.

## 프로필 지원을 먼저 사용

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
AWS_PROFILE=engineering-dev aws sts get-caller-identity
```

도구가 프로필을 지원하면 여기서 끝낸다.

```bash
AWS_PROFILE=engineering-dev your-tool
```

SDK 코드에는 키를 지정하지 않고 기본 provider chain을 쓴다. CI와 AWS workload에는 사람의 Identity Center 세션 대신 OIDC 또는 workload role을 쓴다.

## 레거시 프로세스를 위한 지원 방식

AWS CLI v2의 `aws configure export-credentials`를 사용한다. 현재 CLI에서 명령이 존재하는지 확인한 다음 도구 실행 직전에 현재 셸에만 내보낸다.

```bash
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
eval "$(aws configure export-credentials --profile engineering-dev --format env)"
your-legacy-tool
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
```

`eval`은 생성된 셸 문장을 실행한다. 신뢰하는 AWS CLI, 고정되거나 allowlist에 있는 프로필, `env` 형식에만 사용한다. 외부 입력으로 프로필을 받지 않고 결과를 로그, 히스토리, 티켓, `.env`, CI 변수에 남기지 않는다.

child process만 실행한다면 `env-no-export` 결과를 로그 없이 파싱하는 wrapper가 노출 범위를 줄인다. consumer가 shared config 계약을 지원하면 `credential_process`도 선택지다. wrapper는 예상 계정을 확인하고 다르면 실행을 중단해야 한다.

## 비용과 수명

환경 변수는 호환성이 높지만 모든 child process가 상속하고 진단 도구가 환경을 수집할 수 있다. 프로필 provider는 노출 범위가 작고 갱신도 처리한다. export한 자격 증명은 source session보다 오래 살 수 없다. 장기 프로세스는 만료를 처리해야 하며 캐시 반복 파싱은 안전한 갱신 방법이 아니다.

## 마이그레이션 체크리스트

- 프로필, `credential_process`, web identity, workload role을 정말 지원하지 않는지 확인한다.
- AWS CLI v2와 명명된 Identity Center 프로필을 준비한다.
- STS로 계정과 ARN을 검증한다.
- 현재의 짧은 셸 또는 child process에만 export한다.
- 만료 동작을 테스트하고 오류를 명확히 한다.
- 복사된 키와 SSO 캐시 파싱 코드를 제거한다.
- 예외의 소유자와 제거 목표일을 기록한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [`aws configure export-credentials`](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html)
- [AWS CLI의 IAM Identity Center 인증](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [외부 프로세스로 자격 증명 공급](https://docs.aws.amazon.com/sdkref/latest/guide/feature-process-credentials.html)
