---
title: DNS and Email Authentication Without the Misleading Shortcuts
date: 2024-11-25
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A practical guide to A, CNAME, MX, TXT, SPF, DKIM, and DMARC records, including alignment, limits, rollout, and verification."
categories:
  - Technology
  - Web Development
tags:
  - DNS
  - Email Authentication
  - SPF
  - DKIM
  - DMARC
  - Security
---

DNS publishes routing and policy data. It does not perform an HTTP redirect, prove that every sender is trustworthy, or guarantee email delivery. Understanding the boundary of each record prevents configurations that look correct but fail authentication or create outages.

## Common DNS records

- **A / AAAA:** map a hostname to an IPv4 or IPv6 address.
- **CNAME:** aliases one DNS name to another canonical name. It is not a browser redirect and normally cannot coexist with other data at the same owner name. DNS providers may offer ALIAS/ANAME-style flattening at the zone apex; that is provider behavior, not a CNAME at the apex.
- **MX:** identifies mail exchangers for a domain. A lower preference number is tried first. Multiple MX records help only when they lead to genuinely independent, correctly configured delivery paths; a fake “backup MX” can weaken filtering or queue mail incorrectly.
- **TXT:** carries arbitrary text used by ownership checks and email policies. Publishing several unrelated TXT records is normal, but a domain must not publish multiple SPF records.

## SPF: authorize sending infrastructure

SPF evaluates whether the connecting mail server is authorized for the RFC5321.MailFrom/return-path domain. It does not by itself authenticate the visible `From` header. Keep one SPF record per domain, end with an intentional qualifier, and watch the RFC-defined DNS lookup limit. Flattening provider ranges can become stale, while excessive `include` chains can produce `permerror`.

Example:

```dns
example.com. TXT "v=spf1 include:_spf.example-sender.com -all"
```

Use a subdomain for a third-party sender when it reduces blast radius, and remove providers when they are no longer used.

## DKIM: sign messages

DKIM adds a cryptographic signature. The receiver retrieves the public key at a selector such as `selector1._domainkey.example.com`. Protect the private key at the sender, use supported key sizes, rotate selectors, and keep an old selector published until messages signed with it have aged out.

AWS SES Easy DKIM can generate and rotate keys, but the DNS records must remain correct. “Three CNAMEs” is an SES implementation detail, not the definition of DKIM.

## DMARC: require alignment and publish handling policy

DMARC passes when at least one of SPF or DKIM both passes and aligns with the visible `From` domain. It then tells receivers the requested policy and where to send aggregate reports.

```dns
_dmarc.example.com. TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.com; adkim=r; aspf=r; pct=100"
```

Start with monitoring only after the mailbox and privacy handling for reports are ready. Inventory legitimate senders, fix alignment, then move deliberately to `quarantine` and `reject`. `p=none` gathers data but does not ask receivers to block failing mail. Receiver behavior and local policy can still vary.

## Safe change procedure

1. Inventory every service sending with the domain, including marketing, support, billing, alerts, and forwarding.
2. Query current authoritative DNS and record TTLs.
3. Configure DKIM and an aligned return-path for each sender.
4. Publish one reviewed SPF policy and a DMARC monitoring record.
5. Validate syntax with authoritative queries and send test messages to independent receivers.
6. Inspect `Authentication-Results` headers and aggregate reports.
7. Tighten DMARC gradually, monitoring false positives and forwarded/list mail.
8. Document owner, purpose, provider, selector, and removal date for every record.

DNS caching means rollback is not instant. Lowering TTL only helps after the previous TTL has elapsed. DNSSEC protects authenticity of DNS responses when correctly deployed, but it does not replace SPF, DKIM, or DMARC.

Official standards reviewed on **2026-08-01**:

- [SPF, RFC 7208](https://www.rfc-editor.org/rfc/rfc7208)
- [DKIM, RFC 6376](https://www.rfc-editor.org/rfc/rfc6376)
- [DMARC, RFC 7489](https://www.rfc-editor.org/rfc/rfc7489)
- [Amazon SES Easy DKIM](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html)
