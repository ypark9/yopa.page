---
title: "MCP가 stateless해진다 (2026-07-28): 호스트·클라이언트·서버와 AWS 배포"
date: 2026-08-09T09:05:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "최종 2026-07-28 MCP 사양은 프로토콜 계층의 세션을 제거한다. 호스트·클라이언트·서버의 역할, 기존 서버의 마이그레이션 지점, 그리고 stateless MCP가 AWS AgentCore를 어디까지 단순하게 만드는지 살펴본다."
categories:
  - AWS
tags:
  - mcp
  - agentcore
  - bedrock
  - stateless
  - architecture
---

[최종 2026-07-28 MCP 사양](https://blog.modelcontextprotocol.io/posts/2026-07-28/)의 핵심은 프로토콜 계층에서 세션을 없앤다는 데 있다. 애플리케이션 상태도 외부화하거나 요청에 명시적으로 담는다면 원격 MCP 서버는 sticky session이나 공유 세션 저장소 없이 일반적인 round-robin 로드 밸런서 뒤에서 동작할 수 있다. 게이트웨이가 요청 본문을 들여다보며 프로토콜 연결을 유지할 이유도 줄어든다.

전송 방식의 변화를 보기 전에, 먼저 자주 혼동되는 host, client, server의 역할부터 정리해 보자.

## Host, client, server의 역할

MCP를 설명하다 보면 결국 “그럼 Claude는 무엇인가?”라는 질문으로 돌아온다. 세 구성 요소는 다음처럼 나누면 이해하기 쉽다.

- **Host**는 LLM 애플리케이션이다. Claude Desktop, Cursor, ChatGPT 또는 AgentCore Runtime에서 실행되는 에이전트가 여기에 해당한다. 사용자와 모델이 만나는 지점이며, 하나 이상의 client를 관리한다.
- **Client**는 host 내부에서 특정 server와 통신하는 연결 계층이다. JSON-RPC로 `tools/list`, `tools/call` 등을 호출한다. host가 GitHub MCP server와 Slack MCP server에 연결되어 있다면 각각에 대응하는 client가 하나씩 있다. 보통 사용자는 이 계층을 직접 보지 못한다.
- **Server**는 tool, resource, prompt를 제공하는 프로세스다. 예를 들어 GitHub MCP server는 `create_issue()`, `search_repos()` 같은 기능을 tool 스키마로 노출한다.

따라서 GitHub MCP server는 기능을 제공하는 server이고, Claude Desktop이나 Cursor는 host다. 그 host 안에서 GitHub server와 1:1로 통신하는 구성 요소가 client다. 바깥에서는 Claude가 server와 직접 대화하는 것처럼 보이지만, 실제 요청은 host가 관리하는 client를 거쳐 전달된다. client가 host 안에 숨어 있기 때문에 이 구분이 특히 헷갈리기 쉽다.

```
┌─ Host (Claude Desktop) ───────────────┐
│  user + model                          │
│    ├── Client A ──── GitHub MCP server │  create_issue(), search_repos()
│    └── Client B ──── Slack MCP server  │  post_message(), list_channels()
└────────────────────────────────────────┘
```

이 관계를 염두에 두면, 이번 변경이 client와 server 사이의 통신 방식을 바꾸는 일이라는 점이 분명해진다.

## 무엇이 달라졌나: 프로토콜에서 세션을 제거했다

2025-11-25 버전에서는 tool을 호출하기 전에 먼저 세션을 수립해야 했다. client가 `initialize` 핸드셰이크를 보내면 server가 `Mcp-Session-Id`를 반환하고, 이후의 모든 요청은 그 ID를 포함해야 했다. 이 ID 때문에 client는 세션을 발급한 특정 server 인스턴스에 사실상 묶였다.

최종 사양의 요청 형식을 비교하면 차이가 더 선명하다.

이전 버전(2025-11-25)에서는 두 번 왕복하며, 두 번째 요청은 특정 인스턴스의 세션에 종속된다.

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

2026-07-28에서는 요청 하나가 필요한 정보를 모두 담는다. 따라서 어떤 인스턴스가 요청을 받아도 처리할 수 있다.

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

두 가지 변화가 함께 일어났다. 먼저 `initialize`/`initialized` 핸드셰이크가 제거됐다(SEP-2575). 연결 시 한 번만 주고받던 protocol version, client 정보, capability는 이제 각 요청의 `_meta`에 담긴다. client가 server의 capability를 미리 확인해야 한다면 새 `server/discover` 메서드를 호출하면 된다. 또한 `Mcp-Session-Id` 헤더와 프로토콜 수준의 세션도 사라졌다(SEP-2567). 그 결과 어떤 요청도 특정 인스턴스에 고정되지 않는다.

## 기존 서버에서 바꿔야 할 것

프로토콜이 stateless해진다고 해서 애플리케이션의 상태까지 없애야 하는 것은 아니다. 다만 프로토콜이 암묵적으로 보관하던 상태를 애플리케이션이 명시적으로 관리해야 한다.

- **세션 상태는 명시적인 handle로 바꾼다.** HTTP API에서 하던 방식과 같다. tool이 `basket_id`나 `browser_id`를 발급해 반환하고, 모델은 다음 호출에서 이를 일반 인수로 넘긴다. 상태가 전송 메타데이터에 숨지 않고 모델에도 드러나므로, 여러 tool 호출 사이에서 handle을 조합할 수 있다는 장점이 있다.
- **server가 client에 입력을 요청하는 흐름은 Multi Round-Trip으로 바뀐다(SEP-2322).** 예전처럼 “파일 3개를 삭제할까요?”라고 묻기 위해 SSE 스트림을 열어 둔 채 기다리지 않는다. server는 `requestState`를 담은 `InputRequiredResult`를 반환하고, client는 사용자의 응답과 해당 `requestState`를 `inputResponses`에 실어 원래 호출을 다시 보낸다. 재시도에 필요한 정보가 payload에 모두 있으므로 다른 인스턴스도 이어서 처리할 수 있다. server 주도 요청도 이제 client 요청을 처리하는 동안에만 허용된다(SEP-2260).
- **목록과 리소스 읽기 결과는 캐시한다.** `tools/list`와 resource read 결과에 `ttlMs`, `cacheScope`가 추가됐다(SEP-2549). HTTP의 Cache-Control과 비슷한 모델이다. 목록 변경을 알기 위해 장시간 SSE 스트림을 유지할 필요가 줄어든다.
- **호환성에 영향을 주는 변경도 있다.** Roots, Sampling, Logging은 deprecated 됐다(SEP-2577. 현재는 annotation 수준의 변경이다). 리소스가 없을 때의 오류 코드는 MCP 전용 `-32002`에서 표준 `-32602 Invalid Params`로 바뀐다(SEP-2164). 이 숫자값으로 분기하는 client는 수정해야 한다. tool 스키마도 JSON Schema 2020-12 전체를 사용하도록 바뀐다(SEP-2106).

## AWS에 배포할 때 달라지는 점

이 변화의 실질적인 이점은 AWS에서 MCP server를 수평 확장할 때 가장 잘 드러난다.

- **일반적인 round-robin 로드 밸런서로 충분하다.** 이전에는 `Mcp-Session-Id`가 항상 세션을 만든 인스턴스로 돌아가도록 sticky session이나 공유 세션 저장소가 필요했다. 이 제약이 프로토콜 계층에서 사라졌으므로 ALB의 기본 라우팅을 그대로 사용할 수 있다.
- **Lambda와 Fargate의 실행 모델에 잘 맞는다.** 어떤 요청이든 어느 인스턴스에서 처리할 수 있다는 성질은 serverless와 자동 확장 컨테이너의 운영 방식과 자연스럽게 맞물린다. 인스턴스 고정성을 별도로 관리할 필요가 없다.
- **gateway는 본문 대신 헤더를 기준으로 라우팅할 수 있다.** transport는 이제 `Mcp-Method`, `Mcp-Name` 헤더를 요구한다(SEP-2243). 로드 밸런서, gateway, rate limiter는 요청 본문을 해석하지 않고도 작업 종류에 따라 라우팅하거나 제한할 수 있다. 헤더와 본문이 서로 다르면 server는 요청을 거부한다.
- **트레이싱 방식이 표준화됐다.** `_meta`를 통한 W3C Trace Context 전파가 문서화됐다(SEP-414). `traceparent`, `tracestate`, `baggage`의 키 이름이 정해졌으므로 host에서 시작한 trace를 client SDK, server, 하위 서비스까지 이어 OpenTelemetry 백엔드에서 하나의 span tree로 볼 수 있다.

## AgentCore와의 상관관계

AWS에서 MCP server를 운영한다면 AgentCore의 다음 두 구성 요소와 만나게 될 가능성이 높다.

- **AgentCore Runtime**은 에이전트나 MCP server 같은 server 측 워크로드를 관리형 컨테이너에서 실행한다.
- **AgentCore Gateway**는 tool을 MCP endpoint로 노출하고, 그 앞에 SigV4(IAM) 인증을 둔다. 에이전트는 gateway의 tool을 다른 MCP server처럼 로드해 사용할 수 있다.

stateless 전환은 AgentCore의 확장 방식과 잘 맞는다. AgentCore는 컨테이너 인스턴스를 추가해 확장할 수 있고, 프로토콜 자체가 모든 요청에 프로토콜 세션을 요구하지 않기 때문이다. 다만 AgentCore에 세션이 아예 없어지는 것은 아니다. 구형 client 호환이나 elicitation·sampling 같은 interactive 기능을 위해 Gateway와 Runtime이 선택적인 stateful MCP 세션을 관리할 수 있다. gateway의 affinity를 없애기 전에 client 버전, target 동작, 실제로 설정한 세션 모드를 확인해야 한다.

실제 gateway에 client를 연결할 때는 한 가지를 주의해야 한다. SigV4는 MCP client transport에 기본으로 들어 있지 않으므로 OAuth provider에 맡기는 대신, 요청을 서명하는 `fetch`를 Streamable HTTP transport에 주입해야 한다. 인증 흐름은 [AgentCore Gateway의 MCP client가 OAuth auth code flow가 필요한 경우](/ko/blog/2026-06-03-agentcore-gateway-mcp-oauth-auth-code.html)에서, 더 넓은 구조는 [Strands와 MCP의 아키텍처 패턴](/blog/2025-12-11-architecture-patterns-for-strands-and-mcp.html)에서 다뤘다. 이 글은 그 두 글의 전송 계층 관점에 해당한다.

## 주의할 점

- **stateless를 모든 상태의 제거로 이해하지 않는다.** 상태는 전송 계층에서 모델이 주고받는 명시적인 handle로 옮겨갈 뿐이다. server에 세션별 상태가 필요하다면 계속 유지해야 하며, 어느 인스턴스에서도 읽을 수 있는 위치에 두어야 한다.
- **헤더와 본문의 일치 규칙을 놓치지 않는다.** gateway가 `Mcp-Method`나 `Mcp-Name`을 바꿨는데 본문이 다른 작업을 가리키면, 규격을 따르는 server는 요청을 거부한다. 헤더를 기준으로 라우팅하되 헤더 자체를 변형하지 않는 편이 안전하다.
- **기존 `-32002` 분기를 점검한다.** 이전의 리소스 없음 오류 코드에 의존하는 client는 2026-07-28 server에서 예상과 다르게 동작할 수 있다. 코드베이스에서 해당 값의 사용처를 먼저 확인한다.
- **모든 구현이 최종 상태라고 가정하지 않는다.** 2026-07-28 문서는 최종 사양이지만 client와 gateway가 이전 버전을 협상할 수 있다. affinity를 없애거나 세션 저장소를 지우기 전에 배포된 버전과 stateful-session 설정을 확인해라.

## 지금 할 일

원격 MCP server를 운영한다면 지금부터 프로토콜 세션 제거를 준비할 만하다. 먼저 `Mcp-Session-Id`에 의존하는 부분을 찾고, 어떤 상태를 명시적인 handle로 바꿀지 정한다. server가 client에 입력을 요청하는 흐름은 Multi Round-Trip 형태로 옮긴다. AgentCore에 배포한다면 먼저 optional stateful session 경로를 쓰는지 확인한 뒤 gateway affinity를 제거하고 stateless 요청을 수평 확장하도록 둔다. 마지막으로 host, client, server의 역할은 다음 한 문장으로 정리할 수 있다. host가 client를 관리하고, client는 각 server와 통신하며, server는 tool을 제공한다.
