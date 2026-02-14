---
title: "Why Do Python Experts Use the @property Decorator?"
date: 2026-02-09
author: Yoonsoo Park
description: "A deep dive into the @property decorator in Python, exploring its benefits for dynamic attributes and read-only protection."
categories:
  - Python
  - Software Engineering
tags:
  - Python
  - Decorators
  - Clean Code
---

If you are learning Python, you might have come across the `@property` decorator. While many decorators can seem complex to beginners, `@property` is often confusing for the opposite reason: its behavior is so simple—it allows you to declare a function but access it like a variable—that many wonder why it is necessary at all.

I recently watched a video by [임커밋](https://www.youtube.com/@LimCommit) that highlighted the importance of `@property` not just as syntax sugar, but as a tool for better architectural control. Inspired by that, I wanted to share my own take on why experienced developers lean on this feature.

Here are the two main reasons to use `@property`.

## 1. Dynamic Attributes (Computed Properties)

The most common use case arises when the external "look" of a value should be a simple attribute, but the internal logic requires calculation.

Consider an e-commerce `ShoppingCart` class. A cart contains a list of items, each with a price. Naturally, you want to know the total price.

### The Problem

If you define `total` as a standard instance variable, you must remember to update it every time an item is added or removed.

```python
class ShoppingCart:
    def __init__(self):
        self.items = []
        self.total = 0  # Needs manual updates!

    def add_item(self, price):
        self.items.append(price)
        self.total += price  # Easy to forget or get wrong in complex logic
```

If a developer modifies `items` directly or forgets to update `total`, the data becomes inconsistent! 

### The Function Solution

You could write a method like `get_total()`, but accessing it requires parentheses (e.g., `cart.get_total()`). This works, but it exposes the implementation detail that `total` is calculated, rather than just being a property of the cart. and we all know less code is better. no code no bug. lol

### The @property Solution

By using `@property`, you can define `total` as a method internally so it calculates the value fresh every time it is called, but you access it externally like a static attribute (e.g., `cart.total`).

```python
class ShoppingCart:
    def __init__(self):
        self.items = []

    def add_item(self, price):
        self.items.append(price)

    @property
    def total(self):
        return sum(self.items)

cart = ShoppingCart()
cart.add_item(100)
cart.add_item(50)

print(cart.total)  # 150 (Computed on the fly!)
```
This ensures your data is always consistent—the total can never be out of sync with the items list—without sacrificing attribute-like syntax.

## 2. Read-Only Protection

The second major reason to use `@property` is to create "read-only" attributes.

Sometimes you have data that should be visible to the outside world but never modified directly. For example, a `User` class might have a unique `id` assigned at creation.

If `id` were a normal attribute, nothing stops a developer from accidentally overwriting it:

```python
user = User(id=123)
user.id = 456  # Oops! Data integrity broken.
```

However, when you define a value using `@property` without a corresponding setter method, it becomes read-only by default.

```python
class User:
    def __init__(self, user_id, username):
        self._user_id = user_id
        self.username = username

    @property
    def user_id(self):
        return self._user_id

user = User(101, "python_guru")
print(user.user_id)  # 101

# Attempting to modify it raises an error
try:
    user.user_id = 999
except AttributeError as e:
    print(e)  # can't set attribute
```

This behavior allows developers to protect sensitive or critical data (like IDs, timestamps, or derived values) from being accidentally overwritten by external code. It effectively isolates the internal logic from external interference.

## Conclusion

While it might seem like a small syntactic sugar, the `@property` decorator is a something you need to consider for encapsulation. It allows you to maintain the clean interface of simple attributes while keeping the safety of dynamic functions in the background.
