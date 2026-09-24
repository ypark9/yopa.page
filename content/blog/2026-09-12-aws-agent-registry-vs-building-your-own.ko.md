---
title: "AWS Agent Registry가 정식 출시됐다. 그래도 직접 구축해야 할까?"
date: 2026-09-12T09:00:00-04:00
author: Yoonsoo Park
description: "AWS Agent Registry는 agent, tool, skill, MCP server를 위한 거버넌스 적용 카탈로그이자 검색 계층이다. ‘registry’라는 말에 가려진 세 가지 계층과 AWS가 제공하는 범위를 살펴본다."
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

AWS Agent Registry는 2026년 8월 31일 정식 출시됐다. 조직 내 agent, tool, skill, MCP server, custom resource를 위한 비공개 거버넌스 카탈로그이자 검색 계층이다. Agent Registry 콘솔, CLI, SDK에서 사용할 수 있으며, AgentCore, Amazon Quick, Kiro에서도 컨텍스트를 전환하지 않고 레코드를 검색할 수 있다.

이미 자체 “registry”를 구축한 플랫폼 팀이라면 이 발표가 불편하게 느껴질 수 있다. AWS가 이제 무료로 제공하는 것을 다시 만든 것은 아닐까 하는 의문 때문이다. 기능을 비교해 본 결과, 기존 시스템을 모두 걷어낼 일은 아니었다. ‘registry’라는 말은 서로 다른 세 시스템을 가리키고 있으며, AWS가 제공한 것은 그중 하나다.

## AWS Agent Registry가 실제로 하는 일

핵심만 보면 **카탈로그와 검색** 계층이다.

- agent, tool, skill, MCP server, custom resource를 레코드로 등록한다.
- semantic 검색이나 keyword 검색으로 찾는다. 이미 있는 capability를 다시 만들지 않게 해준다.
- 레코드를 approval workflow에 태운다.
- 모든 동작을 CloudTrail로 audit한다.
- CloudFormation, Terraform, CDK로 registry를 코드로 관리하고, 레코드에 태그를 붙여 cost allocation과 access control에 쓴다.
- AgentCore runtime과 gateway에 뜬 agent를 조직 전체에서 auto-detect한다. 수동으로 등록 안 해도 레코드가 최신으로 유지된다.

특히 자동 탐지는 카탈로그를 수동으로 최신 상태로 유지할 필요가 없다는 뜻이다. agent가 AgentCore에서 실행된다면 누군가 등록을 잊어도 레코드가 자동으로 나타난다.

## registry라는 단어가 가리고 있는 세 층위

여기에는 흔한 혼동이 있다. 조직에서는 서로 다른 세 시스템을 모두 “레지스트리”라고 부르곤 하지만, 이들은 같은 계층이 아니다. AWS Agent Registry를 에이전트 구성·실행 계층과 같은 것으로 보기 쉽지만, 두 시스템의 책임은 다르다.

**1층: catalog / discovery 계층.** 어떤 agent와 tool이 어디에 있고 누가 승인했는지 찾는 표면이다. AWS Agent Registry가 맡는 역할이다.

**2층: 에이전트 구성·실행 계층.** agent의 system prompt, 모델, tool 목록, ownership, 실행을 관리한다. 설정을 작성해 기준 정보로 저장하고 agent를 실행한다. 카탈로그는 이 계층에서 만들어진 대상을 나열할 수는 있어도 설정을 작성하거나 실행하지는 못한다.

**3층: 프로비저닝·거버넌스 control plane.** capability 등록에 따라 backing resource를 만들고, 계정별·region별 모델 profile을 연결하며, 실패 시 rollback하고, 승인 내역을 compliance 레코드로 남긴다. 이 계층은 실제 인프라를 생성하고 모델을 연결한다. 카탈로그나 에이전트 구성·실행 계층이 맡지 않는 역할이다.

에이전트 구성·실행 계층은 agent 목록을, control plane은 capability 등록을 다루기 때문에 둘 다 registry처럼 보인다. 그러나 AWS Agent Registry는 1층에 해당한다. agent를 작성·실행하거나 모델 resource를 만들지 않고, 다른 두 계층이 만든 대상을 색인하고 거버넌스를 적용한다.

## 구체적인 예시

system prompt 하나, 모델 하나, tool 두 개, MCP server 하나를 사용하는 support agent를 운영한다고 하자. 다음 네 질문은 각각 다른 계층에 속한다.

