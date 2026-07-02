---
title: "Agent가 만든 코드, 어디서 돌릴 건데? Lambda MicroVMs와 격리의 트레이드오프"
date: 2026-07-02T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda MicroVMs는 Firecracker 기반 VM 수준 격리에 최대 8시간 suspend/resume까지 준다. 진짜 질문은 이거다. 언제 이게 필요하고 언제 Code Interpreter 샌드박스나 그냥 컨테이너면 충분한가. 그리고 agent가 짠 코드를 돌릴 때의 함정들."
categories:
  - AWS
tags:
  - lambda
  - firecracker
  - agentcore
  - security
  - agents
---

Agent를 만들다 보면 아무도 반기지 않는 질문에 결국 부딪힌다. 모델이 방금 코드를 짰고, 이제 뭔가가 그걸 실행해야 한다. 내 코드가 아니다. LLM이 1초 전에 생성한 코드고, 틀렸을 수도 있고, prompt injection이 뚫렸으면 악의적일 수도 있다. 그걸 어디서 돌릴 건데?

2026년 6월, AWS가 [Lambda MicroVMs](https://aws-news.com/article/2026-06-22-aws-introduces-lambda-microvms-for-isolated-execution-of-user-and-ai-generated-code)를 냈다. 딱 이 문제를 위한 compute primitive다. 새거고 반짝여서가 아니라, 그동안 대충 눈감고 있던 트레이드오프를 정면으로 마주보게 만들어서 알아둘 가치가 있다.

## 원하는 세 가지, 다 가질 순 없다

신뢰 안 되는 코드를 돌릴 때 동시에 원하는 속성이 셋 있다.

1. **격리(isolation)**. 나쁜 프로세스가 다른 tenant 데이터를 읽거나 내 인프라로 탈출하지 못하게.
2. **속도(speed)**. 스니펫 하나 돌릴 때마다 agent가 몇 초씩 멈추지 않게.
3. **상태(state)**. 긴 작업이 멈췄다가 working directory와 메모리를 그대로 들고 나중에 재개할 수 있게.

원래는 이 중 둘만 골랐다. 공유 컨테이너는 빠르고 상태도 유지되지만 격리가 벽이 아니라 namespace다. 요청마다 새로 뜨는 Firecracker microVM은 격리되고 부팅도 빠르지만 상태를 다 버린다. 풀 EC2 VM은 격리·상태 다 되지만 즉각적이지 않다.

Lambda MicroVMs는 이제 셋 다 가질 수 있다는 AWS의 주장이다. 밑바닥은 Lambda를 떠받치는 그 Firecracker(발표문 기준 월 15조+ 호출)고, 이걸 직접 띄우는 primitive로 노출한 거다.

## 실제로 주는 것

마케팅 걷어낸 실제 기능.

- **VM 수준 격리**. multi-tenant 실행인데 virtualization layer를 내가 관리 안 해도 됨.
- **거의 즉각 launch**, 거기에 **최대 8시간** suspend/resume. 이게 재밌는 부분이다. microVM이 멈춘 작업을 붙잡고 있다가, context를 다시 쌓는 대신 나중에 그대로 재개한다.
- **Dockerfile로 이미지** 만들고, HTTP/2·gRPC·WebSocket 다 되는 **전용 HTTPS URL**로 launch.
- **돌아가는 동안 baseline 과금**, baseline 초과분은 쓴 만큼.

suspend/resume 창이 "그냥 빠른 샌드박스"랑 이걸 가르는 지점이다. 여러 단계 작업을 돌리다가 사람 승인을 기다린 뒤 이어가는 agent가, 컨테이너를 열어두거나 전체 상태를 디스크에 직렬화했다 되살리는 대신, suspend된 microVM에 그냥 앉아 있으면 된다.

## 결정: 진짜 이게 필요한가?

여기가 핵심이다. 가벼운 옵션으로 충분한데 microVM 격리를 집어드는 건 오버엔지니어링이다. 나라면 이렇게 판단한다.

```
상황                                          집어들 것
────────────────────────────────────────────────────────────
내가 만들고 통제하는 짧은 순수 연산 스니펫     관리형 Code Interpreter 샌드박스.
                                              인프라 짓지 마라.
신뢰 안 되는/모델 생성 코드, multi-tenant,     Lambda MicroVMs.
네트워크나 파일시스템 필요                      이게 만들어진 이유.
사람 승인에서 멈췄다 재개하는 긴 작업          Lambda MicroVMs. suspend/resume 때문.
내 로직, 신뢰되는 코드, 그냥 스케일만          그냥 Lambda나 컨테이너.
                                              격리는 이미 충분.
```

VM 격리가 진짜 필요하다는 신호는 "코드를 돌린다"가 아니다. "내가 안 쓴 코드를, 서로 신뢰 안 하는 tenant들을 위해 돌린다"이다. 이 문장이 참이 아니면 관리형 샌드박스가 더 싸고 단순하다.

## 지켜볼 함정들

- **격리가 입력 처리를 건너뛸 면허는 아니다.** VM 수준 격리는 탈출을 막는다. 근데 agent가 내가 마운트해준 데이터 볼륨에 신나게 `rm -rf`를 날리거나, env var로 넘긴 secret을 유출하는 건 못 막는다. 격리는 blast radius를 가둘 뿐, 그 안에서 뭐가 터질지는 안 정해준다.
- **8시간 resume 창은 까먹으면 비용 함정이다.** suspend된 microVM도 baseline compute는 계속 과금된다. 작업을 suspend해놓고 안 치우는 agent는 느린 누수다. idle connection 관리하듯 suspend된 VM을 추적하고 회수해라.
- **런칭 시점 리전이 좁다.** N. Virginia, Ohio, Oregon, Tokyo, Ireland. agent가 다른 데서 돌면 아직 옵션이 아니고, 지금 이걸 전제로 설계하면 나중에 마이그레이션이다.
- **microVM마다 HTTPS URL은 네트워크 모델을 바꾼다.** VM마다 자기 endpoint를 갖는다. 편하긴 한데 ephemeral surface가 확 늘어난다는 뜻이기도 하다. 앞단에 뭘 두고, 로깅하고, 그 URL이 prompt injection이 노릴 수 있는 agent 가시 context로 새 나가지 않게 해라.

## 뭘 해야 하나

코드 생성하는 agent를 돌린다면, 위 네 줄 중 실제로 어디에 있는지 적어둬라. 대부분의 팀은 1번이나 4번이고 microVM 필요 없다. 진짜 필요한 팀, 신뢰 안 되는 코드를 pause/resume 붙여 multi-tenant로 돌리는 팀은, 이제 Firecracker glue 더미 대신 이 일을 위해 만들어진 primitive가 생겼다. 제일 안전해 *보이는* 격리가 아니라, 실제로 필요한 격리를 기준으로 골라라.
