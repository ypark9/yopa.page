---
title: Managing Multiple Versions with Pyenv and Virtual Environments
date: 2024-01-01
author: Yoonsoo Park
description: "Dive into the essentials of Python development by learning how to manage multiple Python versions with Pyenv and create isolated project environments using virtual environments."
categories:
  - Python
tags:
  - Multiple Python Versions
  - pyenv
  - Homebrew
  - Virtual Environments
---

## Managing Multiple Versions with Pyenv and Virtual Environments

When working on multiple projects with different Python versions, it's crucial to avoid conflicts and ensure that each project uses the correct version and dependencies. This is where virtual environments come in. They are isolated Python environments that let you manage packages and dependencies specific to a project without affecting the global Python installation.

## Installing Python Using Homebrew on macOS

Before setting up virtual environments, ensure you have the desired versions of Python installed:

1. **Install Homebrew**: Install Homebrew, a package manager for macOS, with the following command:
   e.g.

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Python**: Use Homebrew to install the latest version of Python:

   ```bash
   brew install python
   ```

## Managing Multiple Python Versions with pyenv

`pyenv` is an indispensable tool for managing multiple Python versions:

1. **Install pyenv**: Install `pyenv` using Homebrew:

   ```bash
   brew install pyenv
   ```

2. **Configure Your Shell**: Add the following to your shell configuration file (`.bashrc`, `.zshrc`, etc.) and restart your terminal or source the profile:

   ```bash
   eval "$(pyenv init --path)"
   eval "$(pyenv init -)"
   ```

3. **Install Python Versions**: Install the desired Python versions:

   ```bash
   pyenv install 3.8.6
   pyenv install 2.7.18
   ```

4. **Set Global Python Version**: Choose a global Python version with `pyenv`:

   ```bash
   pyenv global 3.8.6
   ```

## Creating and Activating Virtual Environments

Virtual environments are created and activated to isolate project dependencies:

1. **Creating a Virtual Environment**: Navigate to your project directory and create a virtual environment:

   ```bash
   python3 -m venv env
   ```

   Replace `env` with your preferred environment name.

2. **Activating the Virtual Environment**: Activate the virtual environment to use it:

   ```bash
   source env/bin/activate
   ```

   Upon activation, your shell prompt might change to indicate the active environment. Now, the environment's Python version and packages are isolated from the rest of your system.

## How Virtual Environments Set the Correct Python Version and Environment Variables

When a virtual environment is activated:

- **Python Version**: The virtual environment uses the Python version it was created with. Even if you have multiple versions installed on your system, the environment will only have access to and use the specific version it was created with.

- **Environment Variables**: The activation script adjusts environment variables like `PATH` to ensure that when you invoke `python` or `pip`, you're using the versions installed in the virtual environment's bin directory. This means any Python scripts you run or packages you install will be confined to the virtual environment.

- **Isolation**: This isolation prevents different projects from interfering with each other's dependencies. Each virtual environment operates independently, with its own Python binaries and site packages.

## Deactivating Virtual Environments

To stop using a virtual environment and revert to your global Python setup, simply run:

```bash
deactivate
```

Your shell's prompt will return to normal, and you'll be using the global Python version and packages again.
Cheers! 🍺
