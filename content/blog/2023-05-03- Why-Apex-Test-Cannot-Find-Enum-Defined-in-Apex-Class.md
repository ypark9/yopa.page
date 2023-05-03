---
title: Why Apex Test Cannot Find Enum Defined in Apex Class
date: 2023-05-03T01:25:00-04:00
author: Yoonsoo Park
description: "The reason why Apex Test Cannot Find Enum Defined in Apex Class"
categories:
  - Programming
  - Salesforce
tags:
  - Test
  - enum
---

 there is a common issue that developers face when working with enums in Apex. Sometimes, when you try to reference an enum defined in an Apex class from your test class, you may get an error that the enum is not found. This can be a frustrating issue to deal with, especially if you are new to Apex development.

The reason for this issue is that when you create an instance of the Apex class with exactly the same name as the class name, but with a different case, Apex does not recognize it as a class. Instead, it sees it as an instance of the class. This means that when you try to reference the enum from your test class, Apex cannot find it because it is not defined on the instance.

To avoid this issue, it is important to always create your instance name differently than the class name. This will ensure that Apex recognizes it as a separate instance and not as the class itself. For example, if your class is named "MyClass", you could create an instance named "myInstance" or "myClassInstance".

Let's take a look at an example to illustrate this issue:
```java
public class MyClass {
    public enum MyEnum {
        VALUE_1, VALUE_2, VALUE_3
    }
}

public class MyTestClass {
    public static void testEnum() {
        MyClass myClass = new MyClass();
        // This line will throw an error because Apex cannot find the enum
        MyClass.MyEnum value = MyClass.MyEnum.VALUE_1;
    }
}
```

In the above example, the `testEnum()` method in the `MyTestClass` class tries to reference the `MyEnum` enum defined in the `MyClass` class. However, because the instance of `MyClass` is named `myClass` (with a lowercase "m"), Apex does not recognize it as the class itself. Therefore, when we try to reference `MyClass.MyEnum`, Apex cannot find it and throws an error.

To fix this issue, we can simply rename the instance of `MyClass` to something different than the class name:

```java
public class MyTestClass {
    public static void testEnum() {
        MyClass myClassInstance = new MyClass();
        // This line will work correctly
        MyClass.MyEnum value = MyClass.MyEnum.VALUE_1;
    }
}
```

By creating an instance named `myClassInstance` instead of `myClass`, Apex now recognizes it as a separate instance and not as the class itself. Therefore, when we reference `MyClass.MyEnum`, Apex can find it and our code will work correctly.

Cheers! 🍺
