---
title: "AWS CDK v2로 서버리스 API를 안전하게 배포하기"
date: 2023-06-05T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-05-deploying-services-aws-cdk-and-aws-sso.html"
author: Yoonsoo Park
description: "지원 중인 런타임, 임시 자격 증명, 테스트와 최소 권한을 적용한 API Gateway, Lambda, S3용 CDK v2 배포 흐름."
categories:
  - AWS
  - Infrastructure as Code
tags:
  - AWS CDK
  - AWS Lambda
  - Amazon API Gateway
  - Amazon S3
  - IAM Identity Center
---

과거 CDK 예제에는 `@aws-cdk/*` v1 모듈과 `aws-cdk-lib` v2를 섞거나 지원 종료된 Lambda 런타임을 쓰는 경우가 많다. 현재 흐름은 CDK v2만 일관되게 사용하고, 지원 중인 런타임과 임시 운영자 자격 증명을 쓰며, 배포 전에 합성된 템플릿을 검토한다.

## API 종류부터 선택하기

Lambda proxy API라면 API Gateway HTTP API가 보통 비용과 복잡도가 낮다. usage plan이나 일부 request transformation 같은 REST API 전용 기능이 필요하면 REST API를 쓴다. 인증 요구가 단순한 작은 서비스는 Lambda Function URL, 기존 컨테이너 서비스는 ALB가 더 자연스러울 수 있다.

아래 코드는 이전 글과 비교하기 위해 REST API를 유지하지만 실제 설계에서는 선택 근거를 기록해야 한다.

## CDK v2 스택

```bash
mkdir current-api && cd current-api
npx aws-cdk@latest init app --language typescript
npm install aws-cdk-lib constructs
```

```typescript
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Runtime, Function, Code } from "aws-cdk-lib/aws-lambda";
import { RestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const bucket = new Bucket(this, "Data", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const handler = new Function(this, "Handler", {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromAsset("lambda"),
      environment: { BUCKET_NAME: bucket.bucketName },
    });
    bucket.grantRead(handler);
    const api = new RestApi(this, "Api");
    api.root.addMethod("GET", new LambdaIntegration(handler));
  }
}
```

`grantRead`는 함수에 범위가 정해진 identity policy를 만든다. CDK가 코드에 필요한 모든 권한을 자동으로 추론한다는 뜻은 아니다. 합성된 IAM 문장을 확인하고 wildcard grant는 피한다.

## 인증, 검토, 배포

```bash
aws sso login --profile engineering-dev
AWS_PROFILE=engineering-dev aws sts get-caller-identity
AWS_PROFILE=engineering-dev npx cdk bootstrap
npx cdk synth
npx cdk diff
AWS_PROFILE=engineering-dev npx cdk deploy --require-approval broadening
```

bootstrap은 계정과 리전별로 권한이 있는 역할을 사용해 수행한다. `cdk.json`, 소스, lockfile, 테스트는 커밋하지만 `cdk.out`은 커밋하지 않는다. CDK 버전 범위를 고정하고 의도적으로 갱신한다. CI에는 장기 키 대신 OIDC로 deploy role을 맡게 한다.

작은 예제에는 구조화 로그, 알람, 인증, 입력 검증, throttling, 데이터 보존 정책이 빠져 있다. 의존성을 재현 가능하게 패키징하고 Lambda 단위 테스트와 보안 속성에 대한 CDK template assertion을 추가한다. 비운영 계정에 먼저 배포하고 rollback을 확인한다. `RETAIN`한 데이터는 별도 이전·삭제 절차가 필요하다.

## 마이그레이션 체크리스트

- CDK v1 서비스 패키지를 제거하고 `aws-cdk-lib`에서 import한다.
- `Construct`는 `constructs`에서 가져온다.
- 지원 중인 Lambda 런타임을 선택하고 애플리케이션을 테스트한다.
- 로컬은 Identity Center, CI는 OIDC와 역할을 사용한다.
- 배포 전 `synth`, 테스트, 보안 검사, `diff`를 실행한다.
- IAM 권한 확대와 리소스 교체·삭제를 검토한다.
- endpoint, 로그, 인증, S3 접근과 rollback을 검증한다.

CDK는 TypeScript 추상화와 재사용이 장점이다. 작은 AWS 전용 스택은 CloudFormation이나 SAM이 단순할 수 있고, 여러 provider를 다루는 조직은 Terraform/OpenTofu가 더 맞을 수 있다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [AWS CDK v2 Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS Lambda 런타임](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [CDK 권한과 grant](https://docs.aws.amazon.com/cdk/v2/guide/permissions.html)
- [API Gateway API 유형 비교](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html)
