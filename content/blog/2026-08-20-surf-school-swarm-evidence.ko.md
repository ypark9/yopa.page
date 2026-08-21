---
title: "AWS 레스토랑 프라이싱 swarm을 서핑 스쿨로 다시 만들고 33번 돌려봤다"
date: 2026-08-20T09:05:00-04:00
author: Yoonsoo Park
description: "AWS 다이나믹 프라이싱 블로그는 깔끔한 5개 agent swarm 다이어그램을 그린다. 나는 같은 패턴을 서핑 스쿨 예약 도우미로 다시 만들어 Strands와 Bedrock 위에서 33번 돌렸다. 다이어그램이 숨긴 것: 완주율 81.8%, latency 중앙값 136초, run당 6.5만 토큰, 그리고 화살표엔 없는 실패 6건."
categories:
  - AWS
  - Architecture
tags:
  - strands
  - bedrock
  - multi-agent
  - swarm
  - agentcore
  - observability
---

AWS가 꽤 괜찮은 레퍼런스 아키텍처를 하나 올렸다. [Strands Agents로 만든 레스토랑 다이나믹 프라이싱 솔루션](https://aws.amazon.com/blogs/industries/build-a-dynamic-pricing-solution-for-restaurants-using-agentic-ai-strands-agents/)이다. orchestrator가 specialist agent들(수요, 날씨, 지역 이벤트, 경쟁사 가격)로 갈라지고, 각자가 MCP server를 통해 자기 데이터소스랑 얘기하고, swarm parent가 다 모아서 가격을 낸다. 다이어그램은 깔끔하다. 화살표는 전부 앞으로만 간다. 아무것도 안 깨진다.

나는 저 다이어그램을 실제로 돌리면 얼마가 드는지가 궁금했다. 그래서 똑같은 패턴을 도메인만 바꿔서, 서핑 스쿨 예약 도우미로 다시 만들었다. 그리고 Bedrock 위에서 33번 돌리고 모든 hop을 로그로 남겼다.

예전에 쓴 [agent 하나로 부족할 때만 멀티 agent 시스템을 설계하라](/blog/2025-12-12-designing-robust-multi-agent-systems.html)는 글을 읽었다면, 이건 그 글의 실측 후속편이다. "해야 하나"보다는 "청구서가 이렇더라"에 가깝다.

## 같은 패턴, 서핑 스쿨로

서핑 스쿨은 레스토랑이랑 구조가 똑같다. 수요가 출렁이고, 외부 신호가 그 수요를 움직이고, 절대 못 넘는 하드한 제약이 하나 있다. 레스토랑에선 그 제약이 원가 바닥(원가 아래로는 안 판다)이다. 서핑 스쿨에선 안전이다(스웰이랑 돌풍이 위험할 때 초보를 물에 넣지 않는다).

그래서 5개 specialist를 이렇게 매핑했다.

```
orchestrator
  └── swarm
        conditions_agent   → get_surf_conditions   (Open-Meteo Marine: 스웰 높이/주기)
        weather_agent      → get_weather           (Open-Meteo Forecast: 바람, 돌풍, 기온)
        availability_agent → get_instructor_availability (로컬 seed, DynamoDB 대역)
        safety_agent       → (tool 없음: 앞 결과 위에서 추론, safety veto 담당)
        pricing_agent      → get_base_pricing       (프리미엄/할인, 바닥가 밑으론 안 감)
```

바다 신호 두 개는 진짜다. [Open-Meteo](https://open-meteo.com/)는 API key 없이 스웰이랑 바람을 주니까 `conditions_agent`랑 `weather_agent`는 실제 데이터를 당긴다. 강사랑 base 가격은 로컬 JSON seed인데, AWS 버전에서 DynamoDB가 하던 역할 그대로다. 안전 규칙은 `safety_agent` 프롬프트에 문장으로 박아두고 `pricing_agent`에서 한 번 더 되풀이한다. 가격 인센티브가 safety veto를 절대 못 덮게. 이게 AWS 예제가 깔고 앉은 "정책을 프롬프트에 넣는다"는 전제 그대로다.

Strands 배선은 AWS 샘플이 보여주는 거랑 거의 똑같다.

```python
from strands import Agent, tool
from strands.models import BedrockModel
from strands.multiagent import Swarm

swarm = Swarm(
    build_specialists(),          # 위의 5개 agent, 순서대로
    max_handoffs=6,
    max_iterations=6,
    execution_timeout=300.0,
    node_timeout=90.0,
)
result = swarm(f"Recommend surf lesson slots and pricing for {location} on {day}. lat={lat} lon={lon}")
```

handoff은 코드가 아니다. 각 specialist가 프롬프트 끝에 "그 다음 `next_agent`로 넘겨라"라고 적어두면, 모델이 `handoff_to_agent` tool을 부를지 스스로 정한다. 이 사실을 기억해두자. 다이어그램이 거짓말을 시작하는 지점이 바로 여기다.

run들을 비교 가능하게 만들려고 실제 Open-Meteo snapshot 하나를 얼려서, 거기서 stress 시나리오 11개를 파생시켰다(큰 스웰, 강한 돌풍, cold-calm, 초보 경계선인 날, 관측 시각 하나가 빠진 snapshot). 그리고 각 시나리오를 temperature 0으로 세 번씩 돌렸다. 같은 입력, 같은 seed, 33번의 Bedrock 콜. 모델은 `claude-sonnet-4-6`.

## 다이어그램이 보여주는 것 vs 33번이 보여준 것

솔직한 성적표는 이렇다.

```
run 수:              33  (시나리오 11개 x 3회)
완주:                27  (81.8%)
실패:                 6  (18.2%)
정확한 5-agent 경로:  27  (81.8%)
latency:             평균 136.7초 | 중앙값 132.5초 | p95 159.6초 | 범위 115-186초
run당 토큰:          평균 65,730 | 중앙값 67,476 | p95 76,275
배치 총 토큰:        2,169,078 (입력 1.81M / 출력 356k)
추정 배치 비용:      약 $10.78  ($3/M 입력, $15/M 출력 기준)
AWS 스로틀:          0
타임아웃:            0
```

다시 읽어봐라. **다섯 번에 한 번은 다이어그램의 그 깔끔한 경로를 완주 못 했고, 그중 AWS 탓인 실패는 단 하나도 없었다.** 스로틀도 없고 타임아웃도 없다. 실패는 전부 swarm 내부에서 났고, 아키텍처 그림이 열심히 감추는 지점에 몰려 있다.

### 1. 마지막 agent가 제일 비싸고 제일 잘 깨진다

다이어그램에선 specialist가 다 같은 크기 박스다. 로그에선 아니다. 각 agent는 앞선 agent들의 출력을 전부 읽고 자기 handoff로 다시 쓴다. 컨텍스트가 체인을 따라 증폭되니까, 끝에 가까운 agent일수록 제일 무거운 payload를 짊어진다. 대표적인 run 하나를 보면 이렇다.

```
conditions_agent   9,286 토큰
weather_agent     11,267
availability_agent 13,255
safety_agent      16,303   <- 출력 토큰 3,676, 가장 큰 생성량
pricing_agent     16,481
```

내 실패 6건 중 4건이 `safety_agent`가 handoff를 만들다가 생성 토큰 4,000 한도에 부딪힌 거였다(한 번은 승인 슬롯 21개를 직렬화하다가). 가장 중요한 규칙, 즉 safety veto를 쥔 agent가 동시에 제일 잘 막히는 agent다. 체인 뒤쪽에 앉아서 앞의 모든 걸 다시 말해야 하기 때문이다. 왼쪽에서 오른쪽으로 흐르는 깔끔한 화살표는 정작 오른쪽이 깨지는 곳이라는 힌트를 하나도 안 준다.

### 2. temperature 0으로도 결정론이 안 됐다

모든 시나리오를 똑같이 얼린 입력으로, temperature 0으로 세 번씩 돌렸다. 시나리오 다섯 개가 한 번 실패하고 두 번 성공했다. 같은 snapshot, 같은 seed, 같은 프롬프트인데. 실패 위치가 run마다 옮겨다녔고, 한 번은 *agent 경로 자체가* 바뀌었다. `cold-calm` 1회차는 유효한 8슬롯 결과로 pricing까지 끝내놓고, 제어권을 *뒤로* `conditions_agent`한테 넘겨서 루프를 돌다가 iteration 예산을 다 써버렸다. 2회차랑 3회차는 곧장 통과했다.

temperature 0은 다음 토큰 샘플링을 고정한다. tool-call 포맷, handoff 길이, 라우팅 결정은 안 고정한다. 멀티 agent swarm은 모델이 좌우하는 제어 지점이 너무 많아서 "temperature 0"이 "재현 가능"을 뜻하지 못한다. swarm을 테스트하면서 결정론에 기대고 있었다면, 그 기대를 접어라.

### 3. 화살표는 깨진 tool call이랑 SDK 모서리를 숨긴다

다이어그램은 못 보여주는데 로그는 보여준 것들이다.

- **인자 없는 tool이 파싱에 실패한다.** `get_base_pricing()`처럼 인자가 없는 tool이 계속 `failed to parse tool input json, defaulting to empty dict`를 남겼다. Strands가 `{}`를 대신 넣고 계속 진행해서 최종 답은 대개 validate됐지만, tool-call 계층은 거의 매 run 조용히 malformed였다.
- **Strands 1.52.0의 `SwarmResult`엔 `final_response`가 없다.** AWS 샘플은 `result.final_response`를 읽는다. 내가 돌린 버전엔 그 필드가 아예 없어서, pricing 노드를 `result.results`에서 꺼내야 했다. 공개된 샘플이랑 실제 배포된 SDK가 이미 어긋나 있었다.
- **Bedrock이 assistant-prefill 이어받기를 거부한다.** `pricing_agent` 실패 한 건은 Bedrock이 assistant 메시지로 끝난 대화를 이어받길 거부한 거였다. 이건 SDK와 모델의 대화 형태 제약이지, 아키텍처 그림으로는 절대 유추 못 할 종류다.
- **run 간 스키마 드리프트.** 같은 agent가 어떤 run에선 `slots`를 그냥 리스트로, 어떤 run에선 `approved_slots`를 담은 객체로 냈다. 출력을 검사하려고 알려진 형태들을 정규화하는 validator를 따로 짜야 했다. validator는 관찰만 하지, 모델의 추천을 절대 다시 쓰지 않는다.

### 4. compact handoff이 비용을 거의 반으로 줄였는데도 안 쌌다

처음에 순진하게 만든 버전은 시각별 관측을 통째로 agent 사이에 넘겨서, run당 108,827 swarm 토큰에 285초가 걸렸다. compact한 레슨 시간 handoff에 추천 8개 상한을 걸었더니, 같은 snapshot run이 64,781 토큰에 125초로 떨어졌다. 5-agent 경로는 그대로. 프롬프트 엔지니어링 한 방으로 얻은 큰 승리다. 그런데도 배치는 여전히 run당 평균 65,730 토큰에 136초였다. 5-agent swarm은 "오늘 레슨 가격을 얼마로 할까"에 답하기엔 진짜로 비싼 방법이다.

## safety veto 얘기

마음 편해지는 쪽: validator가 파싱할 수 있었던 모든 추천에서 초보 안전 임계 위반이 0건, 바닥가 위반이 0건이었다. 큰 스웰이랑 강한 돌풍 시나리오는 완주한 출력 전부에서 위험한 초보 슬롯을 걷어냈다. 프롬프트만으로 건 정책이 지켜지는 것처럼 보였다.

솔직해지는 쪽: 그게 프롬프트만의 안전이 믿을 만하다는 증명은 안 된다. 6개 run은 쓸 만한 결과를 애초에 못 냈다. 5개는 malformed 출력으로 분류됐다. `missing-hour` 2회차는 관측이 빠진 시각에 슬롯을 추천했는데, validator가 안전이 아니라 `unverifiable`로 찍었다. 그리고 validator는 최종 추출된 슬롯만 검사하지, 모든 자연어 주장이나 중간 handoff를 다 보진 않는다. 방어 가능한 결론은 좁다. *이 배치에서 검증 가능한 완주 추천 안에서는 측정 가능한 위반이 없었다.* "프롬프트만으로 안전이 된다"가 아니다. 여기서 안전이 진짜 중요했다면, veto는 swarm 뒤의 결정론적 코드에 있어야지, 끝에 앉은 제일 과부하된 agent가 정확히 되풀이해주길 바라는 프롬프트 문장에 있으면 안 된다.

## 그래서 레스토랑 swarm, 만들어야 하나

패턴을 배우려면 만들어라. 진짜로 돌아간다. 5개 specialist가 실제 Bedrock 콜 위에서 협업했고, 라이브 바다 데이터를 당겼고, 안전하고 바닥가를 지키는 가격 추천을 33번 중 27번 만들어냈다. Strands `Swarm` primitive는 오후 하나면 세울 수 있는 실체 있는 물건이다.

근데 배포하기 전에 값부터 매겨라.

- **평균이 아니라 꼬리를 예산잡아라.** 추천 하나에 약 65k 토큰, 약 136초다. 그리고 실패 모드는 컨텍스트가 제일 뚱뚱한 체인 끝에 산다.
- **temperature 0이 재현 가능한 swarm 동작을 준다고 믿지 마라.** 안 준다. 반복 실행으로 테스트하고 편차를 각오해라.
- **하드한 제약은 프롬프트가 아니라 코드에 넣어라.** safety veto랑 바닥가는 결정론적 후처리여야 한다. swarm이 제안하게 하고, 코드가 결정하게 해라.
- **첫날부터 모든 hop을 로그해라.** 노드 경로, 노드별 토큰, tool call, validation 결과, 실패 분류. 내가 만든 것 중 제일 쓸모 있었던 게 run 로그였고, AWS 다이어그램에 없는 게 딱 그거다.

깔끔한 아키텍처 다이어그램은 마케팅이다. 18.2% 실패율, 뒤로 도는 루프, 목이 막히는 마지막 agent, 33 run에 $10.78. 이게 엔지니어링이다. 진짜 고객 앞에 이런 걸 하나 돌릴 거면, 관리되는 부분은 [AgentCore Runtime](/blog/2026-08-06-agentcore-runtime-instances.html)에 올리되, 레퍼런스 그림이 빼먹은 지저분한 부분을 예산에 넣어라. "애초에 swarm이 맞는 도구인가"라는 더 큰 질문은 여전히 [agent 하나로 부족할 때만 멀티 agent를 설계하라](/blog/2025-12-12-designing-robust-multi-agent-systems.html)가 답이고, 프레임워크를 고르는 중이면 [Bedrock 위의 Strands vs LangGraph](/blog/2026-02-28-Strands-vs-LangGraph.html)가 짝이 되는 글이다.

다이어그램은 절대 안 깨진다. 네 swarm은 깨진다. 어떻게 깨지는지 알게, 로그를 남겨라.
