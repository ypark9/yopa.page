---
title: Manage environment variables in TypeScript
date: 2023-05-05T01:25:00-04:00
author: Yoonsoo Park
description: "Manage environment variables in TypeScript with dotenv"
categories:
  - TypeScript
tags:
  - dotenv
---

In a typical web application, you might have sensitive information like database credentials, API keys, and other configuration data that you don't want to hardcode into your codebase. Instead, you can use environment variables to keep this data separate and secure. In this article, we'll discuss how to use the `dotenv` library to manage environment variables in TypeScript.

## What is dotenv?
`dotenv` is a popular library that loads environment variables from a `.env` file into `process.env`, making it easy to access them in your code. With `dotenv`, you can keep your sensitive information separate from your codebase, making it easier to manage and secure.

## Installation
To get started with `dotenv`, you need to install it as a dependency in your project. 
```sh
npm install dotenv
```
## Usage
Once you have installed `dotenv`, you need to create a `.env` file in the **root** of your project. This file should contain your environment variables in the `KEY=VALUE` format, with each variable on a new line. 
For example:

```sh
DATABASE_URL=mongodb://localhost:27017/mydb
API_KEY=abc123
```

In your TypeScript code, you can now access these environment variables using `process.env`. 
For example:

```ts
import * as dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
```

Note that you need to call `dotenv.config()` to load the variables from the `.env` file into `process.env`. You can call this function at the beginning of your application or whenever you need to load new variables.

Happy Frisay, cheers! 🍺
