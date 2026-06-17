---
title: "AWS WAF AI Traffic Monetization: 25년 묵은 HTTP 402가 살아났다, 근데 너는 켜지 마라"
date: 2026-06-17T02:30:00-04:00
author: Yoonsoo Park
description: "AWS WAF가 이제 엣지에서 AI 봇한테 가격을 매기고 결제를 받는다. x402 프로토콜이랑 HTTP 402 Payment Required로. 새 Bot Control 기능이 뭘 하는지, verified 크롤러랑 unverified 크롤러 가격을 어떻게 가르는지, 그리고 퍼블리셔가 언제 이걸 켜야 하는지(대부분의 무료 사이트는 왜 끄는 게 맞는지) 정리한다."
categories:
  - AWS
tags:
  - waf
  - bot-control
  - x402
  - monetization
  - edge
---

HTTP 상태코드 `402 Payment Required`는 25년 가까이 스펙에 예약어로만 박혀 있었다. 정의는 됐는데 표준화는 안 됐고, 실제로 쏘는 사람도 거의 없었다. 무료 콘텐츠랑 광고 수익으로 큰 웹은 이게 필요 없었으니까.

AI 에이전트가 필요하게 만들었다. 2026년 6월, AWS가 [AI traffic monetization](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-waf-ai-traffic-monetization/)을 새 AWS WAF Bot Control 기능으로 내놨다. 콘텐츠 소유자가 엣지에서 AI 봇/에이전트한테 가격 매기고, 미터링하고, 결제까지 받게 해주는 건데, 방식이 바로 그 죽어있던 `402`를 드디어 일 시키는 거다.

## 뭘 하는 거냐

전부 한 request 사이클 안에서, CloudFront 엣지에서, origin에 닿기도 전에 끝난다:

1. AI 에이전트가 보호된 리소스를 요청한다. article, data feed, 라이선스 archive 같은 거.
2. WAF가 machine-to-machine 결제용 [x402 오픈 프로토콜](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-waf-ai-traffic-monetization/)로 `HTTP 402 Payment Required`를 돌려준다. 응답에 가격, 받는 결제수단, 라이선스 조건이 machine-readable하게 다 들어있다.
3. 에이전트가 결제 증명을 제시한다.
4. WAF가 엣지에서 검증하고, scoped access token을 발급하고, 응답을 내준다.

origin 코드 안 건드린다. 체크아웃 페이지로 redirect도 없다. 협상이 기계 대 기계로 일어나고 한 번의 round trip에 끝난다. 정산이랑 검증은 Coinbase의 x402 Facilitator로 돌고, 페이아웃은 네가 고른 지갑으로 스테이블코인이 꽂힌다. 수익 분석은 기존 AI traffic 대시보드 옆에 WAF 콘솔에서 바로 본다.

## 진짜 흥미로운 건: intent 기반 차등 가격

헤드라인 기능은 결제다. 근데 실제로 흥미로운 건 모두한테 같은 가격을 매길 필요가 없다는 거다.

WAF는 verification status 기반으로 agent policy를 정의하게 해준다. Web Bot Auth 시그니처 포함해서. 그래서:

- **verified AI search crawler**는 한 가격으로 통과시킨다 (그 검색 결과에 들어가고 싶으니까).
- **unverified agent나 training crawler**는 다른, 더 비싼 가격을 매긴다 (아니면 막거나).

이 구분이 중요한 이유는, "AI 봇이 내 사이트를 때린다"가 한 종류의 이벤트가 아니기 때문이다. 유저를 다시 돌려보내주는 search crawler랑, 내 archive를 통째로 빨아먹고 클릭 한 번 안 보내는 training scraper는 경제적으로 정반대다. 예전엔 이 둘을 똑같이 취급하는 것밖에 없었다. 둘 다 막거나, 둘 다 열거나. 이제 intent에 가격이 붙는다.

## 언제 켜야 하나

이건 퍼블리셔 툴이다. 결정 트리는 짧다:

