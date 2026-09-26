# Plan: Remove Existing Korean Blog Articles

**Status:** Plan only. This document updates the existing Draft PR #110 after PR #111 merged. It does not delete content, modify other PR branches, or deploy the site.

## Decision and goal

PR #111 established English-only authoring for new posts. This follow-up removes the existing Korean blog article pages as well:

- Remove every current `content/blog/*.ko.md` article.
- Keep its English counterpart and keep the site’s Korean interface and non-blog content.
- Permanently redirect old `/ko/blog/...` URLs to the matching English article.
- Update active article PRs so they cannot reintroduce Korean blog pages.

Keep the existing Korean About page, localized home and Expedition pages, Field Dispatch pages, and their Korean interface copy. Leave the newsletter CTA and subscription settings alone; they are independent of article authoring.

## Pinned state and evidence

- Target repository: `ypark9/yopa.page`.
- Implementation base: `a1c54b0fe748b81990143d33ff550c27c5674d34`, the PR #111 merge commit on `main`.
- The merge commit tree is `cd320156db4198b09e7c0e34ca38bddf0e5941d2`, the same tree as PR #111 head `8c09009ec164a78ecf43f5d896d72ad8078df488`.
- PR #111, “docs: stop bilingual publishing, new articles are English-only,” is merged. PR #110 is still open and Draft; this plan replaces its authoring-only plan.
- On the pinned tree, `content/blog/` contains 77 `.ko.md` articles and 77 matching `.en.md` articles. All 77 Korean files have an English counterpart. Forty-three Korean files are `maintenance_status: replacement` articles.
- The Korean Expedition data currently links to six `/ko/blog/...` URLs. The 43 archived source articles also have a `replacement_url_ko` field.
- CloudFront already uses the `draw_rewrite` viewer-request function for `/draw` and `/explore`. The same event cannot have a second viewer-request function association.
- The current production workflow stages Hugo output to the standby S3 path, then uses the production OpenTofu plan to promote the standby path and invalidates CloudFront. Review the actual PR plans before rollout; do not assume an infrastructure plan is safe.

Refresh the main SHA, content counts, cross-links, and open PR heads before implementation. Stop and update this plan if any of them differ.

## Scope

### Included

1. Delete all 77 Korean blog article files present at the pinned base.
2. Keep the matching English files and the 43 archived source articles.
3. Remove `replacement_url_ko` from the 43 archived source articles; keep their English replacement URL.
4. Update the Korean Expedition’s six article links to the matching English URLs while retaining Korean titles, descriptions, and other localized text.
5. Add a permanent redirect from every old `/ko/blog/...` URL to its corresponding `/blog/...` URL.
6. Update validators, tests, CI, and current policy documentation so Korean blog articles cannot return accidentally.
7. Update the ten open article PRs listed below: retain English work, remove Korean article files, and preserve unrelated work.

### Excluded

- Do not remove `languages.ko` from `config.yaml`.
- Do not remove Korean About, Expedition, home, or Field Dispatch pages.
- Do not change the newsletter CTA, subscription endpoint, or signup copy.
- Do not rewrite the English articles or the archived English originals.
- Do not merge, close, or publish the article PRs as part of this plan. Their owners can continue them with English-only article content.

## Contracts to preserve

### Content and URL contract

- After the migration, no Korean-language blog article is built or tracked under `content/blog/`; the 77 English counterparts remain.
- Each retired `/ko/blog/<slug>.html` path returns HTTP 301 to `https://www.yopa.page/blog/<slug>.html`. Preserve the query string, do not redirect other `/ko/*` paths, and do not create a redirect loop.
- Commit `tests/fixtures/retired-korean-article-redirects.csv` with the 77 verified old-path/new-path pairs. Confirm the Hugo-generated paths before relying on the slug mapping; resolve any mismatch explicitly rather than silently redirecting to a wrong page.
- The English archived originals keep `replacement_url_en`; the Korean replacement link is removed from both their metadata and the archive notice.
- Korean Expedition pages remain Korean, but their article links point to English pages.

