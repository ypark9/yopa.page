# Article Atlas growth operations

Implementation status and owner handoffs are tracked in
`agent-plans/personal/PLAN-article-atlas-growth-mvp.md`. Update that checklist in
the same change that completes an MVP item.

The growth MVP is static and fail-closed. Expedition content works without an
account, Field Dispatch is hidden until both publications are owner-verified,
and Article Atlas Presence remains disabled.

## GA4 aggregate baseline

Use Google's experimental `google-analytics-mcp` as the conversational,
read-only analysis interface. Keep `scripts/ga4_baseline.py` as the deterministic
monthly snapshot path so the same queries and date ranges remain reproducible.
Both paths use the same property-scoped Viewer identity. The MCP also requires
Google Analytics Admin API to be enabled for its read-only property tools.

Owner-only setup:

1. Create a dedicated Google Cloud project and enable Google Analytics Data API v1.
2. Create a service account. In the yopa.page GA4 property (not the Analytics
   account), grant that service-account email the `Viewer` role only.
3. Store its JSON credential outside the repository, preferably under a private
   local secret store. Never paste it into a task, issue, CI log, or cxdoc note.
4. Install the optional client in an isolated environment:

   ```sh
   python3 -m venv .venv-analytics
   .venv-analytics/bin/pip install -r requirements-analytics.txt
   ```

5. Run the aggregate reports into an ignored local directory:

   ```sh
   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/private/path/ga4-viewer.json
   export YOPA_GA4_PROPERTY_ID=123456789
   .venv-analytics/bin/python scripts/ga4_baseline.py \
     --as-of 2026-08-09 \
     --output-dir analytics-output/2026-08-09
   ```

The script uses `runReport` only and requests aggregate dimensions. It does not
query user IDs, individual timelines, or city-level location. Review sampling
flags before comparing the API output with the GA UI. Run at baseline, before
and after a release, and then at most monthly.

Development builds do not load GA. Every baseline query is also restricted to
the `www.yopa.page` and `yopa.page` host names. This double boundary prevents
localhost preview sessions from entering production measurements. Empty report
runs remove any older CSV for the same report and period so stale funnel data
cannot be mistaken for a current result.

## Field Dispatch activation

The beehiiv remote MCP is configured for Codex at
`https://mcp.beehiiv.com/mcp`. OAuth approval links should be opened in the
owner's system browser because the in-app browser may lose the local callback
connection. A fresh Codex task may be required after connecting or refreshing
the MCP. Limit Atlas queries to aggregate publication and performance data; do
not request subscriber email addresses, custom fields, or individual records.

Owner-only setup:

1. Create separate English and Korean beehiiv publications on the Launch plan.
2. Enable double opt-in, verify unsubscribe, and write the monthly promise in
   each language. Do not import or mirror one list into the other.
3. Use beehiiv-hosted subscribe URLs that disclose beehiiv as the email
   processor. Test both confirmation and unsubscribe with owner-controlled
   addresses.
   Configure the successful opt-in redirects as:

   - English: `https://www.yopa.page/dispatch/confirmed.html`
   - 한국어: `https://www.yopa.page/ko/dispatch/confirmed.html`

   Each confirmation page links to its matching Expedition and is measured only
   as an anonymous page view.
4. Add only the public subscribe URLs to `params.fieldDispatch` in
   `config.yaml`, then set each verified language's `enabled` value to `true`.
   An empty URL or disabled flag renders no subscription surface.
5. After 2,000 subscribers, a paid-feature requirement, an export restriction,
   or a deliverability problem, stop and assess export plus an SES migration.
   Do not build a send-only SES Lambda: consent, unsubscribe, bounce, complaint,
   suppression, and monitoring are required parts of that system.

## Release and gates

Before release:

```sh
python3 scripts/validate_frontmatter.py
python3 scripts/validate_expeditions.py
python3 -m unittest discover -s tests
hugo --gc --minify
```

Smoke-test the English and Korean expedition with JavaScript enabled and
disabled, keyboard navigation, responsive browser widths, and reduced motion.
Storage failures must remain fail-open; a browser-enforced blocked-storage
check is useful but non-blocking for this MVP. Screen-reader and physical-touch
checks are follow-up acceptance rather than release gates. Confirm that no
AdSense unit or Ko-fi trap appears during the expedition. Keep Presence
disabled.

Collect four weeks of baseline data before judging the funnel. Maker's Road,
the Engineering Ridge workshop, App Garden activation, and Presence remain
blocked until the first expedition has useful evidence. The initial gates are:

- at least 25% expedition completion;
- at least 5% confirmed subscription among completers;
- at least 3% expedition starts from eligible article visits;
- no two consecutive missed monthly dispatches; and
- increased article discovery after an Atlas visit relative to baseline.
