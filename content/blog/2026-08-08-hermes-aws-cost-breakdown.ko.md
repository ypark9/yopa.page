---
title: "Hermes Agent를 AWS에 배포하면 한 달에 얼마가 들까?"
date: 2026-08-08
author: Yoonsoo Park
description: "개인용 Hermes Agent를 AWS ECS Fargate에서 한 달 남짓 운영한 실제 비용 기록. NAT Gateway, Fargate, EFS 처리량이 각각 얼마나 나왔는지 Cost Explorer로 확인했다."
categories:
  - AWS
  - Agentic AI
  - FinOps
tags:
  - Hermes Agent
  - Amazon ECS
  - Amazon EFS
  - FinOps
  - Self-Hosting
---

Hermes Agent를 AWS에 처음 올릴 때는 ECS Fargate 비용과 LLM 사용료만 대충 계산했다. 그런데 한 달 넘게 돌려 보니 생각보다 큰 금액이 다른 곳에서 나왔다. 24시간 켜 둔 NAT Gateway와 EFS 처리량이 Fargate 비용만큼이나 컸다.

결론부터 말하면, 개인용 agent 하나를 약 833시간 운영하는 데 할인 전 기준으로 약 $108.9가 들었다. 이 글은 그때의 Cost Explorer 기록을 풀어 쓴 운영 회고다. 리전, 실행 시간, 파일 접근 패턴에 따라 결과가 달라지므로 누구에게나 적용되는 가격표로 읽으면 안 된다.

## 측정한 구성

당시 구성은 이랬다.

- ARM 기반 ECS Fargate 태스크 1개: 1 vCPU, 메모리 2 GiB
- 프라이빗 서브넷 2개와 퍼블릭 NAT Gateway 1개
- Hermes의 대화·인증 상태를 저장하는 암호화 EFS
- Hermes 이미지를 보관한 ECR
- Slack, GitHub, provider 인증 정보를 담은 Secrets Manager secret 3개
- context를 보관한 S3 bucket과 CloudWatch Logs

Hermes는 Slack Socket Mode를 썼기 때문에 외부에서 들어오는 공개 endpoint는 없었다. 그렇다고 네트워크 비용이 없어지는 것은 아니다. 프라이빗 서브넷의 컨테이너가 Slack과 모델 provider API에 나가려면 NAT Gateway가 필요했고, 그 gateway는 트래픽이 거의 없어도 계속 과금된다.

## 실제 사용료: 약 $108.9

측정 기간은 2026년 7월 4일부터 8월 8일까지였다. 그 사이 Hermes 태스크가 실제로 떠 있던 시간은 약 833시간이다. 아래 표는 Cost Explorer에서 credit을 빼기 전 `Usage` 항목만 추려 센트 단위로 반올림한 값이다.

| 항목 | 사용량 | 비용 |
|---|---:|---:|
| NAT Gateway 시간 및 처리량 | 833시간, 약 12.3 GB | 약 $38.04 |
| ECS Fargate ARM | 833 vCPU-hours, 1,664 GB-hours | 약 $32.92 |
| EFS Elastic Throughput 데이터 접근 | 약 730.5 GB | 약 $31.97 |
| EFS 저장 공간 | 평균 1 GB 미만 | 약 $0.14 |
| NAT에 연결한 public IPv4 | 약 833시간 | 약 $4.17 |
| Secrets Manager | secret 3개 | 약 $1.32 |
| ECR 저장 공간 | 기간 중 누적 사용량 | 약 $0.34 |
| EFS backup | 1 GB 미만 | 약 $0.02 |
| **합계** |  | **약 $108.9** |

S3와 CloudWatch Logs는 이 정도 규모에서는 반올림 오차에 가까웠다. LLM 비용은 표에서 뺐다. 이때 Hermes는 OpenAI Codex provider를 사용했고 AWS Bedrock 사용료는 $0이었다. OpenAI 구독료처럼 AWS 밖에서 나가는 비용까지 섞으면 인프라 비용을 비교하기 어려워진다.

## 청구서에는 왜 거의 $0로 보였나

마침 이 계정에는 promotional credit이 남아 있었다. 같은 기간 계정 전체 사용료는 약 $113.22였고, 거의 같은 액수의 credit이 적용돼 실제 카드 청구액은 $0에 가까웠다.

하지만 무료로 쓴 것은 아니다. 정확히는 **개인 agent 하나가 한 달 남짓 동안 약 $109어치의 AWS credit을 쓴 것**이다. credit이 끝나는 다음 달부터는 같은 구성이 그대로 청구된다. 그래서 무료 체험이나 credit을 쓰는 동안에도 할인 전 사용료를 따로 봐야 한다.

## 가장 놀라웠던 EFS throughput

마지막에 확인한 EFS 저장량은 약 924 MB였다. 반면 Elastic Throughput으로 집계된 데이터 접근량은 약 730 GB였다. 저장된 파일은 1 GB도 안 되는데, 읽고 쓴 데이터는 그보다 수백 배 많았던 셈이다.

어떤 Hermes 동작이 이 수치를 만들었는지는 별도로 추적하지 않았다. SQLite나 상태 파일 접근 중 하나를 범인으로 지목할 근거도 없다. 다만 파일 시스템 비용을 계산할 때 저장 용량만 보면 틀릴 수 있다는 것은 분명해졌다. 작아 보이는 데이터도 자주 읽고 쓰면 처리량 비용이 저장 비용을 훌쩍 넘어간다.

## NAT Gateway는 트래픽이 적어도 돈이 든다

NAT Gateway도 같은 맥락이다. 이 서비스에는 공개 endpoint가 없었지만, 프라이빗 서브넷에서 Slack과 provider API로 나가야 했다. 그래서 NAT Gateway를 하루 24시간 켜 두었고, 트래픽이 적은 시간에도 시간당 요금은 계속 붙었다.

이번에는 NAT가 처리한 데이터보다 gateway를 켜 둔 시간이 훨씬 비쌌다. 개인용 agent라면 보안 요구를 해치지 않는 범위에서 public subnet 설계, NAT instance, VPC endpoint, 이미 가동 중인 홈 서버를 함께 비교해 볼 만하다. 다만 저렴한 선택이 항상 운영하기 쉬운 선택은 아니다.

## 다음에 먼저 계산할 것

다시 예산을 잡는다면 아래 네 가지부터 계산할 것이다.

1. 계속 실행할 태스크의 vCPU와 메모리 시간
2. 프라이빗 서브넷의 외부 연결을 위한 NAT와 public IPv4 고정비
3. 파일 시스템 저장량뿐 아니라 throughput mode와 데이터 접근량
4. credit이 사라진 뒤에도 감당할 수 있는 할인 전 비용

[AWS VPC pricing](https://aws.amazon.com/vpc/pricing/), [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/), [Amazon EFS pricing](https://aws.amazon.com/efs/pricing/), [AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/)에서 현재 단가를 확인할 수 있다. 이 글의 숫자는 내 리전, 실행 시간, I/O 패턴에서 나온 실제 기록일 뿐 모든 Hermes 배포의 정답은 아니다.

비용을 확인한 뒤 Hermes를 Synology로 옮긴 과정은 별도 글에 정리했다: [Hermes를 AWS ECS에서 Synology로 옮기며 배운 데이터 무손실 마이그레이션](/blog/migrate-hermes-from-aws-to-synology/).
