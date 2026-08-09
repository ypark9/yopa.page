# Article Atlas Growth MVP

Status: release candidate; beehiiv publication setup pending
Last updated: 2026-08-09

Fresh-session context: `SESSION_HANDOFF.md`

This is the source of truth for the first Article Atlas growth release. Update
the checkbox and its evidence in the same change that completes each item.
Unchecked owner tasks must never be inferred as complete from code changes.

## Outcome

Ship one bilingual, measurable Expedition that moves a useful article visit
toward deeper discovery and an optional monthly relationship, without accounts,
personal visitor tracking, or gated world features.

## Working rule

- `[x]` means implemented and verified. Add the verification evidence inline.
- `[~]` means implemented but waiting for owner or production verification.
- `[ ]` means not started or blocked.
- Every implementation turn updates this file before handoff.
- Maker's Road, Workshop, App Garden, and Presence remain outside this MVP.

## A. Utility and portfolio layer

- [x] Homepage offers `Solve a problem`, `See what I am learning`, and
  `Explore the Atlas`. Evidence: Hugo production build and EN/KO browser smoke.
- [x] About pages explain purpose, expertise, proof of work, and contact paths
  in English and Korean. Evidence: `content/about.md`, `content/about.ko.md`.
- [x] Journey articles expose a normal article URL and an Expedition CTA.
  Evidence: Hugo output smoke test.
- [x] Article metadata records region, journey, evidence, and era for all five
  bilingual stops. Evidence: `scripts/validate_expeditions.py`.

## B. First Expedition

- [x] `safe-agent-operations` has the same five-stop structure in English and
  Korean. Evidence: expedition validator passes.
- [x] All stops remain reachable without JavaScript. Evidence: static ordered
  list and `<noscript>` fallback in the expedition template.
- [x] Progress is local-only and fails open when storage is unavailable or
  damaged. Evidence: unknown stop IDs are discarded and storage calls are
  guarded.
- [x] Start, stop, and first completion interactions emit coarse GA events.
  Evidence: client tests and browser completion smoke.
- [x] Completion shows principles, checklist, related route, and optional
  Dispatch CTA. Evidence: 5/5 browser interaction smoke.
- [x] Expedition pages contain no article ad or Ko-fi trap. Evidence: EN/KO
  browser DOM smoke.
- [x] Keyboard focus moves to the completion result and progress has an
  accessible label. Evidence: browser completion smoke.
- [x] Responsive mobile browser smoke passes at 390×844 with no horizontal
  overflow and a 52px start action. Evidence: EN Expedition and EN/KO confirmed
  pages in the local browser.
- [x] Reduced-motion behavior selects non-animated scrolling. Evidence:
  `matchMedia("(prefers-reduced-motion: reduce)")` client path and syntax tests.
- [~] Manual screen-reader, browser-enforced blocked-storage, and physical mobile
  touch acceptance remain to be performed before production release.

## C. GA4 aggregate baseline

- [x] Integration decision: use Google's experimental Analytics MCP for
  conversational read-only investigation, while retaining
  `scripts/ga4_baseline.py` for reproducible fixed monthly snapshots.
- [x] Read-only aggregate reporting script exists with four fixed report groups.
- [x] Credential and analytics output paths are ignored by Git.
- [x] Tests exclude user ID, pseudo ID, city, and individual session dimensions.
- [x] Growth funnel includes anonymous page views for only the two language
  confirmation paths; it does not create a subscriber event or identifier.
- [x] **Owner:** created a dedicated Google Cloud project.
- [x] **Owner:** enabled Google Analytics Data API v1 and Google Analytics Admin
  API in that project. The MCP exposes read-only property metadata as well as
  Data API reports.
- [x] **Owner:** created a dedicated service account and stored its JSON key at
  `.secrets/ga4-viewer.json`, outside Git tracking, with mode `600`.
- [x] **Owner:** added the service-account identity to the yopa.page property
  with `Viewer` only; no account-level, Analyst, Editor, or Administrator access.
