---
title: Virtual Class and Abstract Class in Apex
date: 2023-05-12T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Virtual Class and Abstract Class in Apex"
categories:
  - Salesforce
tags:
  - Apex
  - Software Design
  - Apex Testing
---

`virtual` and `abstract` both allow inheritance in Apex, but they express different contracts. Use them deliberately; an interface or composition is often simpler when callers only need behavior rather than shared state.

## Virtual Classes
A virtual class in Apex is a class that allows its methods to be overridden by subclasses. It provides a way to define a base implementation while also enabling customization and extension by derived classes. In other words, virtual classes serve as a starting point for creating specialized implementations.

To declare a `virtual` class in Apex, you use the `virtual` keyword before the class keyword, like this:

```java
virtual class MyBaseClass {
    // Class implementation goes here
}
```
**Methods within a virtual class can be marked as virtual as well.** This indicates that the method can be overridden by subclasses to provide their own implementation. For example:

```java
virtual class MyBaseClass {
    virtual void myMethod() {
        // Base implementation
    }
}
```
Subclasses of a virtual class can override its methods using the `override` keyword. This allows them to provide their own custom implementation. For instance:

```java
virtual class MyBaseClass {
    virtual void myMethod() {
        // Base implementation
    }
}

class MyDerivedClass extends MyBaseClass {
    override void myMethod() {
        // Custom implementation
    }
}
```

By using virtual classes, developers can create a hierarchy of classes where each class adds or modifies the behavior of the base class, enabling flexibility and customization.

## Abstract Classes
An `abstract` class in Apex, on the other hand, is a class that cannot be instantiated directly. It serves as a blueprint or contract for derived classes, defining common methods and properties that subclasses must implement. Abstract classes allow developers to establish a common interface while leaving the specifics of implementation to the derived classes.

To declare an abstract class in Apex, you use the `abstract` keyword before the class keyword, like this:

```java
abstract class MyAbstractClass {
    // Class implementation goes here
}
```

Abstract classes can contain `abstract` methods, **which are declared without an implementation.** These methods act as placeholders that must be implemented by any non-abstract subclass. For example:

```java
abstract class MyAbstractClass {
    abstract void myMethod();
}
```

Any class that extends an `abstract` class must provide an implementation for all `abstract` methods defined in the `abstract` class. Failure to do so will result in a compilation error.

```java
abstract class MyAbstractClass {
    abstract void myMethod();
}

class MyConcreteClass extends MyAbstractClass {
    void myMethod() {
        // Implementation of abstract method
    }
}
```

Abstract classes are useful when you want to define a common set of methods and properties for a group of related classes, ensuring consistent behavior across different implementations.

## Choosing between them
- Use a virtual class when a useful default implementation exists and subclasses may override selected virtual methods.
- Use an abstract class when the base must not be instantiated and subclasses must supply one or more abstract operations.
- Use an interface when unrelated implementations need the same contract without shared implementation.
- Prefer composition when inheritance would expose internals or create a fragile hierarchy.

Keep visibility explicit (`public` or `global` only when required), add `override` to implementations, and write tests against both the base behavior and each specialization. `global` expands the package-level compatibility commitment, so don't use it as a default. Reviewed on 2026-08-01 against the [Apex class definition reference](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_defining.htm).
