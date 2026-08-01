---
title: Resolve CloudFront CNAMEAlreadyExists Without an Avoidable Outage
date: 2024-01-23
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Identify and move a CloudFront alternate domain name with ownership proof, a matching certificate, and AWS-supported conflict APIs."
categories:
  - AWS
  - Troubleshooting
tags:
  - Amazon CloudFront
  - DNS
  - TLS
  - Reliability
---

CloudFront returns `CNAMEAlreadyExists` when the alternate domain name you want is already associated with another CloudFront distribution or distribution tenant. DNS may still point at the old resource, but deleting the DNS record alone does not necessarily remove the CloudFront association and can create an avoidable outage.

## Prepare the target first

The target distribution must be deployed and include a valid TLS certificate from ACM in `us-east-1`. The certificate's subject alternative names must cover the domain you are moving. Configure origins, cache behavior, security policy, logging, and error responses before changing production traffic.

Confirm the AWS account and distribution IDs:

```bash
aws sts get-caller-identity --profile production
aws cloudfront get-distribution --id TARGET_ID --profile production
```

Do not copy a domain between accounts based on a partial distribution ID from an error message.

## Find the conflict

AWS recommends the newer `ListDomainConflicts` operation because it supports both standard distributions and distribution tenants. `ListConflictingAliases` supports standard distributions and remains relevant for older workflows. The caller needs permission for the operation and access to the target resource used in the ownership check.

Use the current console, SDK, or AWS CLI command available in your installed CLI version. Inspect exact and wildcard conflicts: `*.example.com` can overlap `www.example.com` even when the literal alias is not obvious.

If you own both resources and they are in the same account, update the source and target through the documented move procedure. Depending on resource type and account boundary, AWS supports `AssociateAlias` or `UpdateDomainAssociation`. Cross-account movement requires domain ownership proof, commonly through the documented DNS TXT record, and appropriate permissions on both sides.

## Avoid DNS-first troubleshooting

Lower DNS TTL ahead of a planned move when appropriate, but do not remove a working record simply to clear the API error. CloudFront's alias association and public DNS are separate state. Prepare and validate the target, move the association with the supported operation, update DNS if the target hostname changes, and keep the source available through propagation and cache windows.

Test the target before the public cutover where possible:

```bash
curl --resolve www.example.com:443:TARGET_EDGE_IP \
  https://www.example.com/health
```

Because CloudFront edge IPs change and direct testing has caveats, follow the documented target-validation method for the migration type. Verify certificate hostname, response headers, origin routing, redirects, cache keys, cookies, and authenticated paths—not only the home page.

## Failure and rollback

If AWS says the source is in another account you do not control, do not attempt to seize it. Verify DNS ownership and open an AWS Support case using the official process. Never publish account IDs, distribution details, or certificate validation records in a public ticket.

Keep the source configuration and DNS values recorded. A rollback may require moving the alias back; DNS reversal alone is insufficient if CloudFront now associates the alias with the target. Monitor CloudFront 4xx/5xx, origin errors, TLS failures, cache hit behavior, and application checks during the change window.

## Checklist

- Confirm account, source, target, exact alias, and wildcard overlap.
- Deploy target behavior and an `us-east-1` certificate covering the alias.
- Use the supported conflict-list and association/move operation.
- Prove ownership for cross-account movement.
- Coordinate alias and DNS changes; do not delete DNS as a first fix.
- Validate critical paths and monitoring before and after cutover.
- Preserve a tested reverse-move rollback plan.

Official documentation reviewed on **2026-08-01**:

- [Move an alternate domain name](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/alternate-domain-names-move.html)
- [`list-domain-conflicts`](https://docs.aws.amazon.com/cli/latest/reference/cloudfront/list-domain-conflicts.html)
- [Requirements for alternate domain names](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)
