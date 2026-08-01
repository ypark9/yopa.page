# Article Maintenance: 2023–2025

Reviewed: 2026-08-01

This ledger tracks the technical-article review requested for the 2023–2025 archive. Existing 2026 articles are outside the review scope. New 2026 replacement articles may be added when an older article's central recommendation can no longer be repaired safely in place.

## Decision policy

| Verdict | Meaning | Required action |
| --- | --- | --- |
| Keep | The central guidance still matches current practice. | Correct metadata or small clarity issues and record `lastmod` and `reviewed_at`. |
| Tone | The technical direction is sound but the prose is exaggerated, formulaic, or distracting. | Rewrite the complete prose surface without changing the technical claim. |
| Update | The article remains a useful URL and framing, but commands, examples, caveats, or recommendations changed. | Verify against primary sources and revise in place. |
| Archive + replacement | The central workflow is deprecated, unsafe, materially incorrect, or no longer the best route. | Preserve the URL with an archive notice and publish a maintained English/Korean replacement pair. |

An article is archived only when editing it in place would preserve a misleading title, premise, or learning path. Age alone is not an archive reason.

## Review protocol

- Read the complete article, including frontmatter, code, tables, and links.
- Prefer official product documentation, specifications, release notes, and deprecation notices. Community sources are supplementary only.
- Record volatile claims only when useful, with a verification date or a link to the live limit/status page.
- Treat destructive commands, credential handling, authentication, dependency updates, and deployment guidance as high risk.
- Preserve existing URLs. Do not merge articles that address separate search intents.
- Write replacement articles as matching `.en.md` and `.ko.md` files with equivalent technical claims and natural prose in each language.

## Ownership and progress

| Subject | Owner | Audited | 2023 remediation | 2024 remediation | 2025 remediation |
| --- | --- | ---: | --- | --- | --- |
| Salesforce, Salesforce CLI, Apex | Salesforce reviewer | 30 | Complete | Complete | Complete |
| TypeScript, JavaScript, Node.js, Python, Git, developer tools, software design | Developer-tools reviewer | 87 | Complete | Complete | Complete |
| AWS, infrastructure, DevOps, architecture, AI | AWS/AI reviewer | Complete | Complete | Complete | Complete |

Non-technical book summaries, workplace advice, leadership, psychology, and general self-development articles are intentionally excluded.

## Primary evidence index

### Salesforce