### Discovery and SEO contract

- The English blog pages keep their existing canonical URL, BlogPosting metadata, feed entries, Article Atlas relationships, and English tags.
- Removed Korean pages do not appear in Hugo output, language feeds, sitemap, search index, Article Atlas payloads, or related-article links.
- English blog pages no longer advertise a Korean article through `hreflang`. Bilingual non-blog pages retain their current `hreflang` behavior.
- Do not delete or weaken tag-graph validation just to make the smaller English-only corpus pass. Reassess any changed graph coverage using the remaining English articles and keep meaningful relationships.

## Work plan, ownership, and dependencies

Use one implementation owner on the company laptop and one reviewable implementation PR. Keep the listed file groups under one owner each; do not make parallel edits to the same paths.

### Checkpoint 0 — Refresh state

**Owner:** implementation lead.

1. Confirm `origin/main == a1c54b0fe748b81990143d33ff550c27c5674d34` or record the newer main SHA and rerun the inventory.
2. Recount Korean and English blog pages; verify every Korean slug maps to one English page.
3. Search all non-Korean article sources, layouts, data, feeds, and tests for `/ko/blog/` and `replacement_url_ko`.
4. Refresh every open PR head below and check for new bilingual article PRs.

**Gate:** do not delete any source file until the URL map and current PR list are complete.

### Checkpoint 1 — Clean up in-flight article PRs

**Owner:** the current branch owners, coordinated by the implementation lead. Preserve each PR’s English article and unrelated changes.

| PR | Current head at plan review | Required disposition |
| --- | --- | --- |
| #95 | `afd62c9764d2816e2a9a9708c425e7c7a1776548` | Keep English article; remove Korean article |
| #97 | `f6f0f77187ff528d5c2ea29eab46a7193f0abfd4` | Keep English article and sandbox experiment; remove Korean article |
| #98 | `c38cf8218fc6abd7aa0d308798fa5478604597b0` | Keep English article; remove Korean article |
| #99 | `27e395a641096e1e1d56ab303a5431e6b5de4e22` | Keep English article; remove Korean article |
| #103 | `3e551aa694813473614366008c0912a79dcbb5ca` | Keep English article; remove Korean article |
| #104 | `f511b9763bcf51e59d2ba41cbe7eaa0fb537bb20` | Keep English article; remove Korean article |
| #105 | `c8a450a87c43f74dc10b1610ec87db1e1fad6306` | Keep the English correction and MCP Apps experiment; remove the Korean article edit. Rebase after #98 because this PR is based on #98. |
| #106 | `fd42d7d1f3418348ca63aa9d098d1be033dba118` | Keep English article; remove Korean article |
| #107 | `d4b8bf9facb73f3e902380a5b29b3771a89385af` | Keep English article; remove Korean article |
| #108 | `f87f92a96709b2330cf40047d128558aa2b6bdf4` | Keep English article; remove Korean article |

Rebase each updated branch on the current main (and preserve any experiment dependencies). PR #105 follows the updated #98 branch. Before the content migration is considered complete, inspect the current PR diffs and verify none can add a `.ko.md` article back to `content/blog/`.

**Gate:** if a listed PR has changed owner or head, refresh its state and coordinate the new disposition before touching its branch.

### Checkpoint 2 — Content, Expedition, and metadata

**Owner:** content/data lane.

- Delete the 77 `.ko.md` files from the refreshed inventory.
- Keep all matching `.en.md` files.
- Remove the 43 `replacement_url_ko` values; retain `replacement_url_en`.
- Change the six URLs in `data/expeditions/ko.yaml` to the corresponding `/blog/<slug>.html` paths. Keep the Korean copy and stop order unchanged.
- Search again for links into `/ko/blog/` outside files being deleted. Convert intended in-site article links to the English route; document any route that is intentionally not an article.

