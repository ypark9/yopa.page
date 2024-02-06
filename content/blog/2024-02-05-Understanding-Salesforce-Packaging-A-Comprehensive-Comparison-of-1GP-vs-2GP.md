---
title: Understanding Salesforce Packaging - A Comprehensive Comparison of 1GP vs 2GP
date: 2024-02-05
author: Yoonsoo Park
description: "Dive deep into the core distinctions between Salesforce's 1st Generation Packaging (1GP) and 2nd Generation Packaging (2GP), offering a clear guide for developers and businesses navigating these essential Salesforce development tools."
categories:
  - Salesforce
tags:
  - 2GP
  - Salesforce DX
  - 1GP vs 2GP
---

![Salesforce 2GP](images/oni-salesforce.webp)

Salesforce's evolution has always been characterized by its adaptability and forward-thinking approach. This is particularly evident in the realm of application development, where Salesforce 2nd Generation Packaging (2GP) marks a significant leap forward. 2GP, part of the Salesforce DX ecosystem, has transformed how Salesforce applications are developed, deployed, and managed. This article delves into the nuances of 2GP, highlighting its benefits and practical implications through real-world examples.

## 1GP vs 2GP

The two generations of Salesforce packaging, 1st Generation Packaging (1GP) and 2nd Generation Packaging (2GP), represent different approaches and capabilities in the Salesforce ecosystem. Understanding their key differences is crucial for developers and organizations to choose the right packaging strategy.

<details>
<summary>Detail</summary>

### 1st Generation Packaging (1GP)

1. **Packaging Model**: 1GP is based on the original Salesforce packaging model, primarily used for creating managed and unmanaged packages.
2. **Development Org-Based**: The package development and versioning are tied to a specific Salesforce org (the packaging org).
3. **Release Process**: Updates to a managed package require uploading a new version from the packaging org. Unmanaged packages can't be updated; a new package must be created for each release.
4. **Namespace**: In managed packages, a namespace is permanently tied to the packaging org and is used across all packages created in that org.
5. **Upgrade and Dependency Management**: Managing upgrades and dependencies can be more challenging, especially for complex applications.
6. **Metadata Deployment**: Uses traditional metadata API deployment methods.
7. **Salesforce DX Compatibility**: Limited compatibility with Salesforce DX. It does not support source-driven development and scratch orgs as efficiently as 2GP.

### 2nd Generation Packaging (2GP)

1. **Packaging Model**: 2GP is part of the Salesforce DX ecosystem, designed for a more modular and flexible development experience.
2. **Dev Hub-Based**: Package development and lifecycle are managed through the Dev Hub, not tied to a specific development org.
3. **Source-Driven Development**: Emphasizes source-driven development, where the source of truth is in a version control system, not an org.
4. **Namespace Flexibility**: Offers flexibility in namespace usage. You can create packages without a namespace and opt for promoting them to managed packages later.
5. **Modular Development**: Supports more modular development with unlocked packages, allowing different parts of an application to be developed and deployed independently.
6. **Improved Dependency Management**: Better handling of dependencies and package upgrades, simplifying the management of complex applications.
7. **Continuous Integration and Delivery**: Better suited for CI/CD practices, integrating seamlessly with modern development pipelines.
8. **Scratch Orgs and Isolation**: Allows for development and testing in isolated, ephemeral scratch orgs, promoting cleaner development practices.

</details>

## Source-Driven Development

"Source-Driven Development" refers to a software development approach where the primary focus is on managing and manipulating the source code directly, rather than the final output or the environment where the code runs. In the context of Salesforce, particularly with 2nd Generation Packaging (2GP), this concept plays a pivotal role.

<details>
<summary>Detail</summary>

### Traditional Approach vs. Source-Driven Development

In traditional Salesforce development (more aligned with 1st Generation Packaging, or 1GP), the development often takes place directly in the Salesforce org. Developers make changes to the metadata and configurations within the org, and these changes are then retrieved and stored in version control. The Salesforce org, in this case, is often seen as the 'source of truth'.

