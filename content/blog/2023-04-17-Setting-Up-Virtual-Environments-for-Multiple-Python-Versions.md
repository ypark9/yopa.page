---
title: Setting Up Virtual Environments for Multiple Python Versions
date: 2023-04-17T01:25:00-04:00
author: Yoonsoo Park
description: "Setting Up Virtual Environments for Multiple Python Versions"
categories:
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

## Deactivating Virtual Environments

When you finish working in the virtual environment and want to return to the system's default settings, use:

```bash
deactivate
```

This command will revert all changes made to the environment by activation.

## Managing Dependencies with requirements.txt

To manage dependencies within a virtual environment:

- Creating a requirements.txt: Save all current dependencies to a file:

```bash
pip freeze > requirements.txt
```

- Installing from requirements.txt:

```bash
pip install -r requirements.txt
```

This ensures that you can replicate your environment exactly on another machine or in another environment.

Cheers! 🍺
