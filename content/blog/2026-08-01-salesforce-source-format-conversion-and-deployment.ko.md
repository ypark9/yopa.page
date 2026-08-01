---
title: "Salesforce 소스 포맷 변환과 배포"
date: 2023-09-06T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-09-09-understanding-the-sfdx-force-source-convert-command-in-salesforce-dx.html"
author: Yoonsoo Park
description: "Salesforce 소스를 직접 배포하고 실제 호환성 경계에서만 Metadata API 포맷으로 변환한다."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Metadata API
  - CI/CD
---

이 글은 2026-08-01 Salesforce CLI 공식 문서를 기준으로 확인했다.

## 변환 우선 방식이 바뀐 이유

Salesforce DX 소스 포맷은 큰 Metadata API 파일을 Git에서 다루기 좋은 작은 파일로 분해한다. 과거에는 모든 배포 전에 이를 Metadata API 포맷으로 변환하는 흐름이 흔했다. 현재 Salesforce CLI는 sandbox와 production을 포함한 org에 프로젝트 소스를 직접 배포한다. 변환 기능은 남아 있지만 필수 배포 단계가 아니라 호환성 도구다.

예전 `sfdx force:source:convert`도 지원이 끝난 `sfdx` CLI 명령이다. 빌드에 그대로 두면 중간 산출물과 파일 선택 로직이 늘고, 변환본이 리뷰한 소스와 달라질 여지도 생긴다.

## 현재의 멘탈 모델

저장소는 소스 포맷을 기준으로 유지한다. 배포는 `sf project deploy start`, 의도적인 가져오기는 `sf project retrieve start`를 쓴다. 다른 도구가 Metadata API bundle만 받을 때 경계에서 변환한다.

```bash
sf project deploy preview --source-dir force-app --target-org staging
sf project deploy start --source-dir force-app --target-org staging \
  --dry-run --test-level RunLocalTests
sf project deploy start --source-dir force-app --target-org staging \
  --test-level RunLocalTests
```

릴리스 범위를 디렉터리와 별도로 관리한다면 manifest를 사용한다.

```bash
sf project deploy start --manifest manifest/package.xml \
  --target-org staging --dry-run
```

Preview 결과를 읽고 destructive change는 별도 승인하며 목표 환경에 맞는 test level을 고른다. 인증은 저장소가 아니라 keychain이나 CI secret store에 둔다.

## 변환이 필요한 경우

외부 시스템이 Salesforce DX 프로젝트를 읽지 못하고 `package.xml` bundle만 요구한다면 변환한다.

```bash
sf project convert source --root-dir force-app \
  --output-dir build/mdapi --package-name ReleaseBundle
```

반대로 받은 Metadata API 패키지를 Git에서 유지하려면 소스 포맷으로 가져온다.

```bash
sf project convert mdapi --root-dir incoming/unpackaged \
  --output-dir force-app
```

레거시 연동, 패키지 점검, 마이그레이션에는 변환이 유용하다. 대신 산출물이 중복되고 구조 변경으로 diff가 복잡해진다. 변환 결과는 임시 산출물로 취급하고 항상 리뷰된 소스에서 다시 만든다.

## 마이그레이션 체크리스트

1. `sfdx force:source:convert`, `mdapi:deploy`, 커밋된 변환 디렉터리를 찾는다.
2. 실제로 Metadata API 포맷만 받는 소비자가 있는지 확인한다.
3. 일반 배포를 preview와 `sf project deploy start --dry-run`으로 바꾼다.
4. Manifest가 의도적인 릴리스 범위를 나타내면 유지한다.
5. 변환이 남는다면 깨끗한 build 디렉터리에 쓰고 두 포맷을 동시에 편집하지 않는다.
6. Custom Object 같은 분해형 metadata를 포함해 일회성 org에서 retrieve와 deploy를 시험한다.
7. 프로덕션 자동화를 바꾸기 전에 테스트와 배포 구성요소 비교를 완료한다.

## 검증

명령 성공만으로 끝내지 않는다. Preview 대상, 실행된 테스트, 명시된 target org, Git에 소스 표현만 남았는지를 확인한다. CI에서는 CLI 버전을 고정하고 배포 보고서를 보존하되 인증 자료나 민감한 변환 산출물은 남기지 않는다.

## 공식 자료

- [Salesforce CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html)
- [Migrate from sfdx to sf](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
- [Salesforce DX project structure](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm)
