---
title: "Alexa Skill Certified but Not Live? How Publishing Actually Works"
date: 2026-08-29
author: Yoonsoo Park
description: "A practical guide to Alexa skill version states: why Certified is not necessarily Live, when a publish action is enough, when a changed development version needs a new certification submission, and how to check the endpoint behind each stage."
categories:
  - Voice AI
  - Release Management
tags:
  - Alexa Skills Kit
  - Voice AI
  - Troubleshooting
  - Release Management
---

If the Alexa Developer Console says **Certified** but your Echo still behaves like the old skill, do not start by redeploying Lambda. First identify *which skill version* was certified and whether Amazon has started publishing that exact snapshot.

The short answer is: **Certified means the submitted version passed review. Live means that a version has been published for end users. They are related states, but they are not the same thing.** Amazon's [submission documentation](https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html) explicitly distinguishes development, certified, and live versions.

This distinction matters because you can keep editing a development version while another snapshot is being reviewed or has already passed certification. A development endpoint can also point at newer Lambda code than the public skill uses.

## The three versions you are looking at

Think of the Developer Console as tracking snapshots, not one mutable skill.

| State | What it means | Can end users rely on it? |
| --- | --- | --- |
| **Development / In Dev** | The editable working version. You can change the model, endpoint, and store metadata here. | No. It is for the owner and enabled development testing. |
| **Certified** | A submitted snapshot passed Amazon's certification review. | Not necessarily. It may be waiting for manual publication. |
| **Live** | A published snapshot is available to customers in the configured marketplaces. | Yes, subject to normal store availability and propagation. |

When you publish a skill, Amazon automatically creates a new development version based on the live version so you can continue working. That behavior is documented in Amazon's [skill versioning guidance](https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html). It is convenient, but it causes a predictable confusion: the Console can show a newly editable version next to a certified or live snapshot, and the newer development code is not automatically what customers invoke.

## First question: which publishing preference did you choose?

On the Certification submission page, Amazon offers two different choices:

- **Certify and publish now**: after the skill passes review, Amazon starts the publishing process.
- **Certify now and publish later**: after review, the submitted version moves to Certified and you choose when to begin publishing.

Those are Amazon's terms, not merely UI labels. The [official submission instructions](https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html) state that the first choice starts publication after certification, while the second leaves you with a Certified status until you publish.

So the next action depends on what actually happened:

```text
Certified status
    |
    +-- The certified snapshot is unchanged and you selected publish later?
    |       -> Start publication for that certified version. Do not submit it again.
    |
    +-- You changed the development version after submission?
    |       -> Those changes are a new snapshot. They need their own certification submission.
    |
    +-- You selected publish now, but customers still see old behavior?
            -> Check the Live version, marketplace availability, and the Lambda endpoint
               behind the live configuration before changing code.
```

The important distinction is between **publishing a certified snapshot** and **certifying a newer development snapshot**. Clicking Submit again after only choosing "publish later" starts an unnecessary review cycle. Conversely, publishing the older certified snapshot cannot include code or interaction-model edits made afterward in Development.

## A fast, low-risk investigation

Use this sequence before touching infrastructure.

### 1. Read the version message and submission time

Every certification submission can have a version message. Compare that message and time with your deployment notes. If the message describes the previous release, the Console is telling you the truth: an older snapshot passed, not the change you were expecting.

### 2. Check the certification tab, not only the skill list

Open the skill's Certification tab and inspect Submission. The status there identifies the review result and whether a publish action is still available. The skill list can display multiple stages together, so it is not enough to see the word "Certified" in isolation.

### 3. Compare the Development and Live endpoints

For an AWS Lambda-hosted custom skill, the endpoint ARN is part of the skill configuration. The development version may be aimed at a beta Lambda alias while the live version continues to reference a production alias. That is a good safety pattern, but it means a successful development test proves only the development route.

Do not copy an ARN from one stage to the other as a troubleshooting reflex. First write down:

| Check | Development | Live |
| --- | --- | --- |
| Interaction model build timestamp | | |
| Endpoint ARN or alias | | |
| Lambda published version behind that alias | | |
| Version message / certification snapshot | | |

The gap between those columns is usually the explanation.

### 4. Test the right stage intentionally

The Developer Console simulator can test Development or Live. Select the stage deliberately and keep a fresh session for each comparison. If an Echo is signed in with the developer account, it can also exercise the development version; another household member may only receive the live version. That makes device-account context part of the test record.

### 5. Wait only after the correct publication path is confirmed

Store publication has propagation steps outside your Lambda deploy. Once the Console confirms that the intended certified version is being published, allow time for the live state and store listing to update. If the UI still offers a publish action, waiting will not substitute for starting publication.

## Why redeploying Lambda often does not fix this

Lambda and Alexa skill publication are separate release systems.

```text
Git commit -> Lambda artifact -> Lambda version / alias
                                      |
                                      v
Alexa Development endpoint ----> development testing

Alexa certification snapshot --> review --> certified --> publishing --> Live endpoint
```

Deploying a fresh Lambda artifact can change what an alias serves, but it does not turn a development interaction model into a published Alexa skill. Likewise, a Certified status does not guarantee that your live endpoint points at the newest artifact you expected.

This is why an immutable Lambda version and a clear alias name are useful. A deployment record can say, "development tested version 12 through `beta`; live serves version 11 through `prod`" without exposing an account number or a full ARN. You can then tell whether the issue is publication, endpoint configuration, or code behavior.

## Avoid the two accidental rework loops

**Loop one: submit again because Certified looks unfinished.** If the version is unchanged and the chosen preference was publish later, publish that certified snapshot. A fresh submission is for a fresh development snapshot.

**Loop two: change the development version while investigating.** A small metadata or endpoint edit can create uncertainty about what the next submission contains. Freeze changes briefly, identify the certified snapshot, and record the current development state before acting.

Amazon's [distribution documentation](https://developer.amazon.com/en-US/docs/alexa/custom-skills/submit-an-alexa-skill-for-certification.html) also notes that updates to an already-published skill are made in the development version and then submitted for certification. This is normal release versioning, not a console failure.

## A publish-readiness checklist

- [ ] Confirm whether the intended snapshot is Development, Certified, or Live.
- [ ] Compare version message and submission time with the release you mean to publish.
- [ ] If it is Certified and unchanged, use the appropriate publication action rather than resubmitting.
- [ ] If you changed Development after certification, treat that as a new release candidate.
- [ ] Compare live and development endpoint aliases before altering Lambda.
- [ ] Test the same stage you are diagnosing: Development for beta, Live for customers.
- [ ] Record the version message, endpoint alias, and test result in the release note.

Once you use snapshots as the mental model, the status labels stop being mysterious. Certified answers "did Amazon approve this submitted version?" Live answers "is that version currently published for customers?" Those are two different, equally necessary checks.
