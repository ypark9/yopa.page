---
title: "Apex List Syntax and Nested Collections"
date: 2023-04-10T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-04-10-what-is-the-difference-between-string-and-liststring-in-apex.html"
author: Yoonsoo Park
description: "A tested guide to Apex List syntax, initialization, and nested collections."
categories:
  - Salesforce
tags:
  - Apex
  - Collections
  - Apex Testing
---

Verified against Salesforce documentation on 2026-08-01.

Apex accepts both `String[]` and `List<String>` as syntax for a list. They are not two storage models, so choose `List<String>` when readability matters.

```apex
List<String> names = new List<String>{'Ada', 'Grace'};
String[] aliases = new String[]{'a', 'g'};
List<List<String>> groups = new List<List<String>>{names, aliases};
```

The older article was retired because its sample did not compile and described arrays as a separate, sequential-memory type. When migrating, replace ambiguous declarations with `List<T>`, give methods unique names, and run the Apex tests that exercise indexing and empty inputs. Array-style syntax remains useful when matching an existing codebase; `List<T>` makes nested generics clearer.

Reference: [Apex Developer Guide: Lists](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_collections_lists.htm).

## Why the old explanation failed

Apex deliberately treats array notation as an alternative spelling for `List<T>`. Reasoning from Java's array memory model leads to false conclusions, while duplicate method signatures and undefined variables hide the real lesson behind compiler errors.

## A practical mental model

A list is an ordered, zero-indexed collection that can grow with `add`, replace an element with `set`, and be iterated. Generic notation is clearer when types are nested. A set is better for uniqueness, and a map is better for keyed lookup; don't choose a list merely because it is familiar.

## Safe example

```apex
public class NameGroups {
    public static List<List<String>> group(List<String> input, Integer size) {
        if (input == null || size == null || size <= 0) {
            throw new IllegalArgumentException('A positive group size is required');
        }
        List<List<String>> result = new List<List<String>>();
        for (Integer i = 0; i < input.size(); i += size) {
            List<String> chunk = new List<String>();
            for (Integer j = i; j < Math.min(i + size, input.size()); j++) chunk.add(input[j]);
            result.add(chunk);
        }
        return result;
    }
}
```

Test empty, null, exact-size, and remainder inputs. Remember that assigning one list variable to another shares the same mutable list; construct a new list when a shallow copy is intended.

## Migration and verification checklist

1. Replace claims about two different collection types with one List model.
2. Normalize public APIs to `List<T>` while allowing array notation in compatible callers.
3. Give every method a unique signature and compile examples in a scratch org.
4. Use `List<List<T>>` for nesting and add tests for mutation and bounds.
5. Run Apex tests and static analysis before deployment.

Array notation can minimize churn in legacy code, but consistency and readable nested types usually outweigh that small benefit.
