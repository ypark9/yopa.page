---
title: "Trivia Quiz Time — Privacy Policy and Terms"
type: trivia-policy
layout: single
url: /trivia-quiz-time.html
date: 2026-08-23
description: "Privacy policy and terms for the Trivia Quiz Time Alexa skill."
noindex: true
sitemap:
  disable: true
excludeFromArticleSurfaces: true
---

## About Trivia Quiz Time

Trivia Quiz Time is a voice-first trivia game for Amazon Alexa. You can play
Classic, Survival, and Category Challenge games and answer questions by voice
or, on supported devices, by selecting an answer on screen.

This page describes what the Trivia Quiz Time skill backend does with
information received from Alexa. Amazon Alexa may process requests under
Amazon's own privacy terms; this page describes the application operated for
this skill.

## Game state

The skill keeps the current game state in Alexa session attributes while a game
is active. This state includes the selected mode, question identifiers, score,
answer order, and hint state.

The skill does not use an account database, DynamoDB, a leaderboard, account
linking, advertising, or in-skill purchases. Game history is not retained after
the Alexa session ends.

## Information the skill backend does not intentionally retain

The skill backend does not intentionally write the following information to
its application data store or operational telemetry:

- your Alexa user ID or device ID;
- your voice utterance or the raw audio behind it;
- Alexa session attributes;
- the question text, answer choices, or your personal answer history.

Alexa still needs to process a request in order to recognize and route it to
the skill. This page does not change the data handling performed by Amazon's
Alexa service.

## Operational logs

The Lambda backend writes bounded operational events to Amazon CloudWatch Logs
to help detect errors and understand how the game is used. Events contain
fields such as the request type, intent name, locale, game mode, category,
result code, request duration, and the executed Lambda version. They do not
contain the user ID, session attributes, utterance, question text, or answer
choices.

CloudWatch Logs for the skill are configured to be retained for up to 30 days.
They are used for service operation, troubleshooting, and aggregate product
decisions rather than for building a user profile.

## Website analytics

This policy page is hosted on yopa.page. The production website uses an
existing Google Analytics property to measure website page views. That website
measurement is separate from the Alexa skill's gameplay state and operational
logs. The skill does not send Alexa user IDs or voice content to Google
Analytics.

This page does not load the site's blog advertising unit.

## Contact

For questions about Trivia Quiz Time or this policy, contact
[Yoonsoo Park](mailto:yoonsoo@duck.com).

## Terms of use

Trivia Quiz Time is provided as free entertainment. Trivia questions and
explanations are prepared for general interest and may contain mistakes or
become outdated. Do not rely on the skill for medical, legal, financial,
safety-critical, or other important decisions.

The skill does not require an account, charge a fee, or offer purchases. You
may stop using it at any time by ending the Alexa session.

## Effective date

This policy and these terms took effect on August 23, 2026. Material changes
will be reflected on this page with an updated date.
