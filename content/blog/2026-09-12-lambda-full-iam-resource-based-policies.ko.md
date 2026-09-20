---
title: "Lambda의 IAM 리소스 기반 정책, add-permission 여러 번 대신 문서 하나로 관리하기"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda에서 여러 principal, action, IAM 조건 키를 하나의 리소스 기반 정책 문서로 관리할 수 있게 됐다. 기존 add-permission 방식과의 차이, 적합한 사용 사례, 주의할 점을 살펴본다."
categories:
  - AWS
tags:
  - lambda
  - iam
  - resource-based-policy
  - cross-account
  - least-privilege
---

여러 서비스가 하나의 Lambda 함수를 호출하도록 구성해 본 적이 있다면 기존 방식이 얼마나 번거로운지 알 것이다. 용도가 제한된 권한 statement를 하나씩 API로 추가해야 했고, 정교한 조건을 지정할 방법도 없었다. 2026년 8월 25일부터 Lambda는 이 방식을 확장했다. 이제 여러 principal과 action, IAM 조건 키를 하나의 완전한 리소스 기반 정책 문서에 정의할 수 있다. 모든 상용 리전에서 추가 비용 없이 사용할 수 있다.

이 글에서는 하나의 구체적인 예시를 기존 방식에서 새 방식으로 옮겨 보고, `add-permission`이 여전히 더 나은 경우와 새 기능을 사용할 때 유의할 점을 정리한다.

## 예시

`order-events-processor` 함수가 다음 세 곳에서 호출되어야 한다고 가정해 보자.

1. `s3:ObjectCreated` 이벤트를 발생시키는 S3 버킷
2. 일정에 따라 실행되는 EventBridge 규칙
3. 조직 내 다른 AWS 계정에서 실행하는 배치 작업

이는 특별할 것 없는 fan-in 구성이다. 다만 기존 방식으로 호출 권한을 부여하려면 다음과 같은 절차가 필요했다.

## 기존 방식: principal마다 `add-permission` 호출

principal마다 별도의 statement와 API 호출이 필요했다. 직접 편집할 수 있는 정책 문서는 없었고, `add-permission`으로 관리 대상이 잘 보이지 않는 정책에 `--statement-id`를 하나씩 추가하는 방식이었다.

```bash
# S3 버킷
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::my-orders-bucket

# EventBridge 규칙
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:111122223333:rule/nightly-batch

# 다른 계정
aws lambda add-permission \
  --function-name order-events-processor \
  --statement-id cross-account-batch \
  --action lambda:InvokeFunction \
  --principal 444455556666
```

호출은 세 번이고 관리해야 할 statement ID도 세 개다. 더 근본적인 제약은 표현력에 있었다. 각 statement에는 `--principal`, `--source-arn`, `--source-account`처럼 제한된 파라미터만 지정할 수 있었으며, 임의의 IAM 조건을 추가할 수 없었다. 예를 들어 “이 계정은 허용하되 특정 태그가 있는 principal만 허용한다” 또는 “이 소스 IP 대역에서만 허용한다”와 같은 규칙을 표현할 자리가 없었다. 단일 목적의 statement가 늘어날수록 `statement-id` 이름과 권한의 관계를 관리하기도 어려워졌다.

## 새 방식: 정책 문서 하나로 여러 principal과 조건 관리

