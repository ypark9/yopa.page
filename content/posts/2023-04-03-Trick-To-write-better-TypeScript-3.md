---
title: Master TypeScript with Discriminated Unions - Enhance Your Coding Skills
date: 2023-04-03T01:25:00-04:00
author: Yoonsoo Park
description: "Write Better TypeScript Code 3"
categories:
  - Programming
  - TypeScript
tags:
  - Discriminated unions
---

Another cool trick in TypeScript is to use **Discriminated Unions**.
Discriminated unions are a way to create a type that is a union of multiple types, where each type has a unique property (called a "**discriminant**") that can be used to distinguish between them. This makes it easier to handle different types in a type-safe manner.

Let's take a look at an example:

Suppose you are building a messaging app that supports different types of messages: text, image, and video. You can create separate types for each message type and use a discriminant property called `type`:

```typescript
interface TextMessage {
  type: "text";
  content: string;
}

interface ImageMessage {
  type: "image";
  url: string;
  width: number;
  height: number;
}

interface VideoMessage {
  type: "video";
  url: string;
  duration: number;
}
```

Now, you can create a `Message` type as a discriminated union of these message types:

```typescript
type Message = TextMessage | ImageMessage | VideoMessage;
```

This `Message` type can represent any of the three message types. You can handle different message types using a type-safe switch statement based on the `type` property:

```typescript
function handleMessage(message: Message) {
  switch (message.type) {
    case "text":
      console.log(`Text message: ${message.content}`);
      break;
    case "image":
      console.log(
        `Image message: ${message.url} (${message.width}x${message.height})`
      );
      break;
    case "video":
      console.log(
        `Video message: ${message.url} (${message.duration} seconds)`
      );
      break;
  }
}
```

TypeScript will infer the correct type within each case block, ensuring that you are using the correct properties for each message type.

Here's how you can use the `handleMessage` function with different message types:

```typescript
const textMsg: TextMessage = { type: "text", content: "Hello, World!" };
const imageMsg: ImageMessage = {
  type: "image",
  url: "https://example.com/image.jpg",
  width: 800,
  height: 600,
};
const videoMsg: VideoMessage = {
  type: "video",
  url: "https://example.com/video.mp4",
  duration: 120,
};

handleMessage(textMsg);
handleMessage(imageMsg);
handleMessage(videoMsg);
```

**Discriminated Unions** help you create more versatile and maintainable TypeScript code by allowing you to work with different types in a type-safe manner. This can help you catch errors early in the development process and make your code easier to understand and modify.

Cheer! 🍺
