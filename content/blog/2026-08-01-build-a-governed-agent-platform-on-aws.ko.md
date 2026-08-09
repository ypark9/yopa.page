---
title: "AWS에서 Governance를 갖춘 Agent Platform 만들기"
date: 2025-12-20
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2025-12-20-building-agent-factory-with-agentcore.html"
author: Yoonsoo Park
description: "declarative template, 최소 권한, signed artifact, evaluation, approval, observability와 rollback을 갖춘 agent 생성 platform."
categories:
  - AWS
  - Platform Engineering
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - Platform Engineering
  - Security
  - Observability
  - AWS IAM
atlas:
  region: cloud
  object: field-note
  journeys:
    - safe-agent-operations
  evidence: documented
  era: current
---

“agent factory”는 모델에 넓은 IAM 권한을 주고 role, repository, image, runtime을 직접 만들게 한다는 뜻이어서는 안 된다. 자연어는 agent를 제안할 수 있지만 production infrastructure에는 결정론적이고 review 가능한 control plane이 필요하다.

안전한 pattern은 governance가 있는 internal platform이다. agent spec이 PR 또는 signed request가 되고 policy·evaluation gate가 증거를 만든다. agent 자신이 아니라 deployment service가 승인된 template을 적용한다.

```yaml
name: order-status-assistant
owner: commerce-platform
protocol: HTTP
model_policy: approved-low-risk
tools:
  - get_order_status
data_classification: internal
memory:
  enabled: false
network:
  internet_egress: false
human_gate:
  required_for_write_tools: true
budgets:
  max_runtime_seconds: 120
  max_tool_calls: 8
```

schema를 검증하고 알 수 없는 field는 거부한다. tool 이름은 owner, I/O schema, authorization, data class, availability, test endpoint가 있는 승인 catalog에서 해석한다. prompt가 임의 role ARN이나 container image를 요구할 수 없게 한다.

## plane과 identity 분리

**platform control plane**은 spec 검증, CDK/CloudFormation/Terraform 합성, policy check, image build, immutable release와 AgentCore 배포를 맡는다. privileged action은 approval과 audit이 있는 제한된 CI/deploy role로 실행한다.

**agent data plane**은 agent별 execution role로 invocation을 처리한다. IAM role 생성, runtime 변경, image publish, tool self-grant 권한이 없다. AgentCore Identity/Gateway가 outbound credential과 tool을 제공해도 target은 실제 action을 다시 승인한다.

source checkout, image build, infrastructure deploy, runtime execution, break-glass recovery role을 분리한다. 외부 CI는 OIDC로 role을 맡는다. 자동화에 `aws configure`나 개발자 static key를 쓰지 않는다.

## supply chain과 evaluation

고정 base image와 lock dependency로 build한다. SBOM을 만들고 dependency/image scan, image signing, private ECR immutable tag, digest deployment를 적용한다. source commit, build identity, eval result, policy version, image digest, model config와 infrastructure plan을 provenance로 기록한다.

template은 log redaction, encryption, 필요한 private network, bounded egress, tag, retention/deletion, lifecycle, alarm과 budget을 기본 제공한다. 예외에는 owner, 이유, expiry와 추가 test가 필요하다.

model eval 전에 deterministic application test를 실행한다. 대표·adversarial case로 task success, tool argument, authorization, prompt injection, unsafe action, data leak, refusal/escalation, latency와 cost를 확인한다. simple baseline과 비교하고 효과 없이 비용만 늘리는 multi-agent를 승인하지 않는다.

write tool은 sandbox/draft test와 idempotency가 필요하다. multi-tenant는 negative isolation test를 한다. browser/code execution에는 network와 artifact control이 필요하다. 사람은 생성 요약만이 아니라 첨부된 증거로 risk-sensitive release를 승인한다.

## deployment와 rollback

동일 immutable artifact를 환경별 config와 함께 dev→stage→prod로 승격한다. shadow/read-only 후 작은 canary로 시작한다. task success, human correction, tool denial, runtime error, latency, token/tool cost와 identity anomaly를 감시한다.

rollback은 이전 compatible artifact와 config로 traffic을 돌린다. memory/schema/tool contract 변경은 호환성 또는 migration restore plan이 필요하다. 전체 deploy 없이 invocation이나 tool authority를 끄는 kill switch를 둔다.

platform은 반복 팀의 속도와 통제를 높이지만 bottleneck 또는 lowest-common-denominator가 될 수 있다. universal factory 대신 반복되는 두세 pattern부터 시작한다. 초기 experiment는 팀 직접 배포가 나을 수 있지만 production 권한 전에는 같은 identity, test, cost boundary가 필요하다.

## 마이그레이션 체크리스트

- builder agent에서 infrastructure mutation 권한을 제거한다.
- 원하는 행동을 versioned validated spec으로 바꾼다.
- narrow role을 가진 runtime/tool template을 만든다.
- CI에서 immutable artifact를 build/sign/scan하고 infrastructure plan을 리뷰한다.
- deterministic, model, security, isolation, cost, recovery gate를 추가한다.
- release approval과 runtime identity를 분리한다.
- canary, provenance, alarm, budget, kill switch, rollback을 둔다.
- low-risk agent 하나로 lead time과 escaped defect를 측정한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime.html)
- [Amazon ECR image tag immutability](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html)
- [AWS Signer](https://docs.aws.amazon.com/signer/latest/developerguide/Welcome.html)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
