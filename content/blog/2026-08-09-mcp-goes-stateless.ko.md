---
title: "MCP가 Stateless로 바뀐다 (2026-07-28): Host, Client, Server부터 AWS 배포까지"
date: 2026-08-09T09:05:00-04:00
author: Yoonsoo Park
description: "2026-07-28 MCP 릴리스 후보는 프로토콜 계층에서 세션을 없앤다. 다들 헷갈려하는 host/client/server 구분부터, 기존 서버에서 뭘 바꿔야 하는지, 그리고 왜 stateless가 AWS AgentCore와 잘 맞는지 정리했다."
categories:
  - AWS
tags:
  - mcp
  - agentcore
  - bedrock
  - stateless
  - architecture
---

[2026-07-28 MCP 릴리스 후보](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)는 프로토콜이 나온 이래 가장 큰 변화다. 핵심 한 줄은 이거다. 이제 MCP는 프로토콜 계층에서 stateless다. 예전에는 sticky session, 공유 session store, 그리고 요청 본문까지 뜯어보는 gateway가 있어야 돌던 원격 서버가, 이제는 그냥 평범한 round-robin load balancer 뒤에 앉아도 된다.

transport 변화로 들어가기 전에, 사람들이 제일 먼저 묻는 걸 짚고 가자. host, client, server가 정확히 뭐냐는 질문이다.

## Host, client, server 3분 정리

이 셋은 정말 자주 뒤섞인다. 대부분 "그래서 Claude는 뭔데?"에서 막힌다.

- **Host**는 LLM 앱 그 자체다. Claude Desktop, Cursor, ChatGPT, 아니면 AgentCore Runtime 위에서 도는 에이전트. 사용자와 모델이 사는 곳이고, client를 하나 이상 소유한다.
- **Client**는 host 안에 들어 있는 커넥터다. server 하나당 client 하나. JSON-RPC 프로토콜을 말하고 `tools/list`, `tools/call` 같은 걸 날린다. host가 GitHub server랑 Slack server에 붙으면 client가 2개 생긴다. 사용자 눈에는 안 보인다.
- **Server**는 실제 능력을 노출하는 프로세스다. tool, resource, prompt. GitHub MCP server는 `create_issue()`, `search_repos()` 같은 함수를 tool 스펙으로 광고하는 바로 그것이다.

그래서 질문에 바로 답하면 이렇다. GitHub MCP server는 tool을 제공하는 곳이 맞다. Claude(Desktop이든 Cursor든)는 **host**다. 그 Claude 안에서 GitHub server랑 1:1로 붙어 대화하는 커넥터가 **client**고. host는 컨테이너, client는 server 하나로 가는 연결선, server는 능력 제공자. 헷갈리는 이유는 client가 host 안에 숨은 구현 디테일이라서다. 밖에서 보면 Claude가 server랑 직접 얘기하는 것처럼 보이지만, 사실은 자기가 소유한 client를 거쳐서 하는 거다.

```
┌─ Host (Claude Desktop) ───────────────┐
│  user + model                          │
│    ├── Client A ──── GitHub MCP server │  create_issue(), search_repos()
│    └── Client B ──── Slack MCP server  │  post_message(), list_channels()
└────────────────────────────────────────┘
```

이 그림을 붙들고 있자. 이번 stateless 변화는 결국 client와 server가 서로 어떻게 대화하느냐가 바뀐 거니까.

## 뭐가 바뀌었나: 세션이 프로토콜에서 빠졌다

2025-11-25 버전에서는 tool 하나를 부르려면 먼저 세션을 맺어야 했다. client가 `initialize` 핸드셰이크를 보내면 server가 `Mcp-Session-Id`를 돌려주고, 그다음부터 모든 요청이 그 ID를 달고 가야 했다. 그 ID가 client를 그걸 발급한 특정 server 인스턴스에 묶어버린다.

릴리스 후보의 before/after를 보면 확 와닿는다.

예전(2025-11-25)은 왕복이 두 번이고, 두 번째 요청은 인스턴스에 묶여 있다.

```http
POST /mcp HTTP/1.1
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize",
 "params":{"protocolVersion":"2025-11-25","capabilities":{},
           "clientInfo":{"name":"my-app","version":"1.0"}}}
```

```http
POST /mcp HTTP/1.1
Mcp-Session-Id: 1868a90c-3a3f-4f5b
Content-Type: application/json

{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"search","arguments":{"q":"otters"}}}
```

