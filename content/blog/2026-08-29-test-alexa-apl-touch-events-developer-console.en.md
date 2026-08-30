---
title: "How to Test Alexa APL Touch Events in the Developer Console"
date: 2026-08-29
author: Yoonsoo Park
description: "Draft field guide for testing Alexa Presentation Language touch interactions in the Developer Console: enable APL, configure a development endpoint, inspect UserEvent requests, test multiple viewports, and keep a voice-only fallback."
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

> **Draft — implementation notes, not a completed validation report.** The APL screen work described here has been implemented and merged for a trivia skill, but the Developer Console simulator, beta endpoint, and physical-device checks have not yet been completed. Treat this as the test plan I will follow, not evidence that the experience is released or hardware-verified.

Alexa Presentation Language (APL) can turn a screen-equipped Alexa device from a transcript display into a playable visual surface. For a trivia game, that means answer choices can become large tap targets, the current score can stay visible, and a player can select an answer without remembering a number.

The first failure mode is deceptively simple: the document renders in a local fixture, but a tap does nothing in the Alexa Developer Console. That is usually not a styling problem. It is a missing link in the path from APL's `SendEvent` command to an `Alexa.Presentation.APL.UserEvent` handler in the development endpoint.

This draft documents the test path before calling an APL release complete.

## Understand the interaction path

The visual document and the voice skill remain one conversation. A button tap does not mutate your game state inside the APL document; it sends a request back to the skill.

```text
Player taps an answer
        |
APL component runs SendEvent
        |
Alexa sends Alexa.Presentation.APL.UserEvent
        |
ASK SDK handler validates the event and advances the same game engine
        |
Skill responds with speech + an updated RenderDocument
```

Amazon's [ASK SDK APL guide](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/use-apl-with-ask-sdk.html) documents this exact pattern: `SendEvent` creates a `UserEvent` request, and a normal skill request handler identifies the source or arguments and returns the appropriate next response.

The practical design rule is: **voice and touch must call the same game action.** A tap on choice 3 should use the same `answerCurrentQuestion` operation as a spoken "three." Duplicating game rules in an APL-specific handler is how the two modes drift apart.

## Prerequisites in the Developer Console

Before testing a visual interaction, verify all four configuration links. Amazon lists the same prerequisites in its [APL simulator documentation](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/test-apl-skills-dev-console.html):

1. The interaction model has an invocation name and at least one custom intent with sample utterances.
2. The model builds without errors.
3. The development endpoint is valid and the intended Lambda code is deployed there.
4. The `Alexa.Presentation.APL` interface is enabled for the skill.

For a release that uses Lambda aliases, make the endpoint check precise. The Development version should use the qualified `beta` alias ARN, not an unqualified function ARN or the `prod` alias. Then a simulator test cannot accidentally exercise customer traffic.

Also confirm that the Lambda permission matches the qualified alias. A request can look correct in the Console while failing before application code if Alexa is not permitted to invoke that alias.

## Build a small first visual

Do not start with an animated dashboard. Start with one question, four visible choices, and a clear selected state.

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

The backend handler should treat the values in `arguments` as external input. Validate that the event type is `Alexa.Presentation.APL.UserEvent`, that the action is one your current screen allows, that the choice belongs to the current question, and that the session is actually in an asking phase. An event from an old document must not answer a newer question.

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

This code is intentionally a sketch. Exact TypeScript narrowing depends on the ASK SDK model types in the project. The invariant matters more: event arguments are identifiers, not a second copy of question text or state.

## Test in the Console, in this order

1. Open the skill's **Test** tab and set skill testing to **Development**.
2. Select **Device Display**. Invoke the skill and begin a game through normal voice or text input.
3. Scroll beyond Skill I/O to the screen simulator. Select a viewport from the available list.
4. Tap one answer. Inspect Skill I/O for an `Alexa.Presentation.APL.UserEvent` request and confirm the response both speaks and renders the next state.
5. Repeat from a new session with a spoken answer. The score, question index, and next screen should match the tap path.
6. Exercise an invalid or stale event path: tap after the game ends, invoke a restart, and then try a prior screen's action if the simulator permits it. The skill should recover to a safe prompt, never silently change score.

The [Alexa simulator guide](https://developer.amazon.com/en-US/docs/alexa/devconsole/alexa-simulator.html) says that the simulator maintains a skill session, which is useful for a full game flow. It is still a simulator. The final checks need at least one supported screen device and one voice-only device.

## Test viewports and version fallbacks

APL is not one screen size. The Developer Console simulator lets you preview different viewports, but that preview must be paired with a layout contract:

| Scenario | Expected behavior |
| --- | --- |
| Wide hub display | Question and all choices fit without clipping; tap targets remain distinct. |
| Smaller round or rectangular display | Text reflows or scrolls intentionally; no unreachable answer. |
| Voice-only device | The same question is spoken and answer intents still work; no APL directive is required. |
| Device without a required APL capability | The skill uses a documented fallback rather than returning an error. |

Amazon's current [APL version page](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-latest-version.html) lists device support for APL 2024.3 and also makes the compatibility point explicit: older devices may not support the latest APL version. Check `supportedInterfaces` before emitting a visual directive, and set a minimum supported document version only after deciding what devices you will support.

One especially easy mistake is to assume that every device with a display supports custom APL. Amazon notes that the 2024 Echo Spot does not expose `Alexa.Presentation.APL` to custom skills; it remains a voice-only experience for this purpose. That is why the voice path is a first-class test case, not a fallback afterthought.

## A release gate for a trivia screen

The minimum acceptance record should cover the following paths on the **Development** endpoint:

- launch and begin a default game;
- voice answer and tap answer for each choice position;
- correct and incorrect transitions;
- repeat and help while the screen is visible;
- hint state, including disabled choices that cannot be tapped;
- survival-mode loss, category-round completion, restart, stop, and cancel;
- a screen device on at least two useful viewports; and
- a voice-only device with the same conversation paths.

For each case, record the alias and published Lambda version tested. Passing unit tests proves that the document builder emitted something plausible. It does not prove that the Developer Console is targeting the intended endpoint, that touch events arrive, or that a real device renders the layout readably.

## What this draft still needs before publication

- Console evidence that the Development endpoint invokes the beta alias.
- Simulator evidence for touch events and at least two viewports.
- A real screen-device pass and a separate voice-only-device pass.
- Any corrections discovered from the actual request payloads or device rendering.
- A decision on whether the documented APL version and component set need a lower-version fallback.

Once those checks are complete, this guide can graduate from a draft test plan into a field report. Until then, the honest claim is narrower: the APL implementation exists, and its console and hardware validation is the next release gate.
