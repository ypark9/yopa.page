# Article tag taxonomy

Tags are relationship edges, not a second description field. They should help a reader move between articles that share a product, language, architectural concept, protocol, or operational concern.

The enforced scope is the 2023–2025 technical maintenance set plus its new `2026-08-01` replacement articles. Previously excluded non-technical articles and pre-existing 2026 articles remain unchanged.

## Rules

- Use 3–6 tags per article.
- Prefer canonical product names and durable concepts over marketing adjectives or generic labels.
- Keep spelling and casing exact: `Git`, `CLI`, `Salesforce CLI`, `IAM Identity Center`, and `Amazon Bedrock AgentCore`.
- Keep categories broad; make tags precise enough to explain why two articles are related.
- English and Korean versions of the same article must use the same tags in the same order.
- An archived article and its replacement must share at least two tags so inbound knowledge-graph paths remain connected.
- Do not combine multiple tags in one comma-separated value.
- A current article must share at least one tag with another reviewed article.

## Tag shape

A balanced article usually contains:

1. A primary ecosystem or product, such as `Python`, `Salesforce CLI`, or `Amazon Bedrock AgentCore`.
2. A technical concept, such as `Virtual Environments`, `OIDC`, or `Source Tracking`.
3. A practice or concern, such as `Dependency Management`, `Authentication`, `Observability`, or `Multi-Tenancy`.

Add a fourth to sixth tag only when it creates a meaningful reusable connection. Avoid `Programming`, `Technology`, and `Best Practices`; the article's language, product, or actual practice is a stronger edge.

## Canonical migrations

| Old variants | Canonical tag |
| --- | --- |
| `sfdx`, `SFDX` | `Salesforce CLI` |
| `AWS SSO`, `AWS-SSO` | `IAM Identity Center` |
| `AgentCore` | `Amazon Bedrock AgentCore` |
| `git` | `Git` |
| `cli` | `CLI` |

Run `python3 scripts/validate_article_tags.py` after changing article tags.
