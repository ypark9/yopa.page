---
title: "Install and Update Salesforce CLI Safely"
date: 2023-06-22T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-22-how-to-update-sfdx-cli-from-one-version-to-another.html"
author: Yoonsoo Park
description: "Identify how Salesforce CLI was installed, update the supported sf CLI, and preserve authentication safely."
categories:
  - Salesforce
tags:
  - Salesforce CLI
  - Developer Tools
  - Security
---

This guide was verified against Salesforce's current CLI documentation on 2026-08-01.

## Why the old workflow changed

The standalone `sfdx` CLI has been unsupported since April 2023. The supported executable is `sf`, distributed through Salesforce installers and the `@salesforce/cli` npm package. An old troubleshooting habit was to uninstall packages, delete every `.sfdx` directory, and reinstall. That mixes three different concerns—program files, configuration, and authorization—and can destroy working credentials without fixing the binary selected by `PATH`.

## Start with the installation owner

Before changing anything, identify every executable and its version:

```bash
type -a sf
command -v sf
sf version --verbose
npm list --global --depth=0 @salesforce/cli
```

On macOS, `type -a` is especially useful because a native installer, Homebrew-managed path, and an npm global installed under a Node version manager can coexist. Update with the same channel that owns the active executable. A Salesforce installer build can self-update with `sf update`; an npm installation is updated through npm:

```bash
npm install --global @salesforce/cli@latest
sf version --verbose
sf doctor
```

Do not run both approaches merely to be safe. Multiple owners make later debugging harder.

## Preserve configuration and authentication

CLI state is not disposable program code. Before a repair, list the org aliases you rely on and confirm that your team has a documented way to reauthenticate. Never copy authorization files into a repository or ticket. Do not use `sudo rm -rf` against CLI state directories. If a support procedure calls for clearing a specific cache, back it up and limit the change to that diagnosed cache.

For CI, pin an intentional CLI version in the build image or lockfile and update it through a reviewed dependency change. Do not let every pipeline pull `latest` without validation. Authentication material belongs in the CI secret store, and the build log must not print auth URLs or tokens.

## Alternatives and tradeoffs

- The native installer is a simple default for a developer workstation and avoids coupling the CLI to an `nvm` Node version.
- npm is useful when a team already controls Node and global-tool versions, but each Node installation can have a different global package directory.
- A pinned container gives CI reproducibility, at the cost of maintaining and scanning the image.

## Migration checklist

1. Record `type -a sf`, `sf version --verbose`, and the owning package manager.
2. Remove legacy `sfdx-cli` only through the package manager that installed it.
3. Install or update one supported `sf` distribution.
4. Open a fresh shell and confirm that the intended binary appears first.
5. Run `sf doctor`, then `sf org list auth` without sharing its sensitive output.
6. Execute one read-only command against a nonproduction org.
7. Update scripts from `sfdx force:*` to their current `sf` equivalents separately; a binary update does not make old documentation correct.

## Official sources

- [Install Salesforce CLI](https://developer.salesforce.com/docs/platform/salesforce-cli-guide/guide/install-sfdx-cli.html)
- [Migrate from sfdx to sf](https://developer.salesforce.com/docs/platform/salesforce-cli-plugin/guide/migrate-sfdx-sf.html)
- [Salesforce CLI command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html)
