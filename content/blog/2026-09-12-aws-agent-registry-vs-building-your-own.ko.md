---
title: "AWS Agent Registry가 GA 됐다. 그래도 직접 만들어야 할까?"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Agent Registry는 agent, tool, skill, MCP server를 위한 governed catalog이자 discovery 레이어다. 그런데 이건 그것들을 provisioning하고 governance하는 control plane과는 다른 물건이다. 둘 중 뭐가 진짜 필요한지 가려보자."
categories:
  - AWS
  - AI Agents
  - Architecture
tags:
  - Amazon Bedrock AgentCore
  - AI Agents
  - agent-registry
  - governance
  - platform-engineering
---

2026년 8월 31일에 AWS Agent Registry가 GA 됐다. 조직 안의 agent, tool, skill, MCP server, 그리고 custom resource를 위한 private governed catalog이자 discovery 레이어다. Agent Registry 콘솔이나 CLI, SDK로 접근하고, AgentCore와 Amazon Quick, Kiro에서도 컨텍스트 전환 없이 이 레코드를 바로 찾아 쓸 수 있다.

이미 자체 registry를 세워둔 플랫폼 팀이라면 이 발표가 좀 불편하게 다가온다. 우리가 방금 AWS가 공짜로 주는 걸 다시 만든 건가 싶은 거다. GA 기능들을 직접 만든 registry와 하나하나 대봤는데, 결론은 "네 걸 걷어내라"가 아니었다. "이 둘은 서로 다른 문제를 푸는데, registry라는 단어 하나가 너무 많은 일을 떠안고 있다"는 거였다.

## AWS Agent Registry가 실제로 하는 일

마케팅 걷어내면 **catalog + discovery** 레이어다.

- agent, tool, skill, MCP server, custom resource를 레코드로 등록한다.
- semantic 검색이나 keyword 검색으로 찾는다. 이미 있는 capability를 다시 만들지 않게 해준다.
- 레코드를 approval workflow에 태운다.
- 모든 동작을 CloudTrail로 audit한다.
- CloudFormation, Terraform, CDK로 registry를 코드로 관리하고, 레코드에 태그를 붙여 cost allocation과 access control에 쓴다.
- AgentCore runtime과 gateway에 뜬 agent를 조직 전체에서 auto-detect한다. 수동으로 등록 안 해도 레코드가 최신으로 유지된다.

마지막 항목에서 잠깐 멈췄다. auto-detect는 카탈로그를 손으로 맞춰줄 필요가 없다는 뜻이다. agent가 AgentCore에서 돌면 누가 등록을 기억하든 말든 알아서 뜬다.

## registry라는 단어가 가리고 있는 구분

여기 함정이 있다. 많은 내부 플랫폼 팀이 "registry"라 부르는 걸 만들었는데, 그건 카탈로그가 아니다. **provisioning과 governance를 담당하는 control plane**이다. 내가 만든 건 이렇게 생겼었다.

- 팀이 capability를 등록한다. LLM capability면 실제 backing resource를 provisioning한다. region별, trust zone별로 Bedrock inference profile을 만들고, 중간에 하나라도 실패하면 rollback한다.
- 등록에는 governance 산출물이 딸려온다. risk/compliance form, explanation form, lifecycle state machine.
- 이 레코드가 source of truth다. 다른 서비스들이 "이 capability가 어느 계정 어느 모델에 매핑되나"를 여기 물어본다.

이 중 어느 것도 discovery가 아니다. 카탈로그는 "뭐가 어디 있나"에 답한다. control plane은 "이걸 만들어라, 맞는 region에서 모델에 묶어라, 누가 승인했는지 governed 레코드로 남겨라"에 답한다. AWS Agent Registry는 앞엣것을 한다. inference profile을 만들지 않고, region별 모델 바인딩을 하지 않고, 네 capability governance form을 소유하지 않는다.

그러니 진짜 질문은 "AWS냐 내 것이냐"가 아니다. "나는 이 두 가지 일 중 뭘 하고 있고, 나머지 하나는 이미 해결돼 있나"다.

## 구체적인 예시

support agent를 운영한다고 하자. tool 두 개를 쓰고 MCP server 하나랑 얘기한다. 질문 세 개.

