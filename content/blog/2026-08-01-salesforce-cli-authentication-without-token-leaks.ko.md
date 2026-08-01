---
title: "토큰을 노출하지 않는 Salesforce CLI 인증"
date: 2023-05-01T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-01-get-access-token-from-salesforce.html"
author: Yoonsoo Park
description: "Salesforce CLI 인증을 안전하게 사용하고 bearer token이 로그나 파이프라인에 남지 않게 한다."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - OAuth
  - Security
---

2026-08-01 기준으로 확인했다. 상세 org 출력에서 access token을 긁어오는 방식은 위험하다. Bearer token을 얻은 사람은 그 권한으로 API를 호출할 수 있다.

```bash
sf org login web --alias dev --instance-url https://login.salesforce.com
sf org display --target-org dev
```

대부분의 작업은 별칭만 넘기면 CLI가 저장된 인증을 사용하므로 토큰을 볼 필요가 없다. 제한된 진단에서 정말 필요할 때만 `sf org auth show-access-token --target-org dev`를 사용하고 화면 녹화와 CI 로그를 끈다. 노출된 토큰은 즉시 세션 폐기 또는 회전한다. 자동화 인증 자료는 secret manager에 보관한다.

기존 파이프라인에서는 토큰 추출을 없애고 `--target-org`를 전달한다. 로그 이력도 확인해 노출된 세션을 폐기한다. 사람에게는 웹 로그인이 편하지만 CI에는 승인된 비대화형 OAuth 방식이 재현성이 높고, 대신 키와 정책 관리가 필요하다.

참고: [org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html).

## 위협 모델과 현재 방식

Access token은 잠깐 보이는 진단 문자열이 아니라 자격 증명이다. 셸 이력, CI 주석, 화면 녹화, 지원 bundle, 복사한 JSON이 순간적인 출력을 오래 남는 노출로 바꾼다. 가장 안전한 흐름은 CLI 인증 저장소가 token을 사용하게 두고 프로세스 사이에는 alias만 넘기는 것이다.

## 안전한 단계별 흐름

```bash
sf org login web --alias dev --instance-url https://login.salesforce.com
sf org display --target-org dev
sf data query --query "SELECT Id FROM Organization" --target-org dev --json
```

일반 명령의 성공으로 세션을 확인하면 bearer token을 볼 필요가 없다. 진단은 sandbox 또는 developer org에서 한다. 조직 정책상 민감한 username과 org ID도 공유 전에 마스킹한다. 제한된 연동 시험에서 raw token이 불가피하다면 command tracing을 끄고 pipe와 임시 파일을 피하며 끝난 즉시 세션을 폐기한다.

## 자동화 대안

웹 로그인은 사람에게 쉽지만 headless CI에는 맞지 않는다. JWT bearer flow는 재현성이 높지만 private key 보호와 회전이 필요하다. 승인된 workload identity나 secret manager 기반 OAuth는 장기 secret을 줄일 수 있으나 CI 구조에 따라 선택지가 달라진다. SFDX auth URL도 자격 증명이다.

## 사고 대응과 마이그레이션

1. 스크립트의 token 추출을 없애고 CLI 명령에 `--target-org`를 전달한다.
2. Git 이력, CI 로그, 티켓, artifact를 검사하되 값을 다시 출력하지 않는다.
3. 노출된 세션을 폐기하고 관련 자격 증명을 회전한다.
4. Connected 또는 External Client App의 scope와 정책을 검토한다.
5. 로그 마스킹과 secret scanner를 추가하고 합성 값으로 시험한다.
6. 최소 권한 비프로덕션 identity로 새 흐름을 검증한다.

문서에서 값을 지우는 것은 폐기가 아니다. 세션 폐기가 containment이고 redaction은 추가 노출을 막는 조치다.
