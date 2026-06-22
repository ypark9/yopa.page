---
title: "구글이 내가 그냥 만들던 걸 표준으로 만들 때"
date: 2026-06-22T18:30:00-04:00
author: Yoonsoo Park
description: "벡터 RAG 파이프라인 대신 LLM wiki를 생성하는 knowledge base 에이전트를 만들었다. 이게 업계 표준이 아니라서 토이 로직 같다는 불안이 늘 있었다. 그러다 구글이 Open Knowledge Format을 냈는데, 내가 쓰던 패턴이랑 거의 그대로였다. OKF가 뭔지, 왜 마크다운 디렉토리가 어떤 작업에선 벡터 스토어보다 나은지, conformant 되는 데 든 비용이 얼마였는지 적는다."
categories:
  - AI
  - Engineering
tags:
  - agents
  - rag
  - knowledge-base
  - llm-wiki
  - okf
---

지난 몇 달 동안 좀 특이한 작업(?)을 하는 knowledge base 에이전트를 만들었다. 벡터 스토어 세우고, 문서 청킹하고, 쿼리 때마다 유사도 검색 돌리는 대신, 에이전트가 소스를 한 번 읽고 wiki로 컴파일한다. YAML frontmatter 붙은 마크다운 파일 디렉토리. cross-link 걸려 있고, index랑 변경 log도 있다. 다운스트림 에이전트가 질문에 답할 때는 사람이 하듯이 wiki를 읽는다. index 열고, 링크 따라가고, 페이지를 읽는다.

잘 됐다. 내가 다루던 느리게 변하는 구조화된 지식에는, 이게 대체한 RAG 파이프라인보다 나았다. 근데 늘 마음에 걸렸다. 다들 블로그에 쓰는 건 벡터 RAG다. 프레임워크들도 그걸 전제한다. 내 마크다운 wiki는 구석에서 혼자 만든 장난감 같았다. 진지한 팀이라면 안 쓸 영리한 꼼수같은 느낌.

그러다 구글이 Open Knowledge Format을 냈다.

## OKF가 실제로 뭐냐

OKF는 Google Cloud knowledge-catalog 프로젝트에서 나온 draft 스펙이다. 한 줄로: 지식 corpus는 YAML frontmatter 붙은 마크다운 파일 디렉토리고, 그게 끝. 스키마 레지스트리 없음. 중앙 권한 없음. 필수 SDK 없음. 스펙 자체 표현이 "cat 되면 읽히고, git clone 되면 배포된다"다.

구조는 민망할 정도로 작다.

- concept 하나가 마크다운 파일 하나다. 파일 경로에서 `.md` 뗀 게 그 ID다.
- 파일마다 frontmatter 블록이 있다. 필수 필드는 딱 하나, `type`. 나머지(`title`, `description`, `resource`, `tags`, `timestamp`)는 선택이다.
- `index.md`는 디렉토리 목록용 예약 파일명이다. `log.md`는 변경 이력용 예약명. 둘 다 선택.
- concept 간 링크는 그냥 마크다운 링크다. A에서 B로 링크가 있으면 "둘이 관련 있다"만 단언한다. 관계의 종류는 주변 prose가 정한다. 소비자는 모든 링크를 untyped directed edge로 취급한다.
- 깨진 링크 허용. 타겟이 아직 안 쓰여진 지식일 수도 있으니까.

이게 포맷 전부다. conformance 규칙도 똑같이 관대하다. non-reserved 마크다운 파일들이 parse 가능한 frontmatter를 갖고, 모든 frontmatter에 빈 값 아닌 `type`이 있으면 conformant다. 소비자는 선택 필드 누락, 모르는 type, 모르는 key, 깨진 링크, index 없음 같은 걸로 번들을 거부하면 안 된다고 명시돼 있다. 절반만 쓰여지고 일부는 기계가 생성한 상태에서도 쓸모를 유지하도록 설계됐다. 현실의 지식이 결국 도달하는 상태를 반영했다.

그리고 스펙이 자기 아이디어를 적어뒀다. 섹션 10에 "LLM wiki repos"랑 "metadata as code"가 OKF가 의도적으로 가깝게 둔 패턴으로 나온다. 이 문장에서 눈이 커지더라. 내가 조용히 만들던 게 emerging open standard의 named reference 패턴 중 하나였다. 토씨 하나 안 틀리고.

## 왜 파일 디렉토리가 어떤 작업에선 벡터 스토어를 이기나

2026년 본능은 RAG = embedding + 벡터 DB다. 많은 문제엔 맞는 말이다. corpus가 거대하고 비구조화돼 있고 수백만 청크에서 fuzzy recall이 필요하면 벡터 스토어가 맞다.

근데 벡터 RAG는 쿼리 하나하나마다 지식을 처음부터 다시 발견한다. 질문이랑 비슷한 top-k 청크를 끌어와서 모델한테 던지고, 모델은 매번 답을 다시 synthesize하고, 모순을 다시 풀고, 관계를 다시 추적한다. 지식이 쌓이질 않는다. retrieval 품질은 청킹 품질이 천장이고, 청킹은 애초에 소스를 coherent하게 만들던 구조를 망친다.

컴파일된 wiki는 이걸 뒤집는다. synthesis 비용을 write time에 한 번만 낸다. cross-reference가 이미 거기 있다. 모순점은 페이지를 쓴 사람(혹은 ? ㅋ)이 이미 flag 걸고 정리해뒀다. concept 사이 관계는 cosine similarity로 재구성하는 게 아니라 link graph에 박혀 있다. 소비하는 에이전트가 페이지를 읽으면 큐레이션된 view를 받는다. nearest-neighbor 조각 한 봉지가 아니라.

