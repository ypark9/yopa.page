---
title: Setting Up Virtual Environments for Multiple Python Versions
date: 2023-04-17T01:25:00-04:00
author: Yoonsoo Park
description: "Setting Up Virtual Environments for Multiple Python Versions"
categories:
  - Programming
  - Python
tags:
  - Multiple Python Versions
---

## Setting Up Virtual Environments for Multiple Python Versions

In some cases, you may need to work on multiple projects with different Python versions. To avoid conflicts and ensure that each project uses the correct version of Python, you can set up virtual environments for each project. Virtual environments are isolated Python environments that allow you to install packages and dependencies specific to a project, without affecting the global Python installation.

## Creating Virtual Environments

To create a virtual environment for a project using **venv**, navigate to the project directory in your terminal and run the following command:

```bash
python2 -m venv env
```

```bash
python3 -m venv env
```

You can replace `env` with any name you prefer.

## Activating Virtual Environments

To start using a virtual environment, you need to activate it. Activating a virtual environment sets the correct Python version and environment variables for the current shell session.

To activate a virtual environment, run the following command:

```bash
source env/bin/activate
```

Once you have activated a virtual environment, you can install packages and dependencies specific to your project using pip. Any packages you install will only be available within the virtual environment.

Cheers! 🍺
