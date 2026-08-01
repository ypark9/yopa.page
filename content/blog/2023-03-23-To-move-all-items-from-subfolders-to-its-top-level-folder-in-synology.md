---
title: Synology Script - How to Efficiently Move Items from Subfolders to Parent Folder
date: 2023-03-23T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Flatten a Synology folder carefully, with a dry run, collision checks, and a tested backup before moving files."
categories:
  - Programming
  - Synology
tags:
  - Synology
  - Shell
  - File Management
  - Data Protection
---

Flattening a directory tree looks simple until two subfolders contain a file with the same name. A script also needs to handle spaces, newlines, partial failures, and files that are already at the destination level.

Before moving anything, take or verify a recoverable backup. Synology documents Hyper Backup and Snapshot Replication as recovery options; RAID alone is not a backup. Run the script first against a temporary directory with representative filenames.

## Preview the move

This Bash script targets only files below the first directory level. It prints the proposed source and destination and stops when a destination name already exists.

```bash
#!/bin/bash
set -euo pipefail

rootdir="/volume1/target"

find "$rootdir" -mindepth 2 -type f -print0 |
while IFS= read -r -d '' source; do
  destination="$rootdir/$(basename "$source")"

  if [[ -e "$destination" ]]; then
    printf 'collision: %q -> %q\n' "$source" "$destination" >&2
    continue
  fi

  printf 'would move: %q -> %q\n' "$source" "$destination"
done
```

Review every collision instead of silently overwriting it. Decide whether duplicate names should be renamed, deduplicated, or left in place.

## Perform the move

After verifying the backup and preview, replace the final `printf 'would move...'` line with:

```bash
mv -- "$source" "$destination"
```

Synology DSM versions can ship different command implementations. Confirm that `mv --` works on the NAS; if it does not, use `mv "$source" "$destination"` and reject filenames beginning with `-` before running the script. Run it from an administrator-controlled shell, not from an untrusted downloaded script.

This moves files, not directories. Empty directories remain so they can be inspected before removal. Do not add automatic directory deletion until the moved files, permissions, applications, and backups have been verified.

Official recovery references: [Back up your Synology NAS](https://kb.synology.com/en-global/DSM/help/DSM/Tutorial/backup_backup) and [Hyper Backup data backup](https://kb.synology.com/en-global/DSM/help/HyperBackup/data_backup?version=7).
