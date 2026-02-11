---
title: 6 Principles for Increasing Click-Through Rates
date: 2026-02-09
author: Yoonsoo Park
description: "Discover six proven principles to write marketing copy that increases click-through rates, based on insights from Toss Tech, with code examples for implementation."
categories:
  - Marketing
  - Writing
  - Engineering
tags:
  - UX Writing
  - Copywriting
  - Growth
  - A/B Testing
---

> This article is based on the [Toss Tech Blog post "Marketing Writing"](https://toss.tech/article/Marketing_Writing) by Ah-ran Yu.

At Toss, there are strict principles for writing copy that doesn't deceive users. We avoid exaggeration or anxiety-inducing tactics to induce clicks. We use language everyone can understand and avoid slang or jargon specific to certain groups.

But how can you achieve performance with so many constraints? As a UX writer working closely with engineers, the challenge is to increase click-through rates while adhering to these rules. Through hundreds of tests across dozens of services, we've identified patterns in copy that users respond to.

Here are six principles for increasing click-through rates, distilled from those experiments, along with how we can support them technically.

## 1. Deliver Only One Key Message

Don't try to list all the benefits of your service in one line. Instead, give the user just one reason to click right now. Detailed value can be experienced after the click.

**Loser:** Check consumption compatibility and get newlywed support fund
**Winner:** Couple type test arrived: Solve 10 questions and see results

In the "Loser" example, multiple messages cluttered the sentence. By focusing on the immediate action ("Solve 10 questions"), the "Winner" copy saw a 10x increase in impressions and clicks.

## 2. Promise a Definite Reward

Users no longer react just to "maximum benefits". Certainty, even if the amount is small, is more important.

**Loser:** Check July loan capacity and get up to 1 million won
**Winner:** Check July loan capacity and get at least 100 won

Users responded 20 times more to "at least 100 won" than "up to 1 million won". Small but certain rewards reduce the feeling of "it's just an ad".

## 3. Express Actions Lightly

Even for the same action, the weight felt by the user varies depending on the words used. Find words that reduce psychological burden.

**Loser:** If you haven't prepared travel insurance, sign up in 3 minutes
**Winner:** If you haven't prepared travel insurance, prepare in 3 minutes

"Sign up" (ga-ip) suggests paperwork and procedures. "Prepare" (jun-bi) feels like it will finish quickly.

## 4. State the Nature of the Information

Before explaining complex benefits, tell the user what kind of information this is. Is it a collection? Is it something new?

**Loser:** Check loans Kim Toss can receive in October
**Winner:** This month's loan list arrived: View all

Using words like "List" and "View all" clarified that this is a collection of information. Explicitly stating "New" for new products increased click-through rates by 6 times.

## 5. Be Specific with Conditions and Actions

Users click when they clearly understand what they need to do and how much effort it takes.

**Loser:** October financial missions released: Challenge and get points
**Winner:** 4 financial missions released: Challenge and get points

Specifying "4 missions" increased conversion rates by 4 times. It gives a clear goal ("I can do this much"). Similarly, "Fill 8 blanks" performed 2 times better than "Fill blanks".

## 6. Evoke Everyday Experiences

Expressions that remind users of everyday actions are intuitively understood without further explanation.

**Loser:** Pit-a-pat quiz: View answer
**Winner:** Pit-a-pat quiz: Pick answer

"Pick" (jjik-gi) is more intuitive than "View" for a quiz, as it aligns with the physical action of choosing an answer.

---

## Applying These Principles in Code

As developers, we often hardcode strings or bury them in localization files. To apply these principles effectively, we need a flexible structure that allows for easy A/B testing and dynamic value injection.

### 1. Separation of Copy and Logic

Instead of hardcoding "Get up to 1 million won", use a configuration that allows marketing teams to experiment with different phrasings without code changes.

```json
// copy-variants.json
{
  "loan_promotion": {
    "variant_a": {
      "text": "Check July loan capacity and get up to {maxAmount}",
      "highlight": "up to"
    },
    "variant_b": {
      "text": "Check July loan capacity and get at least {minAmount}",
      "highlight": "at least"
    }
  }
}
```

### 2. A/B Testing Component

We can build a `CopyExperiment` component that renders different text based on the user's assigned group. This allows us to test "Definite Reward" vs. "Maximum Benefit" seamlessly.

```tsx
import { useExperiment } from './useExperiment';

interface LoanBannerProps {
  maxAmount: string;
  minAmount: string;
}

const LoanBanner: React.FC<LoanBannerProps> = ({ maxAmount, minAmount }) => {
  const { variant } = useExperiment('loan_promotion');

  // Dynamically injecting values based on the variant
  const isVariantB = variant === 'variant_b';
  const displayAmount = isVariantB ? minAmount : maxAmount;
  const benefitText = isVariantB ? "at least" : "up to";

  return (
    <div className="banner-container">
      <p>
        Check July loan capacity and get <strong>{benefitText} {displayAmount}</strong>
      </p>
      <button onClick={() => console.log('Clicked')}>Check Now</button>
    </div>
  );
};
```

By decoupling the copy from the component logic, we empower writers to iterate on the "Winner" patterns—like emphasizing certainty over maximums—without requiring a full deployment cycle for every text change.

---

Writing marketing copy is not just about what value to deliver, but also about what expressions to use. A single word can change click-through and conversion rates. When you're struggling with copy, try applying these six principles and support them with flexible code.
