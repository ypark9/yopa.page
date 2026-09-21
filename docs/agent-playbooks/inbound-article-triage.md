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
  pitfalls, NOT summaries), and the bilingual `.en.md` / `.ko.md` structure.
- Build your own model of "what fits here" from this. **Re-derive it every run; do not
  hardcode a topic list.** The corpus IS the ground truth for what belongs.

## Absolute excludes (any one leads to DROP immediately)

- Pure summary / news-as-news with no reframing angle
- Marketing or vendor self-praise tone
- A topic already covered **at the same depth** in the corpus (duplicate = DONE, not
  threadable), so always search the corpus for the topic first
- Beginner how-to with no depth or tradeoff

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
- (KEEP) which axis carried it + anchor post if any

Report as a ranked list, KEEP items first. End with a one-line count (scanned N, kept M).

## Hard rules

- Never invent a source or a URL. Only report items you actually read.
- Never publish or open a PR in this phase. Report only.
- Preserve the bilingual and "real pitfalls, not summaries" character of the blog in
  every angle you propose.
- No employer-internal framing ever leaks into a proposed angle or a future post.

## Roadmap (do not act on these yet)

- **Phase 2**: draft the `.en.md` / `.ko.md` pair for an approved candidate; open a PR
  only after the owner signs off.
- **Phase 3**: scheduled auto-scan + digest report.

Each phase stays gated behind the owner's approval until told otherwise.
