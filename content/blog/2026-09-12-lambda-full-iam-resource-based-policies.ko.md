---
title: "Lambda가 이제 완전한 IAM 리소스 기반 정책을 받는다: add-permission N번 대신 문서 하나로"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda가 이제 여러 principal, action, 조건키를 정책 문서 하나에 담는 완전한 IAM 리소스 기반 정책을 지원한다. 예전 방식과 새 방식 비교, 그리고 언제 아직 add-permission을 써야 하나."
categories:
  - AWS
tags:
  - lambda
  - iam
  - resource-based-policy
  - cross-account
  - least-privilege
---

서비스 두어 개 이상을 같은 Lambda 함수에 물려 본 사람은 옛날 방식의 모양을 안다. 좁은 권한 statement가 잔뜩 쌓이고, 하나씩 따로 호출해서 붙이고, 정작 조건은 하나도 못 건다. 2026년 8월 25일에 Lambda가 이걸 바꿨다. 이제 함수가 완전한 IAM 리소스 기반 정책을 받는다. 여러 principal, 여러 action, IAM 조건키 전부를 정책 문서 하나에 넣을 수 있다. 모든 상용 리전에서 추가 비용 없이 쓸 수 있다.

이 글은 구체적인 예시 하나를 옛날 방식에서 새 방식으로 옮겨 보고, 그다음 옛날 방식이 아직 맞는 경우와 새 힘에 딸려 오는 함정을 정리한다.

## 예시 하나

함수 `order-events-processor` 하나를 세 군데서 invoke해야 한다고 하자.

1. `s3:ObjectCreated` 이벤트를 쏘는 S3 버킷.
2. 스케줄로 도는 EventBridge 규칙.
3. 조직 안의 다른 AWS 계정이 돌리는 배치 작업.

흔한 fan-in이다. 특별할 것 없다. 그런데 이걸 허용하는 방법을 보자.

## 예전: principal 하나당 add-permission 한 번

principal마다 statement가 따로였고, statement마다 API 호출이 따로였다. 직접 편집하는 정책 문서 같은 건 없었다. `add-permission`으로 불투명한 정책에 `--statement-id`를 하나씩 덧붙이는 방식이었다.

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

호출 세 번, 관리할 statement ID 세 개다. 더 큰 한계는 표현력이었다. 각 statement가 받는 파라미터가 좁았다(`--principal`, `--source-arn`, `--source-account`). 임의의 IAM 조건은 못 붙였다. "이 계정은 허용하되 특정 태그를 단 principal만" 이라든가 "이 소스 IP 대역에서만" 같은 걸 넣을 자리가 없었다. 단일 목적 statement가 계속 늘어나는 걸 관리하면서 `statement-id` 작명이 안 꼬이기를 바라는 게 전부였다.

## 이제: 정책 문서 하나, 여러 principal, 진짜 조건

이제 함수는 JSON 문서 하나로 쓸 수 있는 리소스 기반 정책을 갖는다. 다른 데서 이미 쓰는 IAM 정책이랑 똑같은 방식이다. 조건이 겹치는 principal은 한 statement로 합치고, 조건키를 드디어 쓸 수 있다.

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

불투명한 호출 세 번이 하던 걸 이제 statement 두 개가 담고, cross-account 허용은 "계정 `444455556666`, 믿어줘" 대신 principal 태그와 org ID로 좁혀진다. 진짜 이득은 줄 수가 아니다. 접근 결정이 드디어 identity 정책에서 쓰던 조건키를 그대로 참조할 수 있다는 거다. 소스 IP로, principal 태그로, org ID로, 표준 키 아무거로나 제한하는 걸 한자리에서 읽히는 문서 안에서 한다.

수정은 Lambda 콘솔의 JSON 편집기, CLI, SDK, CloudFormation이나 SAM 같은 IaC에서 한 번에 한다.

## 예전 add-permission이 아직 맞는 경우

돌아가는 스택을 그냥 다시 쓰지 마라. `add-permission`이 여전히 더 간단한 도구인 경우가 있다.

- **단일 서비스, 단일 source ARN.** "이 버킷 하나가 이 함수 하나를 트리거한다"는 고전적 허용은 `add-permission` 한 번이면 되고 조건도 필요 없다. 손으로 쓴 정책 문서는 이득 없이 관리 면적만 늘린다.
- **IaC가 이미 다룬다.** CDK의 `fn.addPermission(...)`이나 SAM 이벤트 소스가 맞는 허용을 만들어 준다. 프레임워크가 정책을 소유하면 맡겨라.
- **조건이 영영 필요 없다.** 옮기는 이유의 전부가 조건키와 multi-principal 통합이다. 조건도, 통합도 없으면 옮길 이유가 없다.

새 기능은 함수가 진짜 fan-in 대상일 때, 허용이 계정이나 조직 경계를 넘을 때, 보안팀이 태그나 네트워크 출처로 접근을 막고 싶을 때 값을 한다.

## 내가 볼 함정들

- **정책 크기에 한도가 있다.** 리소스 기반 정책엔 크기 제한이 있다. 여러 principal을 문서 하나로 합치는 게 깔끔하긴 한데, 진짜로 수십 개의 별개 허용을 가진 함수라면 천장에 닿을 수 있다. 조건이 겹치는 principal끼리 묶어라. 무관한 조건을 한 statement에 욱여넣은 mega-statement를 만들지 마라.
- **`Principal: "*"` + 느슨한 조건은 발등 찍는 짓이다.** 조건을 걸 수 있게 되니, 와일드카드 principal을 약한 조건 하나로 "제한"하는 안티패턴을 부른다. 명시적 principal을 써라. org 전체 접근이 꼭 필요하면 계정 목록만이 아니라 `aws:PrincipalOrgID`로 막고, blast radius를 이해해라.
- **문서 하나는 편집 지점도 하나다.** `add-permission` 열 번은 각각 독립적으로 실패한다. JSON 한 번 잘못 고치면 지킬 생각이던 허용까지 날아간다. 정책을 IaC로 버전 관리하고 diff를 리뷰해라. 콘솔에서 라이브로 고치지 말고.
- **기존 add-permission 허용은 그대로 남아 있다.** 문서로 옮긴다고 옛 statement가 자동 이관되지 않는다. 먼저 현재 정책을 읽어라(`aws lambda get-policy`). 조용히 이중 허용하거나 뭔가 빠뜨리지 않게.

## 뭘 하면 되나

함수가 트리거 하나짜리면 그냥 둬라. fan-in 대상이거나, cross-account invoke거나, 예전엔 표현 못 하던 보안 요구가 있는 곳만 완전한 리소스 기반 정책으로 옮겨라. 현재 정책을 읽고, 겹치는 principal을 한 statement로 접고, 진짜 필요한 조건키를 넣고, 문서를 IaC로 관리해라. 목표는 줄 수 줄이기가 아니다. 한자리에서 읽히고, 나머지 IAM이랑 같은 조건키로 따질 수 있는 접근 규칙이다.

서비스가 API에 *인증*하는 방식까지 관리한다면, 한자리에서 읽는다는 같은 감각이 서명과 identity에도 적용된다. credential 쪽 이야기는 [TypeScript에서 IAM Identity Center 프로파일 안전하게 쓰기](/ko/blog/2023-05-23-aws-sso-with-typescript.html)에 적어 뒀다.
