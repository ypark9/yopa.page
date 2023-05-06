---
title: What is a Record with Self-Referencing in Salesforce and Why Do We Need It?
date: 2023-05-04T01:25:00-04:00
author: Yoonsoo Park
description: "A Record with Self-Referencing in Salesforce"
categories:
  - Salesforce
tags:
  - Self-Referencing
---

A self-referencing field is a field on an object that refers to another record of the same object. In other words, a record can reference another record of the same type. This is useful in a number of scenarios, including hierarchical relationships, parent-child relationships, and lookup relationships.

## Why Do We Need Record with Self-Referencing in Salesforce?
- One of the primary use cases for self-referencing records in Salesforce is for managing hierarchical data. For example, an organization might use self-referencing records to manage a tree structure of departments or teams. Each department or team can have a parent department or team, and this relationship can be easily modeled using self-referencing fields.

- Another use case for self-referencing records is for managing parent-child relationships. For example, a company might use self-referencing records to manage a list of accounts, where each account can have a parent account. This relationship can be modeled using a self-referencing field on the Account object.

- Finally, self-referencing records can be useful for managing lookup relationships between records of the same object type. For example, a company might use self-referencing records to manage a list of products, where each product can be associated with another product as a substitute or alternative.

## Example of Record with Self-Referencing in Salesforce
Let's say that you are working for a company that sells software products. You have been tasked with setting up a new product catalog in Salesforce, and you want to be able to manage relationships between products. You decide to use self-referencing records to model these relationships.

You create a new custom object called "Product," and you add a new self-referencing field called "Related Product." This field allows you to associate a product with another product as a substitute or alternative.

You then create a new record for your flagship product, "Awesome Software 2.0." In the "Related Product" field, you associate it with your previous version, "Awesome Software 1.0." This allows your sales team to easily suggest the newer version as an alternative when selling to existing customers.

You also create a new record for a complementary product, "Awesome Add-On." In the "Related Product" field, you associate it with "Awesome Software 2.0." This allows your sales team to easily suggest the add-on when selling the main product.


## How to Create a Record with Self-Referencing in Salesforce

Creating a record with self-referencing fields in Salesforce is a straightforward process. Here's a step-by-step guide:

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

Now you can start creating records with self-referencing fields. When you create a new record, you'll see the self-referencing field on the page layout. You can use this field to associate the record with another record of the same object type.

Cheers! 🍺