In contrast, source-driven development, as emphasized in 2GP, flips this approach:

1. **Version Control as the Source of Truth**: The primary 'source of truth' is the version control system (like Git). All changes and the current state of the application are stored and managed in version control.
2. **Development in Isolation**: Developers work in their local development environment or in isolated, ephemeral environments like scratch orgs. They make changes to the code and metadata locally.
3. **Version Control Operations**: Standard version control operations such as branching, merging, and pull requests are used to manage changes.
4. **Continuous Integration/Continuous Deployment (CI/CD)**: Automated processes for testing and deploying the code changes are integrated, ensuring that changes are tested and deployed systematically and consistently.

### Example Scenario

Imagine a team developing a Salesforce application:

1. **Initial Setup**: The team sets up a Git repository for their project. This repository will contain all their Salesforce code and configuration metadata.
2. **Feature Development**: A developer starts working on a new feature. They create a new branch in the Git repository for this feature.
3. **Local Development**: The developer pulls the branch onto their local machine. They use a Salesforce DX command to create a new scratch org for development.
4. **Making Changes**: The developer makes necessary code and metadata changes in the scratch org. These changes are then pulled from the scratch org and committed to their feature branch in Git.
5. **Code Review and Merging**: Once the feature is completed, the developer creates a pull request to merge their changes into the main branch. The team reviews the code changes in the pull request.
6. **CI/CD Pipeline**: After the pull request is approved and merged, a CI/CD pipeline automatically deploys the changes from the main branch to a testing org, runs tests, and if everything is successful, deploys it to the production org.

In this example, the Git repository serves as the central hub for all development work, ensuring that every change is tracked, reviewed, and systematically deployed, contrasting with traditional methods where the Salesforce org itself would be the main workspace for development.

</details>

## Namespace Flexibility

In Salesforce, the concept of "offering flexibility in namespace usage" in the context of 2nd Generation Packaging (2GP) refers to the ability to develop and initially distribute packages without committing to a specific namespace, and then later decide to add a namespace when promoting them to managed packages. This is a significant shift from the 1st Generation Packaging (1GP) approach.

<details>
<summary>Detail</summary>

### Understanding Namespaces in Salesforce

A namespace in Salesforce serves as a unique identifier for packages, ensuring that components from different packages do not conflict with each other. In 1GP, once you assign a namespace to a package, it is permanent and cannot be changed or removed. This binding occurs very early in the development process.

### Flexibility in 2GP

In 2GP, Salesforce provides more flexibility:

1. **Develop Without a Namespace**: You can start developing your package without assigning a namespace. This is particularly useful in the early stages of development when you are still experimenting or uncertain about the final structure of your package.
2. **Promote to Managed Package Later**: Once your package is ready for distribution and you've finalized its components, you can then choose to assign a namespace and promote it to a managed package. This step is more definitive and suitable for packages intended for wider distribution, especially in the Salesforce AppExchange.

### Example Scenario

Let's consider an example to illustrate this flexibility:

1. **Initial Development**:
   - A Salesforce developer starts creating a new application package.
   - They focus on building features and components without worrying about namespaces.
   - The package is in an unmanaged state and used for internal testing and iteration.
2. **Iteration and Testing**:
   - The developer and the team test and refine the package, still without a namespace.
   - They share this version within their organization for feedback and further development.
3. **Finalizing the Package**:
   - Once the package is mature and ready for broader distribution, the developer decides to promote it to a managed package.
   - At this point, they assign a namespace to the package. This namespace uniquely identifies the package, especially if it is to be listed on Salesforce AppExchange.
4. **Release and Distribution**:
   - With the namespace assigned, the package is now a managed package.
   - It can be distributed externally, with the namespace ensuring no conflicts with other Salesforce packages or components.

This flexibility allows developers to work more iteratively and make decisions about namespaces at a more appropriate time in the development lifecycle, instead of being forced to commit to a namespace at the very beginning.

