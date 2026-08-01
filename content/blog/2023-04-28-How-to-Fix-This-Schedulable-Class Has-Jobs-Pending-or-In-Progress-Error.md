---
title: How to Fix This Schedulable Class Has Jobs Pending or In Progress Error
date: 2023-04-28T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "How to Fix This Schedulable Class Has Jobs Pending or In Progress Error"
categories:
  - Salesforce
tags:
  - Apex
  - Asynchronous Apex
  - CI/CD
---

Salesforce can block deployment of a schedulable Apex class while jobs for that class are queued or running. Treat the jobs as production work to understand, not as an obstacle to bypass automatically.

## Diagnose before changing deployment settings

In Setup, review **Scheduled Jobs** and **Apex Jobs**. Confirm which class is running, who owns the schedule, when it runs next, and whether the deployment changes its behavior or state. In a scratch org, deleting and recreating a disposable schedule may be reasonable. In a shared or production org, coordinate a maintenance window and preserve the schedule expression and owner before aborting anything.

If it is safe to stop a job, abort the specific job through Setup or a reviewed Apex administration procedure, deploy with the current CLI, then reschedule and verify it:

```bash
sf project deploy start --source-dir force-app/main/default/classes \
  --target-org staging --dry-run --test-level RunLocalTests
```

The Deployment Settings option **Allow deployments of components when corresponding Apex jobs are pending or in progress** is a governed exception, not the default fix. It permits class replacement while related work exists, so use it only after assessing compatibility and rollback. Record the previous setting and restore it after the controlled deployment if your policy requires that.

Verification includes the deployment result, Apex tests, the recreated schedule, and the next successful job execution. Reviewed on 2026-08-01 against the [Apex Scheduler documentation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_scheduler.htm) and current Salesforce CLI reference.