그래서 결정은 "RAG냐 아니냐"보다 지식의 형태에 있다.

- **느리게 변하고, 구조화돼 있고, 관계가 많은 지식**(데이터 모델, 내부 시스템 묶음, 도메인 ontology): 컴파일된 wiki가 이긴다. 구조가 곧 가치고, wiki는 그걸 보존한다.
- **거대하고, 빠르게 변하고, 비구조화된 corpus**(서포트 티켓 히스토리, 방대한 문서 더미): 벡터 RAG가 이긴다. 백만 개 티켓을 손으로 컴파일할 수 없고, 관계도 필요 없다.
- **internal tolling 상당수의 솔직한 답은 "둘 다"라고 본다**: 구조화된 코어엔 작은 큐레이션 wiki, long tail엔 벡터 검색.

wiki 방식엔 하나 더 중요한 속성이 하나 더 있다. 사람이 읽을 수 있다. git 안 마크다운일 뿐이다. diff, attribution, 코드 리뷰가 되고, Obsidian으로 열어서 graph를 볼 수도 있다. 벡터 스토어는 불투명한 float 덩어리다. 에이전트가 이상한 답을 내놨을 때 wiki 페이지를 열면, 정확히 뭘 읽었는지 보인다.

## conformant 되는 비용은 사실상 0이었다

여기가 그 불안을 지울 수 있던 영역. 내가 OKF conformance 규칙에서 얼마나 떨어져 있나 기존 wiki들과 비교해봤다.

두 줄쯤 떨어져 있었다.

내 wiki generator는 이미 YAML frontmatter 붙은 마크다운 파일을 디렉토리 트리로 뽑고, cross-link 걸고, 기계가 읽는 index를 만들고 있었다. 스펙이 엄격히 요구하는 것 중 내가 안 하던 건 frontmatter의 `type` 필드 하나뿐. generator frontmatter dict에 한 줄 추가하면 된다. 나머지 gap은 cosmetic이었다. 기계용 `index.json`은 있는데 스펙의 `index.md`는 없어서, 이제 둘 다 생성한다. index를 소비하는 query 라이브러리는 눈치도 못 챘다. `index.md`랑 `type`은 외부 소비자를 위한 additive surface지 내 런타임 변경이 아니니까.

나머지는 자연스레 맞았다. 내 cross-link은 스펙의 `[text](/path.md)`가 아니라 Obsidian식 `[[wikilink]]`였는데, OKF는 링크를 soft guidance로 취급하고 링크 형식 때문에 번들을 거부하지 않으니, wikilink를 그대로 두고(내 reader가 파싱한다) 번들은 여전히 conformant다. untyped edge, permissive consumption, 문서마다 frontmatter. 같은 설계 결정에 도달한다. 결국 해결해야되는 문제의 시작점은 같으니까.

## 실제로 겪은 문제점들.

이 패턴을 진짜로 사용해보니 스펙이 경고 안 해주는 것들이 있었다.

- **중복 페이지가 디폴트 실패 모드다.** 에이전트가 쓰기 전에 index를 안 확인하면, 살짝 다른 이름으로 이미 있는 엔티티의 두 번째 페이지를 만든다. 해법은 강한 규칙 하나. 먼저 orient하고, index 검색하고, 그다음 쓴다. 이걸 건너뛰는 순간 wiki는 쓰레기 동산으로 전락한다.
- **orphan 페이지는 보이지 않는다.** inbound 링크 없는 페이지는 없는 거나 마찬가지다. 아무것도 거기로 traverse 안 하니까. 새 페이지마다 기존 페이지에서 들어오는 링크가 최소 두어 개는 있어야 한다. 아니면 그냥 의미없는 바이트이다.
- **index랑 log는 네비게이션 중심이다.** 업데이트 건너뛰고 싶은 충동이 생길거다. 해야 된다. index가 모든 걸 찾는 통로고, stale한 index는 진짜 페이지를 도달 불가능하게 만든다.
- **깨진 링크는 괜찮다, 근데 문제가 될거다.** 깨진 링크가 "아직 안 씀"일 수 있다는 스펙 말은 맞다. 근데 의도된 forward-reference랑 오타를 구분하는 lint 패스는 여전히 필요하다. 아니면 graph가 천천히 죽는다.

## 이걸로 내가 실제로 얻은 것

실용적 win은 작고 구체적이다. generator에 두어 줄 넣었더니 내 knowledge base를 bespoke 해킹이 아니라 OKF-conformant라고 부를 수 있게 됐다. 이제 누군가한테 설계를 설명할 때 가리킬 레퍼런스가 있다.

더 큰 건 불안이 사라진 거다. 마크다운 wiki 방식이 장난감이라는 의심을 계속 안고 진행하고 있었다. 다들 벡터로 가는데 나만 길을 잘못 든 것 같았다. 근데 그 직관이 가리키던 방향이 지금 구글이 표준화하려는 바로 그 방향이었다. 그 패턴은 해킹이 아니었다. 언젠가 스펙이 생길 무언가의 시작이였다.

이건 적어두고 싶었다. 나한테 보내는 메모로라도. 단순한 설계가 계속 잘 굴러가는데 거기 맞는 표준을 못 찾겠으면, 가끔은 표준이 아직 안 쓰여진 것뿐이다. 단순한 걸 만들어라. 언젠가 스펙이 따라올거다.
