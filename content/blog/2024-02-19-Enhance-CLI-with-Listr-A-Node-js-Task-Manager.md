---
title: Structured CLI Tasks with Listr2
date: 2024-02-19
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Use Listr2 to present structured task progress while preserving useful CI and non-interactive output."
categories:
  - Node.js
  - User Interface Design
tags:
  - Node.js
  - JavaScript
  - Package Management
  - CLI
---

![Listr Task List Example](images/oni-speaker.webp)

**Introduction**

Listr2 presents structured progress for multi-step CLI operations. Use it when task hierarchy helps users understand progress, while retaining plain and complete output for CI and logs.

**Why Listr?**

1. **Elegant Task Displays:** Unlike traditional CLI outputs, Listr introduces clean layouts, spinners, and status symbols that significantly enhance visual appeal and user comprehension.
2. **Organized Workflows:** Listr allows for the breaking down of complex tasks into manageable subtasks, reflecting the logical structure of operations and facilitating easier troubleshooting.
3. **Progress Tracking:** Real-time updates provided by Listr foster trust and a sense of responsiveness, keeping users informed about the script's execution status.

**Getting Started (with TypeScript)**

Before diving into Listr, ensure you have a compatible Node.js environment. Listr's TypeScript support offers strong typing benefits, making your task management scripts more maintainable and error-resistant.

The original `listr` package is superseded by `listr2`, which includes its own TypeScript types. Pin a compatible release and configure a non-interactive renderer for CI, logs, and redirected output. Progress UI must not hide command failures.

1. **Install Listr and types:**

   ```bash
   npm install listr @types/listr
   ```

2. **A simple TypeScript example:**

   ```typescript
   import { Listr } from "listr2";
   import type { ListrTask } from "listr2";

   // Define a context for your tasks to use
   interface MyContext {
     downloadPath: string;
   }

   const tasks = new Listr<MyContext>([
     {
       title: "Download project assets",
       task: (ctx) => downloadAssets(ctx.downloadPath),
       // Here, downloadAssets is a function you define to download project assets
     },
     {
       title: "Process data",
       task: () => processData(),
       // processData is another function for handling your data
     },
   ]);

   // Run the tasks with a specified context
   tasks.run({ downloadPath: "/tmp" }).catch((err) => {
     console.error(err);
   });
   ```

**Listr's Flexibility in Action**

1. **Error Handling:**
   Efficient error management is crucial for resilient script execution. Listr enables specific error handling routines and rollback mechanisms to maintain stability.

   ```typescript
   const tasks = new Listr<MyContext>([
     {
       title: "Fetch sensitive data",
       task: () => fetchData(), // fetchData should safely handle sensitive information
       onRollback: (task, ctx) => cleanUpSensitiveFiles(ctx.tempFiles),
       // cleanUpSensitiveFiles is a custom cleanup function
     },
   ]);
   ```

2. **Observability:**
   Tracking task progress is simplified with Listr's event hooks, offering insights into each step's execution.

   ```typescript
   const tasks = new Listr([...], { rendererOptions: { showSubtasks: false } });

   tasks.on('task:start', (task) => {
       console.log(`Starting task: ${task.title}`);
   });
   ```

3. **Customization:**
   Tailor Listr's output to meet your needs, whether for a concise summary or detailed logs.

   ```typescript
   const tasks = new Listr([...], { renderer: 'verbose' });
   ```

**Real-World Use Cases**

Deploying Listr in practical scenarios demonstrates its versatility and impact:

- **Build Script Example:**
  Simplify your build process with structured tasks, making each step transparent and manageable.

  ```typescript
  tasks.add([
    { title: "Clean", task: () => runCleanCommand() },
    { title: "Transpile Code (TypeScript)", task: () => transpileCode() },
    { title: "Bundle Assets", task: () => bundleAssets() },
  ]);
  ```

- **Deployment Workflow Example:**
  Streamline deployments by organizing tasks sequentially, ensuring each step is completed before proceeding.

```typescript
tasks.add([
  { title: "Test Suite", task: () => runTestSuite() },
  { title: "Push to Staging", task: () => deployToStaging() },
  {
    title: "Monitor",
    task: () => monitorLogs(),
    enabled: (ctx) => ctx.deploySuccess,
  },
]);
```

**Wrapping it up **

Listr2 is useful when interactive progress materially improves a multi-step command. Review its current [official documentation](https://github.com/cenk1cenk2/listr2), and keep the underlying task functions independent from the renderer.
