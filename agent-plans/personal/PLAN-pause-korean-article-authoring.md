# yopa.page: Pause mandatory Korean article authoring

Status: Draft implementation handoff. This document is a plan only; it does
not authorize a merge, deployment, newsletter change, or deletion of existing
Korean content.

Base commit: `7af05f2a0965d11fbec94064f5015702acfceb5c` (`origin/main`,
2026-09-25)

## Goal

Stop requiring a Korean counterpart whenever a new English technical article is
written or an English article is updated. Preserve every published Korean URL
and the current Korean reader experience while the site is no longer able to
guarantee native-quality Korean technical writing.

## Decision and scope

This plan implements an **authoring pause**, not a Korean-site retirement.

In scope:

- Make English the default and sufficient output for new articles and future
  article maintenance.
- Permit an English-only replacement for a newly archived article.
- Retain optional Korean counterparts when an owner explicitly requests and
  reviews one.
- Correct the editorial, validation, and test rules that currently make a
  Korean counterpart mandatory.

Out of scope:

- Deleting or unpublishing existing `.ko.md` content, `/ko/` routes, Korean
  SEO alternates, localized UI, the Korean Expedition, or the Korean beehiiv
  publication.
- Translating, rewriting, or quality-auditing the existing Korean corpus.
- Changing `config.yaml` language registration or newsletter settings.
- Merge, deploy, publish, or send email.

## Current contracts and the desired replacement contracts

| Surface | Current contract | Target contract |
| --- | --- | --- |
| Stage 2 editorial pipeline | New work is an `.en.md` + `.ko.md` pair; one language alone is never updated. | New work and maintenance are English-first. A Korean counterpart is optional and must be explicitly requested. |
| Korean prose | Korean is a native parallel write. | Do not generate a Korean article by default. When explicitly requested, use a separately reviewed native write, never a machine-translation claim. |
| Archived articles | `replacement_url_en` and `replacement_url_ko` are both required. | `replacement_url_en` remains required; `replacement_url_ko` is optional and, when present, must remain a valid `/ko/blog/*.html` URL. |
| Replacement validation | The 2026-08-01 maintenance set requires both `.en.md` and `.ko.md` replacements and equal tags. | Existing bilingual pairs remain valid. New English-only replacements validate. If both variants exist, their tags must remain identical and ordered. |
| Expedition | EN and KO stop IDs must stay aligned. | Unchanged: this is a retained reader feature, not an article-authoring obligation. |

## Affected files and ownership

| Lane | Owned files | Interface / dependency |
| --- | --- | --- |
| Editorial policy | `agent-plans/personal/PLAN-newsletter-editorial-pipeline.md`, `docs/article-maintenance-2023-2025.md`, `docs/article-tag-taxonomy.md` | Defines the English-first policy used by future article work. |
| Project instruction | `CLAUDE.md` | States that `.ko.md` is optional for new blog posts; preserve the existing bilingual-site description. |
| Frontmatter contract | `scripts/validate_frontmatter.py`, `tests/test_archived_articles.py` | Archived English replacements must still have verified lineage and an ugly Hugo URL. |
| Tag contract | `scripts/validate_article_tags.py`, `tests/test_article_tags.py` | Existing pair parity stays checked when both files are in the validator scope; no implicit Korean file lookup for English-only replacements. |
| Rendered archive notice | `layouts/_default/single.html`, relevant archive tests | English link remains visible; Korean link remains conditional and appears only when metadata exists. |

## Sequenced implementation

1. Update `CLAUDE.md` and the Stage 2 editorial plan.
   - Replace mandatory pair language with English-first output.
   - Require an explicit owner request before creating or updating a Korean
     counterpart.
   - Remove `(en/ko)` as the default commit/PR naming requirement; allow it
     only for an intentionally bilingual change.
   - Change two-file dash and link checks to apply to each changed article
     file, not to an assumed Korean companion.

