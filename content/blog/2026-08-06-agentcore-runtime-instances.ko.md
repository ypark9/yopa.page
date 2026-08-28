---
title: "AgentCore Runtime Instances: 에이전트가 MicroVM을 넘어설 때"
date: 2026-08-06T09:00:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "AgentCore가 이제 관리형 EC2 인스턴스에서 에이전트를 돌린다. 세션은 최대 14일, GPU와 메모리/컴퓨트 최적화 인스턴스까지. 서버리스 microVM 대신 언제 이걸 골라야 하는지 정리했다."
categories:
  - AWS
  - AI Agents
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - EC2
  - GPU
  - Long-running Agents
---

2026년 8월 6일에 AWS가 [AgentCore runtime instances](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-bedrock-agentcore-runtime-instances-generally-available/)를 GA로 풀었다. 그동안 AgentCore Runtime이 주는 컴퓨트는 한 종류였다. 서버리스 microVM. 시작이 빠르고 세션은 최대 8시간까지다. 대부분의 request-response 에이전트는 이걸로 충분하다. 그런데 GPU가 필요한 에이전트나, 이틀 동안 살아 있어야 하는 에이전트는 여기에 안 들어간다.

runtime instances가 두 번째 컴퓨트를 추가한다. 배포하고 invoke하는 방식은 그대로인데, 이제 에이전트가 내가 고른 관리형 EC2 인스턴스 위에서 최대 14일짜리 세션으로 돌 수 있다.

이 인스턴스는 capacity provider를 통해 내 계정의 AWS 관리형 EC2 인프라에서 동작한다. 그래서 서버리스 microVM 경로와 보안·암호화 모델이 같다고 보면 안 된다. 설계 전에 [Runtime Instances 공식 문서](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-instances.html)를 확인해라.

예전에 쓴 [Durable Long-Running Jobs with AgentCore](/blog/2026-08-01-durable-long-running-jobs-with-agentcore.html)에서 나는 8시간 상한을 설계로 우회해야 하는 딱딱한 경계라고 봤다. 그 경계가 방금 올라갔고, 일부 워크로드는 이 때문에 설계가 달라진다.

## 예제 하나

문서 인텔리전스 에이전트를 하나 잡자. 계약서 수백 건을 넣으면, 로컬 vision-language 모델을 돌려서 조항을 뽑아내고, 정리된 리포트를 만든다. 이 에이전트가 기본 런타임에서 막히는 지점이 두 개다.

1. 로컬 모델을 돌리려면 GPU가 필요하다. 서버리스 microVM에는 GPU가 없다.
2. 배치 한 번 도는 데 한 시간이 아니라 거의 하루가 걸린다.

이 예제를 두 방식에 그대로 대입해보면 차이가 선명해진다.

## 어디에 들어가나

```
Request  ->  AgentCore Runtime  ->  내 에이전트 코드
                    |
        +-----------+-----------+
        |                       |
   microVM (서버리스)      runtime instance (EC2)
   빠른 시작, <= 8h        내가 고른 인스턴스, <= 14d
```

provisioning, 패칭, 스케일링, lifecycle은 여전히 AgentCore가 다 가져간다. 내가 정하는 건 에이전트가 *무엇 위에서 도느냐* 하나뿐이고, 섞어서도 쓸 수 있다. 지연에 민감한 에이전트는 microVM에, 무거운 배치 에이전트는 인스턴스에 올리면 된다.

## Before: microVM에 억지로 맞추기

서버리스 런타임만 있을 때 이 문서 에이전트는 우회를 두 번 강요한다.

GPU부터. 이건 아예 AgentCore Runtime 바깥으로 나가야 한다. GPU 인스턴스 위에 ECS나 EKS 서비스를 직접 세우고, 네트워킹과 IAM을 손으로 엮고, 그 fleet의 패칭과 스케일링까지 전부 내가 떠안게 된다.

세션 길이는 하루짜리 배치를 8시간 안에 안전하게 끝나는 조각으로 쪼개서 durable orchestrator 뒤에 붙인다. long-running-jobs 글에서 다룬 바로 그 패턴이다.

```
Step Functions
   -> SQS work item (계약서 20건 배치)
      -> AgentCore Runtime (bounded, < 8h)
         -> S3 artifact + DynamoDB checkpoint
   -> 끝날 때까지 loop
```

이 오케스트레이션 자체는 승인이 걸리고 돈이 오가는 진짜 durable한 비즈니스 프로세스에는 여전히 좋은 설계다. 그런데 여기서는 비즈니스 프로세스가 durable해서가 아니라 컴퓨트 제약을 피하려고 존재한다. 그게 신호다.

