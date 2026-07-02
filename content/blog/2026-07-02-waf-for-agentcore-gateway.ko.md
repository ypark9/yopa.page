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

Agent를 바깥에 노출할 때 무서운 건 모델이 아니다. 정문이다. 요청 하나를 수십 개의 MCP tool과 memory store, downstream integration으로 펼쳐주는 gateway야말로 공격자 입장에서 레버리지가 가장 큰 지점이다. 여기서 잘못된 요청이나 악의적인 요청 하나가 뒤에 있는 모든 곳에 침투 가능하다.

2026년 6월, AWS가 [Amazon Bedrock AgentCore Gateway용 AWS WAF를 GA](https://aws-news.com/article/2026-06-29-aws-waf-adds-support-for-amazon-bedrock-agentcore-gateway)로 출시했다. 작은 발표지만 아키텍처적 존재감은 크다. agentic 워크로드의 방벽이 이제 원래 있어야 할 자리(gateway)에 놓이게 됐다.

## 왜 gateway가 맞는 통제 지점인가

AgentCore Gateway는 MCP의 정문이다. caller가 gateway를 치면, gateway가 뒤에 있는 tool·agent·integration으로 요청을 라우팅한다. 바로 이 fan-out 때문에 gateway가 보호하기 정확하게 좋은 자리가 된다.

- **설정 하나로 전부 커버한다.** gateway 레벨에서 WAF를 한 번 연결하면 downstream tool과 integration이 한꺼번에 보호된다. tool마다 WAF를 붙일 필요가 없다.
- **abuse가 몰리는 지점이다.** rate abuse, bot 트래픽, known-bad payload가 전부 같은 진입점으로 모인다. 뒤에 component 하나하나 지키지 말고 대문을 지켜라.
- **trust boundary다.** gateway 바깥은 전부 신뢰할 수 없고, 그 안에 내가 만든 서비스들.

예전엔 이 경계를 지키려면 gateway 앞에 커스텀 인프라가 필요했다. 근데 이제는 관리형 연결(association) 하나면 된다.

## 실제로 켤 수 있는 것

발표문이 나열한 구체적인 기능을, 각각 무엇을 막는지로 매핑하면 이렇다.

```
통제                              막는 것
──────────────────────────────────────────────────────────
IP 기반 접근 통제                 거래하지 않는 지역의 caller
Rate 기반 rule                    한 클라이언트가 gateway를 두들기는 것 (비용+DoS)
Managed Rule Group: Bot Control   자동 스크래핑·abuse 트래픽
Managed Rule Group: Known Bad     공개된 exploit 시그니처에 맞는 payload
Inputs
WAF protection packs              큐레이션된 번들을 일관되게 적용
```

WAF와 AgentCore Gateway가 둘 다 지원되는 모든 리전에서 쓸 수 있다. 일부 런칭과 달리 몇몇 리전에만 묶여 있지 않다.

## 결정 트리: 어떤 rule을, 언제

다 켜는 게 목표가 아니다. rule마다 false-positive 비용이 있고, agent 트래픽은 일반 웹 트래픽보다 훨씬 복잡하다. 나라면 이 순서로 간다.

1. **Rate 기반 rule부터, 무조건.** 제일 싸고 가치가 큰 통제다. rate limit 없는 agent gateway는 보안 문제 이전에 비용 사고가 터질 수 있다. 진짜 클라이언트한테는 넉넉하되, bad actor를 대비해서 상한을 잡아라.
2. **caller 집합을 알 수 있으면 IP 통제.** 내부·파트너 전용 gateway라면 org 대역을 allowlist로 잡아라. public gateway라면 allowlist는 필요 없음.
3. **Known Bad Inputs는 먼저 count 모드로.** block이 아니라 count로 켜고 일주일 지켜봐라. agent payload(큰 JSON, tool schema, embedded code)는 웹 폼용으로 만든 시그니처를 건드릴 수 있다. false-positive 비율을 확인한 뒤에만 block으로 promotion하기.
4. **Bot Control은 마지막에, 조심해서.** 정상적인 agent-to-agent(A2A) 트래픽은 bot처럼 보일 수 있다. 실제로 bot이니까. gateway가 다른 agent를 서비스한다면 Bot Control이 내 caller를 쏠 수 있다. scope를 좁히거나 아예 꺼둬라.

여기서 공통적으로 나오는 내용이 있다. agent gateway가 사람보다 다른 machine에서 많이 쓰일수록, "bot을 막아라"라는 것에 단점이 장점보다 커지기 시작한다. 웹 WAF는 사람은 좋고 bot은 나쁘다고 가정한다. Agent WAF는 그렇게 가정할 수 없다.

## 생각해볼것

- **WAF는 방벽이지 authorization이 아니다.** abusive한 트래픽의 형태는 막지만, 인증된 caller가 특정 tool을 호출할 자격이 있는지는 정하지 않는다. gateway에는 진짜 authz(scoped role, OAuth, tool 레벨 권한)가 여전히 필요하다. WAF는 앞에, authz는 안에.
- **모든 managed rule은 block 전에 count 모드로.** WAF에서 가장 흔한 자책성 장애는, managed group을 block 모드로 켜놓고 이후에 정상 트래픽을 잡아먹고 있었다는 걸 발견하는 것이다. agent payload는 이걸 더 악화시킨다. count하고, 관찰하고, 그다음 block해라.
- **rate limit은 IP당이 아니라 클라이언트당으로 키를 잡아야 한다.** 많은 agent가 NAT나 공유 egress를 거쳐 호출하기 때문에, IP당 rate limiting은 서로 다른 tenant를 한 덩어리로 묶어버릴 수 있다. auth identity로 키를 잡을 수 있다면 적용하는게 좋다.
- **WAF를 유일한 레이어로 두지 마라.** gateway WAF는 여러 겹 중 하나일 뿐이다. downstream tool에는 여전히 입력 검증과 least privilege가 절대적으로 필요하다. 안쪽은 안전하다고 가정하는 방벽 보안은, bypass 하나가 곧 전부를 뚫는 경로가 된다.

## 뭘 해야 하나

내 계정 바깥에서 닿을 수 있는 곳에 AgentCore Gateway를 운영 중이라면, WAF를 붙이고 오늘 바로 rate 기반 rule부터 시작하길 추천한다. 그 통제 하나만으로도 가장 일어나기 쉬운 사고, 즉 폭주하거나 abusive한 클라이언트를 막을 수 있다. 나머지는 count 모드로 결정 트리를 이용해서 결정. 명심할 점은 WAF 하나 붙였다고 gateway 보안이 끝났다고 착각하면 안됨. WAF는 문지기일 뿐, 내부 권한 통제(authz)는 여전히 우리의 몫.
