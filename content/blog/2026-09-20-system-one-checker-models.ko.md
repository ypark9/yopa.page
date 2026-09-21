---
title: "판단만 하는 모델: 보정된 yes/no 확률이 필요한 이유"
date: 2026-09-20T09:00:00-04:00
author: Yoonsoo Park
description: "TypeSafe의 Jev는 텍스트를 생성하지 않고 보정된 yes/no 확률을 반환한다. 핵심은 type-safe 출력이 아니라 코드가 신뢰할 수 있는 확률로 분기할 수 있다는 점이다. 이 모델의 사고방식과 RAG relevance gate에서의 활용을 살펴본다."
categories:
  - AI
  - Architecture
tags:
  - ai-agents
  - rag
  - calibration
  - retrieval
  - llm-architecture
---

TypeSafe AI는 2026년 9월 Jev라는 모델을 공개했다. 이 모델은 문장을 생성하지 않는다. program state와 몇 개의 typed question을 입력하면 한 번의 parallel pass로 choice, score, 확률을 반환한다. TypeSafe는 이 모델군을 Kahneman이 말한 빠르고 직관적인 판단 체계에서 이름을 딴 “System One”이라고 부른다.

처음 발표를 읽었을 때는 핵심이 type safety라고 생각했다. “valid JSON만 반환해 달라”는 식의 제약 없이 출력값을 다음 소프트웨어 단계에 바로 연결할 수 있다는 점이다. 물론 이것도 장점이지만, 더 중요한 가치는 따로 있다.

핵심은 보정된 확률을 코드의 의사결정에 사용할 수 있다는 데 있다.

## 모델이 반환하는 값

제공하는 기본 형식은 세 가지다.

- **Noul**: yes/no 질문에 0과 1 사이의 확률 하나로 답한다. “yes”에 별도의 confidence 필드를 붙이는 방식이 아니라, 숫자 자체가 모델의 판단을 나타낸다.
- **Choice**: N개 옵션 중 하나를 confidence와 함께 선택한다.
- **Score**: 지정한 범위의 숫자와 confidence를 함께 반환한다.

중요한 제약도 있다. 질문은 서로의 답을 볼 수 없다. 어떤 결정이 세 요인에 의존한다면 각 요인을 따로 질문하고, 그 결과를 조합하는 일은 애플리케이션 코드가 맡는다. 이는 단순한 제약이라기보다 이 모델의 설계 철학에 가깝다.

## 핵심은 type safety가 아니다

이 모델을 이해하는 데 가장 중요한 문장은 다음과 같다.

**보정된 확률은 코드가 처음으로 `if` 문에 사용할 수 있는 숫자다.**

일반적인 챗 모델에 “0부터 10까지 얼마나 확신하는가”라고 물으면 숫자 하나를 반환한다. 하지만 그 숫자가 보정되어 있다고 보기는 어렵다. 모델이 “10점 만점에 9점”이라고 답해도 실제로 열 번 중 아홉 번 맞는다는 뜻은 아니다. 따라서 그 값에 신뢰할 만한 임계값을 적용하기 어렵다. 결국 모든 건을 사람에게 보내거나, 모든 건에 더 큰 모델을 실행하게 된다. 코드가 분기할 수 있는 신뢰 가능한 신호가 없기 때문이다.

TypeSafe는 Jev를 RLCD(reinforcement learning for calibrated decisions)라는 방법으로 학습시켰다. 목표는 모델이 0.9라고 말할 때 실제로도 약 열 번 중 아홉 번 맞도록 하는 것이다. 일기예보가 좋은 비유다. 비 올 확률을 70%라고 예보한 날 가운데 대략 100일 중 70일에 비가 온다면, 그 예보는 보정되어 있다.

이 성질이 실제로 유지된다면 다음 코드는 처음으로 의미를 갖는다.

```python
if answer.noul > 0.98:
    auto_act()            # 사람도, 큰 모델도 안 씀
elif answer.noul < 0.05:
    auto_reject()
else:
    escalate()            # 사람이나 느린 reasoning 모델로
```

