---
title: "판단만 하는 모델: calibrated yes/no가 실제로 값어치 하는 곳"
date: 2026-09-20T09:00:00-04:00
author: Yoonsoo Park
description: "TypeSafe가 Jev를 냈다. 텍스트를 안 만들고 calibrated된 yes/no 확률을 돌려주는 모델이다. 흥미로운 건 type-safe한 출력이 아니다. calibrated 확률은 코드가 처음으로 if문을 걸 수 있는 숫자라는 점이다. 멘탈 모델과, 이게 실제로 밥값 하는 한 군데를 적었다. RAG 파이프라인의 relevance gate다."
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

TypeSafe AI가 2026년 9월에 Jev라는 모델을 냈다. 문장을 안 쓴다. program state 한 덩어리랑 typed question 몇 개를 주면, 한 번의 parallel pass로 choice, score, 확률을 돌려준다. 이 클래스를 "System One"이라 부른다. Kahneman이 말한 빠르고 직관적인 판단 엔진에서 따온 이름이다.

처음 발표를 읽었을 때 나도 다들 하는 실수를 했다. 핵심이 type safety라고 생각한 거다. "제발 valid JSON으로만 답해줘" 같은 잔소리 없이 출력이 다음 소프트웨어에 딱 꽂히는 모델. 그것도 맞긴 한데, 그건 부차적인 효과다. 이게 중요한 이유가 아니다.

진짜 이유는 두 번째 읽었을 때 보였고, 한 번 보이니까 안 보이게 할 수가 없더라. 그러니 두 번 읽는 수고는 내가 덜어주겠다.

## 이 모델이 실제로 돌려주는 것

프리미티브가 셋이다.

- **Noul**: yes/no 질문을 0과 1 사이 확률 하나로 답한다. "yes"에 별도 confidence 필드를 붙이는 게 아니다. 그 숫자 자체가 믿음이다.
- **Choice**: N개 옵션 중 하나를 confidence와 함께 고른다.
- **Score**: 범위 안의 숫자를 confidence와 함께 준다.

제약 하나가 중요하다. 질문들은 서로의 답을 못 본다. 어떤 결정이 세 가지 요인에 달렸으면, 각 요인을 따로 묻고 조합은 네 코드가 한다. 제약처럼 들리는데, 사실 이게 설계 철학 전체다. 뒤에서 다시 얘기하겠다.

## 놓치기 쉬운 부분

이 문장이 나한테 전부를 다시 짜맞춰줬다.

**calibrated 확률은 코드가 처음으로 if문을 걸 수 있는 숫자다.**

보통 챗 모델한테 "0부터 10까지, 얼마나 확신해?"라고 물으면 무슨 일이 벌어지는지 생각해보자. 숫자를 하나 쓴다. 근데 그 숫자는 calibrated가 아니다. 모델이 "10점 만점에 9점"이라 해도 실제로 열 번 중 아홉 번 맞는 게 아니다. 그냥 9라는 글자를 쓴 거다. 그러니 거기에 임계값을 못 건다. 결국 다 사람한테 보내거나, 다 큰 모델을 태우게 된다. 조건 걸 만한 믿을 신호가 없으니까.

TypeSafe는 Jev를 RLCD라는 방법으로 학습시켰다. reinforcement learning for calibrated decisions. 목표는 모델이 0.9라 하면 실제로 열 번 중 아홉 번 맞는 거다. 좋은 일기예보랑 똑같다. 70퍼센트라고 부른 날들 중 대략 100일에 70일 비가 오면, 그 예보는 calibrated된 거다.

이게 성립하면 처음으로 이 코드가 동작하고, 의미를 가진다.

```python
if answer.noul > 0.98:
    auto_act()            # 사람도, 큰 모델도 안 씀
elif answer.noul < 0.05:
    auto_reject()
else:
    escalate()            # 사람이나 느린 reasoning 모델로
```

이 다섯 줄이 제품이다. 확신하는 다수는 자동으로 처리하고, 애매한 소수만 위로 올린다. calibration이 없으면 이 코드는 거짓말 위에 서 있는 거고, 있으면 진짜 위에 서 있는 거다.

## 예시 하나로는 설득이 안 되는 이유

킬러 유스케이스를 떠올려보려 했는데 아무것도 안 나왔다. 이유는, 값어치가 어느 하나의 판단에 있는 게 아니라 판단의 양에 있어서 그렇다.

회사는 모델 이름을 William Jevons에서 따왔다. 증기기관이 효율 좋아지니까 영국이 석탄을 덜 쓴 게 아니라 더 태웠다는 걸 관찰한 경제학자다. 무언가를 충분히 싸게 만들면, 훨씬 더 많이 쓰게 된다. 판단 하나가 몇 원도 안 들고 0.5초 안에 돌아오면, 예전엔 돈 아까워서 안 하던 데에 판단을 박기 시작한다. 로그 한 줄마다 yes/no. 커밋마다 risk score. 검색된 청크마다 relevance 체크. 다 너무 느리고 비싸서 아무도 언어 모델로 안 돌리던 것들이다. 이제 된다.

그러니 마법 같은 케이스 하나를 찾아 헤매지 말고, 문제의 모양을 봐라. 좁고, 반복되고, atomic한 판단인데 그 뒤에 있는 코드가 그걸로 분기하고 싶어 하나? 그러면 후보다.

