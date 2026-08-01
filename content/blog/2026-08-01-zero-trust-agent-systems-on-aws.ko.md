---
title: "AWS에서 Zero-Trust Agent 시스템 설계하기"
date: 2026-08-01
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "중요도가 높은 agent workload를 위한 hop-by-hop identity, 사용자 위임, authorization, private connectivity, audit와 recovery 설계."
categories:
  - AWS
  - Security
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Zero Trust
  - Security
  - AWS PrivateLink
  - AWS IAM
---

agent가 다른 agent를 호출하는 것은 사용자 trust가 자동으로 이어지는 일이 아니라 distributed-system request다. 모든 hop에는 인증된 workload, 필요한 경우 명시적인 사용자 delegation, resource에서의 authorization과 감사 가능한 결정이 필요하다.

금융과 의료 같은 consequential system에서 특히 중요하지만 compliance label만으로 architecture가 정해지지는 않는다. 실제 data, action, threat와 regulatory requirement에서 시작한다.

## identity 분리

최소 세 principal이 있다. 결과를 요청한 **end user**, 코드를 실행하는 **agent workload**, 접근을 강제하는 **target tool/service**다.

AgentCore Runtime은 IAM SigV4 inbound authentication 또는 설정된 JWT authorization을 지원한다. 모든 호출에 둘이 자동 결합되는 것이 아니다. AgentCore Identity workload identity는 outbound credential을 중개할 수 있다. downstream이 사용자 권한을 알아야 하면 audience가 제한된 검증 가능한 delegation token 또는 문서화된 trusted user identifier를 전달한다. 모델이 만든 JSON의 `tenantId`를 신뢰하지 않는다.

매 tool call에서 workload와 필요한 경우 delegated user가 해당 action/resource를 사용할 수 있는지 승인한다. Gateway나 interceptor가 앞에서 policy를 검사해도 target authorization을 유지한다.

## 권한과 network 최소화

DB credential이나 arbitrary SQL 대신 `get_account_balance(account_id)` 같은 좁은 tool을 제공한다. account 소유를 확인하고 read/write tool, transaction limit, idempotency key, human approval을 분리한다. supervisor의 넓은 role을 specialist에 전달하지 않는다.

component마다 IAM role과 좁은 trust policy를 사용한다. OAuth/API key는 AgentCore Identity 또는 승인된 secret system에 두고 prompt나 memory에 넣지 않는다.

PrivateLink interface endpoint는 VPC에서 지원되는 AgentCore API로 private connectivity를 제공한다. VPC configuration은 Runtime/tool이 private resource에 접근하게 하고 일부 경로는 VPC Lattice를 사용한다. managed control plane과 모든 component가 고객 VPC “안에서 실행”된다는 뜻은 아니다. inbound endpoint, Runtime/tool egress, DNS, security group, NAT와 third-party destination을 각각 그린다.

private path는 authorization이 아니다. TLS, IAM/JWT, application authorization과 data control을 유지한다. public internet이 필요한 browser tool에는 승인된 egress와 더 강한 content isolation이 필요하다.

## memory, threat, test

Memory를 actor/session으로 scope하고 long-term namespace를 설계하되 지원되는 IAM/application policy로 tenant access를 강제한다. prompt, trace, raw event, extracted memory, tool log에 허용할 데이터를 분류하고 retention, deletion, legal hold, KMS, residency, redaction을 정한다.

prompt injection, confused deputy, excessive agency, token replay, cross-tenant ID, 악성 tool output, exfiltration, duplicate financial action, policy service failure와 compromised agent를 threat model에 넣는다.

invalid/expired/wrong-audience token 거부, delegated scope 초과 거부, read-only agent의 write tool 차단, duplicate request의 단일 효과, policy failure 시 fail closed, 의도하지 않은 public egress 차단, secret-free log를 negative test한다.

synthetic read-only에서 시작해 draft, human-approved low-value action 순으로 rollout한다. 사용자·agent별 budget과 rate limit, anomaly alarm, model 재배포 없이 tool authority를 끄는 kill switch를 둔다. user, workload, policy decision, tool, request ID와 결과를 연결하는 audit record를 보존한다.

## 마이그레이션 체크리스트

- 자동 identity propagation 가정을 실제 token·validator sequence diagram으로 바꾼다.
- caller별 SigV4 또는 JWT inbound auth와 outbound exchange를 기록한다.
- target authorization과 narrow tool을 추가한다.
- PrivateLink, VPC egress, Lattice, NAT, public dependency를 정확히 그린다.
- cross-tenant, replay, idempotency, fail-closed test를 추가한다.
- retention, incident revocation, rollback, human approval을 정의한다.

공식 자료 확인일: **2026-08-01**.

## 공식 자료

- [AgentCore inbound/outbound authentication](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-oauth.html)
- [AgentCore Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html)
- [AgentCore VPC와 PrivateLink](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html)
- [NIST Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