**Interface:** Expedition stop URLs in both language YAML files resolve to an English `.en.md` source. The KO file remains localized text and does not imply a KO article exists.

### Checkpoint 3 — Validators, rendering, and CI

**Owner:** validation/site lane.

Update these files and add focused regression checks:

- `scripts/validate_frontmatter.py`: keep `replacement_url_en` required for archived articles; make the retired KO field invalid or absent from the schema.
- `scripts/validate_article_tags.py`: validate archived-to-English replacement lineage and the remaining English tag graph; remove the bilingual parity requirement.
- `scripts/validate_expeditions.py`: validate Korean Expedition URLs against the matching English article file.
- `tests/test_archived_articles.py`: expect 43 English replacement files, verify archive lineage and English links, and reject a remaining Korean replacement URL.
- `layouts/_default/single.html`: remove the dead Korean replacement link from archived article notices.
- `tests/test_blog_seo.py` and Article Atlas tests: assert English blog metadata remains correct, no KO blog page is rendered, Korean non-blog pages remain, and translated non-blog SEO still works.
- Add a regression check that fails if a tracked `content/blog/*.ko.md` file is introduced.
- Use `tests/fixtures/retired-korean-article-redirects.csv` in tests to verify every retired route maps to a surviving English page.
- Wire `validate_expeditions.py`, `validate_article_tags.py`, and the redirect unit test into `.github/workflows/main.yml`; CI must enforce the new contract.

Keep the bilingual Expedition schema and Korean non-blog tests. They protect retained Korean site surfaces and are not evidence of Korean blog publishing.

### Checkpoint 4 — Legacy URL redirect

**Owner:** infrastructure lane.

- Extend `terraform/modules/website/main.tf`’s existing `aws_cloudfront_function.draw_rewrite`; preserve its `/draw` and `/explore` rewrites. Do not attach a second function to the same viewer-request event.
- Add a testable handler source under `terraform/modules/website/` and a Node test under that module. Return a 301 for `/ko/blog`, `/ko/blog/`, and `/ko/blog/<path>`, mapping the prefix to `/blog`; use the canonical `https://www.yopa.page` host and retain the query string.
- Test every source URL in `tests/fixtures/retired-korean-article-redirects.csv` against its English target.
- Test that unrelated `/ko/about.html`, `/ko/expeditions/...`, and `/ko/dispatch/...` requests pass through untouched; retain existing draw/explore behavior.
- Review the generated production OpenTofu plan for a function update and distribution association update, with no unapproved destruction or replacement.

**Integration point:** the existing workflow in `.github/workflows/main.yml` stages Hugo output to the standby path, then promotes through the production `live_path` plan and invalidates CloudFront. Confirm in the actual production plan that the redirect function and content path are active together at promotion. If the function update would be delayed or the plan is destructive, split the redirect into a preceding infrastructure PR and verify it before removing the Korean files.

### Checkpoint 5 — Current policy documentation

**Owner:** documentation lane.

- Update `docs/agent-playbooks/inbound-article-triage.md`: new and remaining blog articles are English-only; Korean UI and Expedition support do not mean Korean article variants remain.
- Update the current policy/procedure in `docs/article-maintenance-2023-2025.md` and `docs/article-tag-taxonomy.md` to remove any requirement to publish Korean replacements or match EN/KO replacement tags.
- Preserve historical facts and dates in the maintenance ledger (including its record of the 2026 bilingual replacement batch). Mark the rule as historical where needed; do not rewrite historical article counts.

## Verification commands and expected results

Run these on the implementation PR, not while reviewing this plan:

```sh
python3 scripts/validate_frontmatter.py
python3 scripts/validate_article_tags.py
python3 scripts/validate_expeditions.py
python3 -m unittest discover -s tests
hugo --gc --minify
node --test terraform/modules/website/draw_rewrite.test.mjs
tofu fmt -check -recursive terraform
for env in global prod; do
  tofu -chdir="terraform/env/$env" init -backend=false -lockfile=readonly
  tofu -chdir="terraform/env/$env" validate
done
git diff --check
```

