---
title: "Bedrock가 이제 OpenAI를 말한다: Compatible API는 Converse 옆 어디에 놓이나"
date: 2026-07-17T11:30:00-04:00
author: Yoonsoo Park
description: "Bedrock에 OpenAI/Anthropic 호환 endpoint가 생겼다. API key로 그냥 부른다. InvokeModel, Converse에 이어 모델을 부르는 세 번째 방법이다. 각 층이 실제로 뭘 위한 건지, Converse에 이미 표준화한 팀에겐 무슨 의미인지 정리했다."
categories:
  - AWS
tags:
  - bedrock
  - converse
  - openai
  - api-design
  - llm
---

AWS가 Bedrock에 새 콘솔 경험이랑 OpenAI/Anthropic 호환 API를 냈다. 한 줄 요약은 "OpenAI SDK를 API key로 Bedrock에 그대로 꽂아라." DX 개선으로는 좋다. 근데 Bedrock 위에서 좀 굴려본 사람이면 물어야 할 건 "이거 멋지네"가 아니라 "내가 이미 쓰는 것 옆 어디에 놓이나"다. 이게 이제 Bedrock에서 모델을 부르는 세 번째 방법이고, 세 층은 서로를 대체하지 않는다. 향하는 방향이 다르다.

## 세 개의 층

```
1. InvokeModel       날것. provider마다 request/response body가 다르다.
                     모델 바꾸면 payload 다시 쓴다. 통제는 최대, 이식성은 0.

2. Converse          AWS가 통일한 추상화. Bedrock 위 모든 모델에 같은
                     request 모양. tool use, streaming, system prompt 표준화.
                     코드 안 건드리고 모델 스왑. auth는 SigV4 + AWS SDK.

3. Compatible API    업계 표준 wire format(OpenAI / Anthropic).
                     OpenAI SDK를 Bedrock endpoint에 겨누고 API key로 인증,
                     끝. 기존 OSS랑 툴링이 그냥 돈다.
```

1층은 다들 시작한 곳이고 아무도 눌러앉고 싶지 않은 곳이다. 2층은 진지한 Bedrock 팀 대부분이 정착한 곳인데, "모델만 바꾸고 코드는 그대로"가 격주로 Claude vs Llama vs Nova 재는 상황에서 정확히 원하는 거라서 그렇다. 3층이 이번에 새로 나온 거고, "Converse인데 더 쉬운 거"로 오독하기 쉽다. 아니다.

## Converse와 compatible API는 서로 *다른* 걸 통일한다

이게 핵심이라 정확히 짚고 간다.

Converse는 **AWS 안쪽**을 통일한다. Bedrock이 호스팅하는 모든 모델에 대해 하나의 API 모양을 주니까, 내 코드는 상대가 Anthropic인지 Meta인지 Amazon인지 신경 안 쓰게 된다. 추상화 경계는 "Bedrock 위의 모델 집합"이다.

Compatible API는 **AWS 바깥쪽**을 통일한다. 생태계 나머지가 이미 쓰는 wire format을 주니까, OpenAI용으로 짜인 코드나 OpenAI 스키마만 아는 라이브러리가 거의 수정 없이 Bedrock에서 돈다. 추상화 경계는 "업계 기본 request 포맷"이다.

하나는 안을 보고 하나는 밖을 본다. 그래서 둘 중 하나가 나머지를 죽이지 않는다. 내 문제가 "새 Bedrock 모델 쓸 때마다 payload 다시 쓴다"면 Converse가 풀고 compatible API는 안 도와준다. 내 문제가 "OpenAI 모양 코드가 잔뜩 있거나 OpenAI만 아는 OSS 툴을 Bedrock에 올리고 싶다"면 compatible API가 풀고 Converse는 안 도와준다.

## 진짜 결정은 축 두 개다

마케팅 걷어내면 딱 두 가지로 고르는 거다.

- **Auth.** SigV4 + IAM(Converse, InvokeModel) 대 API key(compatible). IAM은 세밀하고 role 단위로 scoping되고 rotate 가능하고 org가 통제한다. API key는 이식성 좋고 극단적으로 단순하지만 scoping이랑 rotation은 약하다. 엔터프라이즈 계정에선 이 축 하나로 대개 결판나고, IAM 쪽으로 결판난다.
- **Lock-in.** AWS-idiomatic(Converse) 대 portable(compatible). Converse는 AWS-native 심화 기능을 사준다. Compatible 층은 코드를 다른 provider로 최소 수정으로 걸어갈 수 있게 사준다.

프로토타입이나 멀티벤더 팀은 이식성이랑 단순함에 무게를 싣는 편이라 compatible API가 진짜 매력적이다. 엔터프라이즈 팀은 auth랑 거버넌스에 무게를 싣는 편이라 Converse에 머문다. 같은 플랫폼, 반대 기본값, 그리고 고르는 주체 기준으로 둘 다 맞다.

## 팀이 이미 Converse에 표준화했다면

짧게 말하면, 옮길 필요 없고 옮기려고 옮기지 마라.

- **만들어둔 거 아무것도 안 사라진다.** Converse의 guardrails 연동, IAM scoping, tool use 스펙은 AWS-native다. Compatible 층이 그중 뭐 하나 deprecate 안 한다. 기존 코드는 하던 그대로 돈다.
- **얻은 건 더 싼 진입로다.** 진짜 가치는 이미 Converse로 짠 코드를 위한 게 아니다. 안 짠 코드를 위한 거다. OpenAI 모양 스니펫, OpenAI 스키마만 아는 OSS agent framework, 팀원이 OpenAI SDK로 만든 프로토타입, 이런 게 이제 거의 포팅 없이 우리 Bedrock 계정에 착지한다. 유입 마이그레이션 비용이 확 떨어졌고, 신경 쓸 만한 win은 이거다.
- **이식성 층을 이제 직접 안 만들어도 된다.** 많은 팀이 non-AWS 코드를 Bedrock에 겨누려고, 혹은 한 벤더 스키마에 완전히 묶이지 않으려고 얇은 번역 shim을 손수 짰다. Compatible endpoint가 그 층을 흡수한다. 그 이유로 수제 adapter를 유지하고 있었다면, 삭제 후보다.

피할 함정은 새로 나온 managed 편의 서피스를 "다시 짜라"는 명령으로 취급하는 거다. 아니다. AWS 보안 경계 안에 살고 native 기능이 필요한 건 여전히 Converse가 맞는 기본값이다. Compatible API는 바깥에서 들어오는 것들을 위한 문이다.

## 내가 실제로 할 것

AWS-native에 IAM 거버넌스 팀이면 새 first-party 작업은 Converse에 계속 둔다. Compatible endpoint는 딱 이럴 때 꺼낸다. 바깥 코드를 들여올 때, OpenAI만 아는 OSS 툴을 평가할 때, API key가 SigV4 배선보다 나은 버리는 프로토타입을 세울 때. 그리고 수제 OpenAI-to-Bedrock shim을 유지하고 있었다면, 그 코드 다시 건드리기 전에 compatible API 문서부터 읽어라. AWS가 방금 그 adapter를 짐덩어리로 만들었을 수 있으니까.

한 플랫폼에 통일 API가 두 개면 모순처럼 들린다. 하나는 안을 보고 하나는 밖을 보기 때문에만 성립한다. 이번엔 그게 기능이다.
