---
title: The Decorator Pattern
date: 2023-05-20T01:25:00-04:00
author: Yoonsoo Park
description: "The Decorator Pattern - a structural design pattern"
categories:
  - Design Pattern
tags:
  - The Decorator Pattern
---

# Unveiling the Decorator Pattern: A Deep Dive with TypeScript

`The Decorator Pattern` is one of the most powerful **structural design pattern**s in the software development arsenal, granting flexibility and dynamism in extending object behavior. 

## What is the Decorator Pattern?

The Decorator Pattern is a design pattern that allows behavior to be added to individual objects, either statically or dynamically, without affecting the behavior of other objects from the same class. 
__Decorators provide a flexible alternative to subclassing for extending functionality.__

## When Should You Use the Decorator Pattern?

The Decorator Pattern provides an alternative to subclassing, which involves creating a new class for every new behavior. 

### Use the Decorator Pattern when:

- You want to add responsibilities to individual objects dynamically and transparently, that is, without affecting other objects.
- You want to add responsibilities to an object that you may want to change in the future.
- Extending functionality by subclassing is impractical because it leads to a large number of subclasses and complicates code maintenance and error tracking.

## Example with TypeScript

Let's assume we are developing a `text editor`, and we want to have the ability to add various types of formatting to the text, such as `bold`, `italic`, or `underline`. Here is how we can implement this using the Decorator Pattern:

```typescript
// Base Component
interface Text {
    displayText(): string;
}

// Concrete Component
class PlainText implements Text {
    displayText(): string {
        return "Plain Text";
    }
}

// Base Decorator
class TextDecorator implements Text {
    constructor(protected text: Text) {}
    displayText(): string {
        return this.text.displayText();
    }
}

// Concrete Decorators
class BoldText extends TextDecorator {
    displayText(): string {
        return `Bold(${super.displayText()})`;
    }
}

class ItalicText extends TextDecorator {
    displayText(): string {
        return `Italic(${super.displayText()})`;
    }
}

// Usage
let text: Text = new PlainText();
text = new BoldText(text);
text = new ItalicText(text);

console.log(text.displayText()); // Outputs: Italic(Bold(Plain Text))
```

In this example, we're able to apply multiple formatting options (bold, italic) to our text dynamically, and we can easily introduce more (like underline, strikethrough, etc.) without affecting existing classes.

## Wrapping up

The Decorator Pattern is a highly effective tool in a developer's toolbox, offering dynamic and flexible object behavior. It aligns well with the open-closed principle, **one of the five principles of SOLID**, leading to more maintainable and less error-prone code. Used appropriately and sparingly, the Decorator Pattern can greatly improve your code design and structure.

Cheers! 🍺
