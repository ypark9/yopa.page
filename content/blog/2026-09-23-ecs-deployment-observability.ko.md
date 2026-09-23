---
title: "ECS 콘솔의 배포 관측성: 기존 방식과 비교, 그리고 파이프라인이 여전히 볼 수 없는 것"
date: 2026-09-23T09:00:00-04:00
author: Yoonsoo Park
description: "Amazon ECS 콘솔에서 트래픽 전환, 서킷 브레이커 상태, 알람, 헬스 체크, 실패 태스크 진단을 담은 실시간 배포 타임라인을 볼 수 있게 됐다. 이것이 대체하는 것과, 배포가 곧 다운타임인 단일 태스크 Fargate 서비스에서 어떻게 맞물리는지, 그리고 CDK·OpenTofu 파이프라인에 남는 한 가지 공백을 정리한다."
categories:
  - AWS
  - DevOps
tags:
  - Amazon ECS
  - fargate
  - deployment
  - observability
  - circuit-breaker
---

ECS에서 서비스를 배포하는 일은 늘 도구 두 개짜리 작업이었다. `aws ecs update-service`로 롤아웃을 시작하고, 잘 됐는지 확인하러 다른 곳으로 간다. 배포 상태는 `describe-services`, 서비스 이벤트 로그는 `describe-events`, 태스크는 CloudWatch Logs, 앞의 둘로 설명이 안 되면 CloudTrail. 도구 자체에 문제가 있었던 건 아니다. 상태 기계를 머릿속에 들고 있으면서 계속 다시 폴링해야 한다는 게 문제였다.

이번 달부터 ECS가 그 상태 기계를 대신 그려 준다. 콘솔에 실시간 배포 타임라인이 생겼다. 네이티브 Linear, Canary, Blue/Green 배포 전략을 쓰는 서비스라면 모든 배포 단계, 서비스 이벤트, 태스크 시작·종료 진행 상황을 항상 현재 상태로 볼 수 있다. 모든 상용 리전과 GovCloud에서 추가 비용 없이, 네이티브 배포 타입을 쓰는 모든 ECS 서비스에 적용된다.

이 글은 그것이 정확히 무엇을 대체하는지, 그리고 도움이 되지 않는 지점 한 곳을 다룬다.

## 기존 루프, 구체적으로

단일 태스크 Fargate 서비스의 롤아웃은 이런 모양이었다.

```bash
# 1. 배포 시작
aws ecs update-service \
  --cluster hermes-private \
  --service hermes-gateway \
  --force-new-deployment

# 2. 아직 롤아웃 중인가
aws ecs describe-services \
  --cluster hermes-private \
  --services hermes-gateway \
  --query 'services[0].deployments[].[status,rolloutState,desiredCount,runningCount,failedTasks]'

# 3. 무슨 일이 있었나
aws ecs describe-services \
  --cluster hermes-private \
  --services hermes-gateway \
  --query 'services[0].events[:10].[createdAt,message]'
```

쿼리 모양만 세 가지이고, 그중 둘은 급할 때 틀리기 쉽다(`rolloutState`와 `status`는 다른 필드다). 그리고 어느 것도 태스크가 *왜* 죽었는지 알려주지 않는다. "왜"는 CloudWatch Logs에, "누가 바꿨나"는 CloudTrail에 있었다. 이야기를 손으로 조립해야 했다.

## Deployments 탭이 주는 것

콘솔에서 ECS 서비스를 선택하고 **Deployments** 탭을 열면 타임라인이 배포를 실시간으로 서술한다.

- **단계, 서비스 이벤트, 태스크 진행 상황**이 하나의 축에 실시간으로 표시된다. 그린 태스크를 늘리는 중인지, 라이프사이클 훅을 기다리는 중인지, bake time 구간에 있는지를 JSON 해석 없이 알 수 있다.
- **소스·타깃 리비전 간 트래픽 전환 분포**가 보인다. canary와 blue/green에서는 롤아웃이 끝난 뒤가 아니라 진행 중에 보고 싶은 숫자가 이것이다.
- **배포 상태 신호가 한 곳에 모인다**: 실패 임계값 추적이 붙은 서킷 브레이커 상태, 배포 알람 상태, 컨테이너·로드밸런서 헬스 체크 결과, 라이프사이클 훅 상태.
- **실패한 태스크가 진단 정보와 함께 표시되고 CloudTrail로 딥링크**된다. "왜"와 "누가"가 콘솔 탭 세 개가 아니라 타임라인에서 한 번의 클릭 거리에 있다.

| 질문 | 기존 | 현재 |
|----------|--------|-----|
| 어느 단계인가 | `deployments[].rolloutState` 파싱 | 타임라인이 단계 표시 |
| 트래픽이 얼마나 넘어갔나 | 타깃 그룹이나 LB 지표에서 유추 | 트래픽 전환 분포 제공 |
| 서킷 브레이커가 걸렸나 | `rolloutState = FAILED`를 보고 추론 | 실패 임계값이 붙은 서킷 브레이커 상태 |
| 알람이 울렸나 | CloudWatch를 따로 확인 | 알람 상태가 타임라인에 표시 |
| 태스크가 왜 죽었나 | CloudWatch Logs, 그다음 CloudTrail | 진단 정보와 CloudTrail 딥링크 |

범위가 중요하다. 이것은 **배포** 관측성이지 런타임 관측성이 아니다. 롤아웃에 무슨 일이 있었는지 알려줄 뿐, 지표·트레이스·로그 수집을 대체하지 않고 배포 이력 제품도 아니다. "시작했다"와 "새 버전이 돌고 있다" 사이의 비어 있던 중간이 채워진 것이다.