이 다섯 줄이 곧 제품의 핵심이다. 확신도가 높은 다수는 자동 처리하고, 애매한 소수만 사람이나 더 느린 추론 모델에 맡긴다. 보정이 없다면 이 분기는 신뢰할 수 없는 숫자에 기대는 것이고, 보정이 있다면 실제 관측값에 근거한 정책이 된다.

## 하나의 사례보다 판단의 규모가 중요하다

단 하나의 결정적인 사용 사례를 찾으려 해도 쉽게 떠오르지 않는다. 이 모델의 가치는 개별 판단 하나가 아니라, 많은 판단을 처리하는 규모에서 나오기 때문이다.

회사는 모델 이름을 경제학자 William Jevons에서 가져왔다. 그는 증기기관의 효율이 높아진 뒤 영국의 석탄 소비가 줄기는커녕 늘어난 현상을 관찰했다. 어떤 일을 충분히 저렴하게 만들면 더 자주 하게 된다는 뜻이다. 판단 하나가 매우 낮은 비용으로 0.5초 안에 끝난다면, 이전에는 비용 때문에 하지 않던 곳에도 판단을 넣을 수 있다. 모든 로그 행의 yes/no 판단, 모든 커밋의 risk score, 모든 검색 청크의 relevance 확인이 그 예다. 그동안은 전체 언어 모델로 실행하기에 너무 느리고 비쌌지만, 이제는 가능해진다.

따라서 하나의 마법 같은 사례를 찾기보다 문제의 형태를 살펴봐야 한다. 좁고 반복적이며 atomic한 판단이고, 후속 코드가 그 결과로 분기해야 한다면 후보가 된다.

## 구체적인 사용 사례: RAG relevance gate

[RAG용 벡터 데이터베이스 아키텍처 결정 가이드](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html)에서 다뤘듯이, RAG 품질은 context window에 실제로 무엇을 넣는지에 크게 좌우된다. Jev는 이 문제에 사용할 수 있는 새 도구다.

전형적인 retrieval 파이프라인은 다음과 같다.

```
query -> embedding search (top 50) -> reranker (top 8) -> LLM에 밀어넣기
```

embedding search와 cross-encoder reranker는 모두 같은 질문에 답한다. 이 청크가 query와 의미적으로 가까운가? 하지만 “가까움”과 “실제로 답이 되는가”는 다르다. embedding 공간에서 가깝더라도 청크에 필요한 답이 없을 수 있다. 이 차이는 RAG 오류의 주요 원인이다. 관련 없는 청크가 context에 들어가면 모델은 그 내용을 이용해 답하려 하기 때문이다.

checker 모델은 reranker를 대체하지 않는다. reranker 뒤에서 reranker가 답하지 못하는 질문을 맡는다.

```python
for chunk in reranked_chunks:               # raw 50개가 아니라 reranker의 top 8
    r = client.system_one(
        state={"query": user_query, "chunk": chunk.text},
        questions={
            "answers":   noul("이 청크가 query에 직접 답이 되는 정보를 담고 있다"),
            "on_topic":  noul("이 청크가 query와 같은 엔티티에 대한 것이다"),
            "relevance": score("query에 답하는 데 이 청크가 얼마나 유용한가", min=0, max=10),
            "stale":     noul("이 청크는 오래됐거나 대체된 것으로 보인다"),
        },
    )
    chunk.judgment = r
```

그다음 어떤 청크를 남길지는 prompt가 아니라 애플리케이션 코드가 결정한다.

```python
keep = [c for c in reranked_chunks
        if c.judgment.nouls["answers"].noul > 0.7
        and c.judgment.nouls["stale"].noul < 0.6]

keep.sort(key=lambda c: c.judgment.scores["relevance"].score, reverse=True)
context = keep[:5]
```

이 접근에는 세 가지 장점이 있다.

