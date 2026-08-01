---
title: Streamline Your TypeScript Projects with Advanced Path Mapping Techniques
date: 2023-04-24T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "NO MORE ../../../../../../../../hate/my/life"
categories:
  - TypeScript
tags:
  - TypeScript
  - JavaScript
  - Module Systems
---

## Runtime resolution matters

TypeScript `paths` changes compiler resolution only; it does not rewrite emitted import specifiers or teach Node.js how to load an alias. Configure the runtime or bundler too, or use package `imports`/`exports` where appropriate. Verify the built output in the same environment that runs it.

If you're a TypeScript developer, you may have encountered the "Cannot find module" error when importing a module from a relative or absolute path. This can be frustrating, especially when dealing with a large codebase.

## Path Mapping

In TypeScript, **Path Mapping** is a feature that allows you to specify aliases for module paths. This can be helpful when working with a large codebase with multiple directories and files. Path Mapping helps to simplify the importation process by allowing you to use a custom alias instead of a relative or absolute path.

For example, instead of using:

```typescript
import { someModule } from "../../path/to/module";
```

You can use:

```typescript
import { someModule } from "@customAlias/module";
```

## Setting up Path Mapping

To use Path Mapping in TypeScript, you need to add a "paths" property in your `tsconfig.json` file.
Here's an example:

```typescript
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@customAlias/*": ["app/*"],
      "@anotherAlias/*": ["../another-dir/*"]
    }
  }
}
```

In this example, we've added two Path Mapping aliases: "@customAlias" and "@anotherAlias". The first alias maps to the "app" directory inside the "src" directory, and the second alias maps to the "another-dir" directory that's located one level up from the current directory.

Once you've set up your Path Mapping aliases, you can use them in your import statements like this:

```typescript
import { someModule } from "@customAlias/module";
import { anotherModule } from "@anotherAlias/module";
```

And that's it! You've successfully set up Path Mapping in TypeScript and can now "Se3y" your imports.
