---
title: DTO vs Schema
date: 2023-05-14T01:25:00-04:00
author: Yoonsoo Park
description: "DTO vs Schema"
categories:
  - Design Pattern
tags:
  - DTO
  - Schema
---

## Data Transfer Object (DTO)

A DTO is a plain TypeScript/JavaScript object used for transferring data between different layers or components of an application. Its primary purpose is to encapsulate data and provide a clear structure for communication across system boundaries, such as API calls or database interactions.

Let's consider an example of a UserDTO in TypeScript:

```typescript
interface UserDTO {
  id: number;
  name: string;
  email: string;
}
```

In this case, the UserDTO interface defines the structure of user data that can be transferred between components or sent over the network. It includes properties like id, name, and email, allowing a consistent and well-defined data representation during communication.

DTOs help decouple different parts of an application by providing a contract for data exchange. They enable type checking and validation when passing data between components, enhancing code reliability and reducing the chances of data-related bugs.

## Schema

A schema, on the other hand, describes the structure, constraints, and relationships of data within an application. It serves as a formal definition for expected data shapes and validation rules. Schemas are commonly employed in libraries or frameworks that handle data validation, serialization, or storage.

To illustrate the concept of a schema in TypeScript, we can use a popular library called Yup:

```typescript
import * as yup from "yup";

const userSchema = yup.object().shape({
  id: yup.number().required(),
  name: yup.string().required(),
  email: yup.string().email().required(),
});
```

In this example, we create a `userSchema` using the `Yup` library. It defines the expected structure and validation rules for user data. The schema specifies that the `id`, `name`, and `email` fields are required, and the email field should be a valid email address.

Schemas provide a powerful mechanism for validating data integrity and enforcing consistency within an application. They allow you to define complex validation rules, perform data transformations, and handle error conditions effectively.

## DTO vs Schema

While DTOs and schemas share some similarities, they have distinct purposes within an application.

- DTOs focus on transferring data between components or across system boundaries.
  - DTOs excel at enabling clear communication and decoupling between different parts of an application. They ensure consistency and type safety when passing data, reducing potential errors and making code more maintainable.
- Schemas concentrate on defining and validating the structure of data within an application.
  - schemas provide a mechanism for formally defining data structures and applying validation rules. They enhance data integrity, enforce constraints, and facilitate robust data handling throughout an application.

Tomorrow is Monday guys. yike.. Good luck!
Cheers! 🍺
