---
title: "Agent가 만든 코드, 어디서 돌릴 건데? Lambda MicroVMs와 격리의 트레이드오프"
date: 2026-07-02T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Lambda MicroVMs는 Firecracker 기반 VM 수준 격리에 최대 8시간 suspend/resume까지 준다. 그럼 언제 이게 필요하고 언제 Code Interpreter 샌드박스나 그냥 컨테이너면 충분한가. 그리고 agent가 짠 코드를 돌릴 때의 가능한 문제점."
categories:
  - AWS
tags:
  - lambda
  - firecracker
  - agentcore
  - security
  - agents
---

Agent를 만들다 보면 모델이 방금 생성한 코드를 실행하고 싶을때가 있다. 근데 LLM이 방금 생성한 코드는 틀렸을 수도 있고, prompt injection이 뚫렸으면 위험할 수도 있다. 그걸 어디서 돌릴건지 생각해야된다.

2026년 6월, AWS가 [Lambda MicroVMs](https://aws-news.com/article/2026-06-22-aws-introduces-lambda-microvms-for-isolated-execution-of-user-and-ai-generated-code)를 발표했다. 딱 이 문제를 위한 compute primitive 솔류션이다. 그동안 대충 괜찮겠지 뭐... 했던 리스크를 표면으로 끌어올리는 것이라 알아둘만하다.

## 원하는 세 가지, 다 가질 순 없다

신뢰 안 되는 코드를 돌릴 때 동시에 갖고 싶은 세가지.

1. **격리(isolation)**. 나쁜 프로세스가 다른 tenant 데이터를 조회 및 내 인프라로 탈출하지 못하게.
2. **속도(speed)**. snippet 하나 돌릴 때마다 agent가 몇 초씩 멈추면 뭔 소용.
3. **상태(state)**. 긴 작업이 멈췄다가 working directory와 메모리를 유지해서 나중에 계속 진행 가능한 경험.

이전에는 이 중 둘만 고를 수 있었다. 공유 컨테이너는 빠르고 상태도 유지되지만 격리가 벽이라기 보단 soft isolation, 즉 namespace다. 요청마다 새로 뜨는 Firecracker microVM은 격리되고 부팅도 빠르지만 이전 상태를 유지 못함. 풀 EC2 VM은 격리·상태 다 되지만 느림.

AWS는 Lambda MicroVMs는 이제 셋 다 가질 수 있다고 주장한다. Lambda 밑에서 돌아가는 것과 똑같은 Firecracker 기술인데(발표문은 월 15조 건 이상의 호출을 근거로 든다), 이번엔 직접 띄울 수 있는 primitive로 노출됐다.

## 실제로 기능들

- **VM 수준 격리**. multi-tenant 실행이지만 내가 virtualization layer를 관리 안 해도 됨.
- **거의 즉각 launch**, 거기에 **최대 8시간** suspend/resume. 이게 재밌고 비용면에서는 무서운 부분. microVM이 멈춘 작업을 유지하다가, 나중에 그대로 재개한다.
- **Dockerfile로 이미지** 만들고, HTTP/2·gRPC·WebSocket 다 되는 **전용 HTTPS URL**로 launch.
- **돌아가는 동안 baseline 과금**, baseline 초과분은 쓴 만큼 청구.

suspend/resume 창이 "그냥 빠른 샌드박스"랑 가장 다른 점으로 보인다. 여러 단계 작업을 돌리다가 사람 승인을 기다린 뒤 이어가는 agent가, 컨테이너를 열어두거나 전체 상태를 디스크에 저장했다가 되살리는 대신, suspend된 microVM에서 그냥 대기하면 됨.

## 결정: 이게 진짜 필요한가?

물론 가벼운 옵션으로 충분한데 microVM 격리를 집어드는 건 오버엔지니어링이다. 판단 기준을 다음과 같다.

```
상황                                          집어들 것
────────────────────────────────────────────────────────────
내가 만들고 통제하는 짧은 순수 연산 snippet     관리형 Code Interpreter 샌드박스.
                                              인프라 짓지 마라.
신뢰 안 되는/모델 생성 코드, multi-tenant,     Lambda MicroVMs.
네트워크나 파일시스템 필요                      이게 만들어진 이유.
사람 승인에서 멈췄다 재개하는 긴 작업          Lambda MicroVMs. suspend/resume 때문.
내 로직, 신뢰되는 코드, 그냥 스케일만          그냥 Lambda나 컨테이너.
                                              격리는 이미 충분.
```

VM 격리가 진짜 필요하다는 시그널은 간단히 "내가 안 쓴 코드를 (리스크있는 코드), tenant isolation을 위해 돌린다"이다. 이외의 경우에는 관리형 샌드박스가 더 싸고 쉽다.

## 체크할 만한 문제점들

- **격리가 입력 처리를 건너뛰어도 된다는건 아니다.** VM 수준 격리는 탈출을 막는다. 근데 agent가 내가 마운트해준 데이터 볼륨에 신나게 `rm -rf`를 날리거나, env var로 넘긴 secret을 유출하는 건 못 막는다. 격리는 blast radius를 가둘 뿐, 그 안에서 뭐가 터질지는 보장하지 못함.
- **8시간 resume 창은 까먹으면 비용 함정이다.** suspend된 microVM도 baseline compute는 계속 과금된다. 작업을 suspend해놓고 agent를 정리 안했다면 각오해야될듯. idle connection 관리하듯 suspend된 VM을 추적하고 회수해라.
- **런칭 시점 리전이 좁다.** N. Virginia, Ohio, Oregon, Tokyo, Ireland. agent가 다른 데서 돌면 아직 옵션 사항이 되지 못함.
- **microVM마다 HTTPS URL은 네트워크 모델을 바꾼다.** VM마다 자기 endpoint를 갖는다. 편하긴 한데 ephemeral surface가 확 늘어난다는 뜻이기도 하다.

## 그래서요?

코드를 생성하는 agent를 돌린다면, 결정하기 전에 우리 use case가 실제로 어디에 속하는지 먼저 따져봐야 한다. 대부분의 경우엔 microVM까지 필요 없다.

microVM이 진짜 필요한 팀은 따로 있다. 신뢰할 수 없는 코드를 실행하고, 거기에 pause/resume을 붙여 multi-tenant로 돌려야 하는 팀이다. 예전에 이런 팀은 Firecracker를 직접 다뤄야 했다. Firecracker는 microVM을 띄우는 저수준 엔진일 뿐이라, 실제 서비스로 돌리려면 그 위에 직접 얹어야 할 게 산더미였다. microVM lifecycle 관리, VM마다 네트워킹 설정, 루트 파일시스템 준비, 스냅샷 기반 pause/resume, multi-tenant 스케줄링까지 — 이 모든 orchestration 코드를 팀이 알아서 짜서 붙이고, 계속 유지보수해야 했다. 부품들을 억지로 이어붙인 접착제(glue) 같은 코드 더미였다.

이제는 그럴 필요가 없다. 바로 이 일을 위해 만들어진 primitive가 생겼기 때문이다. 직접 Firecracker를 엮는 대신, 그 orchestration을 대신 해주는 빌딩블록을 그냥 가져다 쓰면 된다.

핵심은 이거다. 제일 안전해 *보이는* 격리를 고르지 마라. 실제로 필요한 격리 수준을 기준으로 골라라.
