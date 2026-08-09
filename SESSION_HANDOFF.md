# Article Atlas Growth MVP — Session Handoff

Last updated: 2026-08-09
Repository: yopa.page repository root
Status: release candidate in an uncommitted working tree

## Start here

Continue the Article Atlas Growth MVP from the existing working tree. Read, in
order:

1. `AGENTS.md`
2. `agent-plans/personal/PLAN-article-atlas-growth-mvp.md`
3. `docs/ATLAS_GROWTH_OPERATIONS.md`
4. this handoff

Run `cxdoc current . --json` and search yopa.page knowledge before relying on
older session memory. Do not discard or overwrite the current working tree.
Nothing in this MVP has been committed, pushed, or deployed.

## Product decision

Article Atlas is:

> Public evidence of one developer's continued growth, and a living knowledge
> world where working engineers solve a problem and find a reason to return.

The first six-month loop is:

```text
search or direct link
→ useful article
→ safe-agent-operations Expedition
→ practical result
→ language-specific Field Dispatch
→ monthly return
```

World expansion is gated. Do not implement Maker's Road, Workshop, App Garden,
Presence, accounts, inventory, currency, streaks, leaderboards, or AI NPCs until
the first Expedition has four weeks of trustworthy evidence.

## Implemented

### Utility and portfolio

- Homepage entrances: Solve a problem, See what I am learning, Explore Atlas.
- English and Korean About pages.
- Journey CTA on five bilingual agent-operation articles.
- Explicit `atlas` frontmatter for region, object, journey, evidence, and era.

### First Expedition

- Journey ID: `safe-agent-operations`.
- English: `/expeditions/safe-agent-operations.html`.
- Korean: `/ko/expeditions/safe-agent-operations.html`.
- Five matching stops with normal article URLs and static HTML fallback.
- Local-only progress with damaged-storage sanitization.
- Coarse events: `expedition_view`, `expedition_start`,
  `expedition_stop_complete`, `expedition_complete`, and `dispatch_cta`.
- First-completion deduplication and implicit start tracking.
- Accessible progress label and completion focus.
- No AdSense or Ko-fi surface inside an Expedition.

### Field Dispatch preparation

- Fail-closed English and Korean CTA configuration in `config.yaml`.
- CTA remains hidden until each public beehiiv URL is verified.
- Confirmation pages:
  - `/dispatch/confirmed.html`
  - `/ko/dispatch/confirmed.html`
- First English and Korean monthly drafts in `docs/field-dispatch/`.
- beehiiv remote MCP registered and OAuth-authorized in Codex:
  `https://mcp.beehiiv.com/mcp`.

### GA4 and analytics

- Google Cloud project, Data API, Admin API, service account, property-level
  Viewer access, and numeric property ID are owner-configured.
- Secrets are ignored and mode `600`:
  - `.secrets/ga4-viewer.json`
  - `.secrets/ga4.env`
- Never print, commit, paste, or store their contents in cxdoc.
- Google `analytics-mcp` 0.7.0 is installed with pipx and registered in Codex
  through `.secrets/run-analytics-mcp`.
- `.venv-analytics` holds the pinned client for deterministic snapshot reports.
- `scripts/ga4_baseline.py` produces aggregate JSON, CSV, and Markdown under the
  ignored `analytics-output/` directory.
- All reports filter to `www.yopa.page` and `yopa.page`.
- Development Hugo builds do not load GA.
- Empty report runs remove stale CSV files.

## GA4 baseline status

Generated at `analytics-output/2026-08-09/` for:

- current: 2025-08-09 through 2026-08-08;
- prior: 2024-08-09 through 2025-08-08.

All reports were unsampled. After excluding localhost preview traffic:

- Acquisition: 200 aggregate rows in each period, limited by the fixed query.
- Content language: 500 aggregate rows in each period, limited by the query.
- Atlas discovery: 35 current aggregate rows, 0 prior rows.
- Growth funnel: 0 current rows, 0 prior rows.

The first run exposed that local Hugo previews were sending events to the
production property. Those local Expedition and confirmation-page events were
not real visitor conversions. The template and report host filters now prevent
future pollution. Do not use the earlier contaminated funnel rows.

GA UI total comparison is still pending. The baseline output is private and
ignored; do not commit it.

## MCP status for the new session

Both servers are configured globally but must be verified as callable in a
fresh Codex task:

```sh
codex mcp get analytics-mcp
codex mcp get beehiiv
codex mcp list
```