이제(2026-07-28)는 어느 인스턴스가 받아도 되는, 그 자체로 완결된 요청 하나다.

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: search
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"search","arguments":{"q":"otters"},
           "_meta":{"io.modelcontextprotocol/clientInfo":{"name":"my-app","version":"1.0"}}}}
```

두 가지가 사라졌다. `initialize`/`initialized` 핸드셰이크가 없어졌고(SEP-2575), 예전에 연결할 때 한 번 주고받던 protocol version, client info, capabilities가 이제는 매 요청마다 `_meta`에 실려 간다. 대신 client가 server 능력을 미리 알고 싶으면 새로 생긴 `server/discover`로 가져오면 된다. 그리고 `Mcp-Session-Id` 헤더와 그 뒤의 프로토콜 세션도 없어졌다(SEP-2567). 둘 다 사라졌으니 어떤 요청이든 아무 인스턴스에나 떨어져도 된다.

## 기존 서버에서 바꿔야 할 것

프로토콜이 stateless라고 해서 네 애플리케이션까지 상태가 없어야 한다는 뜻은 아니다. 프로토콜이 대신 상태를 들고 있어 주는 걸 그만둔다는 뜻이고, 그럼 네가 직접 명시적으로 들고 있으면 된다.

- **세션 상태는 explicit handle로 바뀐다.** HTTP API가 늘 하던 대로 하면 된다. tool이 `basket_id`나 `browser_id`를 발급해서 돌려주고, 모델이 다음 호출 때 그걸 평범한 인자로 다시 넘긴다. 이제 상태가 transport 메타데이터 속에 숨는 대신 모델에게 보이게 된다. 스펙 저자들은 이게 오히려 더 강력한 패턴이라고 본다. 모델이 handle을 여러 tool에 걸쳐 조합하고 추론할 수 있으니까.
- **server가 client에게 뭘 물어보는 흐름은 Multi Round-Trip으로 바뀐다(SEP-2322).** "파일 3개 지울까?"를 물으려고 SSE 스트림을 붙잡고 있는 대신, server가 `requestState` 뭉치를 담은 `InputRequiredResult`를 돌려준다. client가 답을 모아서 원래 호출을 `inputResponses`랑 그 `requestState`를 붙여 다시 보낸다. 재시도에 필요한 게 전부 payload 안에 있으니 어느 인스턴스가 받아도 이어서 처리한다. 참고로 server가 먼저 거는 요청은 이제 server가 client 요청을 처리하는 도중에만 허용된다(SEP-2260). 난데없이 뜨는 프롬프트는 없어진다는 얘기다.
- **list는 캐싱하자.** `tools/list`랑 resource read 결과에 `ttlMs`와 `cacheScope`가 붙었다(SEP-2549). HTTP Cache-Control을 본떴다. list가 바뀐 걸 알려고 SSE 스트림을 계속 열어둘 필요가 없어졌다.
- **자잘한 breaking 변경들.** Roots, Sampling, Logging이 deprecated 됐다(SEP-2577, 아직은 annotation만). 리소스 없음 에러 코드가 MCP 전용 `-32002`에서 표준 `-32602 Invalid Params`로 바뀌었다(SEP-2164). client가 그 숫자값으로 분기하고 있으면 고쳐야 한다. tool 스키마는 full JSON Schema 2020-12로 올라갔다(SEP-2106).

## AWS에 배포할 때 달라지는 점

stateless가 진짜 값을 하는 지점이 여기다.

- **평범한 round-robin load balancer면 충분하다.** 예전에는 수평 확장하려면 묶여 있는 `Mcp-Session-Id`가 항상 제 인스턴스를 찾아가게 sticky session이나 공유 session store가 필요했다. 그 요구가 프로토콜 계층에서 사라졌으니 ALB 기본 라우팅으로 그냥 된다.
- **Lambda랑 Fargate에 깔끔하게 맞는다.** 아무 요청이나 아무 인스턴스에 떨어져도 되는 건, serverless랑 오토스케일 컨테이너가 딱 원하던 실행 모델이다. 인스턴스 고정이랑 싸울 일이 없다.
- **gateway가 본문 대신 헤더로 라우팅한다.** transport가 이제 `Mcp-Method`랑 `Mcp-Name` 헤더를 요구한다(SEP-2243). load balancer, gateway, rate-limiter가 본문을 뜯어보지 않고 작업 종류로 라우팅하고 throttle 할 수 있다. 헤더랑 본문이 안 맞으면 server가 요청을 거부한다.
- **트레이싱이 표준화됐다.** `_meta`에 실리는 W3C Trace Context 전파가 문서화됐다(SEP-414). `traceparent`, `tracestate`, `baggage` 키 이름이 고정됐다. 그래서 host에서 시작한 트레이스가 client SDK, server, 그 아래 다운스트림까지 따라가서 OpenTelemetry 백엔드에 하나의 span tree로 찍힌다.

## AgentCore와의 상관관계

AWS에서 MCP 서버를 돌린다면, 십중팔구 AgentCore의 두 조각을 통해 이 프로토콜을 만난다.

- **AgentCore Runtime**은 server 쪽 워크로드, 즉 에이전트나 MCP 서버를 관리형 컨테이너로 호스팅한다.
- **AgentCore Gateway**는 tool을 MCP endpoint로 노출하고 그 앞에 SigV4(IAM)를 세운다. 그러면 에이전트가 gateway의 tool을 다른 MCP 서버 붙이듯이 로드할 수 있다.

이번 stateless 개편은 여기에 자연스럽게 맞는다. 이유는 다른 AWS 배포에 도움 되는 이유랑 똑같다. AgentCore는 컨테이너 인스턴스를 늘려서 확장하는데, 호출자를 그중 하나에 묶어두고 싶어 하지 않는다. 프로토콜이 세션을 버리면 "아무 요청이나 아무 인스턴스에"가 Runtime이 이미 확장하는 방식이랑 딱 맞아떨어지고, gateway에서 세션 고정을 붙들 이유가 없어진다.

배포된 gateway에 client를 붙여본 경험에서 하나 짚자면, SigV4는 MCP client transport에 내장돼 있지 않다. 그래서 OAuth provider에 기대는 대신 서명하는 `fetch`를 Streamable HTTP transport에 주입한다. 인증 쪽을 깊게 보고 싶으면 [AgentCore Gateway의 MCP client가 OAuth auth code flow가 필요한 경우](/ko/blog/2026-06-03-agentcore-gateway-mcp-oauth-auth-code.html)를 예전에 써뒀고, 그 전에 [Strands와 MCP의 아키텍처 패턴](/blog/2025-12-11-architecture-patterns-for-strands-and-mcp.html)도 다뤘다. 이 글은 그것들의 transport 계층 짝꿍쯤 된다.

## 밟을 것 같은 함정

- **stateless라고 상태를 다 지운다고 착각하는 것.** 아니다. 상태를 transport에서 빼내서 모델이 주고받는 explicit handle로 옮기는 거다. server에 세션별 상태가 진짜 있었다면 여전히 필요하다. 다만 어느 인스턴스나 읽을 수 있는 곳에 둬야 한다.
- **헤더/본문 일치 규칙을 까먹는 것.** gateway가 `Mcp-Method`나 `Mcp-Name`을 고쳐 쓰는데 본문은 딴소리를 하면, 규격 지키는 server는 요청을 거부한다. 헤더로 라우팅하되 헤더를 건드리지는 마라.
- **`-32002`로 분기하는 것.** 옛날 리소스 없음 에러 코드로 분기하는 client 코드가 있으면, 2026-07-28 server 상대로 조용히 깨진다. grep 한 번 돌려라.
- **RC를 최종본처럼 다루는 것.** 릴리스 후보는 2026년 5월 21일에 잠겼고, 최종 스펙은 2026년 7월 28일에 나온다. breaking change가 들어 있으니 지금은 검증 기간이지 "오늘 prod에 올려라"가 아니다.

## 그래서 뭘 해야 하나

원격 MCP 서버를 갖고 있으면 세션 제거를 지금부터 계획하자. `Mcp-Session-Id`에 의존하는 데를 찾고, 어떤 상태를 explicit handle로 바꿀지 정하고, server가 client에게 묻는 프롬프트를 Multi Round-Trip 형태로 옮겨라. AgentCore에 배포한다면 stateless만 되면 이득은 거의 공짜다. gateway에서 세션 고정을 떼고 Runtime이 평평하게 확장하게 두면 된다. 그리고 host/client/server 질문에 열 번째 답하는 사람이라면, 이 한 줄만 외워두자. host가 client를 소유하고, server 하나당 client 하나, server는 tool을 제공한다.