## 단일 태스크 서비스에서 어떻게 맞물리는가

이 기능이 반가운 이유는, 내 Hermes Agent 게이트웨이가 기존 루프에는 최악이고 새 타임라인에는 최적인 사례라서다. ALB도 공인 인바운드도 없는 Fargate 태스크 하나로 돌아간다. Slack Socket Mode로 밖으로 연결하므로 헬스 체크할 HTTP 포트가 없다. 서비스 정의에서 관련된 부분은 이렇다.

```ts
circuitBreaker: { enable: true, rollback: true },
minHealthyPercent: 0,
maxHealthyPercent: 100,
healthCheck: {
  command: ["CMD-SHELL", "true"], // HTTP 포트가 없다. liveness만 확인
},
```

이 조합에서 두 가지가 따라 나오고, 둘 다 예전에는 폴링으로 알게 되는 사실이었다.

- **태스크가 하나이고 `minHealthyPercent: 0`, `maxHealthyPercent: 100`이면 롤아웃이 곧 다운타임 구간이다.** 여유 용량이 없으므로 새 태스크가 정상이 되기 전에 기존 태스크가 멈춘다. 그 구간을 어느 단계에서 보내고 있는지 알려주는 화면은 배포 타임라인뿐이다.
- **헬스 체크가 의도적으로 무의미하기 때문에 서킷 브레이커가 실질적인 실패 감지기다.** 시작하자마자 종료되는 컨테이너도 `CMD-SHELL true`는 통과한다. 크래시 루프를 잡아 롤백하는 건 서킷 브레이커다. 그 실패 임계값 추적을 보는 것은 여기서 너를 구해 줄 유일한 장치를 보는 일이다.

일반 규칙 하나가 잘 드러난다. 헬스 신호가 표준에서 멀어질수록 배포 기계 자체에 더 의존하게 된다. Deployments 탭은 그 기계를 보여 준다.

## 닫히지 않는 공백

노트북이나 일회성 CLI 호출에서 `--force-new-deployment`를 쓰는 흐름은 이 콘솔 뷰가 정확히 개선하는 대상이다. CI/CD 파이프라인은 아니다.

배포가 GitHub Actions, CDK, OpenTofu에서 돌면 롤아웃 중에 콘솔을 보는 사람이 없고, 새 타임라인은 파이프라인이 관측할 수 있는 것을 바꾸지 않는다. API 경로는 여전히 필요하다. `rolloutState`는 `describe-services`, 사람이 읽을 이유는 서비스 이벤트 로그, 그리고 배포가 `FAILED`가 아니라 `COMPLETED`에 도달했다는 파이프라인 자체의 단언이다. 합리적인 패턴은 그대로이고, 적어 둘 가치가 있다.

```bash
# 롤아웃이 정리될 때까지 기다린 뒤 FAILED면 파이프라인을 실패시킨다
aws ecs wait services-stable \
  --cluster hermes-private \
  --services hermes-gateway
```

경계가 두 개 더 있다.

- **네이티브 배포 타입만 해당된다.** 타임라인은 ECS 네이티브 Linear, Canary, Blue/Green을 쓰는 서비스를 다룬다. CodeDeploy 컨트롤러를 아직 쓰는 서비스는 대상이 아니다. 마이그레이션을 안 했는데 탭이 비어 있다면 이 이유다.
- **콘솔 범위이므로 관측성 스택에는 없다.** 나중에 조회할 API도, 임베드할 대시보드도 아니다. 배포 기록이 필요하면 기존처럼 따로 수집해야 한다.

## 함정

- **파이프라인이 의존하는 이벤트 로그 조회를 없애지 말 것.** 콘솔 뷰와 `describe-events`는 같은 롤아웃의 다른 소비자이고, 빌드를 실패시킬 수 있는 건 하나뿐이다.
- **타임라인이 초록색이라고 서비스가 건강한 건 아니다.** 타임라인은 "배포 완료"에서 끝난다. 새 버전이 *동작하는지*는 여전히 CloudWatch의 질문이고, 에이전트 게이트웨이라면 롤아웃 상태가 아니라 실제 태스크 동작을 봐야 한다.
- **`minHealthyPercent: 0`은 기본값이 아니라 의도적 위험이다.** 자기 자신을 두 개 띄울 수 없는 단일 태스크 서비스에는 맞고, 두 태스크를 띄울 수 있으면서 요청 하나도 떨어뜨리고 싶지 않은 서비스에는 틀리다.

## 그래서 무엇을 할까

손으로 배포한다면 다음번에 `describe-services` 출력을 추측하기 전에 Deployments 탭을 먼저 열면 단계가 바로 보인다. 파이프라인으로 배포한다면 이번 출시가 코드를 바꾸지는 않지만, 강제 배포가 성공했다고 가정하는 대신 `rolloutState`를 실제로 단언하는지 점검할 좋은 계기가 된다. 눈치채지 못한 `FAILED` 롤아웃의 실패 모드는 모두가 새 버전이 나갔다고 믿는 동안 서비스가 옛 버전으로 도는 것이기 때문이다.

ECS에서 실제 서비스를 운영하는 전체 그림(버전 고정, 시크릿 처리, 롤백)은 [Run n8n Queue Mode on AWS ECS with Recoverable Operations](/blog/2026-08-01-run-n8n-queue-mode-on-aws-ecs.html)이 타임라인이 다루지 않는 부분을 채운다.

## 참고 자료

- [AWS What's New — Amazon ECS real-time deployment observability](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-ecs-console-deployment-observability/)
- [Amazon ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
- [Amazon ECS service deployment types](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