Expected:

- `analytics-mcp`: enabled stdio command pointing to
  `.secrets/run-analytics-mcp`.
- `beehiiv`: enabled streamable HTTP endpoint at
  `https://mcp.beehiiv.com/mcp`.

Privacy policy for both MCPs:

- use aggregate reports only;
- do not request individual session timelines;
- do not query user IDs, pseudo IDs, city-level location, subscriber email,
  subscriber custom fields, or individual subscriber records;
- require user confirmation before beehiiv write actions;
- publishing or sending remains an owner-final action.

If OAuth approval is needed again, print the URL for the owner to open in the
system browser. The Codex in-app browser may lose the localhost OAuth callback.

## beehiiv account state and next owner-assisted work

Observed before the MCP detour:

- One existing publication named `yopa.page`.
- Launch plan, 2,500-subscriber limit.
- Double opt-in off.
- Smart Nudge off.
- Welcome email not configured.
- Email footer address reports `No Address Set`.

No publication or email setting was changed.

Recommended configuration, still awaiting execution:

1. Reuse and rename `yopa.page` to `Field Dispatch — English`.
2. Create `Field Dispatch — 한국어` with subdomain
   `yopa-field-dispatch-ko`.
3. Enable Double opt-in for both publications.
4. Enable Smart Nudge for both publications.
5. Set sender names by language.
6. Configure signup flows and public subscribe pages.
7. Set confirmed opt-in redirects:
   - English: `https://www.yopa.page/dispatch/confirmed.html`
   - Korean: `https://www.yopa.page/ko/dispatch/confirmed.html`
8. The owner must enter the required postal address directly; never ask them to
   paste that address into a task.
9. Test confirmation, welcome, and unsubscribe with owner-controlled addresses.
10. Only after verification, add the two public subscribe URLs to `config.yaml`
    and enable one language at a time.

The exact browser-side changes proposed earlier were not approved or applied
before work switched to MCP setup. Confirm the plan with the owner immediately
before saving account changes.

## Verification already completed

- `python3 scripts/validate_frontmatter.py`: 306 articles passed.
- `python3 scripts/validate_expeditions.py`: passed.
- `python3 -m unittest discover -s tests`: 66 tests passed.
- `hugo --gc --minify`: passed.
- Development build contains no Google tag.
- Production build contains the Google tag.
- English and Korean mobile browser smoke at 390×844 passed with no horizontal
  overflow.
- English 5/5 Expedition completion and result focus passed.
- English and Korean confirmation pages rendered without ads or browser errors.
- JavaScript-off output retains every Expedition stop link.
- `git diff --check`: passed.

Still manual before production release:

- screen reader acceptance;
- browser-enforced blocked-local-storage acceptance;
- physical mobile touch acceptance;
- GA UI versus API total comparison.

## Working tree and release boundary

All Article Atlas Growth MVP changes are uncommitted. Preserve the full current
scope, including untracked files. Do not stage, commit, push, open a PR, or
deploy until the owner explicitly approves that action.

The existing personal world plan remains at
`agent-plans/personal/PLAN-article-atlas-world.md`. The actionable MVP source of
truth is `agent-plans/personal/PLAN-article-atlas-growth-mvp.md`; update its
checkboxes and evidence in the same change that completes an item.

## Recommended next sequence

1. Verify the two MCP servers are callable in the fresh session.
2. Use Analytics MCP only to confirm the service account sees the intended
   yopa.page property and run one harmless aggregate query.
3. Use beehiiv MCP only for read-only state confirmation; do not inspect
   subscriber identity data.
4. Resume the owner-confirmed browser setup for the two Field Dispatch
   publications.
5. Add and verify the public subscribe URLs in the fail-closed site config.
6. Complete remaining manual accessibility checks.
7. Run the complete validation suite.
8. Ask the owner whether to create a scoped branch, commit, and Draft PR.

## Validation commands

```sh
node --check static/js/atlas-growth.js
node --check static/js/expedition.js
python3 scripts/validate_frontmatter.py
python3 scripts/validate_expeditions.py
python3 -m unittest discover -s tests
hugo --gc --minify
git diff --check
git status --short
```

To regenerate the private aggregate baseline:

```sh
source .secrets/ga4.env
.venv-analytics/bin/python scripts/ga4_baseline.py \
  --as-of YYYY-MM-DD \
  --output-dir analytics-output/YYYY-MM-DD
```
