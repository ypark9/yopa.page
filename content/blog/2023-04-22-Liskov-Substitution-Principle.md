---
title: The Liskov Substitution Principle (LSP) in OOP
date: 2023-04-22T01:25:00-04:00
author: Yoonsoo Park
description: "If you're not sure what Liskov Substitution Principle (LSP) means, your object-oriented programming skills are in for a world of hurt!"
categories:
- Programming
- OOP
tags:
- OOP
---

Well hello there, my dear friend! It's time we talk about the **Liskov Substitution Principle** (LSP). Now, you better grab your favorite beverage(should be **beer**) and sit tight because this principle is no _*joke*_!

If you have a base class **A** and a subclass *B* that inherits from **A**, then you should be able to substitute *B* for **A** without any problems. In other words, *B* should behave just like **A**, but with extra _coolness_.

Now, let's see an interesting example of LSP, shall we? Imagine you have a ***Bird*** base class and two subclasses: **Penguin** and **Eagle**. The **Penguin** class cannot fly, whereas the **Eagle** class can. However, both classes can make sounds by overriding the `makeSound()` method of the **Bird** base class.

Now, imagine you have a function called `letTheBirdsSing(Bird: Bird)`, which calls the makeSound() method on the **Bird** object passed to it. According to LSP, you should be able to pass in either a **Penguin** or an **Eagle** object, and the function should work as expected.

Here's where it gets interesting. Say you try to pass in a **Penguin** object that cannot fly to a different function called `letTheBirdsFly(Bird: Bird)`. According to LSP, this should work too, right? But, since **Penguin** cannot fly, the function would fail miserably! That's why we need to be careful when applying LSP and ensure that our subclasses can truly substitute their base class.

So, my friend, remember the Liskov Substitution Principle when working on your projects. Otherwise, your knowledge about OOP will be in danger, and we don't want that!

P.S. Do you know how LSP differs from Polymorphism? Cheers. 

