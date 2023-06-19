---
title: How to Add Tags in GitHub
date: 2023-06-18T01:25:00-04:00
author: Yoonsoo Park
description: "How to Add Tags in GitHub"
categories:
  - GitHub
tags:
  - Tags
---

Tags in GitHub are a great way to mark specific points in your project's history, such as significant releases or milestones. They provide a reference point for easier navigation and can be useful for collaboration and version control. In this article, we'll explore two methods of adding tags in GitHub: using Git commands and using the web user interface (UI).

## Adding Tags Using Git Command

1. **Step 1: Clone the Repository**: Begin by cloning the repository to your local machine using the following command:
```
git clone <repository-url>
```

2. **Step 2: Navigate to the Repository**: Move into the repository's directory using the `cd` command:
```
cd <repository-directory>
```

3. **Step 3: Check Out the Desired Commit**: Use the `git log` command to view the commit history. Find the commit you want to tag and note its commit hash. Then, check out the commit using the following command:
```
git checkout <commit-hash>
```

4. **Step 4: Create the Tag**: Now, create the tag using the `git tag` command. You can choose either an annotated or lightweight tag. For an annotated tag, use the following command:
```
git tag -a <tag-name> -m "<tag-message>"
```
For a lightweight tag, use:
```
git tag <tag-name>
```

5. **Step 5: Push the Tag to GitHub**: Finally, push the tag to the remote repository on GitHub with the `git push` command:
```
git push origin <tag-name>
```

## Adding Tags Using Web UI

1. **Step 1: Navigate to the Repository**: Open your web browser and go to GitHub. Navigate to the repository where you want to add the tag.

2. **Step 2: Go to the Releases Section**: Once you're in the repository, click on the "Releases" tab located near the top navigation bar.

3. **Step 3: Create a New Release**: On the releases page, click on the "Create a new release" button.

4. **Step 4: Fill in Release Details**: In the release creation form, enter the tag version, release title, and any other relevant information.

5. **Step 5: Publish the Release**: After filling in the necessary details, click on the "Publish release" button to create the tag and publish the release.

NOICE! You have successfully added a tag to your GitHub repository. Whether you prefer using Git commands or the web UI, both methods provide an efficient way to mark important points in your project's history.

Remember, tags are useful for organizing and tracking different versions of your project. They can also be used to trigger specific actions, such as deployment or CI/CD pipelines. Utilize tags wisely to enhance collaboration and streamline your development workflow.

*Note: If you're using a different Git platform or hosting service, the steps may vary slightly. However, the general concept of adding tags remains the same.*

My first article from my first house! ;) 
Cheers! 🍺
