---
title: Query S3 Buckets Safely with the AWS CLI and JMESPath
date: 2023-06-26T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use current ListBuckets pagination and JMESPath filters, and choose HeadBucket when the real question is whether a known bucket is accessible."
categories:
  - AWS
tags:
  - Amazon S3
  - AWS CLI
  - JMESPath
---

`aws s3api list-buckets` lists general-purpose buckets owned by the authenticated account. AWS CLI's `--query` option uses JMESPath and can both project fields and filter by values. An older version of this article incorrectly said value filtering required `jq` or `grep`.

First verify the identity, especially when several profiles are configured:

```bash
aws sts get-caller-identity --profile engineering-dev
```

List bucket names:

```bash
aws s3api list-buckets \
  --profile engineering-dev \
  --query 'Buckets[].Name' \
  --output text
```

Filter for an exact name in JMESPath:

```bash
aws s3api list-buckets \
  --profile engineering-dev \
  --query "Buckets[?Name=='example-bucket'].Name" \
  --output text
```

For automation, an empty text result is ambiguous unless the script checks it explicitly. Avoid piping to unanchored `grep`, where `logs` could accidentally match `logs-archive` and output formatting can change.

## Listing is not always the right check

If the application already knows the bucket name and needs to determine whether its current identity can address it, use `head-bucket`:

```bash
if aws s3api head-bucket \
  --bucket example-bucket \
  --profile engineering-dev 2>/dev/null; then
  echo "bucket is reachable"
else
  echo "bucket is missing or access is denied" >&2
  exit 1
fi
```

For security reasons, error details may not always distinguish a nonexistent bucket from one the caller cannot access. Do not turn that ambiguity into a false “does not exist” claim. Creating a bucket based only on a failed head request can race or target the wrong account.

## Pagination and scale

Current `ListBuckets` supports pagination and optional prefix/Region parameters. AWS strongly recommends paginated requests; unpaginated requests are rejected for accounts with an approved general-purpose bucket quota above 10,000. AWS CLI paginates by default, but scripts that set `--no-paginate` or call the API directly must handle this deliberately. Directory buckets are not returned by this operation.

Examples:

```bash
aws s3api list-buckets --prefix team-a- --max-items 100
aws s3api list-buckets --bucket-region us-east-1 --max-items 100
```

The exact CLI JSON skeleton is not a stable programmatic contract. For application logic, use an AWS SDK paginator and typed response rather than parsing human-oriented text output.

## Verification checklist

- Confirm account and role with STS.
- Test exact match, no match, and names with similar prefixes.
- Test access denied separately from an absent name.
- Preserve pagination in large-account scripts.
- Grant only `s3:ListAllMyBuckets` or specific bucket actions actually required.
- Do not print sensitive account inventories into shared CI logs.

Official documentation reviewed on **2026-08-01**:

- [`list-buckets` AWS CLI reference](https://docs.aws.amazon.com/cli/latest/reference/s3api/list-buckets.html)
- [`head-bucket` AWS CLI reference](https://docs.aws.amazon.com/cli/latest/reference/s3api/head-bucket.html)
- [AWS CLI filtering](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-filter.html)
