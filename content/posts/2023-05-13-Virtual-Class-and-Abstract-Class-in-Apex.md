---
title: Virtual Class and Abstract Class in Apex
date: 2023-05-12T01:25:00-04:00
author: Yoonsoo Park
description: "Virtual Class and Abstract Class in Apex"
categories:
  - Salesforce
tags:
  - Apex
---

In the world of Apex programming, two important concepts that developers often encounter are `Virtual` Classes and `Abstract` Classes. Both of these class types provide powerful tools for building modular and extensible code, but they serve different purposes and have distinct characteristics. Let's get it~.

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

## Wrap this up!
- Virtual classes allow for method overriding, enabling customization and extension of base implementations. 
- Abstract classes establish a contract for derived classes, ensuring the implementation of required methods.

Cheers! 🍺