</details>

## Modular Development

The concept of "Modular Development" in Salesforce, especially with 2nd Generation Packaging (2GP), refers to the ability to break down a Salesforce application into smaller, independent packages, known as unlocked packages. These packages can be developed, updated, and deployed independently of each other. This approach contrasts with the more monolithic structure often seen in 1st Generation Packaging (1GP).

<details>
<summary>Detail</summary>

### Understanding Modular Development

1. **Small, Independent Units**: Instead of a single large package containing all components of an application, modular development focuses on creating smaller packages, each responsible for a specific feature or functionality.
2. **Reduced Dependencies**: These modules or packages have fewer dependencies on each other, making them easier to manage and update.
3. **Flexibility in Deployment**: Each module can be deployed independently, allowing for more frequent and targeted updates without affecting the entire application.

### Example Scenario

Let's consider an example to illustrate modular development in a Salesforce context:

#### Scenario: A CRM Application for a Sales Organization

1. **Breaking Down the Application**:
   - The CRM application has several distinct features: Lead Management, Opportunity Tracking, Customer Support, and Reporting.
   - Instead of creating one large package containing all these features, the development team decides to break down the application into four separate unlocked packages, one for each feature.
2. **Independent Development**:
   - Different teams or developers work on each package independently.
   - The Lead Management team can make changes and updates to their package without impacting the Opportunity Tracking module, and so on.
3. **Iterative Releases**:
   - As the Customer Support module is ready for an update, it can be released and deployed to the Salesforce org without waiting for changes in other modules.
   - This allows for faster release cycles and more immediate delivery of specific features or fixes.
4. **Maintaining Consistency**:
   - Even though the modules are developed independently, overall consistency in design and functionality is maintained.
   - Common components or services can be shared across modules, but the core development and deployment are done independently.
5. **Scalability and Maintenance**:
   - As the organization grows and needs evolve, new modules (like a new Advanced Analytics module) can be added without disrupting existing ones.
   - Maintenance and updates become more manageable, as they can be targeted to specific modules.

In this example, modular development allows the Salesforce application to be more flexible, scalable, and manageable, with the ability to adapt and evolve as needs change. Each module or package, being self-contained, reduces complexity and enhances the agility of the development process.

</details>

## Improved Dependency Management

"Improved Dependency Management" in the context of 2nd Generation Packaging (2GP) in Salesforce refers to the enhanced ability to manage the relationships and dependencies between different packages and their components. This feature is particularly important when dealing with complex applications that consist of multiple interrelated packages.

<details>
<summary>Detail</summary>

### Traditional Dependency Management Challenges

In 1st Generation Packaging (1GP), managing dependencies can be challenging:

1. **Rigid Structure**: Dependencies are often hard-coded and inflexible, making it difficult to update or change dependent packages without affecting others.
2. **Versioning Constraints**: Updating a package could require updating all dependent packages, even for minor changes.
3. **Complex Upgrades**: Upgrading interdependent packages could lead to compatibility issues, requiring extensive testing and coordination.

### Improved Dependency Management in 2GP

2GP addresses these challenges:

1. **Flexible Dependencies**: Dependencies in 2GP can be defined more flexibly. You can specify version ranges for dependencies, allowing dependent packages to work with multiple versions of other packages.
2. **Independent Upgrades**: Packages can be upgraded independently, reducing the cascading effect of changes across multiple packages.
3. **Clear Dependency Hierarchy**: 2GP allows for a clearer and more manageable dependency hierarchy, making it easier to understand how different packages are related.

### Example Scenario

Let's consider a Salesforce application comprising multiple packages:

#### Scenario: An E-commerce Salesforce Application

1. **Application Structure**:
   - The application consists of several packages: `UserManagement`, `OrderProcessing`, `InventoryManagement`, and `PaymentGateway`.
