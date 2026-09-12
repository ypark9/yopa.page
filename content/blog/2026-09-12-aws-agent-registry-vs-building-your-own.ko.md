---
title: "AWS Agent Registry가 GA 됐다. 그래도 직접 만들어야 할까?"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Agent Registry는 agent, tool, skill, MCP server를 위한 governed catalog이자 discovery 레이어다. registry라는 단어가 서로 다른 세 층위를 가리고 있고, AWS가 내놓은 건 그중 하나뿐이다. 내가 만든 게 어느 층위인지 가려보자."
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

이미 "registry"라고 부르는 뭔가를 세워둔 플랫폼 팀이라면 이 발표가 좀 불편하게 다가온다. 우리가 방금 AWS가 공짜로 주는 걸 다시 만든 건가 싶은 거다. 그래서 GA 기능들을 우리 조직이 이미 만든 것들과 하나하나 대봤다. 결론은 "네 걸 걷어내라"가 아니었다. registry라는 단어 하나가 서로 다른 세 시스템의 일을 떠안고 있는데, AWS가 내놓은 건 그중 하나뿐이라는 거였다.

## AWS Agent Registry가 실제로 하는 일

마케팅 걷어내면 **catalog + discovery** 레이어다.

- agent, tool, skill, MCP server, custom resource를 레코드로 등록한다.
- semantic 검색이나 keyword 검색으로 찾는다. 이미 있는 capability를 다시 만들지 않게 해준다.
- 레코드를 approval workflow에 태운다.
- 모든 동작을 CloudTrail로 audit한다.
- CloudFormation, Terraform, CDK로 registry를 코드로 관리하고, 레코드에 태그를 붙여 cost allocation과 access control에 쓴다.
- AgentCore runtime과 gateway에 뜬 agent를 조직 전체에서 auto-detect한다. 수동으로 등록 안 해도 레코드가 최신으로 유지된다.

마지막 항목에서 잠깐 멈췄다. auto-detect는 카탈로그를 손으로 맞춰줄 필요가 없다는 뜻이다. agent가 AgentCore에서 돌면 누가 등록을 기억하든 말든 알아서 뜬다.

## registry라는 단어가 가리고 있는 세 층위

여기 함정이 있다. 내부 시스템 세 개를 놓고 봤는데, 복도에서 얘기할 땐 셋 다 그냥 "레지스트리"라고 부른다. 근데 같은 층위가 아니다. 동료가 이 발표를 가리키며 "이거 우리 agent studio 아냐?"라고 하는 걸 보고 나서야 이 혼동이 손에 잡혔다. 합리적인 질문이고, 답은 "아니다"지만, 왜 아닌지는 짚어둘 가치가 있다.

**1층: catalog / discovery 층.** "어떤 agent랑 tool이 있고, 어디 있고, 누가 승인했고, 검색하게 해줘." 읽고 찾는 표면이다. AWS Agent Registry가 딱 이거다.

**2층: config store + runtime.** "이 agent의 system prompt, 모델, tool 목록, ownership(managed냐 custom이냐), 그리고 실제로 이걸 invoke하는 것." 이게 agent studio다. agent 설정을 저작하고, source of truth로 저장하고, 실행한다. config를 소유하고 실행까지 한다. 카탈로그는 studio가 만들어낸 걸 나열할 순 있어도, 뭘 저작하거나 실행하진 못한다.

**3층: provisioning / governance control plane.** "이 capability가 등록되면 backing resource를 만들어라. region에 묶인 모델 profile을 계정별로, 중간에 실패하면 rollback하고, 누가 승인했는지 governed compliance 레코드로 남겨라." 이 층은 인프라를 실제로 만들고 모델에 묶는다. 카탈로그도 studio도 이건 안 한다.

이제 혼동이 왜 생기는지 뚜렷해진다. studio(2층)는 agent 목록을 갖고 있으니 registry처럼 느껴진다. provisioning control plane(3층)은 capability를 등록하니 이것도 registry처럼 느껴진다. 근데 AWS Agent Registry는 1층이다. agent를 저작하거나 실행하지 않고, 모델 resource를 만들지도 않는다. 나머지 두 층이 만들어낸 걸 색인하고 governance할 뿐이다.

## 구체적인 예시

support agent를 운영한다고 하자. system prompt 하나, 모델 하나, tool 두 개, MCP server 하나랑 얘기한다. 질문 네 개, 각각 다른 층에 떨어진다.

