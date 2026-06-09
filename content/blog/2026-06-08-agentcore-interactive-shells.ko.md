---
title: "Bedrock AgentCore Runtime의 Interactive Shell — 디버깅 사각지대가 닫혔다"
date: 2026-06-08T02:30:00-04:00
author: Yoonsoo Park
description: "Amazon Bedrock AgentCore Runtime이 이제 실행 중인 agent 세션에 WebSocket으로 진짜 PTY 터미널을 붙일 수 있게 됐다. agent를 VPC 컨테이너로 돌리는 순간 디버깅이 왜 블랙박스가 됐는지, 새 InvokeAgentRuntimeCommandShell API가 실제로 뭘 바꾸는지, 그리고 언제 켜고 언제 잠가야 하는지 정리한다."
categories:
  - AWS
  - Bedrock
tags:
  - bedrock
  - agentcore
  - debugging
  - observability
  - security
---

AgentCore Runtime 위에 agent는 로컬에서 다시 부를 수 있는 Lambda가 아니다. private VPC subnet에 만들어지는 Docker 컨테이너고, 접근 불가능한 세션 상태를 지니고, 로그로만 관찰 가능한 MCP gateway와 memory store을 사용함. 지금까지 세션이 맛가면 쓸 수 있는 도구는 *CloudWatch tail*로 추측하는게 다였음.