## After: 컴퓨트 고르고, 붙이고, 끝

runtime instances에서는 이 두 우회가 설정 한 덩어리로 접힌다. **capacity provider**를 만들어서 에이전트가 필요로 하는 EC2 인스턴스 타입을 지정하고, 여기서는 GPU 계열을 지정한 다음, 에이전트를 거기에 붙이면 된다.

```
capacity provider:
  instance types: [ g6.xlarge, g6.2xlarge ]   # GPU 계열
  ->
agent: document-intelligence
  runtime: instance
  session: 최대 14일
```

GPU가 이제 일급 시민이 됐고, 옆에 ECS fleet을 세울 일이 없다. 하루짜리 배치는 Step Functions로 쪼개는 loop 없이 세션 하나 안에서 돈다. 배포와 invoke는 안 바뀌었으니 microVM 시절 호출 코드가 그대로 동작한다.

대신 밑단 EC2 비용에 더해 AgentCore가 관리하는 컴퓨트 값도 낸다. 그래서 놀고 있는 인스턴스는, 0으로 오토스케일되는 microVM과 달리 실제로 돈이 나가는 상태다.

## 뭘 고를까

| 신호 | 이걸 골라라 |
|---|---|
| request-response, 튀는 트래픽, 8시간 미만 | microVM (서버리스) |
| 빠른 콜드스타트가 중요 | microVM |
| GPU나 메모리/컴퓨트 최적화 하드웨어가 필요 | runtime instance |
| 세션 하나가 8시간을 넘어야 함 (최대 14일) | runtime instance |
| 계속 warm하게 유지되는 워크로드 | runtime instance |
| 진짜 durable한 프로세스 (승인, 며칠씩 대기) | 긴 세션 말고 durable orchestrator |

마지막 줄이 핵심이다. 14일짜리 세션은 durable workflow가 아니다. 프로세스가 사람 승인을 이틀 기다린다면, 오래 살아 있는 세션 하나에 그 상태를 얹어두는 건 약한 설계다. 그 상태는 트랜잭셔널 스토어에 넣고, 대기는 Step Functions가 소유하게 하는 게 맞다. runtime instances는 *연속된* 작업의 천장을 올려줄 뿐, invoke 하나를 saga로 바꿔주지는 않는다.

## 함정

- **놀고 있는 인스턴스도 과금된다.** 서버리스 런타임은 0으로 스케일된다. 튀는 트래픽 에이전트를 위해 capacity provider가 인스턴스를 붙잡고 있으면 트래픽 사이의 빈 시간에 돈이 샌다. 피크가 아니라 트래픽 모양에 런타임을 맞춰라.
- **14일은 최대치지 목표가 아니다.** 며칠짜리 세션에 손이 가는 순간은, 보통 8시간 상한 아래에서와 똑같이 작업을 checkpoint하고 재시작에 안전하게 만들어야 한다는 신호다.
- **리전이 아직 다 열린 게 아니다.** GA 시점 기준으로 US East(버지니아 북부, 오하이오), US West(오리건), 아시아 태평양(뭄바이, 싱가포르, 시드니, 도쿄), 유럽(프랑크푸르트, 아일랜드)이다. 설계에 넣기 전에 내 리전부터 확인해라.
- **인스턴스 선택은 내 몫이다.** capacity provider는 내가 나열한 인스턴스 계열만큼만 적정하다. GPU를 건드리지도 않는 에이전트에 GPU 계열을 과하게 붙여두는 게 전형적인 낭비다.

## 그래서 어떻게

기본값을 유지해라. 대부분의 에이전트는 request-response라 서버리스 microVM에 있는 게 맞다. 여기서는 0으로 스케일되는 것과 빠른 시작이 공짜로 딸려온다. runtime instance는 특정 에이전트가 microVM으로는 못 넘는 벽에 부딪혔을 때만 꺼내라. GPU 요구, 메모리/컴퓨트 최적화 하드웨어, 아니면 연속으로 8시간을 진짜 넘기는 세션. 그리고 비즈니스 프로세스를 열어두려고 14일짜리 세션을 쓰고 싶어지는 순간이 오면, 그건 여전히 durable orchestrator를 꺼내라는 신호다. [long-running jobs 글](/blog/2026-08-01-durable-long-running-jobs-with-agentcore.html)과 좀 더 넓게는 [AgentCore 서비스 맵](/blog/2026-08-01-agentcore-service-map-and-production-boundaries.html)에서 다뤘다.
