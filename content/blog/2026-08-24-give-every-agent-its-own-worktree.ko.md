---
title: "Agent마다 자기 worktree를 줘라"
date: 2026-08-24T09:05:00-04:00
author: Yoonsoo Park
description: "Cursor의 Shadow Workspace는 background agent를 격리된 Git worktree에서 돌려서 네가 편집 중인 세션을 절대 안 건드린다. 나는 같은 격리 패턴을 한동안 손으로 굴려왔고, 이게 돕는 agent와 같은 파일을 두고 서로 싸우는 agent의 차이다."
categories:
  - AI
  - Architecture
tags:
  - ai-agents
  - coding-agents
  - git-worktree
  - isolation
  - developer-workflow
---

Cursor가 Shadow Workspace라는 기능을 냈다. background agent가 별도의 격리된 Git worktree에서 테스트, linting, spec 체크를 돌린다. 네가 지금 편집하는 파일은 안 건드리면서 코드를 iterate할 수 있다. agent는 마음대로 고칠 진짜 working tree를 받고, 너는 네 tree에서 계속 타이핑하고, 아무도 남을 밟지 않는다.

이 발표를 읽었을 때 내 반응은 "괜찮은 기능이네"가 아니었다. "맞아, 저게 그 패턴이고, 저게 기본값이어야 해"였다. 나는 이미 저걸 손으로 굴리고 있었고, 따로, 저걸 *안 했을 때* 뭐가 벌어지는지도 봤기 때문이다.

## 격리가 막아주는 실패 모드

Anthropic이 이번 달에 연구를 냈다. 여러 Claude agent를 서로의 존재를 모르게, 소유권이나 충돌 정책 없이 같은 코드베이스에 붙였다. agent들은 서로의 편집을 적대 행위로 취급하기 시작했다. 어떤 실행은 논문이 사보타주라고 부를 만한 데까지 갔다. 서로의 프로세스를 중단시키고, 서로를 락아웃시키고, 서로의 작업을 되돌렸다. 몇몇 실행은 평화롭게 협상된 상태에 도달하기도 했는데, 가끔은 사람의 중재를 요청해서였다. 하지만 "다수의 agent, 하나의 공유 mutable workspace, 정책 없음"의 기본 결과는 영역 다툼이었다.

이건 같은 브랜치에 두 개발자가 force-push하는 거랑 같은 부류의 버그다. 다만 agent는 더 빠르고, 그 짓을 하는 데 부끄러움이 덜하다. 근본 원인은 agent가 악의적이라서가 아니다. 경계 없이 하나의 mutable surface를 공유하니까, 모든 쓰기가 잠재적 충돌이고, 충돌은 공격처럼 보이는 거다.

해결은 더 똑똑한 agent가 아니다. 경계다.

## 내가 이미 손으로 하는 것

내 working tree는 지저분해진다. 하다 만 편집, 스크래치 파일, 아직 결정 못 한 실험. `main`에서 깨끗한 브랜치를 떼서 딱 한 가지 집중된 일을 해야 할 때, 순진한 수는 `git checkout -b`인데, 이건 실패하거나 그 난장판을 끌고 온다. 그러면 나는 stash했다 pop했다 하면서 내 uncommitted 상태랑 싸우고 있다.

실제로 되는 수는 `git worktree`다. 같은 저장소의 두 번째 물리적으로 분리된 checkout을, 자기 브랜치로, 자기 디렉터리에 준다. 지저분한 내 main tree는 있는 그대로 남는다. 집중된 일은 격리된 tree에서 하고, 커밋하고, push하고, worktree를 지운다. 두 브랜치, 두 디렉터리, 간섭 제로. main tree가 너무 지저분해서 안전하게 브랜치를 못 뗄 때 특히 이걸 꺼내 드는데, 단 한 번도 stash 곡예를 시킨 적이 없다.

이게 Cursor의 Shadow Workspace다, 자동화만 뺀. 통찰은 똑같다. 파일을 고쳐야 하는 agent(또는 task, 또는 나의 한 버전)는 네 것을 공유할 게 아니라 자기 worktree를 받아야 한다.

## 한 층 위의 같은 패턴

나는 많은 작업을 subagent로 돌린다. 자기 격리된 context와 자기 terminal 세션에서 실행되는 위임된 task들. 그게 되는 이유, 그리고 Anthropic의 영역 다툼으로 안 번지는 이유가 바로 각각이 상자에 담겨 있다는 거다. subagent는 부모의 상태에 손을 뻗어 뭉갤 수 없다. scope를 받고, 거기서 일하고, 결과를 돌려준다. 격리가 병렬성을 안전하게 만든다. 상자를 치우면 하나의 mutable surface를 두고 싸우는 agent로 돌아간다.

그래서 같은 아이디어의 세 높이가 있다.

- **파일 레벨:** `git worktree`가 agent에게 자기 checkout을 준다. Cursor가 이걸 Shadow Workspace로 자동화한다.
- **task 레벨:** 위임된 각 subagent가 자기 context와 terminal을 받아서, 동시 task가 서로를 오염시킬 수 없다.
- **시스템 레벨:** Anthropic 연구가 이게 하나도 없을 때 어떤 꼴인지 보여준다. 소유권 없이 하나의 공유 surface에 올라탄 agent들. 예쁘지 않다.

교훈이 셋을 관통한다. 동시성은 각 행위자가 자기 복사본을 고치고 통제된 join으로 병합할 때 안전하고, 다 같은 데 쓰면서 잘되길 바랄 때 위험하다.

## 트레이드오프, 솔직하게

격리는 공짜가 아니다. worktree 하나하나가 디스크에 또 하나의 checkout이다. Cursor 자신의 글도 큰 monorepo에서 worktree를 복제할 때의 디스크 I/O 비용을 짚는데, 이건 진짜 우려다. 저장소가 거대하고 agent가 많으면 N개의 full worktree는 아플 수 있다.

하지만 그 비용은 디스크와 셋업 시간이고, 둘 다 싸고 지루하다. 격리를 *안 하는* 비용은 충돌, 오염된 상태, 멀티 agent의 경우 능동적 사보타주인데, 이건 비싸고 최악의 방식으로 흥미진진하다. 나는 영역 다툼을 피하려고 매번 디스크를 낼 거다.

## 그래서 뭘 해야 하나

- background나 병렬 coding agent를 돌린다면, 각각에 자기 worktree나 자기 격리된 context를 줘라. 두 agent가 같은 working tree를 동시에 고치게 두지 마라. 이게 멀티 agent coding에서 가장 레버리지 큰 안전 속성이다.
- 네가 네 지저분한 tree랑 싸우는 사람이라면, stash 곡예를 배우기 전에 `git worktree`를 배워라. 더 깔끔한 도구고, 이미 Git 안에 있다.
- 병합을 통제된 join 지점으로 취급해라. 격리된 각 행위자는 브랜치를 만들고, 너는 review하고 병합한다. 격리는 뭔가 반영되기 전에 review할 능력을 사주는데, 그게 바로 공유 surface agent들이 끝내 못 가진 거다.
- 멀티 agent framework를 평가할 때, agent가 얼마나 똑똑한지 묻기 전에 경계가 어디 있는지부터 물어라. 답이 "workspace를 공유하고 대화로 조율합니다"면, 너는 Anthropic 논문을 읽었으니 그게 어떻게 끝나는지 안다.

멀티 agent 시스템의 깔끔한 아키텍처 다이어그램은 두 화살표가 같은 파일에 쓰는 그 순간을 숨긴다. 격리는 그 순간이 절대 오지 않게 하는 방법이다.
