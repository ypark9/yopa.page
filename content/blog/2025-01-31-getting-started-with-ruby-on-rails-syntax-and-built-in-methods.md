---
title: Ruby Syntax and Core Collection Methods for Beginners
date: 2025-01-31
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: A beginner-friendly guide to Ruby classes, methods, scope, iteration, and core collection APIs, with concise Python comparisons.
categories:
  - Ruby
tags:
  - Ruby
  - Object-Oriented Programming
  - Collections
  - Language Fundamentals
---

# Ruby Syntax and Built-in Methods

This is a Ruby language reference, not a Rails tutorial. Rails builds on Ruby, but it adds its own framework conventions, APIs, and lifecycle.

The examples were reviewed on 2026-08-01 against the [official Ruby syntax documentation](https://docs.ruby-lang.org/en/3.4/syntax_rdoc.html) and [Ruby in Twenty Minutes](https://www.ruby-lang.org/en/documentation/quickstart/). Check the [official Ruby documentation index](https://www.ruby-lang.org/en/documentation/) and maintenance status before selecting a version for a new project. The examples use syntax available in maintained modern Ruby releases; pin the project's version in development and CI rather than relying on the macOS system Ruby.

## Table of Contents

1. [Introduction](#introduction)
2. [Class Definitions](#class-definitions)
3. [Inheritance](#inheritance)
4. [Function Definitions](#function-definitions)
5. [Variables and Scope](#variables-and-scope)
6. [Loops and Iteration](#loops-and-iteration)
7. [Common Default Functions](#common-default-functions)
8. [Built-in Methods](#built-in-methods)
   - [String Methods](#string-methods)
   - [Array Methods](#array-methods)
   - [Hash Methods](#hash-methods)
   - [Numeric Methods](#numeric-methods)
   - [Enumerable Methods](#enumerable-methods)

## Introduction

Ruby is an object-oriented language in which expressions return values and blocks are central to collection APIs. The Python comparisons below are orientation aids, not claims that the two object models are identical.

## Class Definitions

### Ruby Syntax

```ruby
class Person
  def initialize(name, age)
    @name = name  # Instance variable; note that Ruby uses `@` to denote instance variables
    @age = age
  end

  def introduce
    "Hi, my name is #{@name} and I am #{@age} years old."
  end
end

# Usage
person = Person.new("Alice", 30)
puts person.introduce
```

### Python Equivalent

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def introduce(self):
        return f"Hi, my name is {self.name} and I am {self.age} years old."

# Usage
person = Person("Alice", 30)
print(person.introduce())
```

Ruby instance variables use an `@` prefix. Python stores comparable state through attributes on `self`.

## Inheritance

### Ruby Implementation

```ruby
class Employee < Person
  def initialize(name, age, position)
    super(name, age)  # Calls parent class's constructor
    @position = position  # then we set the instance variable
  end

  def work
    "#{@name} is working as a #{@position}."
  end
end
```

### Python Implementation

```python
class Employee(Person):
    def __init__(self, name, age, position):
        super().__init__(name, age)
        self.position = position

    def work(self):
        return f"{self.name} is working as a {self.position}."
```

Ruby writes superclass inheritance with `<`; Python places base classes in parentheses.

## Function Definitions

### Ruby Methods

```ruby
class Calculator
  def add(a, b = 0)  # Default parameter
    a + b
  end
end

calc = Calculator.new
puts calc.add(5, 10)  # => 15
puts calc.add(7)      # => 7 (uses default value)
```

### Python Methods

```python
class Calculator:
    def add(self, a, b=0):  # Default parameter
        return a + b

calc = Calculator()
print(calc.add(5, 10))  # => 15
print(calc.add(7))      # => 7 (uses default value)
```

## Variables and Scope

### Ruby Variables

```ruby
def demonstrate_variables
  local_var = "I am local"           # Local variable
  @instance_var = "Instance scope"   # Instance variable
  [local_var, @instance_var]
end
```

Ruby also has class variables (`@@name`) and globals (`$name`), but both introduce wider mutable state and should not be the default for ordinary application data. Prefer explicit objects, constants for immutable shared values, and class-instance variables when class-owned state is genuinely required.

### Python Variables

```python
def demonstrate_variables(self):
    local_var = "I am local"              # Local variable
    self.instance_var = "Instance scope"  # Instance variable
    # Class variables in Python use class namespace
    # Global variables use global keyword
```

## Loops and Iteration

### Ruby Loops

```ruby
# Each iterator
[1, 2, 3].each do |number|
  puts number
end

# For loop
for number in 1..5
  puts number
end

# While loop
i = 0
while i < 5
  puts i
  i += 1
end

# Until loop (Ruby-specific)
i = 0
until i >= 5
  puts i
  i += 1
end
```

## Built-in Methods

### String Methods

```ruby
# Common string operations
str = "Hello, World!"
str.length      # => 13
str.upcase      # => "HELLO, WORLD!"
str.downcase    # => "hello, world!"
str.capitalize  # => "Hello, world!"
str.reverse     # => "!dlroW ,olleH"
str.split(",")  # => ["Hello", " World!"]
```

### Array Methods

Ruby arrays can contain objects of different classes, like Python lists. That flexibility is a Ruby language property and does not depend on Rails.
>
> ```ruby
> # Mixed type array examples
> mixed_array = [1, "hello", 3.14, true, [1, 2], {name: "John"}]
> # You can add different types at any time
> mixed_array.push(:symbol)  # Adds a Symbol
> mixed_array << nil        # Adds nil using the shovel operator
> mixed_array.unshift(42.0) # Adds a Float at the beginning
> # These operations are valid; mixed collections still require clear application contracts.
> ```

```ruby
# Array operations
arr = [1, 2, 3, 4, 5]
arr.length       # => 5
arr.first        # => 1
arr.last         # => 5
arr.include?(3)  # => true

# Mutating operations change their receiver
arr.push(6)       # arr => [1, 2, 3, 4, 5, 6]
arr.pop           # => 6; arr => [1, 2, 3, 4, 5]
arr.unshift(0)    # arr => [0, 1, 2, 3, 4, 5]
arr.shift         # => 0; arr => [1, 2, 3, 4, 5]
arr.insert(2, 99) # arr => [1, 2, 99, 3, 4, 5]
arr.delete_at(2)  # => 99; arr => [1, 2, 3, 4, 5]

# delete removes every matching value and returns the argument when found
values = [0, 1, 0, 2]
values.delete(0) # => 0; values => [1, 2]

# delete_if removes values matching the block
numbers = [1, 2, 3, 4, 5]
numbers.delete_if { |n| n.even? } # numbers => [1, 3, 5]

# clear removes all values
numbers.clear # numbers => []
```

### Hash Methods

```ruby
# Hash operations
hash = { name: "John", age: 30 }
hash.keys           # => [:name, :age]
hash.values        # => ["John", 30]
hash[:name]        # => "John"
hash.merge(city: "New York") # => {:name=>"John", :age=>30, :city=>"New York"}
hash.delete(:age) # => 30  # Deletes the key-value pair with the specified key and returns the value that was deleted

# Remove key-value pairs based on a condition
hash = { name: "John", age: 30, role: "Developer", level: "Senior" }
hash.delete_if { |k,v| v == "John" }  # => {:age=>30, :role=>"Developer", :level=>"Senior"}  # Removes all pairs where value is "John"

# Remove nil values from hash
hash = { name: "John", age: 30, title: nil, department: nil }
hash.compact     # => {:name=>"John", :age=>30}  # Returns new hash with nil values removed
hash.compact!    # Removes nil values from original hash permanently

# how to remove all key-value pairs from the hash
hash.clear # => {}  # Removes all key-value pairs from the hash

```

### Numeric Methods

```ruby
# Numeric operations
num = 42
num.even?      # => true
num.odd?       # => false
(-num).abs       # => 42  # The - operator negates num to -42, then abs returns absolute value back to 42
3.14.round     # => 3
3.14.ceil      # => 4
3.14.floor     # => 3

```

### Enumerable Methods

```ruby
# Collection operations
numbers = [1, 2, 3, 4, 5]

# Map/Collect
numbers.map { |n| n * 2 }      # => [2, 4, 6, 8, 10]  # |n| is a block parameter, similar to a function parameter
                               # It represents each element from 'numbers' as the map iterates
                               # You can name it anything, e.g. |num| or |x|

# Select/Filter
numbers.select { |n| n.even? }  # => [2, 4]

# Reduce/Inject
numbers.reduce(:+)              # => 15  # Adds all numbers in array: 1 + 2 + 3 + 4 + 5 = 15
numbers.inject(:+)              # => 15  # Same as reduce
numbers.inject(0) { |result, element| result + element }  # => 15  # More explicit version where:
                               # - 0 is the initial value
                               # - result is always the accumulated value from previous iterations
                               # - element is the current array element being processed
                               # The block parameters |result, element| follow a convention:
                               # - First parameter is always the accumulator/result
                               # - Second parameter is always the current element

# Sort
numbers.sort                    # => [1, 2, 3, 4, 5]  # Returns ascending order
numbers.sort.reverse            # => [5, 4, 3, 2, 1]  # Sorts numbers in descending order

# Reverse
numbers.reverse                 # => [5, 4, 3, 2, 1]  # Reverses the order of the array

# First/Last
numbers.first                   # => 1  # Returns the first element of the array

# Any/All
numbers.any? { |n| n > 3 }     # => true  # Returns true because at least one number (4,5) is greater than 3
numbers.all? { |n| n < 6 }     # => true  # Returns true because every number (1,2,3,4,5) is less than 6
```

Use `ruby -c file.rb` for a syntax check and run examples with the same Ruby version used by the project. For API details, consult the documentation for that exact release because core methods and keyword behavior can evolve across major versions.
