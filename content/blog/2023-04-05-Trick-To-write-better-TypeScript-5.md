---
title: Master TypeScript with Advanced Tricks - Partial and Required
date: 2023-04-05T01:25:00-04:00
author: Yoonsoo Park
description: "Write Better TypeScript Code 4"
categories:
  - Programming
  - TypeScript
tags:
  - Partial and Required
---

## Partial Utility Type
The Partial utility type is a predefined TypeScript utility that makes all properties of a given type optional. This can be useful when you need to create a type that allows for partial updates or when you want to provide default values for missing properties.

Let's start with an example. Consider the following `User` type:

```typescript
Copy code
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}
```

Now, suppose we want to create a function to update a user's information. The function should accept an object with optional properties, allowing you to update only specific properties. The **Partial** utility type can help achieve this:

```typescript
Copy code
type PartialUser = Partial<User>;
```

`PartialUser` will now have the same properties as `User`, but all of them will be **optional**:

```typescript
Copy code
function updateUser(id: number, updates: PartialUser) {
  // Update the user with the provided information
}

// Usage example:
updateUser(1, { name: "Alice" });
updateUser(2, { email: "bob@example.com", age: 25 });
```

Cheer! 🍺
