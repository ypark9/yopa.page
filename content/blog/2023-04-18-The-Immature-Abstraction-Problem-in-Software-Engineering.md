---
title: Recognizing a Premature Abstraction
date: 2023-04-18T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "How to recognize an abstraction created before the code provides enough evidence for it."
categories:
  - OOP
tags:
  - Software Design
  - Design Principles
  - Refactoring
---

An abstraction is premature when it is created before the code provides enough evidence for a stable shared concept. It often begins with two pieces of code that look similar but change for different reasons.

The problem is not abstraction itself. A good abstraction gives related behavior one name, establishes a useful boundary, and lets callers depend on a smaller contract. The problem appears when the contract is based on a guess. Each new use case then adds flags, optional parameters, or special branches until the shared code is harder to change than the original duplication.

## Signals to look for

- Callers pass booleans that switch the abstraction between unrelated modes.
- A generic name hides important domain differences.
- One consumer needs most of the interface while another implements empty or throwing methods.
- A small requirement change repeatedly modifies the shared abstraction and several unrelated callers.
- Tests mostly exercise branching inside the abstraction instead of stable behavior at its boundary.

## A practical response

It is reasonable to keep a little duplication while the requirements are still diverging. When a third case appears—or when two cases have changed together more than once—compare their responsibilities and invariants. Extract the smallest concept that has a clear name and a testable contract.

If an existing abstraction has accumulated exceptions, first add characterization tests. Separate the consumers that change for different reasons, simplify each path, and then look again for the smaller stable concept. The goal is not to eliminate every repeated line; it is to make future changes local and understandable.

Before extracting, ask:

- What specific change becomes easier after this extraction?
- Which behavior and invariants are genuinely shared?
- Can a caller understand the contract without knowing every implementation?
- What evidence would tell us that the abstraction should be split again?

The best time to abstract is not determined by a fixed duplication count. It is when the code has revealed a stable responsibility and the new boundary makes that responsibility easier to test and change.