1. **prompt, 모델, tool 목록은 어디에 있고 무엇이 agent를 실행하는가?** 2층인 에이전트 구성·실행 계층의 역할이다. AWS Agent Registry는 이를 저장하거나 실행하지 않는다.
2. **LLM이 필요할 때, 맞는 계정에서 region에 묶인 모델 resource를 만들고 실패 시 rollback하는 건 누가 하나?** 3층, control plane이다. AWS Agent Registry는 이것도 안 한다.
3. **다른 팀이 중복으로 만들기 전에 이 agent를 찾을 수 있나?** 1층, discovery다. AWS Agent Registry가 답하고, agent가 AgentCore에서 돌면 auto-detect가 그 답을 공짜로 최신 유지한다.
4. **risk 리뷰랑 배포 승인은 누가 기록했나?** 갈린다. AWS Agent Registry에 approval workflow랑 CloudTrail이 있어서 discovery 층 governance는 커버된다. 도메인 특화 compliance form은 보통 3층에 산다.

AWS Agent Registry 전에는 누군가 카탈로그를 옆에서 손으로 관리했고, 누가 업데이트를 까먹는 순간 어긋났다. 이후엔 카탈로그가 AgentCore에서 스스로 유지된다. 이건 진짜 이득이고, studio나 control plane이 여전히 필요한지와는 별개의 축이다. 필요하다.

## 결정 가이드

먼저 자체 “registry”가 실제로 어느 계층에 속하는지 판단해야 한다.

- **메타데이터만 저장한다. agent를 찾고, 승인하고, audit한다.** 1층이다. AWS Agent Registry를 도입하고 수동 카탈로그를 없앨 수 있는 가장 단순한 경우다.
- **agent config를 작성하고 agent를 실행한다(prompt, 모델, tool 목록, invocation).** 2층인 에이전트 구성·실행 계층이다. AWS Agent Registry는 이를 대체하지 못한다. agent가 AgentCore에서 실행된다면 자동 탐지로 AWS Agent Registry에 등록해 조직 전체 검색에 활용한다.
- **등록 시점에 backing resource를 provisioning한다(모델 profile, region별 바인딩, rollback).** 3층인 control plane이다. AWS Agent Registry는 이를 대체하지 못한다. control plane이 관리하는 정보를 AWS Agent Registry에 등록해 검색에 활용한다.
- **둘 이상의 계층이 하나의 “registry” 서비스에 얽혀 있다.** 가장 흔하고 어려운 경우다. 먼저 계층별 책임을 분리한다. 카탈로그 정보는 AWS Agent Registry에 동기화하고, 에이전트 구성·실행 계층과 control plane은 각자의 책임을 유지한다.

일반적으로는 studio가 config와 runtime을, control plane이 provisioning과 권위 있는 governance 레코드를, AWS Agent Registry가 조직 전체의 discovery/search 표면을 맡는 구성이 적합하다. 세 시스템은 각각 다른 일을 하고, 그중 카탈로그 계층을 이제 AWS가 관리한다.

## 주의할 점

- **"registry GA"를 "네 registry는 이제 폐물"로 읽지 마라.** 네 물건이 어느 층인지부터 정해라. 저작하거나 실행하거나 provisioning한다면, 이 발표는 대체가 아니라 덧붙임이다.
- **진짜 위험은 이름 충돌이다.** 세 시스템이 다 "registry"라 불리면, 누군가 studio나 control plane을 카탈로그로 대체하려다 저작·실행·provisioning을 잃는다. 아키텍처 논쟁 전에 층 이름을 대화에 강제로 밀어넣어라.
- **auto-detect는 AgentCore 범위로 한정된다.** agent가 다른 데서 돌면 레코드가 알아서 안 채워지고, 다시 수동 등록이나 custom feeder로 돌아간다.
- **region 가용성.** GA 시점엔 다섯 region이다. US East(버지니아 북부), US West(오레곤), 도쿄, 시드니, 아일랜드. 마이그레이션 계획 전에 네 region이 포함되는지 확인해라.
- **카탈로그 두 개는 하나보다 나쁘다.** AWS Agent Registry를 도입하면서 "혹시 몰라" 손으로 관리하던 목록을 남겨두면, 서로 어긋나는 source of truth가 둘이 된다. 하나를 카탈로그로 정하고 나머지는 producer로 만들어라.

## 적용 방법

자체 “registry”를 검토할 때는 아키텍처 논쟁보다 계층을 구분하는 일부터 시작해야 한다. 코드가 agent config를 작성·저장하는지, agent를 invoke하는지, 등록 시 backing resource를 만드는지 확인한다. 셋 모두 아니라 검색 가능한 메타데이터만 저장한다면 AWS Agent Registry가 강력한 대체 후보가 된다. 하나라도 해당한다면 에이전트 구성·실행 계층이나 control plane에 해당하므로 AWS Agent Registry가 이를 대체할 수 없다. 이 경우 카탈로그 정보를 AWS Agent Registry에 등록하고 검색 기능은 AWS Agent Registry에 맡기는 방식이 적합하다.
