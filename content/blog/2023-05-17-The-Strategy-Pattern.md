---
title: The Strategy Pattern
date: 2023-05-17T01:25:00-04:00
author: Yoonsoo Park
description: "The Strategy Pattern - design pattern"
categories:
  - DesignPattern
tags:
  - The Strategy Pattern
---

The ability to modify or extend functionality without impacting the existing codebase is crucial in a rapidly evolving technological landscape. One design pattern that helps achieve this goal is `the Strategy Pattern`.

## Understanding the Strategy Pattern
The Strategy Pattern is **a behavioral design pattern** that enables the definition of a family of algorithms, encapsulates each one as a separate class, and makes them interchangeable at runtime. It allows the algorithm to vary independently from the clients that use it, promoting `loose coupling` between objects and providing a way to select algorithms dynamically.

At the heart of the Strategy Pattern are three main components:

1. **Context**: This is the class that contains the main business logic and maintains a reference to the chosen strategy object. It provides a method for clients to set the strategy or change it dynamically during runtime.

2. **Strategy**: The strategy interface defines a common set of methods that encapsulate different algorithms or behaviors. Each strategy represents a concrete implementation of a particular algorithm.

3. **Concrete Strategies**: These are the classes that implement the strategy interface and provide specific implementations of the algorithms or behaviors.

## Advantages of the Strategy Pattern
The Strategy Pattern offers several benefits in software design:

1. Improved Code Reusability
By encapsulating algorithms within separate strategy classes, the Strategy Pattern promotes code reuse. Different parts of the system can utilize the same set of strategies, enhancing maintainability and reducing code duplication. This reusability simplifies future modifications or additions to the system.

2. Enhanced Flexibility and Extensibility
The Strategy Pattern allows for easy extension and modification of behaviors. Adding a new strategy involves creating a new class that implements the strategy interface, without needing to modify existing code. This flexibility enables dynamic selection of strategies at runtime, enabling the system to adapt to changing requirements.

3. Separation of Concerns
The Strategy Pattern separates the logic of an algorithm from the context that uses it. This separation promotes cleaner code architecture by assigning responsibilities to appropriate classes. The context class focuses on the main business logic, while the strategies encapsulate specific algorithms. It enhances the overall maintainability and readability of the codebase.

4. Improved Testability
Because the Strategy Pattern encapsulates algorithms within separate classes, it becomes easier to test each strategy independently. By isolating the behavior in smaller, self-contained units, unit testing and mocking become more straightforward, resulting in better test coverage and more robust software.

5. Runtime Selection of Algorithms
One of the key advantages of the Strategy Pattern is the ability to select algorithms dynamically during runtime. The context can change the strategy it uses without affecting the clients or requiring complex conditional logic. This dynamic behavior selection provides a powerful mechanism for adapting the system's behavior to different scenarios or user preferences.

## Example

Let's consider an example where we want to implement different sorting algorithms for a list of integers using the **Strategy Pattern**. We'll have a Sorter class as the context, a `SortStrategy` interface as the strategy, and multiple concrete strategy classes for different sorting algorithms.

```py
# Step 1: Define the strategy interface
class SortStrategy:
    def sort(self, data):
        pass

# Step 2: Implement concrete strategy classes
class BubbleSortStrategy(SortStrategy):
    def sort(self, data):
        # Implementation of bubble sort algorithm
        print("Sorting using Bubble Sort")
        # ...

class QuickSortStrategy(SortStrategy):
    def sort(self, data):
        # Implementation of quicksort algorithm
        print("Sorting using Quick Sort")
        # ...

class MergeSortStrategy(SortStrategy):
    def sort(self, data):
        # Implementation of merge sort algorithm
        print("Sorting using Merge Sort")
        # ...

# Step 3: Create the context class
class Sorter:
    def __init__(self, strategy):
        self.strategy = strategy

    def set_strategy(self, strategy):
        self.strategy = strategy

    def sort(self, data):
        self.strategy.sort(data)

# Step 4: Client code
data = [5, 2, 7, 1, 9]

sorter = Sorter(BubbleSortStrategy())
sorter.sort(data)  # Sorting using Bubble Sort

sorter.set_strategy(QuickSortStrategy())
sorter.sort(data)  # Sorting using Quick Sort

sorter.set_strategy(MergeSortStrategy())
sorter.sort(data)  # Sorting using Merge Sort
```

In the above example, we define the `SortStrategy` interface that declares the `sort()` method. We then implement concrete strategy classes such as `BubbleSortStrategy`, `QuickSortStrategy`, and `MergeSortStrategy`, each providing their own implementation of the `sort()` method.

Next, we create the `Sorter` class as the context. It has a reference to the `SortStrategy` interface and provides methods to set the strategy dynamically (`set_strategy()`) and invoke the sorting operation (`sort()`).

In the client code, we instantiate a `Sorter` object and initially set it to use the `BubbleSortStrategy`. We call the sort() method on the `Sorter` object, and it delegates the sorting operation to the currently set strategy (`BubbleSortStrategy`).

We can dynamically change the sorting strategy by calling `set_strategy()` with a different strategy object (`QuickSortStrategy`, `MergeSortStrategy`, etc.). The `Sorter` object will then use the new strategy for subsequent sorting operations.

Cheers! 🍺