- [x] **Owner:** recorded the numeric GA4 property ID privately in the ignored
  `.secrets/ga4.env`; no credential value was written to Codex, GitHub, cxdoc,
  logs, or this document.
- [x] **Joint:** installed `analytics-mcp` 0.7.0 with `pipx` and configured the
  local Codex client through an ignored credential wrapper. A new Codex task
  may be required before the server appears as a tool.
- [ ] **Joint:** verify the MCP can see only the intended yopa.page property and
  use only aggregate `run_report`/`run_funnel_report` queries for this MVP.
- [~] **Joint:** generated the first unsampled 12-month aggregate baseline for
  2025-08-09 through 2026-08-08. GA UI total comparison remains pending.
- [x] Development builds omit GA entirely and all baseline reports filter to
  `www.yopa.page` or `yopa.page`, preventing localhost preview pollution.
- [ ] **Joint:** record the release date and repeat the report after four weeks.

GA4 owner handoff completed on 2026-08-09. Never paste the JSON contents into a
task, issue, log, or knowledge note.

## D. Field Dispatch

- [x] beehiiv remote MCP is registered and OAuth-authorized in the local Codex
  client. Evidence: `codex mcp get beehiiv` reports the streamable HTTP endpoint
  enabled and the login command completed successfully.
- [ ] **Joint:** verify beehiiv MCP tools in a fresh Codex task. Keep Atlas use
  aggregate-only; do not retrieve subscriber email addresses, custom fields, or
  individual subscriber records.
- [ ] **Owner:** create `Field Dispatch — English` as a separate beehiiv
  publication.
- [ ] **Owner:** create `Field Dispatch — 한국어` as a separate beehiiv
  publication.
- [ ] **Owner:** for each publication, enable Double Opt-in Email under
  `Settings → Emails → Preset Emails`; Smart Nudge is optional.
- [ ] **Owner:** create or publish one signup page per publication and assign a
  signup flow to its subscribe form.
- [ ] **Owner:** set the opt-in redirect for each language to that language's
  Expedition URL, or use a beehiiv confirmation page that links there.
- [ ] **Owner:** verify confirmation, welcome email, and unsubscribe using two
  owner-controlled test addresses, one per publication.
- [ ] **Owner:** copy the two public hosted subscribe URLs. These URLs are public
  configuration and may be shared; subscriber data must not be shared.
- [ ] **Joint:** add each verified URL to `params.fieldDispatch` and enable only
  that language.
- [ ] **Joint:** confirm a Korean signup never enters the English publication,
  and vice versa.
- [ ] **Joint:** verify `dispatch_cta` plus anonymous thank-you page measurement
  without sending email or subscriber identifiers to GA. The local pages and
  aggregate report filter are complete; production measurement is pending.
- [~] First monthly EN/KO Dispatch drafts are prepared under
  `docs/field-dispatch/`; owner editorial approval and sending remain pending.
  Automatic machine translation is not sent.

Owner handoff signal: say `beehiiv 준비 완료` and send only the two public
subscribe URLs. Do not send subscriber exports or account credentials.

## E. Release and measurement gates

- [x] JavaScript syntax checks pass.
- [x] Frontmatter validation passes for 306 articles.
- [x] Expedition validation passes.
- [x] Unit suite passes: 63 tests.
- [x] Hugo production build passes: EN 956 pages, KO 407 pages.
- [x] `git diff --check` passes.
- [ ] Create a scoped branch, commit, and Draft PR after owner approval.
- [ ] Deploy the MVP after checks and manual acceptance pass.
- [ ] Collect four weeks of baseline data.
- [ ] Gate: Expedition CTA exposure-to-start rate is at least 3%.
- [ ] Gate: Expedition start-to-completion rate is at least 25%.
- [ ] Gate: confirmed subscription among completers is at least 5%.
- [ ] Gate: Atlas visitors' additional article discovery improves over baseline.
- [ ] Gate: no Dispatch is missed for two consecutive months.

If a gate fails, revise entry-page choice, CTA, route length, or stop value. Do
not add new world systems to compensate for an unproven visitor loop.
