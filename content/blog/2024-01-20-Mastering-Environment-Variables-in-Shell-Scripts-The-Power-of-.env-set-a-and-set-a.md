---
title: Mastering Environment Variables in Shell Scripts -- The Power of .env, set -a, and set +a
date: 2024-01-20
author: Yoonsoo Park
description: "Explore the nuanced yet powerful techniques of managing environment variables in shell scripts using .env files along with the set -a and set +a commands for a cleaner, more secure, and highly maintainable scripting environment."
categories:
  - Programming
tags:
  - Environment Variables
  - Shell Scripting
  - .env
  - Best Practices
---

![oni-shell](images/oni-shell.webp)

Managing environment variables effectively is crucial in the realm of shell scripting, especially when dealing with complex projects that rely on external configurations. Traditionally, the `source` command is used to import variables from `.env` files. However, this article takes you a step further, illustrating the meticulous art of combining `.env` files with the `set -a` and `set +a` shell commands for a more robust and secure approach to environment variable management.

### Understanding the Basics

Before diving deep, it's important to grasp the basics. An environment variable is a dynamic-named value that can affect the way running processes will behave on a computer. For instance, they can store information about the default text editor or browser, the path to executable files, or the system locale and language.

`.env` files are a simple and popular method to configure environment variables. They are plain text files containing key-value pairs, making them easy to create and manage. However, variables defined in `.env` files aren't automatically available in the shell script. They need to be explicitly imported.

### The Role of `source .env`

The `source` command, used as `source .env`, executes the file passed as an argument, in the current shell. It reads and imports environment variables from `.env` into the shell session, but it doesn't export them to child processes by default.

### Elevating with `set -a` and `set +a`

This is where `set -a` and `set +a` come into play. These commands elevate the way environment variables are handled in shell scripts.

1. **`set -a` (Automatic Export):** When you run `set -a` before sourcing your `.env` file, it automatically exports the variables defined after it. This means the variables are not just available to the script but also to any subprocesses or commands that the script executes. It ensures that the environment is consistent and predictable, not just in your script but in other tools or scripts that your script might call.

2. **`set +a` (Revert Automatic Export):** After importing your variables, `set +a` is used to revert the shell back to its default behavior. It's a good practice, preventing any further variables from being automatically exported. This limits the scope of `set -a` to only the variables you intend to export, minimizing side effects and enhancing security.

### Why Use `set -a` and `set +a`?

Using these commands provides several benefits:

- **Explicitness & Clarity:** Clearly shows the intent to export the variables, making scripts more readable and maintainable.
- **Security:** By isolating the export behavior to a specific block of code, you reduce the risk of unintentionally exposing variables.
- **Consistency & Compatibility:** Ensures consistent behavior in variable exportation across different environments and shell versions.

<details>
<summary><b>Practical Example: Deploying a Web Application</b></summary>
Imagine you're tasked with deploying a web application. This application requires several environment variables to run, such as database connection strings, API keys, and configuration flags. These variables differ between development, staging, and production environments.

#### Steps in the Deployment Script

Your deployment script might include steps like:

1. **Setting Up the Environment:** Load environment variables from a `.env` file corresponding to the target environment (development, staging, or production).
2. **Running Database Migrations:** Execute scripts to set up or update the database schema.
3. **Starting Services:** Start the application backend, frontend, and any auxiliary services, each of which requires access to the environment variables.

#### Why `set -a` and `set +a` are Useful Here

1. **Isolation of Environment Variables:** You have a `.env` file for each environment (`.env.development`, `.env.staging`, `.env.production`). Using `set -a` and `set +a` ensures that only the variables from the specific `.env` file are exported, preventing any accidental overlap or leakage between environments.

2. **Ensuring Subprocess Compatibility:** The database migration scripts, backend, frontend, and auxiliary services are likely separate processes or even separate scripts that are called from your main deployment script. By using `set -a`, you ensure that these subprocesses inherit the necessary environment variables, ensuring a smooth and predictable deployment process.

3. **Security and Cleanliness:** After loading and exporting the necessary variables, `set +a` is used to prevent any future variables defined in your script from being automatically exported. This is particularly important for maintaining the security and cleanliness of your environment, as only the necessary variables are exposed to subprocesses.

#### Script Example

```sh
#!/bin/sh

# Choose the right .env file based on the target environment
ENV_FILE=".env.production"

# Automatically export variables
set -a
source $ENV_FILE
set +a

# Run database migrations
./run_database_migrations.sh

# Start services
./start_backend.sh
./start_frontend.sh
./start_aux_services.sh

# ... rest of your deployment script
```

In this script:

- `set -a` ensures all variables from `.env.production` are exported and available to the `run_database_migrations.sh`, `start_backend.sh`, `start_frontend.sh`, and `start_aux_services.sh` scripts.
- `set +a` ensures that any variables defined or modified after this point in the script are not automatically exported, maintaining a clean and secure environment.

</details>

### Conclusion

While `source .env` works fine for simple cases, the combination of `set -a` and `set +a` offers a controlled, secure, and clear approach to managing environment variables in shell scripts. It's a testament to the thoughtfulness that goes into professional script writing, ensuring that your scripts work predictably and securely, no matter the complexity.

In the world of shell scripting, mastering the nuances of environment variables can significantly improve the robustness and reliability of your scripts. Embracing these practices is a step towards writing cleaner, more maintainable, and secure code.

Cheers! 🍺
