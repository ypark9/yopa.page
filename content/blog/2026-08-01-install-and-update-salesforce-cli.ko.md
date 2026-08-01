---
title: "Salesforce CLI를 안전하게 설치하고 업데이트하기"
date: 2023-06-22T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-22-how-to-update-sfdx-cli-from-one-version-to-another.html"
author: Yoonsoo Park
description: "설치 주체를 확인하고 인증 정보를 보존하면서 지원되는 sf CLI를 업데이트한다."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Developer Tools
  - Security
---

이 글은 2026-08-01 Salesforce 공식 CLI 문서를 기준으로 확인했다.

## 예전 방식이 바뀐 이유

독립 `sfdx` CLI는 2023년 4월부터 지원되지 않는다. 현재 실행 파일은 `sf`이며 Salesforce 설치 프로그램과 `@salesforce/cli` npm 패키지로 배포된다. 예전에는 문제가 생기면 패키지를 지우고 `.sfdx` 디렉터리까지 모두 삭제한 뒤 다시 설치하곤 했다. 하지만 프로그램 파일, 설정, 인증은 서로 다른 문제다. 상태 디렉터리를 통째로 지우면 `PATH` 문제는 그대로인 채 정상 인증만 잃을 수 있다.

## 먼저 설치 주체를 찾는다

```bash
type -a sf
command -v sf
sf version --verbose
npm list --global --depth=0 @salesforce/cli
```

macOS에서는 native installer, Homebrew 경로, Node version manager 아래 npm global 설치가 함께 남아 있을 수 있다. 실제로 선택된 실행 파일을 설치한 채널로만 업데이트한다. Salesforce installer 버전은 `sf update`를, npm 설치는 다음 명령을 사용한다.

```bash
npm install --global @salesforce/cli@latest
sf version --verbose
sf doctor
```

두 방식을 동시에 설치하는 것은 안전장치가 아니다. 다음 장애 때 어느 도구가 실행되는지만 더 불분명해진다.

## 인증과 설정은 별도로 보호한다

CLI 상태는 지워도 되는 프로그램 파일이 아니다. 작업 전에 필요한 org 별칭과 재인증 절차를 확인한다. 인증 파일을 저장소나 티켓으로 복사하지 않고, CLI 상태 디렉터리에 `sudo rm -rf`를 사용하지 않는다. 공식 지원 절차가 특정 캐시 삭제를 요구해도 먼저 백업하고 진단된 범위만 처리한다.

CI에서는 이미지나 lockfile에서 CLI 버전을 고정하고 검토된 의존성 변경으로 올린다. 매 실행마다 `latest`를 받으면 릴리스 재현성이 사라진다. 인증 자료는 CI secret store에 두고 auth URL이나 token을 로그로 출력하지 않는다.

## 선택지와 trade-off

- Native installer는 개인 워크스테이션에서 단순하며 `nvm`의 Node 버전에 묶이지 않는다.
- npm은 Node와 도구 버전을 이미 통제하는 팀에 편하지만 Node 버전마다 global 패키지 위치가 달라질 수 있다.
- 버전을 고정한 컨테이너는 CI 재현성이 높지만 이미지 유지보수와 보안 스캔이 필요하다.

## 마이그레이션 체크리스트

1. `type -a sf`, `sf version --verbose`, 설치 주체를 기록한다.
2. 레거시 `sfdx-cli`는 설치했던 패키지 관리자로만 제거한다.
3. 지원되는 `sf` 배포판 하나만 설치하거나 업데이트한다.
4. 새 셸에서 의도한 실행 파일이 첫 번째인지 확인한다.
5. `sf doctor`와 `sf org list auth`를 실행하되 민감한 출력은 공유하지 않는다.
6. 비프로덕션 org에서 읽기 전용 명령 하나를 검증한다.
7. `sfdx force:*` 스크립트 전환은 별도 변경으로 리뷰한다.

## 공식 자료

- [Install Salesforce CLI](https://developer.salesforce.com/docs/platform/salesforce-cli-guide/guide/install-sfdx-cli.html)
- [Migrate from sfdx to sf](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
- [Salesforce CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html)
