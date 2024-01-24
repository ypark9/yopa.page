---
title: Passing Command-Line Arguments to a TypeScript Script using NPM
date: 2023-08-18T01:25:00-04:00
author: Yoonsoo Park
description: "A step-by-step guide on passing command-line arguments to a TypeScript script using npm run."
categories:
    - TypeScript Development
tags:
    - TypeScript
    - npm
    - CLI
    - Development
---

## Introduction

In modern JavaScript and TypeScript development, `npm` scripts are commonly used to streamline and simplify various tasks. However, there may be occasions when you need to pass arguments to these scripts to make them more dynamic. In this article, we'll explore how to pass command-line arguments to a TypeScript script using `npm run`.

## Setting up NPM to Run Your TypeScript Script

To run your TypeScript script using the `npm run` command, you can define a script in your `package.json` file. Here's a step-by-step guide to help you set it up:

1. Ensure you have the necessary dependencies. Before running TypeScript files, make sure you have the TypeScript compiler and, optionally, `ts-node` installed.
2. Create or update a `tsconfig.json` file to include compiler options for TypeScript.
3. Add a script entry to the `scripts` section of your `package.json` to execute the TypeScript file with `ts-node`.

## Passing Parameters with NPM Run

1. **Handling Arguments in TypeScript**:

    In your TypeScript script, Node.js provides a global object called `process.argv` which is an array containing the command-line arguments passed when the process was launched. The first two values are the node executable and your script's path, so you'll usually want to access the arguments starting from index 2:

    ```typescript
    const args = process.argv.slice(2);
    ```

    For our use case, we want to retrieve the `arg` argument:

    ```typescript
    const profileArg = args.find((arg) => arg.startsWith("--arg="));
    const profileName = profileArg ? profileArg.split("=")[1] : "default";
    ```

2. **Updating the NPM Script**:

    Your `package.json` file remains unchanged. It can look like this:

    ```json
    "scripts": {
      "start": "ts-node your-script-file.ts"
    }
    ```

3. **Executing the Script with Arguments**:

    When running your script, use the following format to pass in the `arg` argument:

    ```
    npm run start -- --arg=myProfile
    ```

    The `--` after `npm run start` indicates that the subsequent arguments should be passed directly to the invoked script.

## Advanced: Using Argument Parsers

For more advanced command-line argument parsing, consider using libraries like `yargs` or `commander`. They offer a plethora of features such as default values, required arguments, aliases, and much more, which can make your scripts more robust and user-friendly.

## Conclusion

Passing command-line arguments to your TypeScript scripts via `npm run` can greatly enhance their flexibility. Whether you're looking to provide different configurations, paths, or any other kind of data, this method can simplify and streamline your development process.

Cheers! 🍺
