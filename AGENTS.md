# AGENTS.md

## Project Purpose

- Hugo software engineering blog with English-only articles, localized site features, Article Atlas experiences, and AWS infrastructure managed through OpenTofu.


## Agent Operating Rules

- Start by reading this file and use cxdoc search commands before relying on memory.
- Use `cxdoc current . --json` to confirm the project mapping when context matters.
- Keep durable project instructions in this file; keep searchable details in cxdoc knowledge notes.

## Article language policy

- Blog articles are written and maintained in English only. Do not create, translate,
  or request Korean blog articles or `.ko.md` article counterparts.
- This policy applies to blog articles. Preserve Korean site UI, non-article pages,
  newsletter settings, and Expedition data unless a task explicitly changes them.

## Blog operation playbooks

Task-specific guidance for agents operating on this blog lives in
`docs/agent-playbooks/`. Read the relevant playbook before acting:

- **Inbound article triage** (scan web reading, identify article candidates, report):
  `docs/agent-playbooks/inbound-article-triage.md`

Re-read the playbook that matches your current task each run. The playbooks are the
source of truth for how work on this blog should be done.

## Validation Commands

- Run `python3 scripts/validate_frontmatter.py` to validate blog filenames and required frontmatter.

- Run `python3 -m unittest discover -s tests` and `hugo --gc --minify` for behavior and site-build validation.

- Run `tofu fmt -check -recursive terraform`; validate locked `terraform/env/global` and `terraform/env/prod` configurations before infrastructure changes.


## Deployment And Release Notes

- Pushes to `main` run GitHub Actions deployment through `make ENV=global safe-apply`, `make ENV=prod deploy`, `make ENV=prod safe-promote`, and CloudFront invalidation.

- Destructive OpenTofu plans must halt automation and require separate manual approval; preserve and validate the current `live_path` blue/green state before promotion.


## Privacy And Secrets

- Do not commit secrets, credentials, tokens, or private customer data.
- Prefer local/private configuration stores for sensitive operational details.

## cxdoc managed memory
