---
title: How to Fix This Schedulable Class Has Jobs Pending or In Progress Error
date: 2023-04-28T01:25:00-04:00
author: Yoonsoo Park
description: "How to Fix This Schedulable Class Has Jobs Pending or In Progress Error"
categories:
  - Programming
  - salesforce
tags:
  - Push code error
---

When working with Salesforce, you may encounter an error message that says "This schedulable class has jobs pending or in progress" when trying to push code to a Scratch Org. This error message can be frustrating and may cause delays in your development process.

## The Solution
To prevent the "This schedulable class has jobs pending or in progress" error message from occurring, you need to navigate to your Deployment Settings and enable the "Allow deployments of components when corresponding Apex jobs are pending or in progress" option.

Here are the steps you can follow:

1. Log in to your Salesforce org.

2. Navigate to the Setup page.

3. In the Quick Find box, search for "Deployment Settings".

4. Click on the "Deployment Settings" link to open the Deployment Settings page.

5. Scroll down to the "Deployment Options" section and locate the "Allow deployments of components when corresponding Apex jobs are pending or in progress" option.

6. Click the checkbox next to the option to enable it.

7. Save your changes by clicking the "Save" button.

By enabling this option, you are allowing the deployment of components, even when corresponding Apex jobs are pending or in progress. This means that you can push your code to a Scratch Org without encountering the "This schedulable class has jobs pending or in progress" error message.

Cheers! 🍺