Expected:

- Validators, tests, Hugo production build, Node handler tests, and OpenTofu formatting/validation pass.
- The build emits no `public/ko/blog/` article pages, while Korean About, Expedition, home, and Dispatch pages remain.
- English blog pages remain in the sitemap, search, Article Atlas, and English feed. No Korean blog article appears in a feed, sitemap, or discovery payload.
- All six Korean Expedition URLs resolve to the intended English pages.
- CloudFront handler tests show 301 plus the correct canonical Location and preserved query string for all old Korean article paths, with no changes to other Korean routes.
- CI production plans pass `scripts/check-plan-safety.sh` without unapproved destructive actions.

After deployment is separately approved, verify at least one retired article and all 77 mapped paths. Example:

```sh
curl -sS -D- -o /dev/null 'https://www.yopa.page/ko/blog/2026-08-01-a-practical-taxonomy-for-ai-agent-systems.html?source=retirement-check'
curl -sS -L -o /dev/null -w '%{http_code}\n' 'https://www.yopa.page/ko/blog/2026-08-01-a-practical-taxonomy-for-ai-agent-systems.html?source=retirement-check'
```

The first request must return 301 with a Location under `/blog/` and the query intact. The final request must return 200. Repeat status/Location checks for all 77 entries in `tests/fixtures/retired-korean-article-redirects.csv` before declaring rollout complete.

## Failure handling and rollback

- If the refreshed inventory includes a Korean article without a clear English counterpart, stop and ask for a route disposition. Do not delete it or redirect it to an unrelated article.
- If a listed PR has new edits, resolve the branch against its latest head before applying this plan. Do not overwrite an unreviewed branch update.
- If the Article Atlas graph loses meaningful edges, repair the English graph based on subject relationships; do not lower thresholds merely to get a pass.
- If the OpenTofu plan reports a destructive action or replacement, leave the rollout blocked at PR review and inspect the exact resource plan. Do not bypass `check-plan-safety.sh`.
- If production redirect checks fail, revert the combined migration through the existing blue/green workflow so restored content and redirect behavior move together. Preserve the pre-migration SHA and confirm the restored paths before the next attempt.
- Stop before merge or deployment if approval for those actions has not been given separately.

## Acceptance criteria

1. No `content/blog/*.ko.md` files remain on main, and active article PRs cannot reintroduce any.
2. Every removed Korean article URL permanently redirects to the matching English URL.
3. All 77 English counterparts and all 43 English archived replacements remain available.
4. The Korean Expedition still renders in Korean and all six article links work through English pages.
5. Korean About, home, Expedition, and Dispatch pages still render; their localization and non-blog `hreflang` remain intact.
6. Search, sitemap, feeds, Article Atlas, tag checks, and archive notices contain no dead Korean article targets.
7. CI and the production infrastructure plan pass; deployment is performed only after separate approval.

## Self-contained implementation handoff

You are implementing this plan on the company laptop for `ypark9/yopa.page`. Start by reading the repository `AGENTS.md` and `docs/agent-playbooks/inbound-article-triage.md`. Confirm `origin/main` is still `a1c54b0fe748b81990143d33ff550c27c5674d34`; otherwise refresh every count, URL mapping, and PR head in this plan before editing. Preserve the 77 English counterparts, Korean non-blog site surfaces, historical maintenance facts, and unrelated in-flight PR work. Update the ten listed article PR branches to English-only, handling #98 before dependent #105. Implement the content, validators/tests, CI, policy docs, and CloudFront redirect changes under the file ownership and checkpoints above. Open or update a reviewable implementation PR; run the listed checks and record results. Do not merge or deploy until the owner separately authorizes it.EOF
git rm agent-plans/personal/PLAN-pause-korean-article-authoring.md
