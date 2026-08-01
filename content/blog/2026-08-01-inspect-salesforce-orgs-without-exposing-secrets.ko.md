---
title: "비밀을 노출하지 않고 Salesforce org 확인하기"
date: 2026-08-01
author: Yoonsoo Park
description: "Access token을 출력하지 않고 org 식별 정보와 scratch org 상태를 확인한다."
categories:
  - Salesforce
  - Security
tags:
  - Salesforce CLI
  - Scratch Orgs
  - OAuth
---

2026-08-01 기준으로 확인했다. 이전 글은 지원이 끝난 `sfdx` 문법과 실제 토큰처럼 보이는 값을 노출했다.

```bash
sf org display --target-org my-scratch
sf org list --json >orgs.json
```

공유할 때는 사람이 읽는 기본 출력을 우선하고, JSON은 필요한 필드만 추린다. Access token, auth URL, client secret, private key는 개발 도구가 출력했더라도 비밀이다. Git이나 공개 로그에 들어갔다면 문서에서 지우는 것과 별개로 해당 세션을 폐기해야 한다.

기존 작업은 `sf org display --target-org`로 바꾸고 verbose 인증 필드 요청을 없앤다. 별칭, org ID, instance URL, 연결 상태, scratch org 만료일만 검증한다.

참고: [Salesforce CLI org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html).

## 필요한 정보부터 정한다

대부분의 진단에는 alias, org ID, instance URL, 연결 상태, edition, scratch org 만료일이면 충분하다. Bearer token은 필요하지 않다. Identity와 상태 확인을 인증 자료 공개라는 예외 작업과 분리한다.

## 안전한 확인 흐름

```bash
sf org list --json >org-list.json
jq '.result.scratchOrgs[] | {alias, orgId, instanceUrl, status, expirationDate}' org-list.json
sf org display --target-org my-scratch
```

진단 파일은 권한이 제한된 임시 위치에 쓰고 작업 후 삭제한다. Plugin 버전에 따라 JSON 필드가 늘 수 있으므로 공유 전 원본을 확인한다. 추가 필드의 의미를 모르면 `--verbose`를 사용하지 않는다. CI에서는 나중에 blacklist로 지우기보다 처음부터 allowlist 필드만 출력한다.

Token이 정말 필요한 연동 시험이라면 전용 명령을 통제된 세션에서만 호출한다. 출력은 채팅, issue, screenshot, artifact에 붙이지 않는다. Git에 들어간 token은 이력을 지운 뒤에도 폐기해야 한다.

## 대안과 trade-off

사람용 출력은 운영자에게 안전하지만 자동화가 어렵다. JSON은 스크립트와 종료 코드 검사에 좋지만 예상보다 많은 정보를 담을 수 있다. Setup UI는 시각적이지만 재현 가능한 진단을 남기기 어렵다.

## 마이그레이션과 검증

`sfdx force:org:display --verbose`를 교체하고 예제와 fixture에서 token 필드를 없앤다. 실제처럼 보이는 token도 회전하고 allowlist redaction을 추가한다. Scratch org와 sandbox에서 결과를 만들어 직접 검토하고 secret scanner를 실행한다. 운영 작업에 alias와 만료일만으로 충분한지도 확인한다.
