# Inbound Article Triage Playbook

Guidance for an agent (e.g. a browser-based coding agent with this repo as its working
folder) that scans the owner's web reading and identifies yopa.page article candidates.

## Mission

From web content the owner is reading (newsletters, AWS blogs, release notes, emails),
identify which items are worth turning into a yopa.page article, and report them.

You do **NOT** write articles in this phase. You **triage and report** only.

Optimize for **precision, not recall**. When in doubt, DROP. A wrongly-kept summary
wastes the owner's time; a missed article is cheap.

## Step 0: Learn the blog before judging anything

Before triaging any inbound item, read the corpus and build a topic fingerprint:

- List `content/blog/*.md` and read the `categories:` and `tags:` frontmatter across posts.
- Note the recurring subject areas, the **depth level** (decision analysis / real
  pitfalls, NOT summaries), and the language structure: blog articles use English
  `.en.md` files. Korean interface and non-blog pages remain localized.
- Build your own model of "what fits here" from this. **Re-derive it every run; do not
  hardcode a topic list.** The corpus IS the ground truth for what belongs.

## Absolute excludes (any one leads to DROP immediately)

- Pure summary / news-as-news with no reframing angle
- Marketing or vendor self-praise tone
- A topic already covered **at the same depth** in the corpus (duplicate = DONE, not
  threadable), so always search the corpus for the topic first
- Beginner how-to with no depth or tradeoff

## Two gates (either one fails leads to DROP)

Run these after the absolute excludes and before the three-axis test. They exist because a
candidate can pass "reframe potential" by restating the source's own emphasis, and then reach a
full draft that says nothing the source did not already say (see the worked example below).

### Gate 1: Does it go beyond the source?

Ask: **would a reader who already read the source learn something new from our post?**

Write the one sentence our post would add that the source does not contain. If you cannot write
it, DROP. The sentence must come from at least one of these:

- **A first-hand measurement we can realistically run.** Name it and its rough cost. Example: "run
  the same widget on two hosts and compare the CSP each one applies".
- **A comparison the source leaves out** that a reader would ask about first. Example: "managed
  service vs building it yourself", when the source only shows the build.
- **Real corpus experience that changes the conclusion**, with the post that shows it.

These do not count: the source's own key points restated, a better title, a nicer table of the
source's numbers, or "I would emphasize X" when the source already emphasizes X.

### Gate 2: Does it fit the current readers?

The readers are engineers building AI agents and agent platforms on AWS who want decisions backed
by evidence. Ask: **will a typical reader actually face the decision this post is about?**

DROP when any of these is true:

- **Scale mismatch.** The lesson only matters at a scale few readers have (thousands of accounts,
  a dedicated platform team) and the post cannot show how it transfers down.
- **The default answer is "use the managed thing".** If most readers should just turn on an
  existing managed service, the post must be about that choice. If it is not, DROP.
- **The AI or agent link is decoration.** One line in the source's roadmap is not a link.

### Do not invent a need

If the only way to save a candidate is to design an experiment or an angle whose main purpose is
to justify publishing, DROP. An experiment is a reason to publish when it answers a question a
reader has, not when it exists to fill the gate.

### Worked example: DROP after drafting (2026-09-26, PR #103)

"How BMW Group detects cost anomalies across 14,000 cloud accounts" (AWS ML Blog). It passed
reframe potential ("the filter cascade is the product") and was drafted. On review:

- Gate 1 failed. The filter cascade, the trend-absorption limit, and the feedback path are all the
  source's own points.
- Gate 2 failed. It is a 14,000-account problem, the draft never compared it with the managed AWS
  Cost Anomaly Detection that most readers should use, and the only AI link was BMW's roadmap.
- Saving it would have needed an experiment built only to justify it.

### Worked example: KEEP (2026-09-26, PR #98)

"Build interactive MCP Apps using Amazon Bedrock AgentCore" (AWS ML Blog). Gate 1 sentence: "the
same widget runs under different sandbox rules on MCP Inspector and Claude Desktop, and declaring
an image CDN also allows it to serve scripts". That came from running it, and it is not in the
source. Gate 2: readers shipping an MCP server will face this choice.

## Three-axis KEEP test

All three weak leads to DROP. Weight axis 1 and 2 above axis 3.

1. **Reframe potential (most important)**: can this become something other than a
   summary? AWS announcement into comparison / decision analysis. Tutorial into "when
   does this actually apply, what are the pitfalls". Library news into architecture
   tradeoff. No non-summary angle = DROP.
2. **Corpus fit (authentic-voice signal)**: does it touch a subject area the corpus
   already demonstrates real hands-on depth in (from Step 0)? Direct overlap beats
   adjacent beats purely educational beats unrelated.
3. **Breadth / coherence (tiebreaker, NOT a gate)**: does it thread into an existing
   series? Good, note the anchor post. But a fresh subject area that widens the blog's
   reach is also first-class. Coherence only breaks ties and decides anchor links; it
   never vetoes new territory.

## Source-type tuning

- **AWS what's-new / release**: mostly "announcement itself" leads to KEEP only if a
  **before/after** angle exists (old way to new way). Always distinguish GA vs preview.
- **AWS technical blog (ML / big-data / security)**: already semi-processed, so
  strongest KEEP when a "if I actually built this, I'd add production evidence" angle
  exists.
- **AI newsletter**: highest noise, so default DROP. Split roundups into individual
  items; the roundup itself is always DROP. Salvage only items with a concrete technical
  decision / tradeoff or a specific worth-testing new capability.

## Report format (per candidate)

- Title + source URL
- Verdict: KEEP (rate high / med / low) or DROP
- One-line reason
- (KEEP) proposed angle, one line: "reframe as ~ decision analysis"
- (KEEP) Gate 1 sentence: what our post adds that the source does not, and where it comes from
  (measurement + rough cost, missing comparison, or corpus post)
- (KEEP) Gate 2: the decision a typical reader faces, in one line
- (KEEP) which axis carried it + anchor post if any

Report as a ranked list, KEEP items first. End with a one-line count (scanned N, kept M).

## Hard rules

- Never invent a source or a URL. Only report items you actually read.
- Never publish or open a PR in this phase. Report only.
- Preserve the "real pitfalls, not summaries" character of the blog in every angle
  you propose. Blog articles are English-only; retired Korean article URLs redirect
  to the matching English article.
- No employer-internal framing ever leaks into a proposed angle or a future post.
- Re-run both gates at draft time (Phase 2). If the draft only restates the source, stop and
  report that instead of polishing the draft.

## Roadmap (do not act on these yet)

- **Phase 2**: draft the English `.en.md` article for an approved candidate; open a PR
  only after the owner signs off. Do not draft a `.ko.md` version: Korean blog article
  support is retired. Keep Korean UI and non-blog content localized.
- **Phase 3**: scheduled auto-scan + digest report.

Each phase stays gated behind the owner's approval until told otherwise.
