---
title: "AgentCore Gateway에 MCP 클라이언트 붙일 때, OAuth Auth Code Flow가 진짜 필요한 순간"
date: 2026-06-03T11:45:00-04:00
author: Yoonsoo Park
description: "AWS가 MCP 클라이언트와 AgentCore Gateway 사이에 OAuth 2.0 authorization code flow를 붙이는 가이드를 냈다. 튜토리얼 자체는 무난한데, 정작 중요한 질문 — '언제 M2M으로 안 되고 three-legged OAuth가 필요한가, 잘못 고르면 뭐가 깨지나' — 은 다루지 않는다. 그 결정 트리를 정리한다."
categories:
  - AI
  - Security
tags:
  - agentcore
  - mcp
  - oauth
  - authentication
  - aws
---

AWS가 [블로그 글](https://aws.amazon.com/blogs/machine-learning/building-a-secure-auth-code-flow-setup-using-agentcore-gateway-with-mcp-clients/)을 하나 올렸다. MCP 클라이언트(Cursor, Claude Desktop, 자체 구현 등)와 Bedrock AgentCore Gateway를 OAuth 2.0 authorization code flow로 잇는 방법. 튜토리얼은 깔끔하다. 다만 **"언제 진짜로 three-legged OAuth가 필요한가, client credentials로 때우면 뭐가 깨지나"** — 이 결정 부분은 빠져 있다. 내부 tool을 외부 MCP 클라이언트한테 노출할 시나리오를 그리다 보면 가장 먼저 막히는 지점인데도.

이 글은 튜토리얼이 아니라 **결정 트리**다.

## 구성 요약

AgentCore Gateway는 MCP 클라이언트와 Lambda tool 사이에 끼는 resource server다.

```
MCP 클라이언트 (Cursor / Claude Desktop / custom)
        │  (MCP over HTTP+SSE, bearer token 포함)
        ▼
AgentCore Gateway   ──►   Cognito / Okta / Auth0 (토큰 검증)
        │
        ▼  (signed invoke)
Lambda tool ──►  DynamoDB / Salesforce / Jira / 무엇이든
```

Gateway가 OAuth resource server, IdP가 토큰 발급, MCP 클라이언트가 토큰 들고 호출. 토큰 종류는 두 가지.

1. **Client credentials (M2M)** — MCP 클라이언트 자체가 service account로 인증. 토큰 하나, 사용자 정체성 없음, per-user scoping 없음.
2. **Authorization code + PKCE** — 진짜 사람이 브라우저 redirect로 한 번 로그인하고, MCP 클라이언트가 access + refresh 토큰을 들고 다니며 tool 호출마다 access 토큰을 제시.

AWS 블로그가 다루는 건 2번. 왜 굳이 2번까지 가야 하는지가 핵심.

## Client credentials로 충분한 경우

먼저 솔직하자. 아래가 다 참이면 auth code flow 안 써도 된다.

- Tool이 다루는 데이터가 **user-scoped가 아님** (공용 KB, 내부 메트릭 집계, read-only 카탈로그).
- 호출자가 전부 신뢰 도메인 안 (사내 agent platform이지, 서드파티 MCP 마켓플레이스가 아님).
- 감사 로그에 "어떤 인간이 호출했는지" 남길 필요 없음.

그러면 MCP 클라이언트 종류별로 client_id + client_secret 하나씩 발급하고, secret rotate, scope 좁게, 끝. 멀쩡하다.

## Auth code flow가 진짜 필요한 경우

아래 중 하나라도 해당되는 순간 M2M은 무너진다.

| 트리거 | M2M이 깨지는 이유 |
|---------|------------------|
| Tool이 **per-user 데이터** 조회 (이 사용자의 Salesforce 레코드, 이 사용자의 Jira) | 공용 service account는 모든 데이터 보거나(과권한) 아무것도 못 보거나(저권한). 중간이 없음. 만들려면 tool 안에서 auth를 직접 다시 짜야 함. |
| **Multi-tenant SaaS** 통합 | Tool이 사용자 자격으로 downstream API를 호출해야 함. 안 그러면 사용자별 자격증명을 tool 쪽에 저장하고 흉내 내야 하는데, 이게 바로 OAuth가 없애려던 안티패턴. |
| **감사/컴플라이언스**가 "누가 이 tool을 호출했나" 요구 | 토큰의 `sub` claim이 곧 감사 trail. M2M 토큰의 `sub`은 service ID라 인간이 아님. |
| **동의(consent) 화면**이 제품 요구사항 | "이 MCP 클라이언트가 당신의 X를 읽으려 합니다" 화면을 사용자한테 보여주는 건 auth code flow에서만 가능. |

내부 agent가 platform 작업을 도는 tool gateway면 M2M으로 충분. 사용자가 자기 Cursor를 우리 gateway에 꽂아서 자기 권한으로 작업하는 시나리오면 auth code flow 필수. 어중간한 절충안은 결국 자작 auth 시스템으로 변한다.

## 튜토리얼이 짧게 다루고 넘어간 세 가지

해피 패스 말고 진짜 함정.

### 1. MCP transport와 브라우저 redirect는 자연스럽게 안 섞인다

OAuth auth code flow는 브라우저를 전제한다. 그런데 MCP 클라이언트는 보통 **stdio** (Cursor, Claude Desktop) 또는 **SSE** transport. Stdio는 브라우저가 없고, SSE는 브라우저가 있어도 MCP 서버가 그걸 운전하지 않는다.

MCP spec의 답: **클라이언트가** 토큰 없으면 authorization endpoint를 브라우저로 직접 열고, redirect를 캡처하고, code 교환하고, 결과를 저장한다. Gateway는 브라우저를 안 건드린다. 동작은 하는데, 의미는:

- 모든 MCP 클라이언트가 자기 token 캐시와 refresh 로직을 따로 구현. Cursor가 Claude Desktop이랑 다르고, 너의 custom 클라이언트도 또 다름.
- Desktop 클라이언트의 `redirect_uri`는 사실상 `http://localhost:<random-port>`만 현실적. IdP에 wildcard나 넉넉한 range를 등록하든지, 아니면 새 port 나올 때마다 whitelist하는 삶을 산다.

### 2. Dynamic Client Registration은 약속이지 현실이 아니다

[RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591). MCP 클라이언트가 IdP에 self-register해서 사용자가 `client_id`를 복붙할 필요 없게 하자는 표준. MCP 0.6이 참조함. 그런데 **Cognito는 미지원.** Okta는 enterprise plan에서만. Auth0는 tenant별 옵션.

현실적 결론: 당분간 IdP에 client를 미리 만들어 놓고, `client_id`를 사용자한테 알려주고, MCP 클라이언트 config에 붙여넣게 한다. Dynamic registration은 IdP가 따라올 때까지 없는 셈 친다.

### 3. 토큰 수명 ≠ agent 세션 수명

Long-running agent 세션은 몇 시간씩 간다. 기본 access token은 60분. Auth code flow가 refresh token을 주긴 하는데:

- **Stdio MCP에서 refresh는 자명하지 않음** — 클라이언트가 gateway의 401을 감지하고, refresh 돌리고, 재시도. 대부분의 stock MCP 클라이언트 라이브러리는 아직 자동으로 안 해줌.
- **Refresh token은 bearer secret.** OS keychain에 저장 (macOS Keychain, Windows Credential Manager). `~/.config/` 밑 JSON 평문 절대 X. Cursor와 Claude Desktop은 keychain 씀. 자체 클라이언트도 그래야 함.
- **Idle 만료 vs absolute 만료** 정책: 4시간 agent 작업은 살아남되 영원히 살진 않게. 30일 absolute, 24시간 idle 정도가 시작점.

## Scope 설계 — 다들 과소평가하는 부분

방향 두 가지.

**Per-tool scope**: `tool:read-account`, `tool:create-opportunity`, `tool:run-report`. Fine-grained, 감사 친화적. 하지만 consent 화면이 체크박스 벽이 되고, 47번째 scope 이름 짓다가 후회.

**Domain scope**: `crm:read`, `crm:write`, `analytics:read`. 거칠고, consent 화면이 사람이 읽을 만함. 대신 scope 하나가 tool 묶음을 통째로 열어서 lateral movement 위험.

정답은 보통 **consent UX는 domain scope, 실제 권한 체크는 gateway 안에서 tool 단위로** 하는 하이브리드. Access token이 문은 열어주고, gateway 정책이 어느 Lambda를 invoke할지 결정. 사용자는 체크박스 5개를 보고, 운영은 fine-grained 통제를 유지.

## 실제로 본 함정 / 보일 함정

- **하나의 Cognito resource server에 M2M과 user 클라이언트 섞기.** 동작은 함. 근데 scope가 서로 오염되고, consent 화면에 M2M-only scope가 사람한테 노출됨. 처음부터 resource server 두 개로 분리할 것.
- **Non-prod에서 `http://localhost` redirect_uri 등록 빠뜨리기.** Cognito/Okta/Auth0 다 등록 가능. 안 해두면 로컬 dev가 깨지고, 에러 메시지는 엉뚱한 레이어를 가리킴.
- **IdP의 `aud` claim 기본값을 그대로 믿기.** AgentCore Gateway는 특정 audience를 기대. Cognito user-pool 토큰의 기본 `aud`는 app client ID인데, 별도 resource server를 쓰면 그건 Gateway가 원하는 값이 아님. 양쪽 모두에 audience 명시적 설정.
- **"우리는 confidential client다"라며 PKCE 끄기.** Public client(모든 desktop MCP 클라이언트가 public이다)에서 PKCE 없는 auth code flow는 downgrade 공격 대기 상태. PKCE는 공짜다. 켜라.
- **CloudWatch에 access token 로깅.** Gateway request log를 debug 레벨로 두면 `Authorization` 헤더가 통째로 찍힘. 영속 로그로 보내기 전에 strip.

## 한 문단 결정 트리

Tool이 user-scoped 데이터를 읽거나 쓰거나, 어떤 인간이 호출했는지 알아야 할 일이 한 번이라도 생긴다면 auth code flow + PKCE. IdP 없으면 Cognito, 있으면 Okta/Auth0 그대로. Consent 화면용 domain scope 설계, gateway 안에서 tool 단위 정책. Dynamic registration 성숙할 때까지는 MCP 클라이언트 종류별로 OAuth client 미리 발급. Refresh token은 OS keychain에. 토큰 수명은 agent 세션 기대치에 맞춰 조정 — IdP 기본값 그대로 쓰지 말 것. M2M과 user 클라이언트를 같은 resource server에 넣지 말 것. Prod redirect 경로 테스트하기 전에 로컬 dev redirect부터 깨봐라.

AWS 튜토리얼은 결정이 끝난 다음 따라갈 가이드로 적절하다. 결정 자체는 직접 해야 한다.
