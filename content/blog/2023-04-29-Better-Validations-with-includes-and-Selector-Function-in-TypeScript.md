---
title: Better Validations with includes and Selector Function in TypeScript
date: 2023-04-29T01:25:00-04:00
author: Yoonsoo Park
description: "Better Validations with includes and Selector Function"
categories:
  - Programming
  - TypeScript
tags:
  - Includes and Selector
---

As a developer, ensuring that your code is robust and free from errors is crucial. One way to achieve this is through proper validation of data inputs. TypeScript provides many tools for type checking and validation, and in this article, we will explore how to use the `includes` method and `selector` function for better validations.

## The `includes` Method
The `includes` method is a built-in JavaScript method that checks if an array or string includes a specific value. In TypeScript, we can use `includes` to validate data inputs against a set of allowed values.

For example, let's say we have a function that takes in a string parameter and needs to validate that it is either "foo" or "bar". We can use `includes` to achieve this:

``` ts
function validateInput(input: string): boolean {
  const allowedValues = ["foo", "bar"];
  return allowedValues.includes(input);
}

```
In this example, we have an array `allowedValues` that contains the allowed values. We then use `includes` to check if the input parameter is included in the array. The function returns `true` if the input is valid and `false` if it is not.

## The Selector Function

The selector function is a TypeScript feature that allows us to define a function that selects a specific property from an object. This can be useful when validating complex data structures.

Let's say we have an interface `Person` that represents a person's information:
``` ts
interface Person {
  name: string;
  age: number;
  email: string;
}
```
Now let's say we have an array of `Person` objects and we want to validate that all of the `email` properties are valid email addresses. We can use a selector function to achieve this:

``` ts
function validateEmails(people: Person[]): boolean {
  function getEmail(person: Person): string {
    return person.email;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return people.every((person) => emailRegex.test(getEmail(person)));
}
```

In this example, we have a `getEmail` function that takes in a `Person` object and returns the `email` property. We then use every to check that every `Person` object in the array has a valid email address.


Cheers! 🍺
