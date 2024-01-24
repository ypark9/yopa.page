---
title: Strategy Pattern in Dependency Injection
date: 2023-05-19T01:25:00-04:00
author: Yoonsoo Park
description: "Strategy Pattern in Dependency Injection"
categories:
  - Design Pattern
tags:
  - Strategy Pattern
  - Dependency Injection
---

## Understanding the Concepts
### Strategy Pattern
The Strategy Pattern is a behavioral design pattern that encapsulates algorithms into separate classes with a common interface, enabling interchangeability within the original context object. This approach enhances flexibility by allowing the switching of algorithms or logic at runtime.

### Dependency Injection
Dependency Injection is a technique that promotes Inversion of Control (IoC) - an object obtains its dependencies from an external source rather than creating them itself. DI is instrumental in developing code that is more manageable, modular, and testable.

## Bridging Strategy Pattern with Dependency Injection
When combined, these two concepts can provide exceptional benefits. `Dependency Injection` can be used to inject different Strategy objects into a class, thus promoting flexible behavior that varies with the injected strategy.

## A Practical Example
Let's consider a simple example: a `TextFormatter` class that formats a given text in different ways, such as lower case, upper case, or capitalized. We'll use a Python-esque pseudo-code for our demonstration.

Firstly, we define the strategy interface and the concrete strategies.

```python
class TextFormatStrategy:
    def format_text(self, text):
        pass

class LowerCaseStrategy(TextFormatStrategy):
    def format_text(self, text):
        return text.lower()

class UpperCaseStrategy(TextFormatStrategy):
    def format_text(self, text):
        return text.upper()

class CapitalizeStrategy(TextFormatStrategy):
    def format_text(self, text):
        return text.capitalize()
```
Next, we define the `TextFormatter` class which will use `Dependency Injection` to accept a `TextFormatStrategy` object.

```python
class TextFormatter:
    def __init__(self, strategy: TextFormatStrategy):
        self._strategy = strategy

    def format(self, text):
        return self._strategy.format_text(text)
```
Now we can change the behavior of the `TextFormatter` class at runtime by injecting different strategies.

```python
formatter = TextFormatter(LowerCaseStrategy())
print(formatter.format("Hello World"))  # Output: "hello world"

formatter = TextFormatter(UpperCaseStrategy())
print(formatter.format("Hello World"))  # Output: "HELLO WORLD"

formatter = TextFormatter(CapitalizeStrategy())
print(formatter.format("hello world"))  # Output: "Hello world"
```

This example demonstrates how **Dependency Injection** can inject different **strategies** into a class, resulting in dynamic behavior changes based on the provided strategy.


Cheers! 🍺
