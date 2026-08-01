---
title: What is a Record with Self-Referencing in Salesforce and Why Do We Need It?
date: 2023-05-04T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "A Record with Self-Referencing in Salesforce"
categories:
  - Salesforce
tags:
  - Salesforce
  - Data Modeling
  - Record Types
---

A self-referencing relationship points from a record to another record of the same object. It is useful when the relationship is genuinely part of the domain, such as a parent account, previous product version, or reporting hierarchy.

## When a self-reference fits
- One of the primary use cases for self-referencing records in Salesforce is for managing hierarchical data. For example, an organization might use self-referencing records to manage a tree structure of departments or teams. Each department or team can have a parent department or team, and this relationship can be easily modeled using self-referencing fields.

- Another use case for self-referencing records is for managing parent-child relationships. For example, a company might use self-referencing records to manage a list of accounts, where each account can have a parent account. This relationship can be modeled using a self-referencing field on the Account object.

- A same-object lookup can model a predecessor or preferred alternative. If records need many-to-many relationships, attributes on the relationship, or multiple alternatives, use a junction object instead of adding more lookup fields.

## Example of Record with Self-Referencing in Salesforce
Let's say that you are working for a company that sells software products. You have been tasked with setting up a new product catalog in Salesforce, and you want to be able to manage relationships between products. You decide to use self-referencing records to model these relationships.

You create a new custom object called "Product," and you add a new self-referencing field called "Related Product." This field allows you to associate a product with another product as a substitute or alternative.

You then create a new record for your flagship product, "Awesome Software 2.0." In the "Related Product" field, you associate it with your previous version, "Awesome Software 1.0." This allows your sales team to easily suggest the newer version as an alternative when selling to existing customers.

You also create a new record for a complementary product, "Awesome Add-On." In the "Related Product" field, you associate it with "Awesome Software 2.0." This allows your sales team to easily suggest the add-on when selling the main product.


## How to Create a Record with Self-Referencing in Salesforce

Create the relationship only after deciding its cardinality, delete behavior, access model, and reporting needs:

1. Navigate to Setup by clicking on the gear icon in the top right corner of the screen.

2. In the left-hand menu, select "Object Manager."

3. Select the object for which you want to create a self-referencing field.

4. Click on the "Fields & Relationships" tab.

5. Click the "New" button to create a new field.

6. Select the "Lookup Relationship" field type.

7. Choose the same object as the related object.

8. Give your field a name, such as "Related Product" in our example above.

9. Click "Next."

10. Choose the page layouts where you want the field to appear.

11. Click "Save."

Test more than the happy path. Decide whether cycles such as A → B → A are valid, prevent them with Flow or Apex when they are not, and verify sharing access to both records. Lookup relationships do not automatically provide every roll-up behavior a master-detail relationship does. Also check reporting depth and deletion behavior before importing a hierarchy.

Reviewed on 2026-08-01 against Salesforce's [Object Relationships overview](https://help.salesforce.com/s/articleView?id=platform.overview_of_custom_object_relationships.htm&type=5).