| 네 콘텐츠 | 켤까? |
|-----------|-------|
| 유료 archive, 라이선스 dataset, 독점 data feed, call당 실제 가치 있는 API | **켜라.** 정확히 이걸 위해 만든 기능이다. |
| 이미 paywall 돌리는 프리미엄 리포팅 | **아마도.** 사람용 가격 옆에 agent용 가격 tier를 하나 더 붙이는 셈. |
| 무료 블로그, docs, 마케팅 콘텐츠, 광고나 goodwill로 굴러가는 모든 것 | **끄자.** |

마지막 줄을 좀 붙잡고 가자. "AI 트래픽을 수익화하자"는 본능이 사람을 헛다리 짚게 만드는 지점이 바로 여기니까.

## 무료 사이트가 끄는 게 맞는 이유

콘텐츠가 무료고 목표가 도달이면, AI 에이전트한테 돈 받는 건 세 가지 방향으로 너한테 불리하게 작동한다.

**다른 시그널이랑 모순된다.** `llms.txt`를 발행하고, "이 페이지를 LLM용으로 복사" 버튼을 달고, 인용되고 싶어하는 사이트는 에이전트한테 *제발 좀 빨아가라*고 말하는 거다. 같은 콘텐츠 앞에 `402`를 세우는 건 *먼저 돈 내라*고 말하는 거고. 두 메시지를 동시에 보내면서 둘 중 하나라도 먹히길 기대할 순 없다.

**수익은 이론상 존재한다.** 에이전트가 내는 스테이블코인 마이크로페이먼트는 콘텐츠에 에이전트가 실제로 돈 낼 만한 독립적인 access당 가치가 있을 때만 쌓인다. 개인 블로그의 현실적인 에이전트 수익은 반올림하면 0인 영역이다.

**굴리는 게 공짜가 아니다.** 기능 자체는 추가 비용 없이 제공되지만 standard AWS WAF charges는 그대로 붙는다. Web ACL은 월 고정비가 있고, rule당, request당 요금이 더 붙는다. 수익 0인 사이트에 켜면 너는 수익원이 아니라 청구서를 하나 추가한 거다.

## 켜기 전에 알아둘 함정들

- **출시 시점엔 Coinbase x402가 유일한 facilitator다.** 직접 계좌 결제용 Stripe랑 Machine Payments Protocol(MPP) 지원은 coming soon으로 적혀있다. 지금 당장 fiat 정산이 필요하면 기다려야 한다.
- **페이아웃이 스테이블코인이다.** 지갑을 떠안는 거고, 거기 딸려오는 custody, 회계, 세무 처리까지 떠안는 거다. 콘텐츠 팀이 셋업 안 돼 있을 운영 오버헤드다.
- **"추가 비용 없음"이 "공짜"는 아니다.** standard WAF 요금은 적용된다. Web ACL이랑 request 비용을 네가 상상하는 수익이 아니라 실제로 기대하는 수익에 대고 계산해라.
- **테스트 모드 있다, 써라.** WAF는 라이브 가기 전에 end-to-end 설정을 test mode로 검증하게 해준다. agent identity 기반 차등 가격은 움직이는 부품이 꽤 많아서(verification status, Web Bot Auth, 가격 tier) 진짜 `402`가 나가기 전에 동작을 보고 싶을 거다.

## 결론

여기서 재사용할 아이디어는 "네 블로그에 돈 매겨라"가 아니다. 웹이 기계 트래픽을 위한 native 결제 레이어를 키우고 있고, `402`가 드디어 예약돼 있던 그 상태코드가 됐다는 거다. access당 실제 가치 있는 콘텐츠를 가졌으면, 이건 origin을 갈아엎지 않고 엣지에서 에이전트 접근에 가격을 매기는 방법을 준다. 읽히고 싶은 무료 사이트를 굴린다면, 옳은 수는 이 툴이 있다는 걸 알아두고, 뭐 하는 물건인지 이해하고, 그리고 끄는 거다.

콘솔에 손 뻗기 전에 네가 그 선의 어느 쪽에 있는지부터 알아라.
