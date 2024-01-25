---
title: Understanding the Difference Between sfdx force:source:push and sfdx force:source:deploy
date: 2023-04-20T01:25:00-04:00
author: Yoonsoo Park
description: "sfdx force:source:push vs sfdx force:source:deploy"
categories:
  - SalesForce
tags:
  - sfdx
---

## Key differences between sfdx force:source:push and sfdx force:source:deploy:

- `sfdx force:source:push` deploys changes from a local project directory, while `sfdx force:source:deploy` deploys changes from a source format.

- `sfdx force:source:push` is optimized for development workflows and is useful for pushing code and metadata changes from your local project to your org, while `sfdx force:source:deploy` is more flexible and can be used to deploy changes from a variety of sources, including third-party apps and other orgs.

- `sfdx force:source:push` is typically faster and more efficient than `sfdx force:source:deploy`, as it only deploys changes that have been made since the last push. `sfdx force:source:deploy`, on the other hand, deploys the entire set of metadata specified in the deployment package.

- `sfdx force:source:push` is better suited for development environments, while `sfdx force:source:deploy` is better suited for production environments where changes are typically made less frequently.

- `sfdx force:source:push` requires that you have a local project directory and version control system set up, while `sfdx force:source:deploy` can be used without a local project directory.

Cheers! 🍺