첫째, 기준이 “가까운가”가 아니라 “질문에 답이 되는가”가 된다. `answers` 확률이 보정되어 있다면 `> 0.7`은 query가 달라져도 비교적 안정적인 의미를 갖는다. raw reranker 점수에는 이런 성질이 없다. 한 reranker의 0.8이 다른 reranker의 0.8과 같다고 볼 수 없기 때문이다.

둘째, context를 관련 없는 청크로 채우지 않게 된다. 기준을 넘는 청크가 둘뿐이라면 둘만 보낸다. 아슬아슬한 청크로 자리를 채운 top-5보다 낫다. context의 distractor를 줄이는 일은 RAG 품질을 높이는 가장 비용 효율적인 방법 중 하나다.

셋째, 정책이 읽고 테스트할 수 있는 코드에 남는다. 임계값, staleness 규칙, 엔티티 확인은 모두 unit test를 작성할 수 있는 `if` 문이다. 감으로 조정하는 prompt 안에 묻힌 문장이 아니다.

### checker가 적합하지 않은 경우

이는 ranker가 아니다. 질문들이 서로의 답을 볼 수 없기 때문에 각 청크를 독립적으로 평가한다. 따라서 청크 A가 청크 B보다 더 좋은 답인지는 판단할 수 없고, 각 청크가 그 자체로 답이 되는지만 판단한다. 세밀한 순위는 cross-encoder에 맡기고, checker는 통과/탈락 게이트와 대략적인 유용도 점수에 사용해야 한다. 두 역할은 서로 다르며 함께 사용할 수 있다.

호출은 청크마다 수행되므로 raw top-50이 아니라 reranker의 shortlist에만 게이트를 적용해야 한다. 비용이 낮다고 무료인 것은 아니다.

## maker와 checker의 분리

한 걸음 물러나 보면 이 패턴은 retrieval보다 더 넓게 적용된다. 이 모델은 답을 작성하거나 코드를 만들고 요약을 생성하는 maker가 될 수 없다. 대신 checker 역할에 맞춰져 있다. 유용한 구조는 기존의 두 역할 루프에서 checker의 모델 클래스만 바꾸는 것이다. 언어 모델은 계속 생성하고, 빠르고 보정된 판정 모델이 그 결과를 배포해도 되는지, 다시 작성해야 하는지, 사람이 검토해야 하는지를 결정한다. claim은 proof가 아니다. checker는 claim을 코드가 실제로 실행할 수 있는 결정으로 바꾸는 계층이다.

## 실제 도입 방법

지금 당장 기존 시스템을 이전할 필요는 없다. 모델은 공개된 지 며칠 되지 않았고, 구조화 출력 오류가 거의 없으며 수백 배 더 저렴하고 빠르다는 수치는 벤더가 직접 측정한 값이다. 아직 독립적으로 재현되지 않았다.

먼저 shadow mode로 실행하는 편이 좋다. 버전을 pin하고 기존 경로는 그대로 유지한 채 checker의 판단을 병렬로 실행하되, 아직 어떤 것도 통과·차단하지 않도록 한다. 모델이 어떤 결정을 내렸을지만 로그에 남긴다. 며칠 후 모델이 제외하려 한 청크가 실제로 좋은 답에 쓰이지 않았는지, 자동 승인하려 한 후보가 실제로 맞았는지를 확인한다. 보정 성질이 자체 데이터에서도 유지된다면 그때 실제 게이트로 승격한다. 그렇지 않더라도 로그 저장 비용 외에 잃는 것은 없다.

이 특정 모델이 아직 이른 단계로 판명되더라도 아이디어 자체는 유효하다. 저렴하고 보정되어 있으며 텍스트를 생성하지 않는 판정 모델은 새로운 building block이다. 그 모델이 놓일 자리는 생성하는 모델과 결정하는 코드 사이의 경계다. 이 경계는 많은 agent 시스템에서 취약한 지점이었으며, checker 모델은 그 자리에 맞는 구성 요소가 될 수 있다.
