---
title: Managing Multiple GitHub Accounts: The Local Git Configuration Method
date: 2025-04-04
author: Yoonsoo Park
description: "Learn how to seamlessly manage multiple GitHub accounts on the same machine using Git's local configuration hierarchy - no complex SSH setups required"
categories:
  - Development Tools
  - Git
tags:
  - GitHub
  - Git Configuration
  - Multiple Accounts
  - Developer Productivity
---

> Learn how to seamlessly manage multiple GitHub accounts on the same machine using Git's local configuration hierarchy - no complex SSH setups required

[GitHub's Official Multiple Accounts Guide](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-personal-account/managing-multiple-accounts)

If you're genuinely a developer, you probably juggle multiple GitHub accounts - perhaps one for work and another for personal projects. The challenge is maintaining clean separation between these identities without constantly switching configurations or breaking your workflow.

And there is a way to do it. Git's built-in configuration hierarchy provides a solution that's simpler than complex SSH key setups (yikes!) and more reliable than constantly switching global configurations.

## The Developer's Dilemma

Imagine this scenario: You're working on a company project when inspiration strikes for your personal open-source contribution. You quickly switch to your side project, make some commits, and push to GitHub - only to realize your commits show up under your work identity (what the ...?). Now your personal project has commits attributed to your corporate email address. nightmare.

This situation is more common than you might think. (been there, done that) Most developers end up in one of these problematic scenarios:

**Common Problems:**

- Accidentally committing personal projects with work identity
- Having to manually switch global Git configurations constantly
- Creating overly complex SSH key configurations that are hard to maintain
- Avoiding personal development altogether to prevent identity conflicts (yup.. I did that too)

## Understanding Git's Configuration Hierarchy

The solution lies in understanding how Git manages configuration at different levels. Git uses a three-tier hierarchy where more specific configurations override broader ones:

1. **System Level** - Affects all users on the machine (`/etc/gitconfig`)
2. **Global Level** - Affects all repositories for your user account (`~/.gitconfig`)
3. **Local Level** - Affects only the current repository (`.git/config`)

The magic happens because **local configuration always overrides global configuration**. This means you can set your work account as the global default while overriding it on a per-project basis for personal work. (yay!)

## Step-by-Step Implementation

### 1. Set Up Your Primary Account Globally

Configure your primary account (typically work) as the global default:

```bash
# Set work account as global default
git config --global user.name "john.doe"
git config --global user.email "john.doe@company.com"

# Verify the configuration
git config --global --list | grep user
```

This ensures all new repositories default to your work identity unless specifically overridden.

### 2. Override for Personal Projects

Navigate to your personal project and set local configuration:

```bash
# Go to your personal project
cd ~/my-personal-project

# Set personal identity for this project only (note: no --global flag)
git config user.name "johndoe123"
git config user.email "john.personal@gmail.com"

# Verify what Git will actually use
git config user.name
git config user.email
```

The absence of the `--global` flag is crucial - this creates repository-specific configuration that takes precedence over your global settings.

### 3. Verify Your Setup

```bash
# Check effective configuration
git config user.name    # Should show: johndoe123
git config user.email   # Should show: john.personal@gmail.com

# See all configurations (global + local)
git config --list | grep user
# Output should show both accounts with local taking precedence
```

## Real-World Example

Let's walk through a real-world example. yopa is a software engineer at yopa-world who also contributes to open-source projects:

```bash
# yopa's work setup (global)
git config --global user.name "yopa.park"
git config --global user.email "yopa.park@yopa-world.com"

# Navigate to personal open-source project
cd ~/projects/awesome-react-component

# Set personal identity for this project
git config user.name "yopacodes"
git config user.email "yopa.dev@gmail.com"

# Verify the setup
git config user.name
# Output: yopacodes

# Check both configurations are present
git config --list | grep user
# Output:
# user.name=yopa.park
# user.email=yopa.park@yopa-world.com
# user.name=yopacodes
# user.email=yopa.dev@gmail.com
```

Now when yopa commits in his personal project, the commits will be attributed to "yopacodes" with his personal email, while work projects continue using his corporate identity.

## Authentication Solutions

### Option 1: HTTPS with Personal Access Tokens (Recommended)

For most developers, HTTPS with Personal Access Tokens provides the cleanest authentication approach:

**Step 1: Create Personal Access Tokens**

- Go to GitHub Settings → Developer Settings → Personal Access Tokens
- Create separate tokens for each account
- Set appropriate scopes (typically `repo` for full repository access)
- Store tokens securely in a password manager

**Step 2: Configure Authentication**

```bash
# Method A: Include token in remote URL (use with caution)
git remote set-url origin https://{YOUR_TOKEN}@github.com/{USERNAME}/repo.git

# Method B: Use credential helper (more secure)
git config credential.helper store
# Git will prompt for username and token on first push
```

**Step 3: Use Different Tokens for Different Projects**
When Git prompts for credentials:

- Username: Your GitHub username for that account
- Password: Your Personal Access Token (not your actual password)

### Option 2: SSH with Multiple Keys (Advanced)

For developers who prefer SSH or need it for automation:

**Generate Separate SSH Keys:**

```bash
# Generate keys for each account
ssh-keygen -t ed25519 -C "{WORK_EMAIL}" -f ~/.ssh/id_work
ssh-keygen -t ed25519 -C "{PERSONAL_EMAIL}" -f ~/.ssh/id_personal
```

**Configure SSH Config (`~/.ssh/config`):**

```bash
# Work account
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_work
    IdentitiesOnly yes

# Personal account
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_personal
    IdentitiesOnly yes
```

**Use Different Hosts for Different Projects:**

```bash
# Personal project
git remote set-url origin git@github-personal:username/repo.git

# Work project
git remote set-url origin git@github-work:company/repo.git
```

## Automation and Best Practices

### Project Initialization Script

Create a script to quickly set up new personal projects:

```bash
#!/bin/bash
# setup-personal-project.sh

PROJECT_DIR="$1"
if [ -z "$PROJECT_DIR" ]; then
    echo "Usage: $0 <project-directory>"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Set personal git identity
git config user.name "your-personal-username"
git config user.email "your-personal-email@gmail.com"

echo "✅ Personal git identity configured for $(pwd)"
echo "Name: $(git config user.name)"
echo "Email: $(git config user.email)"
```

### Directory-Based Auto-Configuration

For even more automation, you can use Git's conditional includes feature to automatically set configuration based on project location:

**Create `~/.gitconfig`:**

```ini
[user]
    name = work-username
    email = work@company.com

[includeIf "gitdir:~/personal/"]
    path = ~/.gitconfig-personal

[includeIf "gitdir:~/opensource/"]
    path = ~/.gitconfig-personal
```

**Create `~/.gitconfig-personal`:**

```ini
[user]
    name = personal-username
    email = personal@gmail.com
```

Now any repository under `~/personal/` or `~/opensource/` will automatically use your personal configuration.

## Troubleshooting Common Issues

### "Repository not found" Error

This usually indicates authentication issues:

```bash
# Check your remote URL
git remote -v

# Verify you're using the correct account identity
git config user.name
git config user.email

# For HTTPS: Ensure you're using the right Personal Access Token
# For SSH: Test your SSH connection
ssh -T git@github.com
```

### Commits Showing Wrong Author

```bash
# Check what Git will use before committing
git config user.name
git config user.email

# If incorrect, set the right local configuration
git config user.name "correct-username"
git config user.email "correct-email@domain.com"

# Fix the last commit if needed
git commit --amend --reset-author
```

### Credential Helper Conflicts

If you're having authentication issues with HTTPS:

```bash
# Clear existing credentials
git config --global --unset credential.helper
git config --local --unset credential.helper

# On macOS, you may need to clear keychain entries
```

## Security Considerations

**Personal Access Tokens:**

- Set appropriate expiration dates (90 days is recommended, but ... 🤷)
- Use minimal required scopes
- Store tokens securely in password managers
- Rotate tokens regularly
- Never commit tokens to repositories

**SSH Keys:**

- Use Ed25519 keys instead of RSA when possible
- Protect keys with strong passphrases
- Use separate keys for each account
- Regularly audit and rotate keys

## Advanced: Conditional Configuration

For power users managing many projects, Git's conditional configuration offers even more flexibility:

```ini
# ~/.gitconfig
[user]
    name = default-work-name
    email = work@company.com

[includeIf "gitdir:~/work/client-a/"]
    path = ~/.gitconfig-client-a

[includeIf "gitdir:~/work/client-b/"]
    path = ~/.gitconfig-client-b

[includeIf "gitdir:~/personal/"]
    path = ~/.gitconfig-personal

[includeIf "gitdir:~/opensource/"]
    path = ~/.gitconfig-personal
```

This allows you to automatically use different configurations for different clients, personal projects, or open-source contributions based on where your repositories are located.

## Wrapping it up 👏

Managing multiple GitHub accounts doesn't have to be a reason to smash the keyboard. By leveraging Git's built-in configuration hierarchy, you can create a clean, maintainable system that automatically handles identity switching based on your project context.

The key insight is understanding that **local configuration overrides global configuration**. Whether you choose the HTTPS approach with Personal Access Tokens for simplicity, or the SSH method for advanced control, the local configuration technique provides a clean account separation.

Set up with your most-used account as the global default, then selectively override for specific projects or directories. This approach scales from simple two-account setups to complex multi-client environments while maintaining clarity and reducing the chance of identity mix-ups (which you really don't want).

Your future self will thank you for setting this up properly - no more frantically checking commit history to see which identity was used, and no more awkward explanations about why your personal projects have corporate email addresses in the Git log. Anonymous is a power my friend. Don't expose your identity without a good reason.

Winter is coming. guys. Be ready. 🥶
Good luck 🍺
