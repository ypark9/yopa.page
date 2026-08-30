---
title: "운영 중인 Alexa Skill을 alexa-sdk v1에서 ASK SDK v2로 안전하게 마이그레이션하는 법"
date: 2026-08-29
author: Yoonsoo Park
description: "Node.js Alexa Skill을 alexa-sdk v1에서 ASK SDK v2와 TypeScript로 옮길 때 invocation과 음성 UX를 지키는 호환성 우선 마이그레이션 방법. 게임 엔진 분리, session state 검증, fixture 테스트, clean Lambda artifact와 rollback까지 다룬다."
categories:
  - Software Development
  - AWS
tags:
  - Alexa Skills Kit
  - AWS Lambda
  - TypeScript
  - Serverless
---

오래된 Alexa Skill은 repository가 보여주는 것보다 훨씬 살아 있을 수 있다. 코드는 `alexa-sdk` v1에 머물러 있고 테스트는 형식만 갖췄으며 Lambda ZIP에는 배포되면 안 될 파일까지 들어 있을 수 있다. 그런데도 실제 사용자는 매일 그 skill을 호출한다.

이때의 마이그레이션은 죽은 demo를 다시 쓰는 일이 아니다. 이미 사용자에게 익숙한 **음성 계약**을 교체하는 일이다.

장기간 운영한 trivia skill을 현대화하면서 목표는 코드를 최신스럽게 보이게 만드는 것이 아니었다. 사용자가 이미 아는 invocation, 기본 게임 시작 방식, 답변 흐름, 게임 종료 방식을 유지하는 것이 목표였다. ASK SDK v2와 TypeScript는 구현 도구였고, 호환성은 제품 요구사항이었다.

Amazon은 v1 handler와 v2 handler를 함께 실행할 수 있는 [v1 adapter 마이그레이션 경로](https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/migration-guide.html)를 지금도 안내한다. 큰 skill을 조금씩 옮길 때 좋은 방법이다. 반면 게임 로직도 함께 테스트하기 쉽게 고쳐야 하는 작은 skill이라면, 검증된 v2 구현으로 직접 옮기는 편이 더 이해하기 쉬웠다.

## SDK보다 먼저 지켜야 할 계약을 적는다

import 문을 바꾸기 전에, 절대로 달라지면 안 되는 동작을 적는다. quiz skill이라면 보통 다음이 대상이다.

- invocation name과 지원 locale
- launch 후 기본 경로와 `start game` 동작
- 답변, repeat, help, stop, cancel, restart, `I don't know` 요청
- 허용하는 게임 길이 범위
- 여러 턴에 걸친 대화를 사용자가 이해하게 하는 speech와 reprompt

이것은 feature 목록이 아니라 **계약 테스트 목록**이다. 컴파일러가 답할 수 없는 질문, 즉 "기존 사용자가 배포 후에도 같은 skill이라고 느낄까?"에 답하기 위한 목록이다.

rewrite 전에 대표적인 request/response fixture를 남긴다. 모든 무작위 문제를 보존할 필요는 없다. launch, 첫 질문, 정상 답변, 잘못된 답변, 마지막 질문, 질문 중 help, 게임 종료 뒤 restart처럼 갈림길이 되는 대화는 남겨야 한다. 의도적으로 speech를 바꾼다면 fixture 차이와 이유를 함께 남긴다.

운영 경계도 함께 조사한다. development와 live skill package를 export하고, endpoint와 Lambda policy, runtime configuration, 최근의 집계 health metric을 민감정보 없이 기록한다. repository만 진실의 원천은 아니다. Skill 설정과 실제 배포 artifact도 각각 진실의 원천이다.

## 게임 엔진을 Alexa request에서 분리한다

음성 마이그레이션의 어려운 버그는 규칙, state 변경, speech 생성이 handler 하나에 섞여 있을 때 생긴다. ASK SDK v2에서는 다음처럼 나누는 편이 자연스럽다.

```ts
// 순수 애플리케이션 코드: 여기에는 Alexa SDK 객체가 없다.
export function answerCurrentQuestion(
  game: GameSession,
  answerId: string,
  pack: QuestionPack,
): GameTransition {
  const question = pack.byId(game.questionIds[game.currentIndex]);
  const correct = answerId === question.answerId;

  return correct
    ? advanceAfterCorrectAnswer(game)
    : finishOrAdvanceAfterWrongAnswer(game);
}
```

엔진은 명시적인 state와 action을 받고 명시적인 transition을 돌려준다. request envelope, `responseBuilder`, session attribute manager를 알 필요가 없다. 그래서 seeded random-number generator를 주입해 hint가 정답을 숨기지 않는지, survival mode가 첫 오답에서 끝나는지, 마지막 질문 전환이 맞는지를 쉽게 테스트할 수 있다.

Alexa handler는 adapter로 남긴다.

```ts
import { getRequestType, getIntentName, HandlerInput } from "ask-sdk-core";

export const AnswerIntentHandler = {
  canHandle(input: HandlerInput) {
    return getRequestType(input.requestEnvelope) === "IntentRequest"
      && getIntentName(input.requestEnvelope) === "AnswerIntent";
  },
  handle(input: HandlerInput) {
    const game = readGameSession(input.attributesManager);
    const transition = answerCurrentQuestion(game, readAnswer(input), questionPack);
    writeGameSession(input.attributesManager, transition.session);
    return speakTransition(input, transition);
  },
};
```

ASK SDK v2는 `canHandle`과 `handle`을 가진 handler, 그리고 handler·interceptor·error handler를 조립하는 skill builder를 사용한다. [Node.js SDK 설정 문서](https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/set-up-the-sdk.html)에 나온 `ask-sdk-core`, `ask-sdk-model`처럼 필요한 모듈만 쓰면 Lambda bundle도 작고 의존성도 명확해진다.

