---
title: "Alexa Developer Console에서 APL 터치 이벤트를 테스트하는 법"
date: 2026-08-29
author: Yoonsoo Park
description: "초안: Alexa Presentation Language 터치 상호작용을 Developer Console에서 테스트하는 방법. APL 활성화, development endpoint, UserEvent request, 여러 viewport, voice-only fallback을 다룬다."
categories:
  - Voice AI
  - Software Development
tags:
  - Alexa Skills Kit
  - Alexa Presentation Language
  - Multimodal UI
  - Testing
  - Voice AI
draft: true
---

> **초안 — 완료된 검증 보고서가 아니라 구현 메모다.** 여기서 설명하는 trivia skill의 APL 화면 작업은 구현·merge됐지만, Developer Console simulator, beta endpoint, 실제 기기 검증은 아직 완료되지 않았다. 이 글은 release됐거나 hardware에서 검증됐다는 증거가 아니라 앞으로 따를 테스트 계획이다.

Alexa Presentation Language(APL)를 쓰면 화면이 있는 Alexa 기기를 단순한 대화 transcript 표시에서 게임을 실제로 조작하는 화면으로 바꿀 수 있다. trivia game이라면 choice가 큰 tap target이 되고 score는 계속 보이며 사용자는 번호를 기억하지 않고 답을 고를 수 있다.

처음 맞닥뜨리기 쉬운 실패는 이렇다. local fixture에서는 document가 보이는데 Developer Console에서 tap해도 아무 일도 일어나지 않는다. 대개 style 문제가 아니다. APL의 `SendEvent` command와 development endpoint의 `Alexa.Presentation.APL.UserEvent` handler 사이에 연결 하나가 빠진 문제다.

## 상호작용 경로부터 이해한다

visual document와 voice skill은 하나의 대화다. 버튼 tap이 APL document 안에서 game state를 바꾸는 것이 아니다. tap은 skill로 request를 보낸다.

```text
사용자가 답을 tap한다
        |
APL component가 SendEvent를 실행한다
        |
Alexa가 Alexa.Presentation.APL.UserEvent를 보낸다
        |
ASK SDK handler가 event를 검증하고 같은 game engine을 진행한다
        |
Skill이 speech와 갱신된 RenderDocument를 응답한다
```

Amazon의 [ASK SDK APL 가이드](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/use-apl-with-ask-sdk.html)는 `SendEvent`가 `UserEvent` request를 만들고, 일반 skill request handler가 source나 arguments로 event를 구분해 다음 응답을 만든다고 설명한다.

설계 규칙은 하나다. **voice와 touch가 같은 game action을 호출해야 한다.** choice 3을 tap하는 일은 "three"라고 말하는 일과 같은 `answerCurrentQuestion`을 불러야 한다. APL 전용 handler에 게임 규칙을 복사하면 두 경로는 반드시 어긋난다.

## Developer Console 사전 조건 네 가지

visual interaction을 테스트하기 전에는 연결 네 개를 모두 확인한다. Amazon의 [APL simulator 문서](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/test-apl-skills-dev-console.html)도 같은 조건을 요구한다.

1. interaction model에 invocation name과 sample utterance를 가진 custom intent가 있다.
2. model build가 error 없이 끝났다.
3. development endpoint가 유효하고 의도한 Lambda code가 그곳에 배포됐다.
4. skill에 `Alexa.Presentation.APL` interface가 활성화됐다.

Lambda alias를 쓰는 release라면 endpoint를 더 구체적으로 확인한다. Development version은 unqualified function ARN이나 `prod` alias가 아니라 qualified `beta` alias ARN을 써야 한다. 그래야 simulator test가 customer traffic을 실수로 실행하지 않는다.

Lambda permission도 alias와 일치해야 한다. Alexa가 그 alias를 호출할 permission이 없다면 Console request가 맞아 보여도 application code에 도달하기 전에 실패한다.

## 첫 visual은 작게 만든다

처음부터 animated dashboard를 만들지 않는다. 질문 하나, 보이는 choice 네 개, 명확한 selected state로 시작한다.

```json
{
  "type": "TouchWrapper",
  "onPress": [
    {
      "type": "SendEvent",
      "arguments": ["answer", "choice-3"]
    }
  ],
  "item": {
    "type": "Text",
    "text": "3. Saturn"
  }
}
```

backend handler는 `arguments`를 외부 입력처럼 다룬다. event type이 `Alexa.Presentation.APL.UserEvent`인지, action이 현재 화면에서 허용하는 것인지, choice가 현재 question에 속하는지, session이 asking phase인지 검증한다. 이전 document에서 온 event가 새 질문에 답하면 안 된다.

