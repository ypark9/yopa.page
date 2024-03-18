---
title: Mastering SF CLI - In-Depth Guide to sf project convert source and mdapi Commands
date: 2024-03-17
author: Yoonsoo Park
description: "Delve into the nuances of Salesforce CLI's latest commands, 'sf project convert source' and 'sf project convert mdapi', uncovering their roles, distinctions, and impact on contemporary Salesforce development practices."
categories:
  - Salesforce
  - CLI
  - Development
tags:
  - Salesforce CLI
  - Metadata API
  - Source Format
---

![Salesforce CLI Conversion](images/oni-salesforce-2.webp)

Salesforce CLI (Command Line Interface) continues to evolve, introducing sophisticated tools to enhance the efficiency and structure of Salesforce project management. Among the noteworthy updates are the `sf project convert source` and `sf project convert mdapi` commands, crucial for transitioning project formats and aiding developers in their deployment and development workflows. This article explores these commands in depth, examining their features, differences, and strategic importance in the Salesforce development landscape.

## Exploring `sf project convert source`

The `sf project convert source` command, a recent addition to Salesforce CLI, plays a pivotal role in transforming source-formatted files into Metadata API format, a necessity for certain deployment contexts.

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

These tools underscore Salesforce's commitment to equipping developers with sophisticated resources for modern development methodologies.

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

The introduction of `sf project convert source` alongside `sf project convert mdapi` signifies Salesforce's ongoing commitment to refining the developer experience. These commands are not merely about format conversion; they represent a strategic approach to structured, efficient, and collaborative Salesforce development. Understanding and utilizing these commands allows developers to adeptly navigate the Salesforce development environment, ensuring project adaptability and future-readiness.
