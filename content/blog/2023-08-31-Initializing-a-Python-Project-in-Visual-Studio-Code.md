---
title: Initializing a Python Project in Visual Studio Code
title-with-dash: Initializing-a-Python-Project-in-Visual-Studio-Code
date: 2023-08-31T01:25:00-04:00
author: Yoonsoo Park
description: "This article guides you through the process of initializing a Python project in Visual Studio Code, installing dependencies, and setting up a GitHub repository."
categories:
  - Programming
  - Python
tags:
  - Python
  - VS Code
  - GitHub
  - Visual Studio Code
---

# Initializing a Python Project in Visual Studio Code

Creating a Python project involves more than just writing code. It entails setting up an organized file structure, managing dependencies, and even integrating version control for collaborative development. In this article, we'll go through the steps to initialize a Python project in VS Code, install the necessary dependencies, and set up a GitHub repository for version control.

## Step 1: Create a New Folder in VS Code

Open Visual Studio Code and create a new folder for your Python project using the "New Folder" button. This folder will be the root directory of your Python project.

## Step 2: Initialize a Virtual Environment

1. Open the terminal in VS Code by navigating to `View` > `Terminal` or pressing `Ctrl+~`.
2. Run the following command to create a virtual environment. Replace `myenv` with your desired name.
   ```bash
   python -m venv myenv
   ```

## Step 3: Activate the Virtual Environment

Activate your virtual environment by running:

- On Windows:
  ```bash
  .\myenv\Scripts\Activate
  ```
- On macOS and Linux:
  ```bash
  source myenv/bin/activate
  ```

## Step 4: Install Required Packages

Install the required Python packages by running the following command:

```bash
pip install requests google_images_search
```

## Step 5: Create Python Files

Create a new Python file (`main.py`, for example) and paste your Python code into it.

## Initialize GitHub Repository

### Step 1: Initialize Local Repository

In the terminal, run:

```bash
git init
```

### Step 2: Create `.gitignore` File

Create a `.gitignore` file and add the following:

```bash
myenv/
__pycache__/
*.pyc
*.pyo
```

### Step 3: Add and Commit Files

Run the following commands to add and commit your files locally:

```bash
git add .
git commit -m "Initial commit"
```

### Step 4: Create a GitHub Repository

Log in to your GitHub account and create a new repository.

### Step 5: Link Local Repository to GitHub

Replace `your-repo-url` with the URL of your GitHub repository and run:

```bash
git remote add origin your-repo-url
```

### Step 6: Push to GitHub

Push your local commits to the GitHub repository:

```bash
git push -u origin master
```

Cheers! 🍺
