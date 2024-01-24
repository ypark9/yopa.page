---
title: What is the difference between String[] and List<String> in Apex?
date: 2023-04-10T01:25:00-04:00
author: Yoonsoo Park
description: "Let's find out the real difference between String[] and List<String> in Apex"
categories:
  - Apex
tags:
  - List vs Array 
---

In Apex, arrays are collections of elements of the same type that are stored sequentially in memory. Each element in the array is accessed by an index, which starts from zero. Although Apex does not have a true "array" data type, the List data type in Apex is similar in behavior and can be used in much the same way as an array.

Example
```java
public classA {
  public string[] method1() {
    return new string[]{'string_value'};
  }

  public List<String> method2() {
    return new string[]{'string_value'};
  }

  public string[] method2() {
    return new List<String>{'string_value'};
  }

    public List<String> method2() {
    return new List<String>{'string_value'};
  }
}
```

These all method actually behave the same.

You can even do this

```java
List<String> example = new String[5];

myStrings[0] = 'the first'; 
myStrings.add('the second');

myStrings.set(2,'the third');
myStrings.add('the forth');
```

## What is the difference then?
Array looking List cannot be used for nested arrays - **arrays of arrays are not permitted in Apex**.
But!
You can achieve this with `List<Type>`.

Example:
```java
List<List<Type>> nested = new List<List<Type>>();
```

Cheer! 🍺
