---
title: "Apex Nested Enums and Name Shadowing"
date: 2026-08-01
author: Yoonsoo Park
description: "Reference nested Apex enums without confusing type and variable names."
categories:
  - Salesforce
tags:
  - Apex
  - Apex Testing
  - Software Design
---

Verified on 2026-08-01. The retired article showed the same expression as both failing and fixed, so it could not support its diagnosis.

```apex
public class OrderRules {
    public enum Stage { Draft, Approved }
}
@IsTest private class OrderRulesTest {
    @IsTest static void resolvesNestedEnum() {
        OrderRules.Stage stage = OrderRules.Stage.Approved;
        System.assertEquals(OrderRules.Stage.Approved, stage);
    }
}
```

Use type-like names for classes and lower camel case for variables; avoid identifiers that differ only by case because Apex is case-insensitive. If an old test fails, reduce it to a compiling example, rename the local variable, deploy the class before the test, and verify namespace/package visibility. The tradeoff is only naming consistency; there is no runtime technique required.

Reference: [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_language_reference.htm).

## Current mental model

A nested enum is a type owned by its enclosing class, so the stable reference is `Outer.EnumName.Value`. Apex identifiers are case-insensitive. A local variable that differs from a class name only by capitalization is therefore poor evidence for a compiler diagnosis and difficult for readers to distinguish.

## Diagnose the actual failure

Compile the production class first, then a minimal test containing no unrelated setup. Check the exact compiler line, API version, access modifier, namespace, and package dependency. A test in another namespace may have a visibility problem; a test compiled before its dependency may have a deployment-order problem. Renaming a local variable is good hygiene, but it should not be presented as a universal fix without a reproducer.

```apex
public class OrderRules {
 public enum Stage { Draft, Approved }
 public static Boolean canShip(Stage value) { return value == Stage.Approved; }
}
@IsTest private class OrderRulesTest {
 @IsTest static void approvedCanShip() {
  OrderRules.Stage currentStage = OrderRules.Stage.Approved;
  System.assert(OrderRules.canShip(currentStage));
 }
}
```

## Alternatives and tradeoffs

Nested enums keep a small domain vocabulary close to its owner. A top-level enum is easier to share across unrelated classes but enlarges the public surface. Constants may integrate with strings but lose exhaustive type checking and permit invalid values.

## Migration and verification

Rename ambiguous variables, qualify nested types, remove stringly typed comparisons, and add one test per meaningful enum branch. Deploy the class and test together to a disposable org and run `sf apex run test --tests OrderRulesTest --target-org scratch --wait 10`. Confirm that package consumers can access only the visibility you intend.
