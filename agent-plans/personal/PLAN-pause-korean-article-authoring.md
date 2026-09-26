# yopa.page: Pause mandatory Korean article authoring

Status: Draft implementation handoff. This document is a plan only; it does
not authorize a merge, deployment, newsletter change, or deletion of existing
Korean content.

Base commit: `7af05f2a0965d11fbec94064f5015702acfceb5c` (`origin/main`,
2026-09-25)

## Goal

Stop requiring a Korean counterpart whenever a new English technical article is
written or an English article is updated. Preserve every published Korean URL
and its existing reading experience, while pausing Korean newsletter acquisition
and all future Korean editorial promises because the site can no longer
guarantee native-quality Korean technical writing.

## Decision and scope

This plan implements an **authoring and acquisition pause**, not a Korean-site
retirement.

In scope:

- Make English the default and sufficient output for new articles and future
  article maintenance.
- Permit an English-only replacement for a newly archived article.
- Retain optional Korean counterparts when an owner explicitly requests and
  reviews one.
- Correct the editorial, validation, and test rules that currently make a
  Korean counterpart mandatory.
- Disable the Korean Field Dispatch CTA so Korean readers are not newly asked
  to subscribe to an editorial stream that is paused.
- Have the owner pause new Korean beehiiv subscriptions without exporting,
  deleting, or contacting subscribers.

Out of scope:

- Deleting or unpublishing existing `.ko.md` content, `/ko/` routes, Korean
  SEO alternates, localized UI, the Korean Expedition, or the Korean beehiiv
  publication.
- Translating, rewriting, or quality-auditing the existing Korean corpus.
- Removing the `ko` language registration, existing Korean routes, or their
  SEO alternates.
- Merge, deploy, publish, or send email.

## Current contracts and the desired replacement contracts

| Surface | Current contract | Target contract |
| --- | --- | --- |
| Stage 2 editorial pipeline | New work is an `.en.md` + `.ko.md` pair; one language alone is never updated. | New work and maintenance are English-first. A Korean counterpart is optional and must be explicitly requested. |
| Korean prose | Korean is a native parallel write. | Do not generate a Korean article by default. When explicitly requested, use a separately reviewed native write, never a machine-translation claim. |
| Archived articles | `replacement_url_en` and `replacement_url_ko` are both required. | `replacement_url_en` remains required; `replacement_url_ko` is optional and, when present, must remain a valid `/ko/blog/*.html` URL. |
| Replacement validation | The 2026-08-01 maintenance set requires both `.en.md` and `.ko.md` replacements and equal tags. | Existing bilingual pairs remain valid. New English-only replacements validate. If both variants exist, their tags must remain identical and ordered. |
| Expedition | EN and KO stop IDs must stay aligned. | Unchanged: this is a retained reader feature, not an article-authoring obligation. |
| Hugo configuration | `languages.ko` builds Korean URLs and `fieldDispatch.ko.enabled` displays a Korean signup CTA. | Keep `languages.ko`; set `fieldDispatch.ko.enabled: false`, retaining the public URL only as historical configuration. |
| beehiiv Korean publication | It accepts new readers through its hosted page and is reached from the site CTA. | Owner pauses/turns off new subscriptions or replaces the hosted signup with a clear pause notice. Existing subscribers, consent, unsubscribe, and records are untouched. |

## Affected files and ownership

| Lane | Owned files | Interface / dependency |
| --- | --- | --- |
| Editorial policy | `agent-plans/personal/PLAN-newsletter-editorial-pipeline.md`, `docs/article-maintenance-2023-2025.md`, `docs/article-tag-taxonomy.md` | Defines the English-first policy used by future article work. |
| Project instruction | `CLAUDE.md` | States that `.ko.md` is optional for new blog posts; preserve the existing bilingual-site description. |
| Public configuration and CTA | `config.yaml`, `layouts/partials/field-dispatch.html`, `tests/test_atlas_growth.py`, `tests/test_blog_seo.py` | Korean pages remain routable but render no Korean subscription CTA; English CTA remains unchanged. |
| Retained Korean Expedition | `data/expeditions/{en,ko}.yaml`, `content/expeditions/safe-agent-operations.ko.md`, `layouts/expedition/single.html` | No content/data change. Its existing stop parity stays validated; the disabled Korean CTA is inherited through the shared partial. |
| External newsletter ownership | beehiiv Korean publication and `docs/ATLAS_GROWTH_OPERATIONS.md`, `SESSION_HANDOFF.md` | Owner-only subscription pause; repository documentation records the changed operational state without exposing subscriber data. |
| Frontmatter contract | `scripts/validate_frontmatter.py`, `tests/test_archived_articles.py` | Archived English replacements must still have verified lineage and an ugly Hugo URL. |
| Tag contract | `scripts/validate_article_tags.py`, `tests/test_article_tags.py` | Existing pair parity stays checked when both files are in the validator scope; no implicit Korean file lookup for English-only replacements. |
| Rendered archive notice | `layouts/_default/single.html`, relevant archive tests | English link remains visible; Korean link remains conditional and appears only when metadata exists. |