```ts
export const AplUserEventHandler = {
  canHandle(input: HandlerInput) {
    return input.requestEnvelope.request.type
      === "Alexa.Presentation.APL.UserEvent";
  },
  handle(input: HandlerInput) {
    const args = input.requestEnvelope.request.arguments ?? [];
    if (args[0] !== "answer" || typeof args[1] !== "string") {
      return invalidVisualAction(input);
    }
    return answerFromChoiceId(input, args[1]);
  },
};
```

정확한 TypeScript narrowing은 project의 ASK SDK model type에 따라 달라진다. 중요한 invariant는 event argument가 ID여야 한다는 점이다. question text나 state 전체를 다시 복사하지 않는다.

## Console에서는 이 순서로 테스트한다

1. skill의 **Test** 탭을 열고 testing stage를 **Development**로 둔다.
2. **Device Display**를 고른다. voice나 text로 skill을 invoke하고 game을 시작한다.
3. Skill I/O 아래의 screen simulator로 내려가 viewport를 하나 고른다.
4. answer 하나를 tap한다. Skill I/O에서 `Alexa.Presentation.APL.UserEvent` request를 보고, response가 speech와 다음 화면을 모두 내는지 확인한다.
5. 새 session에서 spoken answer도 테스트한다. score, question index, 다음 화면이 tap 경로와 같아야 한다.
6. stale event도 테스트한다. game이 끝난 뒤 tap하고 restart 뒤 이전 화면 action을 시도한다. score를 조용히 바꾸지 말고 안전한 prompt로 복구해야 한다.

[Alexa simulator 문서](https://developer.amazon.com/en-US/docs/alexa/devconsole/alexa-simulator.html)는 simulator가 skill session을 유지한다고 설명한다. 한 game flow를 테스트하기에는 좋다. 그래도 simulator일 뿐이다. 최종 gate에는 지원하는 화면 기기 하나와 voice-only 기기 하나가 각각 필요하다.

## Viewport와 version fallback을 테스트한다

APL은 화면 크기 하나가 아니다. Developer Console simulator에서 여러 viewport를 preview할 수 있지만, preview와 함께 layout 계약이 있어야 한다.

| 상황 | 기대 동작 |
| --- | --- |
| 넓은 hub display | question과 모든 choice가 잘리지 않고 들어가며 tap target이 겹치지 않는다. |
| 작은 round 또는 rectangular display | text가 의도적으로 reflow 또는 scroll되고 도달할 수 없는 답이 없다. |
| Voice-only device | 같은 question을 읽고 answer intent가 동작한다. APL directive가 필요하지 않다. |
| 필요한 APL capability가 없는 device | error 대신 정해 둔 fallback을 사용한다. |

Amazon의 현재 [APL version 문서](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-latest-version.html)는 APL 2024.3의 device support를 보여 주며, 오래된 기기는 최신 version을 지원하지 않을 수 있다고도 설명한다. visual directive를 내기 전 `supportedInterfaces`를 확인하고, 어떤 기기를 지원할지 결정한 뒤 minimum document version을 정한다.

display가 있다고 해서 모든 기기가 custom APL을 지원한다고 가정하면 안 된다. Amazon은 2024 Echo Spot이 custom skill에 `Alexa.Presentation.APL`을 노출하지 않는다고 명시한다. 이 기기에서는 voice-only 경험이 된다. 그래서 voice path는 나중의 대안이 아니라 첫 번째 test case다.

## Trivia 화면의 release gate

**Development** endpoint에서 최소한 다음 경로를 기록해야 한다.

- launch와 default game 시작
- 각 choice 위치의 voice answer와 tap answer
- correct와 incorrect transition
- 화면이 보이는 동안 repeat와 help
- tap할 수 없는 choice를 포함한 hint state
- survival mode 종료, category round 완료, restart, stop, cancel
- 유용한 viewport 두 개 이상에서의 화면 기기
- 같은 대화 경로를 거치는 voice-only 기기

각 case마다 테스트한 alias와 published Lambda version을 남긴다. unit test가 통과했다는 것은 document builder가 그럴듯한 출력을 만들었다는 뜻일 뿐이다. Developer Console이 의도한 endpoint를 향하는지, touch event가 실제로 오는지, 물리 기기에서 읽기 좋은지는 증명하지 않는다.

## 이 초안이 publish되기 전 아직 필요한 것

- Development endpoint가 beta alias를 호출한다는 Console 증거
- touch event와 최소 두 viewport에 대한 simulator 증거
- 실제 화면 기기 pass와 별도의 voice-only 기기 pass
- 실제 request payload나 device rendering에서 찾은 수정 사항
- 문서에 적은 APL version과 component set에 lower-version fallback이 필요한지에 대한 결정

이 검증이 끝나면 이 글은 draft test plan에서 field report로 바꿀 수 있다. 그 전까지 정직한 표현은 더 좁다. APL 구현은 존재하며, Console과 hardware 검증이 다음 release gate다.
