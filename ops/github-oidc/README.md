# yopa.page GitHub OIDC roles

Current immutable repository prefix: `repo:yopa-dev@332928821/yopa.page@630703474`. The deploy role trusts main only. The plan role trusts PR/main/current integration branch and is read-only. Repository variables are `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`; no static AWS/GitHub token secrets are required because the theme submodule is public.

Policies target the existing site buckets, CloudFront distribution and policies, and Article Atlas presence. No Alexa function, skill deployment role, credential service or IAM policy mutation is allowed. New infrastructure or IAM permission changes require owner review; automatic site delivery retains the existing non-destructive plan gates.

The JSON files are canonical role configuration. Provision with IAM create-role/put-role-policy, inspect resulting trust/policy, and set the two repository variables. Never broaden these roles to avoid a CI failure. main requires static-checks, secret-scan, one approval and only yoonsoo-park/ypark9 can push; the App is excluded. Human merges trigger automatic site deployment.

Read-only PR plans disable Terraform locking (`-lock=false`); they must never be applied. Auto-deployment separately creates and applies its own saved plans after acquiring normal locks. GitHub plan artifacts can include infrastructure state and remain subject to repository access; do not store credentials in state.

Migration verification does not dispatch a production deployment. Verify static checks, OIDC trust/permission simulation and live URL/CloudFront baseline; first post-migration deployment occurs only after an owner merge. If credentials are unavailable, CI fails closed while the currently deployed site remains available. Existing human local credentials stay intact; unknown historical repository key principals are not revoked blindly.

The required secret-scan uses the open-source Gitleaks CLI 8.30.1 with a pinned official release checksum. The prior action requires a commercial license for organization repositories. Full Git history and the working tree remain scanned, with secrets redacted; the check name/protection stays unchanged.

The old Gitleaks configuration skipped all static/draw/assets vendor files. The replacement narrows that exception to one exact upstream public Firebase identifier in one pinned bundle, under only two matching rules. Local probes confirm the same value elsewhere and a different value in the bundle still fail. Full history and the tracked working tree scans pass. Firebase reference: https://firebase.google.com/docs/projects/api-keys.