## Sequenced implementation

1. Pause Korean subscription acquisition in the site configuration.
   - Leave `languages.ko` and all existing `ko` routes enabled to avoid broken
     URLs and lost SEO history.
   - Change only `params.fieldDispatch.ko.enabled` to `false`; retain the URL
     value so the configuration records the public endpoint but the shared
     partial renders no Korean CTA.
   - Do not modify `fieldDispatch.en`.
   - Update CTA/rendering tests: English blog/home/Expedition still has one CTA;
     Korean blog/home/Expedition has none; Korean SEO and article metadata still
     render.

2. Freeze the Korean beehiiv publication through an owner-only operation.
   - Before the repository change is deployed, the owner chooses the verified
     beehiiv mechanism to stop new Korean subscriptions: disable its hosted
     signup, unpublish it, or replace it with a pause notice.
   - Retain unsubscribe access and existing consent records. Do not export,
     delete, merge, contact, or inspect subscriber records.
   - Record only the selected mechanism and verification date in the project
     operations/handoff documents; do not place account settings, tokens, or
     subscriber counts in the repository.
   - If beehiiv cannot prevent new hosted subscriptions, do not deploy the CTA
     change as a claim that acquisition has stopped; leave this step marked
     owner-blocked and state the residual public URL risk.

3. Keep the Korean Expedition as a frozen reader route.
   - Make no content or data edits to `data/expeditions/ko.yaml` or
     `content/expeditions/safe-agent-operations.ko.md`.
   - Keep `scripts/validate_expeditions.py` parity enforcement because its
     purpose is link integrity for published routes, not future article
     authoring.
   - Verify that disabling `fieldDispatch.ko.enabled` removes the shared CTA
     from the Korean Expedition while its existing stop URLs, JavaScript-off
     fallback, and completion flow remain usable.

4. Update `CLAUDE.md` and the Stage 2 editorial plan.
   - Replace mandatory pair language with English-first output.
   - Require an explicit owner request before creating or updating a Korean
     counterpart.
   - Remove `(en/ko)` as the default commit/PR naming requirement; allow it
     only for an intentionally bilingual change.
   - Change two-file dash and link checks to apply to each changed article
     file, not to an assumed Korean companion.

5. Update the maintenance and tag-policy documents.
   - State that existing Korean replacements remain published and linked when
     available.
   - Define optional-pair parity: if both language variants exist, retain the
     same tags in the same order; an English-only future article has no missing
     Korean-file error.
   - Preserve historical counts and claims as history; do not rewrite them to
     imply that past bilingual work did not happen.

6. Relax archived-article frontmatter validation without weakening lineage.
   - Keep `reviewed_at`, `archive_reason`, and `replacement_url_en` required.
   - Validate `replacement_url_en` unconditionally as `/blog/<slug>.html`.
   - Validate `replacement_url_ko` only when supplied, as
     `/ko/blog/<slug>.html`.
   - Add a focused unit case: an archived article with a valid English URL and
     no Korean URL passes; malformed optional Korean URLs fail.

7. Change tag validation from mandatory to conditional bilingual parity.
   - For each archived article, inspect the required English replacement and
     enforce the current overlap rule.
   - Inspect a Korean replacement only when `replacement_url_ko` is present.
   - For the legacy 2026-08-01 pair set, retain parity assertions wherever both
     files exist, but do not report an error merely because a new English-only
     replacement has no `.ko.md` file.
   - Add tests for English-only archive lineage and for a present-but-mismatched
     Korean pair failing parity.