## 밥값 하는 한 군데: RAG의 relevance gate

[RAG용 벡터 데이터베이스 아키텍처 결정 가이드](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html)를 읽었으면, 내가 context window에 뭐가 실제로 들어가는지에 얼마나 집착하는지 알 거다. 이건 바로 그 문제를 위한 새 도구다.

전형적인 retrieval 파이프라인은 이렇게 생겼다.

```
query -> embedding search (top 50) -> reranker (top 8) -> LLM에 밀어넣기
```

embedding search랑 cross-encoder reranker는 둘 다 한 가지만 답한다. 이 청크가 query랑 의미적으로 가까운가? 근데 "가까움"은 "실제로 답이 됨"과 다르다. 청크가 embedding상 가까워도 정작 답은 안 들어 있을 수 있다. 이 간극이 RAG가 틀리는 큰 원인이다. 쓰레기 청크가 context에 들어가고, 모델은 그걸 꾸역꾸역 쓰려고 하니까.

checker 모델은 reranker 대신이 아니라 reranker 뒤에 앉아서, reranker가 못 묻는 걸 묻는다.

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

그 다음 prompt가 아니라 네 코드가 뭘 살릴지 정한다.

```python
keep = [c for c in reranked_chunks
        if c.judgment.nouls["answers"].noul > 0.7
        and c.judgment.nouls["stale"].noul < 0.6]

keep.sort(key=lambda c: c.judgment.scores["relevance"].score, reverse=True)
context = keep[:5]
```

여기서 마음에 드는 게 셋이다.

첫째, 컷이 "가까운가"가 아니라 "답이 되는가"로 걸린다. `answers` 확률이 calibrated니까 `> 0.7`이 query가 바뀌어도 안정적인 의미를 가진다. raw reranker 점수는 그걸 못 준다. 어떤 reranker의 0.8은 다른 reranker의 0.8이 아니다.

둘째, context를 쓰레기로 채우는 걸 멈춘다. 기준을 넘긴 청크가 둘뿐이면 둘만 보낸다. 세 자리를 아슬아슬한 것들로 메운 top-5 대신에. context 안의 distractor를 줄이는 게 RAG 품질에서 제일 싼 승리 중 하나다.

셋째, 정책이 읽고 테스트할 수 있는 코드에 산다. 임계값, staleness 규칙, 엔티티 체크. 이건 유닛테스트 붙는 if문이지, 감으로 튜닝하는 prompt 속에 파묻힌 문장이 아니다.

### checker가 틀린 도구인 지점

이건 ranker가 아니다. 질문들이 서로를 못 보니까 각 청크를 독립적으로 채점한다. 그래서 청크 A가 청크 B보다 나은 답이라고는 못 말한다. 각각이 그 자체로 답이 되는지 아닌지만 말한다. 미세한 순서는 cross-encoder한테 맡겨라. checker는 통과/탈락 게이트랑 대략의 유용도 점수로 써라. 다른 일이고, 서로 조합된다.

그리고 콜이 청크마다 퍼지니까 raw top-50이 아니라 reranker의 shortlist에 게이트를 걸어라. 싸다고 공짜는 아니다.

## maker/checker 분리

한 발 물러서면 이 패턴은 retrieval보다 크다. 이 모델은 maker가 될 수 없다. 답을 쓰거나, 코드를 짜거나, 요약을 만들지 못한다. checker 모양이다. 그래서 유용한 아키텍처는 이미 있던 두 역할짜리 루프인데, checker의 클래스만 바뀐다. 네 언어 모델은 여전히 생성하고, 빠르고 calibrated된 판정관이 그 출력이 내보낼 만한지, 다시 써야 하는지, 사람이 봐야 하는지를 정한다. claim은 proof가 아니다. checker는 claim을 코드가 실제로 행동할 수 있는 결정으로 바꾸는 자리다.

## 내가 실제로 할 것

이번 주에 뭘 옮기지 마라. 모델은 나온 지 며칠 됐고, 눈 튀어나오는 숫자들(구조화 출력 오류 거의 0, 수백 배 싸고 빠름)은 벤더가 자기가 돌린 거고 아직 아무도 재현 안 했다.

shadow로 돌려라. 버전을 pin하고, 기존 경로는 살려둔 채로, checker의 판단을 병렬로 돌리되 아무것도 게이트 못 하게 해라. 뭘 했을지만 로그로 남겨라. 며칠 뒤에 봐라. 얘가 버리려던 청크가 실제로 좋은 답에 안 쓰였나. 얘가 자동 승인하려던 후보가 진짜 맞았나. calibration이 네 데이터에서 버티면 그때 진짜 게이트로 승격해라. 안 버티면 로그 저장 공간 말고 잃은 게 없다.

이 모델이 결국 너무 이른 걸로 판명나도 아이디어 자체는 탄탄하다. 싸고, calibrated되고, 텍스트 없는 판정관은 진짜 새로운 building block이고, 그게 놓이는 자리는 경계다. 생성하는 모델과 결정하는 코드 사이. 그 경계는 내가 만든 모든 agent 시스템에서 늘 약한 데였다. 거기에 딱 맞는 부품이 드디어 생겨서 반갑다.
