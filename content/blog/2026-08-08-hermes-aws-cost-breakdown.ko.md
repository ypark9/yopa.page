---
title: "Hermes Agent를 AWS에 배포하면 한 달에 얼마가 들까?"
date: 2026-08-08
author: Yoonsoo Park
description: "개인용 Hermes Agent를 AWS ECS Fargate에 한 달 남짓 운영하며 실제로 발생한 NAT Gateway, Fargate, EFS throughput과 기타 비용을 Cost Explorer로 분해했다."
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

Hermes Agent를 AWS에 올릴 때 처음 계산한 것은 ECS task와 LLM 비용이었다. 실제로 한 달 남짓 운영해 보니 그 계산은 너무 단순했다. 개인 agent 하나를 위해 계속 켜 둔 NAT Gateway와 EFS throughput이 Fargate와 비슷한 금액을 만들었다.

이 글은 “Hermes를 AWS에 배포하면 한 달에 얼마가 드는가?”라는 질문에 대한 한 번의 실제 측정이다. 모든 계정과 리전에 그대로 적용되는 가격표가 아니라, 내가 사용한 구성과 기간의 Cost Explorer 결과다.

## 측정한 구성

측정한 AWS 구성은 다음과 같다.

- ECS Fargate ARM task 하나, 1 vCPU와 2 GiB memory
- private subnet 두 개와 public NAT Gateway 하나
- Hermes 상태를 저장하는 암호화된 EFS
- ECR에 쌓인 Hermes 이미지들
- Slack, GitHub, provider credential을 보관한 Secrets Manager secret 세 개
- S3 knowledge/context bucket과 CloudWatch Logs

Hermes는 Slack Socket Mode를 사용했기 때문에 public inbound endpoint는 없었다. 그래도 private subnet에서 Slack과 provider API로 나가려면 NAT Gateway가 필요했다. 이 차이가 비용을 이해하는 데 중요하다. public endpoint가 없다는 것과 outbound 네트워크가 무료라는 것은 별개의 이야기다.

## 실제 사용료: 약 $108.9

측정 기간은 2026년 7월 4일부터 8월 8일까지다. Hermes가 실제로 동작한 시간은 약 833시간이었다. 아래 금액은 Cost Explorer의 `Usage` line item에서 credit을 적용하기 전의 on-demand usage cost를 읽어 센트 단위로 반올림한 값이다.

| 항목 | 사용량 | 비용 |
|---|---:|---:|
| NAT Gateway 시간 및 처리량 | 833시간, 약 12.3 GB | 약 $38.04 |
| ECS Fargate ARM | 833 vCPU-hours, 1,664 GB-hours | 약 $32.92 |
| EFS Elastic Throughput 데이터 접근 | 약 730.5 GB | 약 $31.97 |
| EFS 저장 공간 | 평균 1 GB 미만 | 약 $0.14 |
| NAT용 public IPv4 | 약 833시간 | 약 $4.17 |
| Secrets Manager | secret 3개 | 약 $1.32 |
| ECR 저장 공간 | 기간 중 누적 사용량 | 약 $0.34 |
| EFS backup | 1 GB 미만 | 약 $0.02 |
| **합계** |  | **약 $108.9** |

S3와 CloudWatch Logs는 이 workload 규모에서는 사실상 반올림 오차 수준이었다. LLM 비용은 이 표에 포함하지 않았다. 당시 Hermes의 provider는 OpenAI Codex였고 AWS Bedrock usage는 $0이었다. OpenAI 구독이나 외부 provider 비용을 AWS 인프라 비용과 섞으면 비교가 어려워진다.

## 청구서에는 왜 거의 $0로 보였나

내 AWS 계정에는 이 기간 promotional credit이 있었다. 계정 전체 Usage는 약 $113.22였고 거의 같은 금액의 credit이 적용되어 실제 현금 청구는 거의 $0이었다.

그렇다고 이 구성이 무료였던 것은 아니다. 더 정확한 표현은 **개인 agent 하나가 한 달 남짓 동안 약 $109의 AWS credit을 소비했다**는 것이다. Credit이 끝난 다음 달부터는 같은 리소스가 정상 청구된다. 무료 tier나 credit이 있는 계정에서 실험할 때도 할인 전 usage를 따로 기록해야 하는 이유다.

## 가장 놀라웠던 EFS throughput

마지막 측정에서 EFS에 저장된 데이터는 약 924 MB였다. 그런데 EFS Elastic Throughput data access는 약 730 GB였다. 저장 용량만 보고 EFS 비용을 예측했다면 이 차이를 놓쳤을 것이다.

Hermes가 SQLite와 상태 파일을 얼마나 자주 읽고 썼는지 별도 tracing을 하지 않았기 때문에 특정 동작 하나를 원인으로 단정하지는 않는다. 다만 작은 파일 시스템도 반복적인 I/O 패턴에서는 throughput 비용이 저장 비용보다 훨씬 커질 수 있다는 사실은 실제 청구 내역으로 확인했다.

## NAT Gateway는 트래픽이 적어도 돈이 든다

Hermes에는 public inbound endpoint가 없었다. 하지만 private subnet에서 Slack과 provider API로 나가기 위해 NAT Gateway를 24시간 유지했다. 트래픽이 적어도 gateway 시간 요금은 계속 발생한다.

이번 기간에는 NAT 처리량 요금보다 고정 시간 요금이 압도적으로 컸다. 개인용 agent라면 public subnet의 다른 안전한 설계, NAT instance, VPC endpoint, 또는 이미 운영 중인 홈 서버를 검토할 이유가 생긴다. 어떤 대안을 선택할지는 보안 요구와 운영 부담까지 함께 비교해야 한다.

## 다음에 먼저 계산할 것

이 구성을 다시 예산화한다면 다음 네 가지부터 계산할 것이다.

1. 항상 켜진 task의 vCPU와 memory 시간
2. private subnet outbound를 위한 NAT와 public IPv4 고정비
3. 파일 시스템의 저장량뿐 아니라 throughput mode와 data access
4. credit이 사라진 뒤의 할인 전 비용

[AWS VPC pricing](https://aws.amazon.com/vpc/pricing/), [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/), [Amazon EFS pricing](https://aws.amazon.com/efs/pricing/), [AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/)에서 현재 단가를 확인할 수 있다. 이 글의 숫자는 내 리전, 실행 시간과 I/O 패턴에 따른 실제 사례이지 모든 Hermes 배포의 고정 가격은 아니다.

이 비용을 확인한 뒤 Hermes를 Synology로 옮긴 과정은 별도 글로 정리했다: [Hermes를 AWS ECS에서 Synology로 옮기며 배운 데이터 무손실 마이그레이션](/blog/migrate-hermes-from-aws-to-synology/).
