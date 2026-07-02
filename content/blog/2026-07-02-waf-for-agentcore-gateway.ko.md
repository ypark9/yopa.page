---
title: "AgentCore Gateway에 WAF가 붙었다: MCP 정문에 방벽 세우기"
date: 2026-07-02T09:05:00-04:00
author: Yoonsoo Park
description: "AWS WAF가 이제 Amazon Bedrock AgentCore Gateway를 보호한다. Gateway 레벨 설정 하나로 downstream tool, agent, integration 전부 커버된다. 왜 MCP gateway가 방벽을 세울 정확한 자리인지, 그리고 어떤 rule을 실제로 켜야 하는지 정리한다."
categories:
  - AWS
tags:
  - waf
  - agentcore
  - security
  - mcp
  - bedrock
---

Agent를 바깥에 노출하면, 무서운 건 모델이 아니다. 정문이다. 요청 하나를 수십 개 MCP tool, memory store, downstream integration으로 펼쳐주는 gateway가 공격자가 칠 수 있는 가장 레버리지 큰 지점이다. 거기서 잘못됐거나 악의적인 요청 하나가 뒤에 있는 전부에 닿는다.

2026년 6월, AWS가 [Amazon Bedrock AgentCore Gateway용 AWS WAF를 GA](https://aws-news.com/article/2026-06-29-aws-waf-adds-support-for-amazon-bedrock-agentcore-gateway)로 냈다. 작은 발표인데 아키텍처적 함의는 크다. agentic 워크로드의 방벽이 이제 있어야 할 자리인 gateway에 놓인다.

## 왜 gateway가 맞는 통제 지점인가

AgentCore Gateway는 MCP 정문이다. caller가 gateway를 치면, gateway가 뒤에 있는 tool·agent·integration으로 라우팅한다. 이 fan-out이 바로 여기가 보호를 강제할 정확한 자리인 이유다.

- **설정 하나로 전부 커버.** Gateway 레벨 WAF association 하나가 downstream tool·integration 전부를 한 번에 보호한다. tool마다 WAF를 붙일 필요 없다.
- **abuse가 몰리는 지점이다.** rate abuse, bot 트래픽, known-bad payload가 전부 같은 진입점으로 깔때기처럼 모인다. 컵마다 지키지 말고 깔때기를 지켜라.
- **trust boundary다.** gateway 상류는 전부 신뢰 안 됨, 하류는 내가 만든 것. 그게 방벽의 정의다.

이전엔 이 경계를 지키려면 gateway 앞에 커스텀 인프라를 세워야 했다. 이제는 관리형 association이다.

## 실제로 켤 수 있는 것

발표문이 나열한 구체적 기능. 각각 뭘 막는지로 매핑하면.

```
통제                              막는 것
──────────────────────────────────────────────────────────
IP 기반 접근 통제                 거래 안 하는 지역의 caller
Rate 기반 rule                    한 클라이언트가 gateway를 두들김 (비용+DoS)
Managed Rule Group: Bot Control   자동 스크래핑·abuse 트래픽
Managed Rule Group: Known Bad     공개된 exploit 시그니처에 맞는 payload
Inputs
WAF protection packs              큐레이션된 번들을 일관되게 적용
```

WAF와 AgentCore Gateway 둘 다 지원되는 모든 리전에서 쓸 수 있어서, 일부 런칭과 달리 몇 개 리전에만 묶여 있지 않다.

## 결정 트리: 어떤 rule을, 언제

다 켜는 게 목표가 아니다. rule마다 false-positive 비용이 있고, agent 트래픽은 일반 웹 트래픽보다 훨씬 이상하다. 나라면 이 순서로 간다.

1. **Rate 기반 rule 먼저, 무조건.** 제일 싸고 가치 큰 통제. rate limit 없는 agent gateway는 보안 이전에 이미 터질 비용 사고다. 진짜 클라이언트한텐 넉넉하고 폭주 루프한텐 치명적인 상한을 잡아라.
2. **caller 집합을 알 수 있으면 IP 통제.** 내부·파트너 전용 gateway면 org 대역을 allowlist. public gateway면 allowlist 건너뛰어라, 페이지 알림만 울린다.
3. **Known Bad Inputs, 먼저 count 모드로.** block 말고 count로 켜고 일주일 지켜봐라. agent payload(큰 JSON, tool schema, embedded code)는 웹 폼용으로 짠 시그니처를 건드릴 수 있다. false-positive 비율 확인한 뒤에만 block으로 승격.
4. **Bot Control 마지막에, 조심해서.** 정상적인 agent-to-agent(A2A) 트래픽은 bot처럼 보일 수 있다, 실제로 bot이니까. gateway가 다른 agent를 서비스하면 Bot Control이 내 caller를 쏠 수 있다. scope를 좁히거나 꺼둬라.

주제는 이거다. agent gateway가 다른 기계에 많이 쓰일수록 "bot 막아" 본능이 나한테 불리하게 작동한다. 웹 WAF는 사람은 좋고 bot은 나쁘다고 가정한다. Agent WAF는 그럴 수 없다.

## 함정

- **WAF는 방벽이지 authorization이 아니다.** abusive한 트래픽 형태를 막는다. 인증된 caller가 특정 tool을 호출할 자격이 있는지는 안 정한다. gateway에 진짜 authz(scoped role, OAuth, tool 레벨 권한)는 여전히 필요하다. WAF는 앞에, authz는 안에.
- **모든 managed rule은 block 전에 count 모드.** WAF 자해 장애 1순위가 managed group을 block 모드로 켜놓고 정상 트래픽을 잡아먹는 걸 발견하는 거다. agent payload가 이걸 더 악화시킨다. count, 관찰, 그다음 block.
- **rate limit은 IP당이 아니라 클라이언트당 키가 필요하다.** 많은 agent가 NAT나 공유 egress로 호출해서, IP당 rate limiting은 서로 다른 tenant를 한 덩어리로 묶을 수 있다. auth identity로 키를 잡을 수 있으면 그렇게 해라.
- **WAF를 유일한 레이어로 만들지 마라.** gateway WAF는 링 하나다. downstream tool은 여전히 입력 검증과 least privilege가 필요하다. 안쪽이 안전하다고 가정하는 방벽 보안이, bypass 하나가 전부가 되는 경로다.

## 뭘 해야 하나

내 계정 바깥 뭔가가 닿을 수 있는 AgentCore Gateway를 돌린다면, WAF를 붙이고 오늘 rate 기반 rule부터 시작해라. 그 통제 하나만으로도 가장 가능성 높은 사고(폭주하거나 abusive한 클라이언트)를 막는다. 나머지는 count 모드로 트리를 걸어가라. 그리고 프레이밍을 똑바로 유지해라. WAF는 정문에 닿는 트래픽의 *형태*를 지킨다. gateway 안에서 누가 어느 문을 열 수 있는지 정하는 걸 대신해주진 않는다.