8. Keep the archive template backward compatible.
   - Confirm the existing `with .Params.replacement_url_ko` conditional still
     omits the Korean link cleanly when absent.
   - Add a rendered or template-contract test for an English-only archived
     article so the page has no empty replacement container or broken Korean
     link.

9. Update operations documentation and verify only the planned policy change.
   - Change `docs/ATLAS_GROWTH_OPERATIONS.md` and `SESSION_HANDOFF.md` from
     “both language CTAs/publications enabled” to the accurate state: English
     acquisition active, Korean acquisition paused, and published Korean routes
     retained.
   - Do not alter existing `.ko.md` files, `data/expeditions`, or deployment
     configuration.
   - Record the exact changed files and results in the implementation PR.

## Integration checkpoints

1. After steps 1-4, review policy text: no sentence may imply a default Korean
   deliverable, while existing Korean reader support remains explicitly
   preserved.
2. After the owner-only beehiiv step, capture the selected pause mechanism and
   a non-subscriber-data verification result before deploying the disabled CTA.
3. After steps 6-7, run validator unit tests before the whole corpus checks.
4. After step 8, build Hugo and inspect one legacy bilingual archive plus one
   temporary English-only fixture/rendered case.
5. Before requesting review, compare against the pinned base and confirm no
   `.ko.md` content, Korean route registration, or beehiiv URL value changed;
   `fieldDispatch.ko.enabled` is the sole intended configuration change.

## Required verification and expected results

```bash
python3 -m unittest tests/test_archived_articles.py tests/test_article_tags.py -v
python3 scripts/validate_frontmatter.py
python3 scripts/validate_article_tags.py
python3 scripts/validate_expeditions.py
HUGO_CACHEDIR=/private/tmp/yopa-page-korean-policy-hugo-cache hugo --gc --minify
git diff --check
git diff --name-only 7af05f2a0965d11fbec94064f5015702acfceb5c
```

Expected result: all commands exit zero; the final file list is limited to the
policy, configuration, validator, test, archive-template, and operations
documentation surfaces listed above. The Hugo build retains both English and
Korean output for existing content, while Korean pages contain no Field Dispatch
signup CTA.

If the theme submodule is absent, initialize it with `git submodule update
--init --recursive` before the Hugo build. If any corpus validation reveals an
existing malformed bilingual record, do not silently repair unrelated content:
report it separately and decide whether it belongs in this change.

## Rollback

The repository change is reversible: revert its single commit to restore the
Korean CTA and mandatory bilingual authoring rules. The beehiiv subscription
pause is a separate owner action; its rollback is to restore the prior hosted
signup only after the owner has a renewed Korean editorial commitment. Existing
Korean URLs and content are untouched, so no content restoration is needed.

## Acceptance criteria

- A new English-only article can be created and maintained without a `.ko.md`
  counterpart or `(en/ko)` PR convention.
- An archived article can name a valid English replacement without a Korean
  replacement URL.
- Existing bilingual articles, archive notices, hreflang behavior, Expedition
  parity, and Korean newsletter routing continue to work.
- A requested Korean counterpart is still supported, but its quality and
  review are an explicit owner decision rather than a pipeline default.
- Existing Korean pages, SEO metadata, and Expedition navigation continue to
  render, but have no Korean Field Dispatch signup CTA.
- The owner has verified the Korean beehiiv acquisition pause, or the PR is
  explicitly blocked from deployment with the residual hosted-signup risk
  recorded.
- No existing Korean article is deleted, modified, unpublished, or represented
  as newly quality-reviewed.

## Company-laptop implementation handoff

Resume prompt:

> Implement `agent-plans/personal/PLAN-pause-korean-article-authoring.md` from
> base `7af05f2a0965d11fbec94064f5015702acfceb5c`. Keep scope to the listed
> policy, configuration, validator, test, archive-template, and operations
> documentation files. Preserve all existing Korean content and Korean route
> registration. Set only `fieldDispatch.ko.enabled` to false. Obtain the
> owner-only beehiiv pause decision and verification before any deployment;
> never inspect subscriber data. Run every listed command, record results,
> open or update the implementation PR as a draft, and do not merge, deploy,
> or send newsletter email.
