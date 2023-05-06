---
title: How to Switch Scratch Orgs for a VS Code Project Using CLI
date: 2023-04-30T01:25:00-04:00
author: Yoonsoo Park
description: "How to Switch Scratch Orgs for a VS Code Project Using CLI"
categories:
  - SalesForce
tags:
  - sfdx
---

1. Authorize your new Scratch Org with the CLI by running the following command:
```sh
sfdx force:auth:web:login -r https://test.salesforce.com -a <alias>
```

Replace <alias> with the alias for your new Scratch Org. This will create an OAuth authorization for your new Scratch Org and set it as the default org for the CLI.

2. Update your project's configuration file to use the new Scratch Org by running the following command:
```sh
sfdx force:config:set defaultusername=<alias>
```

Verify that your project is now using the new Scratch Org by checking the org details in the bottom-right corner of the VS Code window.

Cheers! 🍺