2. Update the maintenance and tag-policy documents.
   - State that existing Korean replacements remain published and linked when
     available.
   - Define optional-pair parity: if both language variants exist, retain the
     same tags in the same order; an English-only future article has no missing
     Korean-file error.
   - Preserve historical counts and claims as history; do not rewrite them to
     imply that past bilingual work did not happen.

3. Relax archived-article frontmatter validation without weakening lineage.
   - Keep `reviewed_at`, `archive_reason`, and `replacement_url_en` required.
   - Validate `replacement_url_en` unconditionally as `/blog/<slug>.html`.
   - Validate `replacement_url_ko` only when supplied, as
     `/ko/blog/<slug>.html`.
   - Add a focused unit case: an archived article with a valid English URL and
     no Korean URL passes; malformed optional Korean URLs fail.

4. Change tag validation from mandatory to conditional bilingual parity.
   - For each archived article, inspect the required English replacement and
     enforce the current overlap rule.
   - Inspect a Korean replacement only when `replacement_url_ko` is present.
   - For the legacy 2026-08-01 pair set, retain parity assertions wherever both
     files exist, but do not report an error merely because a new English-only
     replacement has no `.ko.md` file.
   - Add tests for English-only archive lineage and for a present-but-mismatched
     Korean pair failing parity.

5. Keep the archive template backward compatible.
   - Confirm the existing `with .Params.replacement_url_ko` conditional still
     omits the Korean link cleanly when absent.
   - Add a rendered or template-contract test for an English-only archived
     article so the page has no empty replacement container or broken Korean
     link.

6. Verify only the planned policy change.
   - Do not alter existing `.ko.md` files, `config.yaml`, `data/expeditions`,
     newsletter configuration, or deployment configuration.
   - Record the exact changed files and results in the implementation PR.

## Integration checkpoints

1. After steps 1-2, review policy text: no sentence may imply a default Korean
   deliverable, while existing Korean reader support remains explicitly
   preserved.
2. After steps 3-4, run validator unit tests before the whole corpus checks.
3. After step 5, build Hugo and inspect one legacy bilingual archive plus one
   temporary English-only fixture/rendered case.
4. Before requesting review, compare against the pinned base and confirm no
   `.ko.md` content, language config, or beehiiv URL changed.

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
policy, validator, test, and archive-template surfaces listed above. The Hugo
build retains both English and Korean output for existing content.

If the theme submodule is absent, initialize it with `git submodule update
--init --recursive` before the Hugo build. If any corpus validation reveals an
existing malformed bilingual record, do not silently repair unrelated content:
report it separately and decide whether it belongs in this change.

## Rollback

The implementation is source-only and reversible. Revert its single commit to
restore mandatory bilingual authoring and validation. Existing Korean URLs,
content, newsletter configuration, and deployment state are untouched, so no
content restoration, cache invalidation, or external rollback is needed.

## Acceptance criteria

- A new English-only article can be created and maintained without a `.ko.md`
  counterpart or `(en/ko)` PR convention.
- An archived article can name a valid English replacement without a Korean
  replacement URL.
- Existing bilingual articles, archive notices, hreflang behavior, Expedition
  parity, and Korean newsletter routing continue to work.
- A requested Korean counterpart is still supported, but its quality and
  review are an explicit owner decision rather than a pipeline default.
- No existing Korean article is deleted, modified, unpublished, or represented
  as newly quality-reviewed.

## Company-laptop implementation handoff

Resume prompt:

> Implement `agent-plans/personal/PLAN-pause-korean-article-authoring.md` from
> base `7af05f2a0965d11fbec94064f5015702acfceb5c`. Keep scope to the listed
> policy, validator, test, and archive-template files. Preserve all existing
> Korean content and site/newsletter configuration. Run every listed command,
> record results, open or update the implementation PR as a draft, and do not
> merge, deploy, or send newsletter email.
