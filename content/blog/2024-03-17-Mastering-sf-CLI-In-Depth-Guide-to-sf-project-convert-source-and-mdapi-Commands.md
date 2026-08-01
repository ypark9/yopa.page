---
title: Mastering SF CLI - In-Depth Guide to sf project convert source and mdapi Commands
date: 2024-03-17
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Delve into the nuances of Salesforce CLI's latest commands, 'sf project convert source' and 'sf project convert mdapi', uncovering their roles, distinctions, and impact on contemporary Salesforce development practices."
categories:
  - Salesforce
  - CLI
  - Development
tags:
  - Salesforce CLI
  - Metadata API
  - Data Migration
---

![Salesforce CLI Conversion](images/oni-salesforce-2.webp)

Salesforce CLI (Command Line Interface) continues to evolve, introducing sophisticated tools to enhance the efficiency and structure of Salesforce project management. Among the noteworthy updates are the `sf project convert source` and `sf project convert mdapi` commands, crucial for transitioning project formats and aiding developers in their deployment and development workflows. This article explores these commands in depth, examining their features, differences, and strategic importance in the Salesforce development landscape.

## Exploring `sf project convert source`

`sf project convert source` transforms source-formatted files into Metadata API format for consumers that explicitly require that representation. Ordinary Salesforce CLI deployments can deploy source format directly, so conversion is not a default deployment step.

### Features and Advantages:

- **Preparation for Deployment**: It readies source-formatted files for deployment, ensuring they are compatible with Metadata API–dependent Salesforce environments.
- **Efficient Workflow Management**: By allowing developers to work in the Source format and convert files as needed, it supports a seamless transition from development to deployment.

#### Practical Examples:

This command allows for flexible directory and package specification, illustrated by these examples:

- Converting a source directory to the metadata format: `$ sf project convert source --root-dir path/to/source`
- Defining an output directory and package name: `$ sf project convert source --root-dir path/to/source --output-dir path/to/output --package-name 'My Package'`

## Reevaluating `sf project convert mdapi`

The `sf project convert mdapi` command complements `sf project convert source` by converting Metadata API format files back to the Source format, supporting a reverse workflow.

### Features and Advantages:

- **Transition to Source Format**: It simplifies the move to Source format, beneficial for version control, collaboration, and CI/CD integration.
- **Legacy Integration**: It's crucial for developers migrating from Metadata API–based projects to the modular Source format.

Treat converted output as an ephemeral interoperability artifact. Keep one source of truth in Git and avoid editing both representations.

### Comparing Metadata API and Source Format Structures

Understanding the structural differences between Metadata API and Source formats is essential for leveraging the full potential of the conversion commands.

#### Metadata API Format Illustration:

The Metadata API format groups similar types of metadata, potentially complicating detailed version control. An example structure is as follows:

```plaintext
unpackaged/
├── classes
│   ├── MyApexClass.cls
│   └── MyApexClass.cls-meta.xml
├── objects
│   ├── MyCustomObject__c.object
│   └── AnotherObject__c.object
├── pages
│   └── MyVisualforcePage.page
└── package.xml
```

#### Source Format Illustration:

The Source format, on the other hand, offers a granular component breakdown, aiding in precise change management and conflict resolution:

```plaintext
force-app/
├── main/
│   └── default/
│       ├── classes/
│       │   ├── MyApexClass.cls
│       │   └── MyApexClass.cls-meta.xml
│       ├── objects/
│       │   ├── MyCustomObject__c/
│       │   │   ├── fields/
│       │   │   │   └── MyField__c.field-meta.xml
│       │   │   └── MyCustomObject__c.object-meta.xml
│       │   └── AnotherObject__c/
│       │       └── AnotherObject__c.object-meta.xml
│       └── pages/
│           └── MyVisualforcePage.page-meta.xml
└── sfdx-project.json
```

These distinctions highlight the strategic considerations in choosing the appropriate command based on the project's phase and requirements.

## Wrapping it up 👏

Use `sf project deploy preview` and `sf project deploy start --dry-run` before direct deployment. Convert only at a legacy-tool or package boundary, write to a clean build directory, and verify the resulting `package.xml`. Reviewed against the [Salesforce CLI reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference.html) on 2026-08-01.