1. **prompt랑 모델, tool 목록은 어디 살고, 뭐가 이걸 invoke하나?** 2층, studio다. AWS Agent Registry는 이걸 저장하지도 실행하지도 않는다.
2. **LLM이 필요할 때, 맞는 계정에서 region에 묶인 모델 resource를 만들고 실패 시 rollback하는 건 누가 하나?** 3층, control plane이다. AWS Agent Registry는 이것도 안 한다.
3. **다른 팀이 중복으로 만들기 전에 이 agent를 찾을 수 있나?** 1층, discovery다. AWS Agent Registry가 답하고, agent가 AgentCore에서 돌면 auto-detect가 그 답을 공짜로 최신 유지한다.
4. **risk 리뷰랑 배포 승인은 누가 기록했나?** 갈린다. AWS Agent Registry에 approval workflow랑 CloudTrail이 있어서 discovery 층 governance는 커버된다. 도메인 특화 compliance form은 보통 3층에 산다.

AWS Agent Registry 전에는 누군가 카탈로그를 옆에서 손으로 관리했고, 누가 업데이트를 까먹는 순간 어긋났다. 이후엔 카탈로그가 AgentCore에서 스스로 유지된다. 이건 진짜 이득이고, studio나 control plane이 여전히 필요한지와는 별개의 축이다. 필요하다.

## 결정 가이드

네 "registry"가 실제로 어느 층인지부터 가려내고 움직여라.

- **메타데이터만 저장한다. agent 찾고, 승인하고, audit.** 1층이다. AWS Agent Registry 도입하고 손으로 관리하던 카탈로그는 지운다. 제일 깔끔한 경우다.
- **agent config를 저작하고 agent를 실행한다(prompt, 모델, tool 목록, invocation).** studio, 2층이다. 유지해라. AWS Agent Registry는 뭘 저작하거나 실행 못 한다. 대신 agent가 AgentCore에서 돌면 auto-detect가 이걸 AWS Agent Registry로 투영하게 두면, 두 번째 목록을 관리 안 하고도 조직 전체 discovery를 얻는다.
- **등록 시점에 backing resource를 provisioning한다(모델 profile, region별 바인딩, rollback).** control plane, 3층이다. 유지해라. AWS Agent Registry가 이걸 대체 못 한다. discovery용으로 레코드를 밀어넣어라.
- **이 중 둘이나 셋이 "registry"라 불리는 한 서비스에 엉켜 있다.** 제일 흔하고 제일 아프다. 층 이름부터 붙이고, 층별로 결정해라. 카탈로그 view는 얇은 projection이라 AWS Agent Registry에 넘길 수 있고, studio랑 control plane은 네 것으로 남는다.

보통 이기는 레이어링은 이렇다. 네 studio가 config와 runtime을 소유하고, 네 control plane이 provisioning과 authoritative governance 레코드를 소유하고, AWS Agent Registry가 그 위에 조직 전체 discovery/search 표면으로 얹힌다. 시스템 셋, 일 셋, 그중 하나를 이제 AWS가 관리해준다.

## 내가 조심할 함정들

- **"registry GA"를 "네 registry는 이제 폐물"로 읽지 마라.** 네 물건이 어느 층인지부터 정해라. 저작하거나 실행하거나 provisioning한다면, 이 발표는 대체가 아니라 덧붙임이다.
- **진짜 위험은 이름 충돌이다.** 세 시스템이 다 "registry"라 불리면, 누군가 studio나 control plane을 카탈로그로 대체하려다 저작·실행·provisioning을 잃는다. 아키텍처 논쟁 전에 층 이름을 대화에 강제로 밀어넣어라.
- **auto-detect는 AgentCore 범위로 한정된다.** agent가 다른 데서 돌면 레코드가 알아서 안 채워지고, 다시 수동 등록이나 custom feeder로 돌아간다.
- **region 가용성.** GA 시점엔 다섯 region이다. US East(버지니아 북부), US West(오레곤), 도쿄, 시드니, 아일랜드. 마이그레이션 계획 전에 네 region이 포함되는지 확인해라.
- **카탈로그 두 개는 하나보다 나쁘다.** AWS Agent Registry를 도입하면서 "혹시 몰라" 손으로 관리하던 목록을 남겨두면, 서로 어긋나는 source of truth가 둘이 된다. 하나를 카탈로그로 정하고 나머지는 producer로 만들어라.

## 그래서 뭘 해야 하나

이 발표 앞에서 자기 "registry"를 노려보고 있다면, 아키텍처 논쟁부터 시작하지 마라. 층 이름 붙이기부터 시작해라. 코드에 질문 세 개를 던져라. agent config를 저작하고 저장하나, agent를 invoke하나, 등록 시점에 backing resource를 만드나. 셋 다 아니고 검색 가능한 메타데이터만 저장한다면, AWS Agent Registry가 대체 후보로 강력하다. 셋 중 하나라도 예라면, 그건 AWS Agent Registry가 대체가 아니라 보완하는 studio거나 control plane이다. 그럴 땐 네 레코드를 거기로 밀어넣고 discovery는 AWS Agent Registry한테 맡기는 게 맞다.