1. **다른 팀이 이 agent랑 tool을 중복으로 만들기 전에 찾을 수 있나?** 이게 discovery다. AWS Agent Registry가 답하고, auto-detect가 그 답을 공짜로 최신 유지한다.
2. **agent가 LLM을 쓸 때, 맞는 계정에서 region에 묶인 모델 resource를 만들고 실패 시 rollback하는 건 누가 하나?** 이게 provisioning이다. AWS Agent Registry는 이걸 안 한다. 직접 만들거나 모델 배선을 수동으로 하는 수밖에.
3. **risk 리뷰, lifecycle 상태, 이 agent를 배포시킨 승인은 누가 기록했나?** AWS Agent Registry에 approval workflow랑 CloudTrail이 있으니 일부는 커버된다. 도메인 특화 compliance form은 여기 안 들어간다.

AWS Agent Registry 전에는 팀이 카탈로그를 옆에서 손으로 관리했고, 누가 업데이트를 까먹는 순간 어긋났다. 이후엔 카탈로그가 AgentCore에서 스스로 유지된다. 이건 진짜 이득이고, provisioning control plane이 여전히 필요한지와는 별개의 축이다.

## 결정 가이드

위에서 아래로 훑어보자.

- **discovery랑 governance 메타데이터만 필요하다(agent 찾고, 승인하고, audit).** AWS Agent Registry 도입하고 손으로 관리하던 카탈로그는 지운다. 제일 깔끔한 경우다.
- **네 "registry"가 사실 backing resource를 provisioning한다(inference profile, region별 모델 바인딩, rollback).** 유지해라. AWS Agent Registry가 이걸 대체 못 한다. 대신 네 control plane이 AWS Agent Registry로 레코드를 밀어넣는 producer가 되게 만드는 걸 고려해라. 카탈로그를 두 개 굴리지 않고도 discovery를 얻는다.
- **두 가지 일이 한 서비스에 엉켜 있다.** 제일 흔하고 제일 아픈 경우다. 쪼개라. provisioning과 governance 로직은 네 control plane이고 네 것으로 남는다. 카탈로그 view는 얇은 projection이라 AWS Agent Registry에 넘길 수 있다. agent가 AgentCore에서 돌면 auto-detect가 카탈로깅을 대신해주니 더 그렇다.

보통 이기는 레이어링은 이렇다. 네 control plane이 provisioning과 authoritative governance 레코드를 소유하고, AWS Agent Registry가 그 위에 discovery/search 표면으로 얹힌다. 한쪽은 만들고 governance하고, 다른 쪽은 찾는다.

## 내가 조심할 함정들

- **"registry GA"를 "네 registry는 이제 폐물"로 읽지 마라.** 네 물건이 resource를 provisioning하는지부터 확인해라. 그렇다면 이 발표는 대체가 아니라 덧붙임이다.
- **auto-detect는 AgentCore 범위로 한정된다.** agent가 다른 데서 돌면 레코드가 알아서 안 채워지고, 다시 수동 등록이나 custom feeder로 돌아간다.
- **region 가용성.** GA 시점엔 다섯 region이다. US East(버지니아 북부), US West(오레곤), 도쿄, 시드니, 아일랜드. 마이그레이션 계획 전에 네 region이 포함되는지 확인해라.
- **카탈로그 두 개는 하나보다 나쁘다.** AWS Agent Registry를 도입하면서 "혹시 몰라" 손으로 관리하던 카탈로그를 남겨두면, 서로 어긋나는 source of truth가 둘이 된다. 하나를 카탈로그로 정하고 나머지는 producer나 consumer로 만들어라.

## 그래서 뭘 해야 하나

이 발표 앞에서 자기 registry를 노려보고 있다면, 아키텍처 논쟁 전에 grep 하나만 돌려봐라. 등록 시점에 backing resource를 만드나, 아니면 메타데이터만 저장하나. 메타데이터만 저장한다면 AWS Agent Registry가 대체 후보로 강력하다. 모델을 provisioning하고 바인딩한다면, 그건 AWS Agent Registry가 대체가 아니라 보완하는 control plane이다. 그럴 땐 네 레코드를 거기로 밀어넣고 discovery는 AWS Agent Registry한테 맡기는 게 맞다.