2. **Dependency Relationships**:
   - `OrderProcessing` depends on `UserManagement` for customer data.
   - `InventoryManagement` is required by `OrderProcessing` to check stock levels.
   - `PaymentGateway` is independent but is used by `OrderProcessing`.
3. **Upgrading a Package**:
   - The team decides to upgrade `UserManagement` to add new features.
   - In 1GP, this might have required simultaneous updates to `OrderProcessing` (and potentially `InventoryManagement`), leading to a complex, coordinated release.
4. **2GP Approach**:
   - With 2GP, `UserManagement` can be upgraded independently.
   - `OrderProcessing` is set to work with a range of versions of `UserManagement`, so it continues to function without immediate updates.
   - The team can plan and execute updates to `OrderProcessing` and `InventoryManagement` separately, at a more convenient time, reducing the complexity of the deployment.
5. **Result**:
   - The upgrade of `UserManagement` is simpler and less risky.
   - Other packages continue to operate normally, and their upgrades can be managed independently, aligning with the team's schedule and resources.

In this example, improved dependency management in 2GP allows for more flexible and less disruptive upgrades and changes within a complex Salesforce application ecosystem. This approach simplifies managing complex applications, especially those with multiple interdependent packages.

</details>

## Scratch Orgs and Isolation

The concept of "Scratch Orgs and Isolation" in Salesforce, particularly in the context of Salesforce DX and 2nd Generation Packaging (2GP), refers to the use of scratch orgs as temporary, disposable Salesforce environments for development and testing. This approach promotes cleaner and more isolated development practices.

<details>
<summary>Detail</summary>

### Understanding Scratch Orgs

A scratch org is a short-lived Salesforce environment that can be quickly set up, used for development or testing, and then discarded. These orgs are fully configurable, allowing developers to emulate different Salesforce editions and features.

### Isolation in Development

The key aspect here is isolation. Each developer can work in their own scratch org without impacting others or the main Salesforce environment. This isolation reduces the risk of conflicts and ensures that changes are tested in a controlled environment before being merged into the main codebase.

### Example Scenario

#### Scenario: Developing a New Feature for a Salesforce Application

1. **Initial Setup**:
   - A development team is working on a Salesforce application.
   - They decide to add a new feature, let's say, an enhanced reporting tool.
2. **Creating Scratch Orgs**:
   - Each developer on the team creates their own scratch org using Salesforce DX.
   - These scratch orgs are configured to mimic the production environment but are completely isolated.
3. **Development Work**:
   - Developers work independently in their scratch orgs, developing different parts of the new feature.
   - They can experiment and test their changes without affecting the main application or each other's work.
4. **Local Testing**:
   - Once a developer completes a part of the feature, they test it thoroughly in their scratch org.
   - Because the scratch org is a controlled environment, they can easily reset or recreate it if needed.
5. **Code Integration**:
   - After testing, the developer commits their changes to a shared version control system like Git.
   - The team reviews the changes through pull requests or code reviews.
6. **Merging and Final Testing**:
   - Once approved, the changes are merged into the main branch.
   - The integrated feature is then deployed to a staging or testing environment for final testing.
7. **Scratch Org Disposal**:
   - After the development work is completed, the scratch orgs can be disposed of.
   - This disposal ensures that no unnecessary environments are left consuming resources.

In this example, scratch orgs provide a clean, isolated environment for each developer, fostering a development process where changes are tested and validated independently before being integrated. This approach leads to higher code quality and a more efficient development lifecycle.

</details>

## Wrapping it up 👏

Salesforce 2GP represents a significant advancement in Salesforce application development. It brings a level of flexibility, modularity, and efficiency previously unattainable in the Salesforce ecosystem. By enabling modular development, offering flexible namespace usage, improving dependency management, and leveraging scratch orgs for isolated development, 2GP empowers developers to build more robust, scalable, and maintainable Salesforce applications. As Salesforce continues to evolve, 2GP stands as a testament to its commitment to innovation and developer empowerment.

Cheers! 🍺
