---
title: "개인 AWS 계정 비용 가드레일 — Budget 알림, Auto-Stop, Anomaly Detection 3단 구성"
date: 2026-05-30T12:35:00-04:00
author: Yoonsoo Park
description: "개인 AWS 계정에 사이드 프로젝트 몇 개 굴린다 — EC2 하나, Bedrock 호출 좀, 가끔 실험들. 한 번의 사고가 4자리 숫자 청구서로 변하지 않도록 내가 쓰는 3단 가드레일을, 실제 CloudFormation과 셋업하면서 밟은 gotcha 포함."
categories:
  - AWS
  - FinOps
tags:
  - cost
  - budgets
  - lambda
  - cloudformation
  - personal
---

AWS war story 중 자주 나오는 장르가 있다 — "스크립트 켜놓고 자다 일어났더니 $4,000 청구서, AWS support가 면제해줬다.. (운 좋으시네..)". 개인 계정에서 진짜 일어날 수 있는 일이다. 조직 SCP도 없고, FinOps 팀도 없고, Bedrock에 잘못 짠 루프 하나나 잊어먹은 EC2 인스턴스 하나가 일주일 동안 조용히 돌 수 있다. 생각만 해도 식은땀 나는 상황.

그래서 앉아서, 알림만 보내는 게 아니라 *실제로 내가 행동을 취할* 최소한의 가드레일을 만들었다. 3단. 마지막 한 단계 빼고는 다 한 CloudFormation 스택으로 배포 가능 — 그 한 단계는 AWS가 제대로 문서화 안 한 부분이 있다.

## 뭐로부터 보호하려는가

- **천천히 새는 것** — EC2가 켜져 있는 걸 잊어서 한 달에 $30 나옴. 짜증나지만 종말은 아님.
- **갑작스런 스파이크** — 버그 있는 스크립트가 Bedrock을 두들기거나 너무 큰 인스턴스 띄움. 몇 시간 안에 수백 달러 가능.
- **느린 누수** — 1년 전에 만든 뭔가가 아직도 하루 $3씩 청구되고 있음. 천 번의 종이베임으로 죽기.

스케일이 다르면 도구도 달라야 한다.

## 1단 — Budget 알림 (느린 drift)

AWS Budgets는 월별 비용 목표 대비 threshold 도달 시, 이메일을 쏜다. 실시간 아님 — Budgets는 대략 8-12시간마다 평가한다 — 대신 값이 싸고, 쉽게 운영된다.

```yaml
MonthlyBudget:
  Type: AWS::Budgets::Budget
  Properties:
    Budget:
      BudgetName: monthly-cost-budget
      BudgetType: COST
      TimeUnit: MONTHLY
      BudgetLimit:
        Amount: 40
        Unit: USD
    NotificationsWithSubscribers:
      - Notification:
          NotificationType: ACTUAL
          ComparisonOperator: GREATER_THAN
          Threshold: 50
          ThresholdType: PERCENTAGE
        Subscribers:
          - SubscriptionType: SNS
            Address: !Ref CostAlertTopic
      - Notification:
          NotificationType: ACTUAL
          ComparisonOperator: GREATER_THAN
          Threshold: 80
          ThresholdType: PERCENTAGE
        Subscribers:
          - SubscriptionType: SNS
            Address: !Ref CostAlertTopic
      - Notification:
          NotificationType: ACTUAL
          ComparisonOperator: GREATER_THAN
          Threshold: 100
          ThresholdType: PERCENTAGE
        Subscribers:
          - SubscriptionType: SNS
            Address: !Ref CostAlertTopic
```

50% / 80% / 100%가 흔한 모양이다. 진짜 유용한 건 50% 알림이다 — 한 달 절반 지나서 50%면 페이스대로다. 첫 주에 50%면 뭔가 잘못됐다.

## 2단 — Auto-stop Lambda (스파이크 안전망)

100%에서 이메일 알림 받아도 새벽 2시에 메일 못 봄. 그래서 100% threshold는 SNS 메시지도 같이 발사하고, 그게 Lambda를 트리거해서 `AutoStop=true` 태그된 모든 running EC2 인스턴스를 멈춤.

