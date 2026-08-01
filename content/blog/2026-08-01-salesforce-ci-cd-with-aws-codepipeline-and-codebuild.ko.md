---
title: "AWS CodePipeline과 CodeBuild로 Salesforce CI/CD 구성하기"
date: 2024-06-15
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-06-15-automating-salesforce-package-deployment-with-aws-code-services-a-comprehensive-guide.html"
author: Yoonsoo Park
description: "인증, 검증, 승인, 배포와 rollback 경계를 분리한 AWS 기반 Salesforce 파이프라인을 구성한다."
categories:
  - AWS
  - Salesforce
  - DevOps
tags:
  - CI/CD
  - Salesforce CLI
  - AWS CodeBuild
  - Salesforce Packaging
---

2026-08-01 AWS와 Salesforce 공식 문서를 기준으로 확인했다.

## 이전 아키텍처를 보관한 이유

AWS CodeDeploy는 AWS compute target에 애플리케이션을 배포하는 서비스이며 Salesforce metadata 배포 엔진이 아니다. Salesforce 소스를 변환해 S3에 둔다고 설치 가능한 “패키지”가 되는 것도 아니다. 이전 글은 유효하지 않은 CloudFormation, 폐기된 `sfdx` 명령, 불필요한 plugin 설치를 섞었고 인증과 rollback 경계가 없었다.

조직이 이미 CodePipeline과 CodeBuild를 운영하거나 AWS account control이 필요할 때 이 구성을 선택한다. 그렇지 않다면 GitHub Actions나 Salesforce DevOps Center가 더 단순할 수 있다. 핵심은 실행 업체가 아니라 릴리스 게이트다.

## 지원되는 파이프라인

1. **Source:** AWS CodeConnections가 리뷰된 Git revision을 CodePipeline으로 전달한다. Connection은 필요한 저장소와 branch로 제한한다.
2. **Validation:** 고정된 image와 지원되는 `sf` CLI를 사용하는 CodeBuild가 인증하고 테스트와 `--dry-run` 배포를 실행한다.
3. **Evidence:** Commit, CLI version, target, 구성요소, 테스트 결과, validation ID를 보존한다. Auth URL, token, private key, 고객 데이터는 artifact에 넣지 않는다.
4. **Approval:** 프로덕션 stage는 validation 뒤 명시적인 manual approval을 요구한다.
5. **Deploy:** 별도 CodeBuild action이 같은 immutable revision을 배포한다. Salesforce가 허용하면 validation ID로 quick deploy하고, 아니면 같은 범위를 다시 배포한다.
6. **Verify:** Smoke test와 실제 애플리케이션 결과를 확인한다.

이 흐름에 CodeDeploy는 없다. CodeBuild로 할 수 없는 좁은 custom orchestration이 아니라면 Lambda도 필요하지 않다.

## 인증 경계

CodeBuild IAM role에는 source artifact, log, 특정 secret에 필요한 최소 AWS 권한만 준다. Salesforce 인증 자료는 Secrets Manager에 저장하고 필요한 build에만 주입한다. 설계가 지원하면 승인된 workload/OIDC federation을 우선한다. 그렇지 않으면 최소 권한 integration user와 JWT bearer 같은 지원되는 비대화형 OAuth를 사용하고 private key를 보호·회전한다.

Token이나 key를 image, 저장소, buildspec, 환경변수 선언, artifact에 넣지 않는다. 인증 구간에서는 shell tracing을 끈다. SFDX auth URL도 자격 증명이다.

## Validation build

```yaml
version: 0.2
phases:
  install:
    commands:
      - sf version
  pre_build:
    commands:
      - ./scripts/authenticate-salesforce-from-secret
      - python3 scripts/validate_frontmatter.py
  build:
    commands:
      - sf project deploy preview --manifest manifest/package.xml --target-org prod
      - sf project deploy start --manifest manifest/package.xml --target-org prod --dry-run --test-level RunLocalTests --wait 60 --json > deploy-validation.json
artifacts:
  files:
    - deploy-validation.json
```

인증 helper는 secret을 출력하지 않고 명시된 alias를 인증하며 종료 시 임시 key를 제거해야 한다. Validation 전에 프로젝트 정적 분석과 단위 테스트를 추가한다. JSON 파일이 생겼다는 이유만으로 성공 처리하지 말고 test, component, status 오류에서 build를 실패시킨다.

## 배포, rollback, trade-off

Quick deploy는 테스트 반복 시간을 줄이지만 Salesforce가 허용하는 기간과 정확히 같은 validation에만 적용된다. Immutable commit과 validation ID를 함께 보존한다. 사용할 수 없으면 같은 manifest와 commit을 정상 배포한다.

Metadata 배포는 범용 rollback이 아니다. Forward fix 또는 사전 검증한 reverse deployment를 준비한다. Destructive change, 비가역 data migration, package promotion, permission 변경은 별도 승인과 복구 계획이 필요하다. Data migration은 metadata action과 분리하고 멱등하게 만든다.

CodePipeline은 AWS-native approval과 account audit trail을 제공하지만 CodeBuild 시작 시간과 cross-cloud 인증 복잡도가 생긴다. DevOps Center는 Salesforce-native workflow를, GitHub Actions는 GitHub 소스에 단순한 구성을 제공한다. 팀이 보안과 운영을 감당할 플랫폼을 선택하되 validation, approval, identity, rollback 통제는 동일하게 유지한다.

## 마이그레이션 체크리스트

1. CodeDeploy, `sfdx force:*`, S3 “package” 가정을 제거한다.
2. 최소 저장소 권한과 명시적 trigger로 CodeConnections를 구성한다.
3. `sf`, build image, dependency 버전을 고정한다.
4. 최소 권한 Salesforce integration identity와 Secrets Manager 경계를 만든다.
5. Validation과 production deploy를 manual approval 양쪽으로 분리한다.
6. 같은 commit, manifest, target org, validation ID가 게이트를 통과했는지 증명한다.
7. 인증 실패, Apex 실패, timeout, 승인 거절, 만료된 quick-deploy ID, rollback을 시험한다.
8. Salesforce payload를 노출하지 않는 post-deploy smoke check와 alert를 추가한다.

## 공식 자료

- [AWS CodePipeline connections](https://docs.aws.amazon.com/codepipeline/latest/userguide/connections.html)
- [AWS CodeBuild buildspec](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)
- [AWS Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Salesforce CLI deploy commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project.html)
- [Salesforce CLI migration](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
