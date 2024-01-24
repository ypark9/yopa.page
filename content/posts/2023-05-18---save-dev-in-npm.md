---
title: --save-dev in npm
date: 2023-05-18T01:25:00-04:00
author: Yoonsoo Park
description: "--save-dev in npm"
categories:
  - npm
tags:
  - --save-dev
---

When working with npm (Node Package Manager) to manage dependencies in a Node.js project, the `--save-dev` flag is often used to save packages as development dependencies. It is an essential feature that helps distinguish between packages required for development purposes and those needed for the production environment.

## What does `--save-dev` do?
By appending `--save-dev` to an npm install command, you specify that the package being installed is only required during development and should not be included when deploying your application to a production environment. The package will be added to the `devDependencies` section in your `package.json` file.

```bash
npm install <package-name> --save-dev
```

The `devDependencies` section typically includes packages related to testing, building, and development tooling, such as test frameworks (e.g., Mocha or Jest), build tools (e.g., Gulp or Webpack), linters (e.g., ESLint or Prettier), and other utilities.

## Example use cases for `--save-dev`

1. Testing frameworks: When writing tests for your application, you often rely on specific testing frameworks like Mocha or Jest. These frameworks are not needed in production but are crucial during development and continuous integration processes. By installing them with `--save-dev`, you ensure they are available when running tests but won't unnecessarily bloat your production build.

2. Build tools: Build tools such as Gulp, Grunt, or Webpack are commonly employed during development to compile and bundle assets, optimize code, or perform other build-related tasks. These tools are not required in a production environment, as the bundled code can be executed without them. Therefore, it's advisable to save them as development dependencies using `--save-dev`.

3. Linters and code formatters: Linters, such as ESLint, and code formatters, like Prettier, assist in maintaining consistent code quality and style. They provide valuable feedback during development but are not necessary for the deployed application. Including them as `devDependencies` allows developers to use them while working on the codebase, without affecting the production build.

## When not to use `--save-dev`

Although `--save-dev` is useful in many scenarios, there are situations where it should not be employed. One example is when installing packages that are explicitly required at runtime by your application. These packages provide functionality that is essential for the application to run correctly, regardless of the development or production context.

For instance, consider a web server framework like Express. Express is a core dependency for a Node.js web application and is necessary for the application to function correctly. In this case, you should install Express without using `--save-dev`, as it belongs to the regular dependencies section of your `package.json` file:

```bash
npm install express
```

By installing Express as a regular dependency, it will be bundled and deployed along with your application to ensure proper execution in both development and production environment.


Cheers! 🍺