```yaml
AutoStopFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: cost-monitor-auto-stop
    Runtime: python3.13
    Handler: index.handler
    Role: !GetAtt AutoStopRole.Arn
    Timeout: 60
    Code:
      ZipFile: |
        import boto3
        ec2 = boto3.client('ec2')
        def handler(event, context):
            r = ec2.describe_instances(Filters=[
                {'Name': 'tag:AutoStop', 'Values': ['true']},
                {'Name': 'instance-state-name', 'Values': ['running']},
            ])
            ids = [i['InstanceId'] for res in r['Reservations'] for i in res['Instances']]
            if ids:
                ec2.stop_instances(InstanceIds=ids)
            return {'stopped': ids}

AutoStopSubscription:
  Type: AWS::SNS::Subscription
  Properties:
    TopicArn: !Ref CostAlertTopic
    Protocol: lambda
    Endpoint: !GetAtt AutoStopFunction.Arn
```

이건 **real-time circuit breaker가 아니다**. Budgets는 8-12시간마다 평가하니까 auto-stop도 그 안에서만 발동한다. `p4d.24xlarge` 띄워서 시간당 $40 쓰면, 한 시간 만에 $40 monthly budget을 뚫을 수 있고 Budgets는 다음 평가까지 모른다.

Auto-stop은 "월 limit 향해 *천천히* 타고 있을 때 (불타오르네) — 아니 진짜 좀 그만 써" 식의 backstop이지 진짜 스파이크 방어가 아니다. 진짜 스파이크 방어는 3단이 필요하다.

IAM role은 작게 배정 — `ec2:DescribeInstances`랑 `ec2:StopInstances`만. auto-stop role에 `Start` 권한 줄 이유 없음. 재시작은 의도적.

## 3단 — Cost Anomaly Detection (스파이크 detector)

이게 "두 시간 전에 뭔가 이상한 거 띄웠지?"를 잡는 단계다. Cost Anomaly Detection(CAD)은 대략 매일 실제 사용량을 평가해서 서비스별로 historical baseline 대비 통계적 anomaly를 찾고, 한 서비스의 일일 spend가 많이 벗어나면 이메일을 보낸다.

함정: 콘솔에서 클릭으로 monitor 만든 적 있으면 CloudFormation으로 fully manage 못한다. AWS는 계정당 정확히 **하나의 DIMENSIONAL/SERVICE anomaly monitor**만 허용한다. 콘솔에서 하나 만들어 놓고 나중에 CloudFormation으로 또 만들려 하면:

```
AlreadyExistsException: AnomalyMonitor already exists.
```

해결책 셋 중 하나:
1. 수동으로 만든 거 지우고 CloudFormation으로 재생성.
2. CloudFormation 스킵하고 콘솔에서 관리.
3. 기존 리소스를 stack에 import (`aws cloudformation create-change-set --change-set-type IMPORT ...`).

나는 2번 적용. CAD는 set-and-forget이 제맛. monitor는 stack 밖에 두고, stack은 budget + auto-stop + SNS topic만 관리한다.

CloudFormation으로 갈 거면 함정 두 개 더:

- `ThresholdExpression`은 **JSON string**이지 YAML object가 아니다. CFN parser는 YAML 받아주고 deploy 시점에 죽는다:

```yaml
# 올바른 형태
ThresholdExpression: '{"Dimensions":{"Key":"ANOMALY_TOTAL_IMPACT_ABSOLUTE","MatchOptions":["GREATER_THAN_OR_EQUAL"],"Values":["5"]}}'

# 잘못된 형태 — EarlyValidation 실패
ThresholdExpression:
  Dimensions:
    Key: ANOMALY_TOTAL_IMPACT_ABSOLUTE
    Values: ['5']
    MatchOptions: ['GREATER_THAN_OR_EQUAL']
```

- `Frequency: IMMEDIATE`는 SNS subscriber에서만 동작. 메일로 바로 받고 싶으면, frequency는 `DAILY`와 `WEEKLY`뿐. 나는 `DAILY` + $5 absolute-impact threshold로 갔다 — 단일 서비스가 하루에 $5 튀는 건 24시간 안에 알아야한다고 생각.

