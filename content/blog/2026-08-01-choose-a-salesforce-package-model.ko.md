---
title: "Salesforce 패키지 모델 선택하기: 1GP, Managed 2GP, Unlocked"
date: 2024-02-05
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-02-05-understanding-salesforce-packaging-a-comprehensive-comparison-of-1gp-vs-2gp.html"
author: Yoonsoo Park
description: "Salesforce 패키지 모델을 배포 대상과 생명주기로 선택하는 가이드."
categories:
  - Salesforce
tags:
  - Salesforce Packaging
  - Salesforce DX
  - CI/CD
---

2026-08-01 Salesforce 공식 문서를 기준으로 확인했다.

## 이전 비교 글을 보관한 이유

패키징은 1GP에서 2GP로 단순히 올라가는 단계가 아니다. Namespace 없는 패키지를 나중에 managed package로 승격할 수 있다는 설명과 임의의 version range를 쓸 수 있다는 설명은 실제 생명주기 제약을 놓친다. Package type, namespace, ancestry, dependency는 초기에 정해야 할 결정이다.

## 선택 기준

- 기존 managed 1GP 제품은 호환성과 이전 비용이 더 중요하면 유지한다.
- 새 상용·파트너 배포 제품은 namespace, upgrade lineage, AppExchange 생명주기가 필요한 managed 2GP를 검토한다.
- 내부 모듈 배포는 Git을 원본으로 삼고 설치를 조직이 통제하는 unlocked package가 잘 맞는다.
- Unmanaged package는 템플릿이나 일회성 전달에 한정하고 업그레이드 가능한 제품으로 보지 않는다.

Namespace 없는 unlocked package가 promotion으로 managed package가 되지는 않는다. Dependency는 실제 package version을 기준으로 검증해야 한다.

## 안전한 흐름

```bash
sf package create --name BillingCore --package-type Unlocked \
  --path force-app --target-dev-hub dev-hub
sf package version create --package BillingCore \
  --installation-key-bypass --wait 20 --target-dev-hub dev-hub
sf package version promote --package 04t... --target-dev-hub dev-hub
sf package install --package 04t... --target-org test --wait 20
```

깨끗한 org에 설치해 Apex, permission, upgrade, dependency 테스트를 통과하기 전에는 promote하지 않는다. CI에서 installation key와 인증 자료를 출력하지 않는다.

## Trade-off

Unlocked package는 내부 자율성이 높지만 managed package와 같은 IP·subscriber 통제를 제공하지 않는다. Managed 2GP는 source-driven release에 적합하지만 namespace와 ancestry 선택이 오래 남는다. 1GP는 기존 제품에 유효하지만 새 개발에서는 2GP workflow의 장점을 잃는다. 작은 단일 org라면 직접 metadata 배포가 단순하지만 설치 경계가 없다.

## 마이그레이션 체크리스트

1. Subscriber, namespace, package ID, dependency, upgrade 약속을 조사한다.
2. 내부·외부 배포와 upgrade 소유자를 정한다.
3. 별도 Dev Hub와 일회성 org에서 모델을 검증한다.
4. `sfdx-project.json`에 package directory와 정확한 dependency를 정의한다.
5. 신규 설치, 이전 version upgrade, uninstall, permission, data migration을 시험한다.
6. 게이트를 통과한 immutable version만 promote한다.
7. Promotion과 별개로 rollback 절차를 문서화한다.

## 검증과 공식 자료

Dev Hub의 package/version ID를 확인하고 빈 org 설치와 가장 오래 지원하는 version에서의 upgrade를 모두 시험한다.

- [Package Types](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm)
- [Unlocked Package Workflow](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_workflow.htm)
- [Salesforce CLI package commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_package.html)