이제 Lambda 함수의 리소스 기반 정책을 다른 IAM 정책처럼 하나의 JSON 문서로 작성할 수 있다. 동일한 조건을 적용할 principal은 하나의 statement로 묶고, IAM 조건 키도 사용할 수 있다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AwsServicesInvoke",
      "Effect": "Allow",
      "Principal": {
        "Service": ["s3.amazonaws.com", "events.amazonaws.com"]
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:111122223333:function:order-events-processor",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "111122223333" }
      }
    },
    {
      "Sid": "CrossAccountBatch",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::444455556666:root" },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:111122223333:function:order-events-processor",
      "Condition": {
        "StringEquals": { "aws:PrincipalTag/team": "batch" },
        "StringEquals": { "aws:PrincipalOrgID": "o-exampleorgid" }
      }
    }
  ]
}
```

기존에는 세 번의 별도 호출로 관리하던 내용을 이제 두 개의 statement에 담을 수 있다. cross-account 권한도 단순히 계정 `444455556666`을 신뢰하는 대신 principal 태그와 조직 ID로 범위를 좁힌다. 핵심 이점은 줄 수를 줄이는 데 있지 않다. 이제 identity 정책에서 사용하던 조건 키를 접근 제어 규칙에도 그대로 적용할 수 있다. 소스 IP, principal 태그, 조직 ID 등 표준 조건 키를 활용한 규칙을 하나의 문서에서 확인하고 관리할 수 있다.

정책은 Lambda 콘솔의 JSON 편집기, CLI, SDK, CloudFormation이나 SAM 같은 IaC 도구에서 한 번에 수정할 수 있다.

## `add-permission`이 여전히 적합한 경우

이미 정상 동작하는 구성을 새 방식으로 바꿀 필요는 없다. 다음과 같은 경우에는 `add-permission`이 여전히 더 간단하다.

- **단일 서비스와 단일 source ARN.** “이 버킷 하나가 이 함수 하나를 트리거한다”는 전형적인 권한은 `add-permission` 한 번이면 충분하고 조건도 필요 없다. 직접 작성한 정책 문서는 이득 없이 관리 대상만 늘린다.
- **IaC가 이미 권한을 모델링하는 경우.** CDK의 `fn.addPermission(...)`이나 SAM 이벤트 소스는 적절한 권한을 생성한다. 프레임워크가 정책을 관리한다면 그 방식을 따르는 편이 낫다.
- **조건이나 multi-principal 통합이 필요 없는 경우.** 새 방식으로 옮기는 주된 이유는 조건 키와 여러 principal을 함께 관리하는 기능이다. 둘 다 필요 없다면 이전할 이유도 크지 않다.

새 기능은 함수가 실제 fan-in 대상이거나 권한이 계정 또는 조직 경계를 넘을 때, 또는 보안 요구 사항상 태그나 네트워크 출처로 접근을 제한해야 할 때 특히 유용하다.

## 주의할 점

- **정책 크기에는 한도가 있다.** 리소스 기반 정책은 크기가 제한되어 있다. 여러 principal을 하나의 문서로 정리하면 깔끔하지만, 실제로 수십 개의 서로 다른 권한이 있는 함수는 한도에 도달할 수 있다. 조건이 같은 principal만 묶고, 관련 없는 조건을 하나의 거대한 statement에 몰아넣지 말아야 한다.
- **`Principal: "*"`와 느슨한 조건의 조합은 위험하다.** 조건을 사용할 수 있게 되면서 와일드카드 principal을 약한 조건 하나로 제한하는 안티패턴이 생길 수 있다. 가능한 한 principal을 명시한다. 조직 전체 접근이 꼭 필요하다면 계정 목록만 나열하지 말고 `aws:PrincipalOrgID`로 제한하고, 영향 범위를 충분히 이해해야 한다.
- **하나의 문서는 하나의 편집 지점이기도 하다.** `add-permission` 열 번은 각각 독립적으로 실패하지만, JSON을 한 번 잘못 수정하면 유지하려던 권한까지 함께 제거될 수 있다. 콘솔에서 직접 수정하기보다 IaC로 정책을 버전 관리하고 diff를 검토하는 편이 안전하다.
- **기존 `add-permission` 권한은 그대로 남는다.** 새 문서로 옮긴다고 기존 statement가 자동으로 이전되지는 않는다. 먼저 `aws lambda get-policy`로 현재 정책을 확인해 의도치 않은 중복 권한이나 누락을 막아야 한다.

## 적용 방법

함수가 단일 트리거만 사용한다면 현재 구성을 그대로 두어도 된다. 반대로 fan-in 대상이거나 cross-account 호출이 필요하고, 기존에는 표현하기 어려웠던 보안 요구 사항이 있다면 완전한 리소스 기반 정책으로 옮기는 것을 검토할 만하다. 현재 정책을 먼저 읽고, 조건이 같은 principal을 하나의 statement로 합치며, 실제로 필요한 조건 키만 추가한다. 마지막으로 문서를 IaC로 관리한다. 목표는 줄 수를 줄이는 것이 아니라, 다른 IAM 정책과 같은 조건 키로 판단할 수 있는 접근 제어 규칙을 한곳에서 명확히 관리하는 데 있다.

서비스가 API에 *인증*하는 방식까지 관리한다면, 한곳에서 정책을 파악한다는 원칙은 서명과 identity 관리에도 적용된다. credential 관리에 관해서는 [TypeScript에서 IAM Identity Center 프로파일 안전하게 쓰기](/ko/blog/2023-05-23-aws-sso-with-typescript.html)에서 다뤘다.