## session attribute는 신뢰하지 않는 입력으로 다룬다

운영 skill은 이전 버전의 session attribute, 불완전한 state, 예상하지 못한 형태의 값을 받을 수 있다. 코드 변경 뒤에도, simulator replay에서도, 이전 handler가 다른 구조를 썼어도 일어난다. 한 번 내 코드가 저장했다는 이유로 TypeScript 객체라고 믿으면 안 된다.

문제 본문을 중복 저장하지 말고 question ID를 가리키는 작고 versioned state를 쓴다.

```ts
interface GameSession {
  schemaVersion: 1;
  phase: "menu" | "asking" | "game-over";
  mode: "classic" | "survival" | "category" | null;
  questionIds: string[];
  currentIndex: number;
  currentChoiceOrder: string[];
  score: number;
  hintAvailable: boolean;
}
```

경계에서 형태를 검증하고, 사용할 수 없으면 안전하게 menu로 돌아간다. 진행 중인 한 판을 잃는 것이 아쉽더라도 예외 메시지나 이전 질문의 reprompt를 듣는 것보다 낫다. `StartOver`도 score만 초기화하지 말고 mode, hint, question order 등 게임별 field를 모두 초기화해야 한다.

session을 넘어선 progression이 필요 없는 skill이라면 session attribute만으로 충분하다. 한 판의 열 문제를 보관하려고 DynamoDB를 넣으면 개인정보와 운영 부담만 늘어난다. question pack은 versioned application data로, session은 그 데이터를 가리키는 짧은 포인터로 둔다.

## 마이그레이션 경로는 의식적으로 고른다

| 경로 | 잘 맞는 경우 | 주요 trade-off |
| --- | --- | --- |
| v1 adapter와 점진적 v2 handler | 첫 변경을 아주 좁게 가져가야 하는 큰 skill | 두 handler 모델이 잠시 공존하며 우선순위를 조심해야 한다. |
| 호환 fixture 뒤의 직접 v2 rewrite | 작은 skill의 로직과 테스트를 함께 정리해야 할 때 | endpoint를 옮기기 전에 더 충실한 테스트가 필요하다. |

Amazon의 migration guide는 v1의 `Unhandled` handler가 등록한 v2 handler보다 먼저 request를 잡을 수 있다고 경고한다. 큰 codebase에서 adapter가 여전히 좋은 이유이면서, 작은 skill의 직접 rewrite가 피할 수 있는 미묘한 동작이기도 하다.

어느 경로를 고르든 content migration은 SDK migration과 분리한다. 모든 trivia 문제를 새로 쓰고, intent 이름을 바꾸고, runtime까지 한 번에 바꾸지 않는다. 회귀가 생겼을 때 "어느 계층이 바뀌었나?"라는 질문에 답할 수 있어야 한다.

## 대화 단위로 테스트를 만든다

나는 테스트를 네 겹으로 나눴다.

1. **Question-pack validation.** JSON Schema로 ID 누락, choice에 없는 answer, 중복 choice, 잘못된 review metadata를 배포 전에 잡는다.
2. **Engine test.** seeded randomness로 hint가 정답을 숨기지 않는지, category round에 중복 문제가 없는지, survival이 첫 오답에서 끝나는지 증명한다.
3. **Handler fixture.** request envelope을 통과시켜 speech, reprompt, session state, `shouldEndSession` 결정을 호환 계약과 비교한다.
4. **Artifact inspection.** staging directory에서 package를 만들고 `.git`, GitHub workflow, test output, Terraform, local config가 ZIP에 들어가면 CI를 실패시킨다.

마지막 항목은 보안과 용량 모두에 중요하다. repository history나 실수로 남은 credential file을 function과 함께 배포하는 흔한 실수를 막아 준다.

## endpoint는 되돌릴 수 있을 때만 움직인다

마지막 단계는 `npm run build`가 아니다. immutable Lambda version을 publish하고 alias가 `$LATEST`가 아니라 version을 가리키게 한다. development endpoint는 먼저 beta alias를 바라보게 한다. production endpoint는 simulator와 기기 테스트가 끝날 때까지 known-good version에 머무를 수 있다.

구체적인 배포 구조는 [Lambda version과 alias로 Alexa Skill을 배포하는 법](/ko/blog/2026-08-29-deploy-alexa-skill-lambda-versions-aliases.html)에서 다룬다. 여기서 중요한 생각은 더 단순하다. 첫 번째 modern version은 무엇이 잘못됐을 때 다시 build하지 않고 이전 버전으로 바꿀 수 있어야 한다.

운영 skill의 성공적인 마이그레이션은 사용자 입장에서 일부러 재미없어야 한다. 사용자는 같은 말을 하고, 같은 게임이 시작되며, 뒤의 코드가 바뀌었다는 사실을 눈치채지 못한다.

## 마이그레이션 체크리스트

- [ ] live와 development skill 설정을 export한다. repository만 믿지 않는다.
- [ ] 기존 음성 계약을 request/response fixture로 남긴다.
- [ ] v1 adapter bridge와 직접 v2 rewrite 중 하나를 고르고 이유를 적는다.
- [ ] 규칙을 injected randomness를 가진 순수 엔진으로 옮긴다.
- [ ] session attribute를 검증·versioning하고 malformed state는 안전한 menu로 복구한다.
- [ ] question, engine, handler, artifact-inspection test를 추가한다.
- [ ] 새 코드로 development endpoint를 바꾸기 전에 immutable rollback version을 publish한다.
- [ ] 기존 사용자에게 반영하기 전에 simulator와 실제 기기에서 테스트한다.