2026년 6월, AWS가 [그 갭을 메웠다](https://aws-news.com/article/2026-06-05-amazon-bedrock-agentcore-runtime-introduces-interactive-shells-for-terminal-access-into-agent-sessions). AgentCore Runtime이 이제 실행 중인 agent 세션에 **interactive shell**을 지원한다. 새 `InvokeAgentRuntimeCommandShell` API로, 라이브 세션에 터미널로 둘러볼 수 있다.

agent를 컨테이너로 돌리는 입장에선, 로그파일 사용해서 상상력으로 디버깅하던 시절이 끝났고, 이제 직접 쳐들어가는 것과 같음.

## 왜 블랙박스였나

AgentCore Runtime을 운영에서 좋게 만드는 바로 그 속성이, 디버깅을 상황에서는 독이었음:

- agent가 **private subnet의 컨테이너**로 돈다, public ingress 없음, SSH 없음, 직접 소통할 길이 없음.
- 세션 상태는 **실행 중인 프로세스 안**에 산다: 환경변수, working directory, in-memory context, agent가 로드한 모든 것.
- 세션에 대해 알 수 있는 건 전부 **나중에**, 로그에서, 그것도 내가 기억해서 찍어둔 것만 겨우 접근. Agentic Coding으로 이 갭이 좀 줄어든건 사실.

그래서 tool call이 조용히 실패하거나, cross-account role assume가 안 걸리거나, 세션에 엉뚱한 context가 주입되면 직접 *볼* 수가 없었다. 로그 라인 추가하고, 재배포하고, 다시 터지길 기다렸다. (진짜 와..) 특정 세션 상태에서만 재현되는 부류의 버그에는 이 루프도 되면 다행인 상황.

## 뭐가 나왔다고?

새 API는 WebSocket 위에 지속되는 PTY 기반 터미널을 준다. 그래서:

- **`InvokeAgentRuntimeCommandShell`** — 실행 중인 agent 세션으로 interactive shell을 연다.
- 기존 **`InvokeAgentRuntimeCommand`**(한번 명령 실행 후 반환)를 보완한다.
- **풀 터미널 기능**: 컬러, 탭 완성, `Ctrl+C`, 터미널 리사이즈, 자동 재연결.
- **명령 간 상태 유지**: 같은 셸 안에서 환경변수, working directory, command history가 명령 사이에 보존됨.
- **재접속 가능**: 세션은 runtime session ID + shell ID로 식별돼서, 종료 후 *같은* 셸에 다시 실행가능.
- runtime당 **동시 셸 최대 10개** — 여러 세션 병렬 디버깅.
- AgentCore CLI로 접근: `agentcore exec --it --runtime <runtime-arn>`.

## One-shot vs interactive — 맞는 걸 골라라

두 API는 다른 유스케이스를 지님. 원샷 명령으로 충분한데 interactive shell를 시작할 필요는 없어보인다

| | `InvokeAgentRuntimeCommand` | `InvokeAgentRuntimeCommandShell` |
|---|---|---|
| 형태 | 원샷 명령, 출력 반환 | 지속되는 interactive 세션 |
| 상태 | 호출마다 stateless | env / cwd / history 유지 |
| 전송 | request/response | WebSocket (PTY) |
| 재접속 | 해당 없음 | session + shell ID로 재접속 |
| 적합한 곳 | 스크립트 체크, CI probe, "X 세팅됐나?" | 라이브 탐색, 다단계 조사 |

health check나 deterministic probe를 스크립트로 짠다면 `Command`가 더 싸고 audit 가능하다. 셸은 *아직 뭘 찾는지 모르는* 경우에 더 적합.

## 실제로 셸을 꺼내는 순간

매일 쓰는 도구가 아니다. 부를 때 재현 안 되는 버그에서 값을 한다:

- **주입된 설정 검증.** runtime이 내가 연결한거 같은(?) gateway URL, memory ID, account config를 진짜로 사용하고 있나? 라이브 세션 안에서 `printenv` 한 줄이 CDK output 읽고 소망이 닫길 비는것보다 효과적.
- **네트워크 안쪽에서 연결성 진단.** 컨테이너는 private subnet에 있다. 셸에서 MCP gateway endpoint를 `curl`하거나, cross-account `sts assume-role`을 테스트하거나, downstream agent(A2A)에 도달하는지 확인할 수 있다 — stack trace에서 스택 따라 조사 말고.
- **세션 context inspect.** multi-tenant runtime에서 "이 세션이 *올바른* tenant context로 떴나?"는 런타임에서 답하기 힘든지 질문이었다. 이제 됨!
- **병렬 조사.** 동시 셸 10개면 한 세션을 고정해두고, known-good 세션과 비교하고, 잠깐 자리를 떠도 위치를 기억 — ID로 재접속하는 구조가 셸을 유지함.

## gotcha와 보안 이야기...

실행 중인 agent로의 라이브 셸은 강력하고, 그래서 위험하다. 켜기 전에 이걸 생각해보길:

- **프로덕션 agent 세션 셸은 특권이다.** 진짜 credential, 진짜 세션 데이터, (multi-tenant라면) 잠재적으로 다른 tenant의 context를 든 프로세스 안에서의 interactive code 실행이다. SSH-into-prod처럼 취급해라. 실제로 그게 맞으니까.
- **IAM으로 막아라.** 셸을 여는 action은 agent를 invoke하는 action과 별개다. `InvokeAgentRuntimeCommandShell`(과 단발 `Command`)을 명시적으로, 소수의 principal에게만 grant, *프로덕션에선 deny* — break-glass 절차가 없다면. 기존 invoke 권한에 묻어두지말기.
- **dev/QA를 default로.** 값의 대부분은 재현하는 non-prod에 있다. 거기선 셸을 자유롭게 켜고, prod에선 audit되고 예외로 만들어라.
- **CLI 버전 확인.** `agentcore exec --it`는 새 API를 아는 AgentCore CLI 빌드가 필요하다. 디버깅 세션 전에 확인해라.
- **idle timeout 주의.** runtime은 보통 idle session timeout(예: 15분)이 있음. 셸은 세션을 열어둔다 — 내 attach가 그 시계를 리셋하는지 알아두기.

## 소왓?

AgentCore Runtime에 agent를 돌린다면, 작은 노력으로 꽤 할 만하다:

1. `bedrock-agentcore:InvokeAgentRuntimeCommandShell`(과 `InvokeAgentRuntimeCommand`)을 **dev/QA scope** IAM 정책에 추가하고, 팀의 디버깅 principal에 붙여라 — agent 자체의 runtime role이 아니라.
2. 프로덕션에선 문서화된 break-glass 예외 이외에는 **deny 유지**.
3. AgentCore CLI가 `exec --it`를 지원하는지 확인.
4. 다음에 세션 버그가 재현 안 되면, 로그 라인 추가를 멈춰라. shell로 보고, 고쳐라.

패턴이 agent 디버깅이 *로그에서 추측*에서 *가서 보기*로 바뀐다. IAM 한 줄과 가드레일 하나 값어치는 충분이 있다고 봄.
