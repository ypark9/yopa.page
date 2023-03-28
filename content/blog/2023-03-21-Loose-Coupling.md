---
title: A Funny and Light-Hearted Look at Loose Coupling.
date: 2023-03-27T01:25:00-04:00
author: Yoonsoo Park
description: "When it comes to coding, there are certain principles that should be followed. One of them is loose coupling."
categories:
  - Programming
  - Principle
tags:
  - Principle
---

> “The advantage of loose coupling is the same in software design as it is in the physical socket and plug model: 
> Once the infrastructure is in place, 
> it can be used by anyone and adapted to changing needs and unforeseen requirements 
> without requiring large changes to the application code base and infrastructure.”

> Excerpt From: Steven van Deursen. “Dependency Injection.” Apple Books. 

Loose coupling. Sounds fancy, right? But what exactly is this loose coupling?
To put it simply, **loose coupling** is a way to design the relationship between different parts of your code so that they can operate independently of each other. Think of it like a `one-night stand` for your code. They can get together and do their thing, but they don't need to rely on each other in the long run.

## Why is loose coupling important? ##
For one thing, it makes your code easier to maintain. Because the different parts of your code aren't tightly intertwined, you can make changes to one part without breaking everything else. It also makes your code more flexible. You can swap out one part for another without having to rewrite all of your code.
(Can you feel the sensation of déjà vu? I might have written about this topic in my blog before. Check it out and let me know!)

## how do you achieve loose coupling? ##
One way is through `dependency injection`. This is when you pass an object to a function instead of having the function create the object itself. It's like bringing your own date to a party instead of relying on the party host to set you up.

Another way is by `using interfaces`. Interfaces allow you to define a contract without worrying about the implementation details. It's like telling someone what you want in a partner without specifying who that person should be.


Now, the next time you hear this buzzword in a design meeting, you can dazzle your associates with your knowledge. cheers. 🍺