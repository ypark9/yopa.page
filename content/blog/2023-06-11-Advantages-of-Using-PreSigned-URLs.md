---
title: Secure Direct Uploads with Amazon S3 Presigned URLs
date: 2023-06-11T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use S3 presigned URLs as short-lived bearer capabilities with bounded keys, expiry, validation, and post-upload processing."
categories:
  - AWS
tags:
  - Amazon S3
  - Presigned URLs
  - Security
---

An S3 presigned URL lets a client perform one signed S3 operation without receiving AWS credentials. Direct upload avoids sending large files through the application server, but a presigned URL is not automatically safe: anyone who obtains it can use it until it expires or the signing credentials stop being valid.

## A safer upload flow

1. The authenticated client asks the application for permission to upload metadata such as file name, size, and media type.
2. The application authorizes the user and generates an unpredictable object key inside that user's allowed prefix.
3. The application returns a short-lived presigned `PUT` URL or presigned POST policy.
4. The client uploads directly to S3.
5. An S3 event or explicit completion request starts validation, malware scanning, metadata extraction, and publication. Keep untrusted uploads in a quarantine prefix or bucket until this finishes.

```python
import boto3

s3 = boto3.client("s3")
url = s3.generate_presigned_url(
    "put_object",
    Params={
        "Bucket": "private-upload-bucket",
        "Key": "incoming/user-123/7a4f...",
        "ContentType": "image/png",
    },
    ExpiresIn=300,
)
```

The client must send the same signed content type. For stricter size constraints, use a presigned POST policy with `content-length-range`, or enforce limits through another trusted boundary. For large uploads, use multipart upload and abort incomplete uploads with an S3 lifecycle rule.

## Security boundaries

- Use the shortest practical expiration. A URL signed with temporary credentials cannot outlive those credentials.
- Treat the URL as a bearer secret: do not put it in analytics, chat, referer-bearing pages, or durable logs.
- Give the signing role access only to the required bucket, operation, and key prefix.
- Keep Block Public Access enabled; a presigned URL does not require public objects.
- Consider checksums, allowed content type, unique keys, server-side encryption, retention, and overwrite behavior.
- Configure CORS only for trusted origins and necessary methods/headers. CORS is a browser control, not authorization.
- Do not make an upload public until server-side validation succeeds.

Revocation is limited. Removing the object does not invalidate an upload URL, and a generated URL has no independent revoke button. You can revoke or restrict the credentials/policy used to sign it, but that affects other requests. Short expiry and narrowly scoped signing permissions are the practical controls.

## When server-side upload is better

Proxy through the application when it must inspect or transform every byte before storage, the client cannot talk to S3, or centralized rate limiting outweighs bandwidth cost. Presigned direct upload is preferable for large trusted workflows, but it moves validation to an asynchronous boundary that must be designed explicitly.

Migration verification: confirm private bucket policy, signing-role scope, expiry, wrong-user denial, size/type rejection, duplicate key behavior, incomplete multipart cleanup, scanner failure, and secret-free logging.

Official documentation reviewed on **2026-08-01**:

- [Download and upload objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [Presigned URL upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
