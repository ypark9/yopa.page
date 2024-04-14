---
title: Managing Multiple Versions with Pyenv, venv, and Pipenv
date: 2024-03-11
author: Yoonsoo Park
description: "Learn to manage multiple Python versions with Pyenv and create isolated project environments using both venv and Pipenv, understanding their distinct roles in Python development."
categories:
  - Python
tags:
  - Multiple Python Versions
  - pyenv
  - Homebrew
  - Virtual Environments
  - Pipenv
---

![oni working on python](images/oni-python-1.webp)

## Introduction to Python Environment Management

When working on multiple Python projects, it's crucial to manage dependencies and Python versions without conflicts. This guide covers using `Pyenv` to handle multiple Python versions, `venv` for creating isolated environments using Python's built-in module, and `Pipenv` for an enhanced approach to manage dependencies and virtual environments together.

## Installing Python Using Homebrew on macOS

Before setting up virtual environments or using Pyenv, ensure you have the desired versions of Python installed:

1. **Install Homebrew**: Use this command to install Homebrew, a package manager for macOS:

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Python**: Install the latest Python version using Homebrew:
   ```bash
   brew install python
   ```

## Managing Multiple Python Versions with pyenv

Pyenv is a popular tool for managing multiple Python versions on your system:

1. **Install pyenv**:

   ```bash
   brew install pyenv
   ```

2. **Configure Your Shell**:

   ```bash
   eval "$(pyenv init --path)"
   eval "$(pyenv init -)"
   ```

3. **Install and Manage Python Versions**:
   ```bash
   pyenv install 3.8.6
   pyenv install 2.7.18
   pyenv global 3.8.6
   ```

## Virtual Environments with venv

`venv` creates isolated Python environments, allowing you to manage packages specific to each project.

1. **Creating a Virtual Environment**: In your project directory:

   ```bash
   python3 -m venv env
   ```

2. **Activating the Virtual Environment**:

   ```bash
   source env/bin/activate
   ```

3. **Deactivating the Virtual Environment**:
   ```bash
   deactivate
   ```

## Dependency Management and Environments with Pipenv

Pipenv combines dependency management with virtual environment management, simplifying Python workflow.

1. **Install Pipenv**:

   ```bash
   brew install pipenv
   ```

2. **Creating and Activating Environments**:
   Navigate to your project directory and run:

   ```bash
   pipenv install
   ```

   This command creates a virtual environment and installs dependencies listed in the `Pipfile`.

3. **Running Commands Within a Virtual Environment**:

   ```bash
   pipenv run python or pipenv run <command>
   ```

4. **Deactivating Pipenv Environment**:
   Exit the environment simply by ending the terminal session, or explicitly with:
   ```bash
   exit
   ```

## Conclusion: Choosing Between venv and Pipenv

- **venv** is suitable for simple projects or when minimal dependency management is needed beyond Python's standard library.
- **Pipenv** offers a higher-level tool that automatically manages a virtual environment for your projects and adds support for dependency management, ideal for more complex project setups.

### Real life Scenario

Imagine an associate developer, YOPA, who has recently joined a Python project team. The project uses Python virtual environments to manage dependencies, but YOPA is not sure which system is in use. After checking with a teammate, YOPA learns that the project uses Python's built-in `venv` but wants to transition to using `Pipenv` for enhanced dependency management and workflow.

### Step-by-Step Guide for Transitioning from `venv` to `Pipenv`

#### Step 1: Check the Current Virtual Environment Setup

First, YOPA needs to confirm that the project is using `venv`. This can be done by looking for a directory typically named `env` or `venv` within the project folder, or checking if there's an activation script in such a directory.

```bash
ls -la
```

If there's a folder named `env`, `venv`, or similar, it likely contains the virtual environment.

#### Step 2: Deactivate the Current `venv` Environment (if active)

Before transitioning to `Pipenv`, YOPA should ensure that no virtual environments are active. If YOPA has the environment activated, he can deactivate it by running:

```bash
deactivate
```

#### Step 3: Install Pipenv

If `Pipenv` is not already installed, YOPA can install it using Homebrew on macOS, or `pip` on other systems:

**On macOS:**

```bash
brew install pipenv
```

**On Windows/Linux:**

```bash
pip install --user pipenv
```

#### Step 4: Remove the `venv` Directory (Optional)

To avoid confusion and clean up the project directory, YOPA can remove the old `venv` directory. This step should only be performed if all necessary dependencies are documented and can be reinstalled with `Pipenv`.

```bash
rm -rf venv
```

#### Step 5: Initialize Pipenv with Python Version

YOPA should initialize `Pipenv` specifying the Python version used by the `venv` to ensure consistency:

```bash
pipenv --python 3.8
```

Replace `3.8` with the version YOPA's project uses.

#### Step 6: Install Dependencies

YOPA needs to install the project dependencies with `Pipenv`. If there's a `requirements.txt` file, he can use that to install all dependencies at once:

```bash
pipenv install -r requirements.txt
```

If there's no such file, YOPA should manually install necessary packages:

```bash
pipenv install requests numpy
```

#### Step 7: Activate the New Pipenv Environment

To start using the newly created Pipenv environment, YOPA can activate it by running:

```bash
pipenv shell
```

#### Step 8: Update Project Documentation

Finally, YOPA should update any project documentation or scripts that reference the old `venv` setup to use `Pipenv` commands instead. This ensures that all team members are aware of the change and know how to activate and use the new environment.

### Wrapping up!

With these steps, YOPA has successfully transitioned the project from using `venv` to `Pipenv`, enhancing the project's dependency management and simplifying future environment setups. Great job, YOPA!

Cheers! 🍺