## 뭘 잡고 뭘 못 잡나

| 시나리오 | 잡는 곳 | Latency |
|---|---|---|
| 잊어먹은 EC2, 한 달에 ~$30 | Budget 50% / 80% | ~12시간 |
| Bedrock 루프 버그, 한 오후에 $200 | Anomaly Detection | ~24시간 |
| 실수로 띄운 `p4d` | 위 셋 다 빠르게는 못 잡음 | 시간 단위 |
| 느린 누수: 1년간 하루 $3 | Anomaly Detection ($5+ threshold) | DAILY 메일 |

솔직한 평가: 한 시간 안에 작정한 사고가 나면 여전히 큰 타격이다. AWS는 합리적인 가격대에서 진짜 real-time auto-stop을 제공하지 않음 — Budgets가 가장 비슷한데 real-time 아니다. 분 단위 스파이크 방어가 진짜 필요하면 (a) Service Catalog로 인스턴스 타입 allowlist 박아서 provision, (b) 진짜 org 계정 쓰고 SCP 걸기, (c) Reserved/Savings Plan으로 spend의 대부분을 fixed-cost 구독에 묶어서 변동 부분 자체를 작게 만들기 — 셋 중 하나 가야 한다.

개인 계정 기준으로는: 이 3단 셋업 정도가 "잠은 잘 자고, 추가 비용은 사실상 0"인 sweet spot이다.

## 실제로 밟은 함정들

- **anomaly monitor `AlreadyExists`**. 콘솔에서 한 번이라도 "anomaly detection 셋업" 클릭했으면 DIMENSIONAL/SERVICE monitor가 이미 있고, CFN은 두 번째를 못 만든다. import하든가 CAD만 CFN 스킵하든가.
- **`ThresholdExpression` 모양**. JSON-encoded string이어야 함. CFN 템플릿이 대부분 property에 YAML 받아주니까 오타처럼 보이지만 사실은 맞음.
- **`Frequency: IMMEDIATE` + email**. 안 됨. IMMEDIATE 원하면 SNS-then-email로 돌리고, 직통 메일은 DAILY/WEEKLY로.
- **Auto-stop ≠ circuit breaker**. Budgets는 real-time 아니다. Bedrock 빡센 루프 돌리면 auto-stop은 이미 돈 다 쓴 뒤에 발동한다.
- **stoppable 인스턴스에 태그하기**. Lambda는 `AutoStop=true` 필터링한다. 태그 잊어먹으면 Lambda는 successfully 돌고 아무것도 stop 안 한다. 개인 EC2는 디폴트로 `AutoStop=true` 박고, 안 멈춰야 할 게 있을 때만 명시적으로 태그 떼기.
- **재시작은 의도적으로 수동**. Lambda에 `ec2:StartInstances` 없다. Auto-stop 후 재시작은 "그래, 뭐 돌고 있고 왜 돌고 있는지 알아"라는 판단에 따른 결정이어야함. 자동 복구가 아니어야 한다.

## 그래서 뭘 해야 하나

개인 AWS 계정 있고 1단(이메일 알림 달린 budget) 조차 없으면, 오늘 만드세요 — 콘솔에서 10분, 무료, 느린 drift류 문제 다 막음.

시간당 청구되는 거 뭐 굴리고 있으면 (EC2, RDS, OpenSearch, GPU 뭐든) 2단 추가 (제발 만드세요. 저처럼 돈내고 만드실 필요 없음). Lambda 20줄에 태그 하나.

사용량 청구 서비스(Bedrock, Lambda invocation count, S3 request count)에 버그 한 방 빠르게 튈 수 있으면 3단 추가 — $5 absolute threshold DAILY anomaly 메일이 "이 청구 뭐지" 단계에서 잡아준다, "이 청구 *뭐였지*" 생각이 들면 늦었음. 카드 꺼내야됨.

3단, 총 ~20분, 추가 비용 0. 하는게 이득.
