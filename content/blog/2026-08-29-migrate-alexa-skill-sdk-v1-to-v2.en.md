---
title: "How to Migrate an Alexa Skill from alexa-sdk v1 to ASK SDK v2 Without Breaking Production"
date: 2026-08-29
author: Yoonsoo Park
description: "A compatibility-first migration playbook for moving a live Node.js Alexa skill from alexa-sdk v1 to ASK SDK v2 and TypeScript: preserve the voice contract, isolate game logic, validate session state, test fixtures, and ship a clean Lambda artifact."
categories:
  - Software Development
  - AWS
tags:
  - Alexa Skills Kit
  - AWS Lambda
  - TypeScript
  - Serverless
---

An old Alexa skill can be more alive than its repository suggests. The code might use `alexa-sdk` v1, its tests might be placeholders, and its Lambda ZIP might contain files that were never meant to deploy. Yet real people can still invoke it every day.

That is the dangerous kind of migration: not a rewrite of a dead demo, but a replacement of a live voice contract.

This is the approach I used while modernizing a long-running trivia skill. The goal was not to make the code look contemporary. The goal was to preserve what customers already knew: the invocation, the default game, the answer flow, and the way a session ends. ASK SDK v2 and TypeScript were the implementation tools; compatibility was the product requirement.

Amazon still documents a [v1 adapter migration path](https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/migration-guide.html), which lets v1 and v2 handlers run side by side. That is a useful bridge for a large skill. For a small skill whose game logic also needed serious tests, I found a direct, tested v2 implementation easier to reason about.

## Start with the contract, not the SDK

Before changing imports, write down the behaviors that must not change. For a quiz skill, that list included:

- the invocation name and supported locales;
- the default launch path and `start game` behavior;
- the accepted answer, repeat, help, stop, cancel, restart, and "I don't know" requests;
- the allowed custom game lengths; and
- the spoken wording that makes a multi-turn session understandable.

This is a contract test list, not a feature list. It answers the question that a compiler cannot: *will an existing player recognize the skill after deployment?*

Capture representative request/response fixtures before the rewrite. A fixture does not need to preserve every random question. It should preserve the decision points: launch, first question, valid answer, invalid answer, a final question, help during a question, and restart after a finished game. If a speech change is intentional, make that a visible fixture change with a reason.

Do the same inventory for the production boundary. Export the development and live skill packages, record the configured endpoint and Lambda policy, and keep a redacted snapshot of runtime configuration and recent aggregate health metrics. A repository is only one source of truth; the skill configuration and deployed artifact are others.

## Separate the game engine from Alexa requests

The hardest bugs in a voice migration often come from putting rules, state mutation, and speech construction in one handler. ASK SDK v2 makes a cleaner split natural:

```ts
// Pure application code: no Alexa SDK objects here.
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

The engine accepts an explicit state and action, then returns an explicit transition. It has no dependency on a request envelope, `responseBuilder`, or session attribute manager. That makes it straightforward to test tricky rules such as a one-use hint, a survival-mode loss, or a final-question transition with a seeded random-number generator.

The Alexa handler becomes an adapter:

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

ASK SDK v2 uses handlers with `canHandle` and `handle`, plus a skill builder that assembles handlers, interceptors, and error handling. The [Node.js SDK setup guide](https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/set-up-the-sdk.html) documents the modular `ask-sdk-core` and `ask-sdk-model` packages; using the focused packages kept this Lambda bundle small and explicit.

## Treat session attributes as untrusted input

A live skill can receive old, incomplete, or malformed session attributes. That can happen after a code change, through a simulator replay, or simply because a prior handler wrote an unexpected shape. Never assume this data is a valid TypeScript object just because it was created by your own code once.

Store a small, versioned state that refers to question IDs rather than duplicating question text:

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

At the boundary, validate the shape and recover safely to the menu when it is not usable. This is deliberately boring behavior: a player loses an unfinished round instead of hearing an exception or a stale prompt. `StartOver` should also reset every game-specific field, not only the score.

For a skill with no cross-session progression, session attributes are enough. Adding DynamoDB just to carry a ten-question game across one session increases privacy and operational work without improving this use case. Keep the question pack as versioned application data, and keep the session as a short-lived pointer into it.

## Choose a migration path deliberately

There are two reasonable routes.

| Route | Good fit | Main trade-off |
| --- | --- | --- |
| v1 adapter, then incremental v2 handlers | A large skill that needs a narrow first change | Both handler models coexist temporarily; handler precedence needs care. |
| Direct v2 rewrite behind compatibility fixtures | A compact skill whose logic and tests both need restructuring | Requires a fuller test suite before the endpoint moves. |

Amazon's migration guide warns that a v1 `Unhandled` function can capture requests before registered v2 handlers see them. That is exactly the kind of subtle behavior a direct rewrite avoids, but it also explains why the adapter can be a sensible low-risk first step for a much larger codebase.

In either route, keep content migration separate from SDK migration. Do not simultaneously rewrite every trivia question, rename every intent, and change the runtime. When something regresses, you want one answer to the question, "which layer changed?"

## Build tests around conversations

I used three layers of tests:

1. **Question-pack validation.** JSON Schema catches missing IDs, an answer that is absent from choices, duplicate choices, and invalid review metadata before a deploy.
2. **Engine tests.** Seeded randomness proves that a hint never hides the correct answer, a category round has unique questions, and survival ends on its first incorrect answer.
3. **Handler fixtures.** Request envelopes exercise the Alexa adapter and compare speech, reprompts, session state, and `shouldEndSession` decisions with the compatibility contract.

Add packaging checks as a fourth gate. Build from a staging directory and fail CI if the ZIP contains `.git`, GitHub workflow files, test output, Terraform files, or a local configuration file. A clean artifact is both smaller and safer. It also prevents a surprisingly common migration mistake: deploying repository history or an accidental credential-bearing file along with the function.

## Move the endpoint only after the code is reversible

The last step is not `npm run build`; it is a rollback design. Publish immutable Lambda versions, point aliases at versions rather than `$LATEST`, and make the development endpoint use a beta alias first. The production endpoint can then remain on its known-good version until the new code has passed simulator and device checks.

The deployment mechanics are covered in [How to Deploy an Alexa Skill with Lambda Versions and Aliases](/blog/2026-08-29-deploy-alexa-skill-lambda-versions-aliases.html). The important migration idea is simpler: your first modern version should be easy to replace with the old one without rebuilding anything.

For a live skill, a successful migration has an intentionally unexciting customer outcome. They say the same thing, hear the same game begin, and never notice that the code behind it has been replaced.

## Migration checklist

- [ ] Export the live and development skill configuration; do not rely on the repository alone.
- [ ] Record the existing voice contract as request/response fixtures.
- [ ] Pick either the v1 adapter bridge or a direct v2 rewrite and state why.
- [ ] Move rules into a pure engine with injected randomness.
- [ ] Validate and version session attributes; recover malformed data to a safe menu.
- [ ] Add question, engine, handler, and artifact-inspection tests.
- [ ] Publish an immutable rollback version before pointing a development endpoint at new code.
- [ ] Test on the simulator and a real device before asking existing customers to absorb the change.
