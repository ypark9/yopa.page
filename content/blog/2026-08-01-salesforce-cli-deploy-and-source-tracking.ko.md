---
title: "Salesforce CLI 배포와 소스 추적"
date: 2026-08-01
author: Yoonsoo Park
description: "폐기된 push 명령 대신 현재 sf CLI의 배포와 소스 추적 흐름을 선택한다."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Metadata API
  - CI/CD
---

2026-08-01 기준으로 확인했다. `sfdx` CLI는 2023년 4월부터 지원되지 않으므로 예전 `force:source:push`와 `deploy` 비교는 현재의 선택지가 아니다.

```bash
sf project deploy preview --source-dir force-app --target-org dev
sf project deploy start --source-dir force-app --target-org dev --dry-run
sf project deploy start --source-dir force-app --target-org dev
```

소스 추적은 로컬과 org의 차이를 알려주지만 Git을 대신하지 않는다. Scratch org에서는 추적을 활용하고, 프로덕션 배포는 대상과 테스트 수준을 명시해 재현 가능하게 만든다. CI에서는 CLI 버전을 고정하고 인증 정보를 저장소 밖에서 공급한다.

기존 스크립트는 `force:source:push`와 `force:source:deploy`를 `sf project deploy start`로 바꾸고 preview 또는 dry-run으로 선택 범위를 검증한다. 일반 배포에는 소스 포맷을 그대로 쓰며, Metadata API 포맷을 요구하는 외부 소비자가 있을 때만 변환한다.

참고: [Salesforce CLI migration](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html), [CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html).

## 현재의 멘탈 모델

Git은 팀이 승인한 변경을 답한다. 소스 추적은 로컬 작업공간과 추적 가능한 org의 차이를 답한다. 배포는 명시적으로 고른 metadata를 이동한다. 이 책임을 분리해야 “바뀐 것을 모두 push”하는 습관이 릴리스 전략이 되는 일을 막을 수 있다.

## 안전한 릴리스 흐름

```bash
sf org display --target-org dev
sf project deploy preview --source-dir force-app --target-org dev
sf project deploy start --source-dir force-app --target-org dev \
  --dry-run --test-level RunLocalTests --json >deploy-validation.json
```

구성요소와 테스트 결과를 리뷰한 뒤 같은 범위를 `--dry-run` 없이 실행한다. 선별한 릴리스는 manifest, 작은 수정은 정확한 metadata 또는 source directory로 범위를 표현한다. Destructive change는 지원되는 manifest와 별도 승인을 사용한다. 프로덕션 대상은 개발자 로컬 기본값에서 추론하지 않는다.

## 대안과 trade-off

Scratch org의 소스 추적은 편하지만 수동 변경과 공유 org에서는 혼란이 생긴다. Manifest는 감사하기 좋지만 유지해야 하고, 디렉터리 배포는 단순하지만 범위가 넓어질 수 있다. DevOps Center도 거버넌스를 더할 뿐 대상, 테스트, identity, rollback 결정까지 대신하지 않는다.

## 마이그레이션과 검증

1. 레거시 push, pull, deploy, retrieve를 모두 찾는다.
2. 이름만 치환하지 말고 각 동작을 현재 deploy/retrieve 흐름에 매핑한다.
3. CI에서 target org와 test level을 명시한다.
4. 대표 비프로덕션 org에서 검증 보고서를 보존한다.
5. 실제 배포 목록을 리뷰한 manifest 또는 디렉터리와 비교한다.
6. 실패, 충돌, rollback 절차를 프로덕션 전에 시험한다.

배포 후 관련 smoke test를 실행하고, org의 미검토 변경을 다시 가져와 Git을 덮지 않았는지 확인한다.