- [Migrate `sfdx` commands to `sf`](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
- [Salesforce CLI command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html)
- [Salesforce CLI org commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org.html)
- [Queueable Apex guidance](https://developer.salesforce.com/blogs/2023/05/leveling-up-your-apex-skills)
- [Spring '26 Connected App change](https://help.salesforce.com/s/articleView?id=005228017&language=en_US&type=1)

### Languages and developer tools

- [TypeScript handbook: types from types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [TypeScript decorators](https://www.typescriptlang.org/docs/handbook/decorators)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) and [package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/)
- [Jest mock functions](https://jestjs.io/docs/mock-functions) and [ECMAScript modules](https://jestjs.io/docs/ecmascript-modules)
- [PyPA virtual environments](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/), [tool recommendations](https://packaging.python.org/en/latest/guides/tool-recommendations/), and [stand-alone CLI tools](https://packaging.python.org/en/latest/guides/installing-stand-alone-command-line-tools/)
- [Git documentation](https://git-scm.com/docs) and [GitHub pull-request checkout guidance](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/checking-out-pull-requests-locally)

## High-priority archive decisions

## Tag taxonomy and knowledge-graph quality

- Canonical tag policy: [`docs/article-tag-taxonomy.md`](article-tag-taxonomy.md)
- Scope: all 158 reviewed 2023-2025 technical articles and all 86 bilingual replacement files.
- Validation result: 244 scoped articles use 147 canonical tags; 48 tags currently occur once.
- Article Atlas relationship model gives tags more weight than categories (`tags: 80`, `categories: 35`).
- 2026-08-01 verification: 234 of 256 visible Atlas articles have at least one related destination, and 649 of 668 generated relationship edges (97.2%) share a canonical tag.
- Regression gates require at least 90% graph coverage and at least 95% tag-supported relationship edges.

Run `python3 scripts/validate_article_tags.py` after changing article tags. The validator enforces canonical spelling, 3-6 tags per scoped article, bilingual replacement parity, archived-to-replacement overlap, and a non-isolated reviewed graph.

### Salesforce and Apex

| Original article | Why the original is archived | Replacement direction |
| --- | --- | --- |
| `2023-04-10-What-Is-The-Difference-between-String[]-and-List<String>-in-Apex.md` | Incorrect memory-layout claims and a non-compiling example undermine the premise. | Explain Apex list syntax, constructors, nested lists, and verified examples. |
| `2023-04-20-sfdx-force:source:push-vs-sfdx-force:source:deploy.md` | Both commands belong to the deprecated `sfdx` workflow and several behavioral claims are false. | Use `sf project deploy start` and `sf project retrieve start`, including tracking, tests, target orgs, and dry runs. |
| `2023-04-25-Checking-If-an-SObject-Exists-in-a-Salesforce-Scratch-Org.md` | The command and flag combination does not perform the promised object check. | Use `sf sobject describe`, a target org, JSON output, and explicit exit handling. |
| `2023-05-01-Get-Access-Token-From-Salesforce.md` | Scraping bearer tokens from verbose output encourages credential leakage. | Limit token display to deliberate debugging and prefer workload identity, JWT, or OIDC for automation. |
| `2023-05-03-Why-Apex-Test-Cannot-Find-Enum-Defined-in-Apex-Class.md` | The failing and fixed examples are identical, so the article does not establish its claim. | Provide a compiling reproduction of identifier shadowing and nested enum references. |
| `2023-05-07-Running-Apex-CLS-File-on-CLI.md` | It treats class files as anonymous Apex and uses unsafe shell interpolation. | Run `.apex` scripts with `sf apex run`, validate extensions, and pass subprocess arguments safely. |
| `2023-05-09-sfdx-force:org:display-to-get-the-scratch-org-information-Salesforce.md` | It uses a deprecated command and exposes a realistic access token. | Use `sf org display --json` and separate ordinary org details from deliberate token retrieval. |
| `2023-05-16-SFDX-Deploy-Record-using-CSV.md` | Data is imported or upserted, not deployed, and the shown mapping interface is obsolete. | Use current bulk upsert commands with external IDs, job status, and failure handling. |
| `2023-06-02-Using-SFDX-CLI-Command-to-Insert-User-to-Org.md` | Shell substitution is unsafe and the example ignores licenses, profiles, and required fields. | Prefer scratch-org user creation or a governed API/admin workflow with safe structured input. |
| `2023-06-21-Record-Based-Configuration-in-Salesforce.md` | The label is nonstandard and Workflow Rules are no longer the strategic automation path. | Compare record types, Dynamic Forms, custom metadata, and Flow by requirement. |
| `2023-06-22-How-to-Update-SFDX-CLI-from-One-Version-to-Another.md` | The package is deprecated and the cleanup advice deletes configuration indiscriminately. | Cover supported `sf` installers and update channels without deleting auth or configuration. |
| `2023-09-09-Understanding-the-sfdx-force-source-convert-Command-in-Salesforce-DX.md` | It implies Metadata API conversion is required for ordinary deployment. | Make direct source-format deployment the default and reserve conversion for interoperability. |

### Languages and developer tools

| Original article | Why the original is archived | Replacement direction |
| --- | --- | --- |
| `2023-04-17-Setting-Up-Virtual-Environments-for-Multiple-Python-Versions.md` | It recommends `python2 -m venv`, although standard-library `venv` is a Python 3 facility. | Use a supported interpreter, project `.venv`, declared dependencies, and `pipx` for applications. |
| `2023-04-19-Decorators-for-Class-in-TypeScript.md` | It teaches only legacy experimental decorators without distinguishing standard decorators. | Compare current standard decorators with `experimentalDecorators` and provide a migration path. |
| `2023-06-19-How-to-Delete-Unwanted-Files-from-a-Pull-Request.md` | It conflates working-tree, staged, committed, and pushed states and recommends destructive commands based on false claims. | Give state-specific, previewable recovery steps using restore or a corrective commit. |
| `2023-09-08-Keeping-Your-Python-Packages-Up-to-date-A-Comprehensive-Guide.md` | A bulk `pip freeze | xargs pip install -U` update bypasses dependency intent and safe review. | Declare direct dependencies, update locks deliberately, test, and audit in reviewable changes. |

### AWS

| Original article | Why the original is archived | Replacement direction |
| --- | --- | --- |
| `2023-05-22-AWS-IAM-User-vs-Role.md` | It recommends permanent IAM-user credentials for humans and applications instead of federation and temporary role credentials. | Provide an identity decision tree using IAM Identity Center, workload roles, MFA, least privilege, and Access Analyzer. |
| `2023-05-23-AWS-SSO-With-TypeScript.md` | It uses the former AWS SSO model and unsafe shell interpolation instead of the SDK provider chain. | Configure an IAM Identity Center `sso-session`, use explicit interactive login, and let AWS SDK for JavaScript v3 resolve credentials. |
| `2023-06-05-Deploying-services-AWS-CDK-and-AWS-SSO.md` | It mixes CDK v1 and v2 APIs, uses a retired Lambda runtime, and omits production security and operability. | Use CDK v2, a supported runtime, provider-chain credentials, least-privilege roles, logs, tests, and explicit removal policies. |
| `2023-06-08-aws-sso-get-role-credentials.md` | It manually handles cached access tokens and role credentials that supported providers should resolve. | Use the standard SDK/CLI provider chain and export credentials only for a narrow non-SDK compatibility case. |
| `2023-06-13-Invoking-AWS-API-Gateway-with-SigV4.md` | It hard-codes access keys and depends on the end-of-support AWS SDK for JavaScript v2. | Sign with SDK v3 and temporary credentials, with canonical-request diagnostics and API Gateway IAM authorization guidance. |
| `2023-06-15-Leveraging-AWS-SSO-to-Acquire-AWS-SecretAccessKey-and-SessionToken.md` | It reads an arbitrary cached token file and shells sensitive values through an unsupported workaround. | Use the provider chain, with a carefully scoped export workflow only when an external tool requires it. |

## Detailed per-article ledger

The detailed ledger is completed year by year after remediation. Each row must contain the path, verdict, priority, current recommendation, material change, official evidence, and resulting replacement URLs when applicable.

### 2023

Complete. Ninety-nine technical articles were reviewed and corrected. Twenty-two unsafe, deprecated, or fundamentally misleading articles were archived and linked to 22 maintained English/Korean replacement pairs. The remaining articles were updated in place or received a whole-surface editorial pass. Frontmatter validation, 28 unit tests, `git diff --check`, and the Hugo production build passed at the year gate.

### 2024

Complete. Forty-one technical articles were reviewed: 31 were retained and substantively updated, while 10 were archived and linked to 10 English/Korean replacement pairs. The year gate passed frontmatter validation for 278 posts, 28 unit tests, `git diff --check`, a minified Hugo build, and rendered-target checks for every replacement URL.

### 2025

Complete. All 18 technical articles were reviewed. Seven were retained and updated or verified; 11 were archived and linked to 11 English/Korean replacement pairs. The largest corrections concern Cognito/Salesforce trust direction, n8n queue-mode reliability, and AgentCore runtime, memory, A2A, tenancy, voice, identity, security, and platform-governance contracts.

## 2024–2025 archive inventory

| Original | Reason | Maintained replacement |
| --- | --- | --- |
| `2024-01-22-Harnessing-the-Power-of-Watchtower-for-Docker-Automated-Updates-Made-Simple.md` | Unattended `latest` updates and Docker-socket access are presented without staging, rollback, or recovery. | `safe-container-updates-on-a-personal-docker-host` |
| `2024-02-05-Understanding-Salesforce-Packaging-A-Comprehensive-Comparison-of-1GP-vs-2GP.md` | Namespace, ancestry, promotion, and dependency claims would lead to the wrong package model. | `choose-a-salesforce-package-model` |
| `2024-03-11-Transitioning-from-venv-to-Pipenv-A-Comprehensive-Guide-with-Examples.md` | Pipenv is presented as a universal upgrade and the workflow relies on obsolete Python examples. | `choosing-python-project-workflow` |
| `2024-04-28-How-to-Debug-Salesforce-Flows-with-Asynchronous-Apex-Methods.md` | The article centers `@future` instead of Queueable and omits transaction/log correlation. | `debug-flow-invoked-queueable-apex` |
| `2024-05-05-Understanding-Salesforce-APIs-Metadata-Tooling-and-Bulk.md` | Its three-API framing omits current data, UI, composite, GraphQL, and Bulk API 2.0 choices. | `choose-the-right-salesforce-api` |
| `2024-06-04-Understanding-Record-Types-and-RecordTypeId-in-Salesforce-for-Beginners.md` | It hard-codes org IDs and confuses Record Types with Person Accounts and import mapping. | `salesforce-record-types-without-hard-coded-ids` |
| `2024-06-15-automating-salesforce-package-deployment-with-aws-code-services-a-comprehensive-guide.md` | The pipeline uses obsolete commands and treats CodeDeploy as a Salesforce deployer. | `salesforce-ci-cd-with-aws-codepipeline-and-codebuild` |
| `2024-08-12-mastering-generative-ai-for-efficient-software-development.md` | Linear role prompts omit repository context, deterministic validation, privacy, threat modeling, and approval gates. | `evidence-driven-ai-assisted-software-development` |
| `2024-09-14-transform-python-scripts-into-global-command-line-tools.md` | A global symlink is not a portable package, upgrade, or uninstall workflow. | `package-and-install-python-cli` |
| `2024-12-30-troubleshooting-aws-amplify-authentication.md` | It treats password auth as a universal fix and omits Cognito's challenge state machine. | `debug-amplify-cognito-sign-in-flows` |
| `2025-04-11-setting-up-sso-between-aws-cognito-and-salesforce-a-beginners-guide.md` | It mixes opposite trust directions and omits discovery, PKCE, state, nonce, claim lifecycle, and logout. | `cognito-salesforce-oidc-trust-topologies` |
| `2025-05-21-ai-agents-vs-agentic-ai-understanding-key-differences-2025.md` | A marketing distinction is presented as a stable binary instead of independent capability and risk dimensions. | `a-practical-taxonomy-for-ai-agent-systems` |
| `2025-08-20-scaling-n8n-on-aws-serverless-architecture.md` | The claimed production topology does not separate processors, pin versions, or provide durable upgrade and recovery paths. | `run-n8n-queue-mode-on-aws-ecs` |
| `2025-12-08-building-long-running-agents-with-agentcore.md` | Runtime lifetime is confused with durable job state and several configuration examples are noncurrent. | `durable-long-running-jobs-with-agentcore` |
| `2025-12-09-deep-dive-into-agentcore-memory-architecture.md` | The strategy schema and hook APIs do not match the current Memory service contract. | `agentcore-memory-events-strategies-and-isolation` |
| `2025-12-11-architecture-patterns-for-strands-and-mcp.md` | The A2A wrapper and discovery claims do not match the current HTTP/JSON-RPC and agent-card contract. | `mcp-and-a2a-boundaries-on-agentcore` |
| `2025-12-13-implementing-multi-tenancy-with-agentcore.md` | Memory namespaces and illustrative token exchange are incorrectly treated as tenant authorization. | `multi-tenant-isolation-with-agentcore` |
| `2025-12-14-real-time-voice-agents-with-aws-nova-sonic.md` | The transport and model guidance predates the current Nova 2 Sonic bidirectional event-stream workflow. | `real-time-voice-agents-with-nova-2-sonic` |
| `2025-12-15-partner-insights-agentcore-overview.md` | Illustrative snippets are presented as real APIs and service boundaries are overstated. | `agentcore-service-map-and-production-boundaries` |
| `2025-12-17-securing-agentic-ai-for-financial-institutions.md` | It claims automatic user propagation, combined SigV4/OAuth, and an entirely private mesh without the required hop-by-hop controls. | `zero-trust-agent-systems-on-aws` |
| `2025-12-20-building-agent-factory-with-agentcore.md` | A demo-specific bootstrap grants infrastructure mutation without declarative review, signed artifacts, quotas, or rollback. | `build-a-governed-agent-platform-on-aws` |
