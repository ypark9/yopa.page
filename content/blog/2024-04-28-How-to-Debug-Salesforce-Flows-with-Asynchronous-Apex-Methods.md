---
title: How to Debug Salesforce Flows with Asynchronous Apex Methods
date: 2024-04-28
author: Yoonsoo Park
description: "Learn the steps to set up, trigger, and analyze debug logs for Salesforce flows that invoke asynchronous Apex methods, including real-world examples."
categories:
  - Salesforce
  - Debugging
tags:
  - Apex
  - Asynchronous
  - Debug Logs
---

Debugging in Salesforce, especially when dealing with asynchronous operations like `@Future` methods, can be challenging. Properly setting up and analyzing debug logs is crucial to identify and resolve issues. This article guides you through the steps of debugging Salesforce flows that invoke asynchronous Apex methods, complete with a real-life example.

### Step 1: Set Up Debug Logs

To ensure that you capture all relevant data, set up debug logging before you trigger the flow.

e.g.

```java
System.debug('Hello, world!');
```

1. **Navigate to Debug Logs**:

   - Go to Setup.
   - In the Quick Find box, type "Debug Logs".
   - Under "Logs", select "Debug Logs".

2. **Add User to Debug Logs**:
   - Click on “New” next to "User Trace Flags".
   - Select the user for whom you want to collect debug logs. This could be the user running the flow or an automated process.
   - Set the "Start Date" and "End Date" to cover your testing period.
   - Choose "User" for "Traced Entity Type".
   - Set "Apex Code" to "FINEST" to capture detailed Apex execution logs. Consider setting "System" and "Callout" to "FINE" or "FINEST" for comprehensive system operations and callouts logs.

### Step 2: Trigger the Flow

Execute the flow that invokes the Apex method marked with the `@Future` annotation. Ensure:

- `Named credentials` are properly configured if your HttpRequest relies on them.
- The endpoint is reachable from your Salesforce org.

### Step 3: Access the Debug Logs

After the flow execution, retrieve the logs:

1. **Return to the Debug Logs** menu as before.
2. **View the Logs**:
   - Refresh the page to see new logs.
   - Identify logs generated during your flow execution.
   - Open logs in Salesforce Log Inspector or download them for detailed analysis.

### Step 4: Analyze the Log

Locate entries linked to your Apex class and method:

- Search for your Apex class or a distinctive feature name in the log.
- Review `System.debug` lines to assess the execution of your method.
- Check HTTP response details to verify external interactions.

### Tips for Log Analysis

- **Adjust Log Levels**: Increase detail level if necessary to capture all relevant data.
- **Manage Log Volume**: High levels of logging can lead to voluminous data, making important details hard to find. Adjust your settings to focus on critical areas like Apex and callouts.

### Real-Life Example

Let's consider a scenario where an Apex method is set to run asynchronously after a specific user action in a Salesforce flow. The method is responsible for making HTTP callouts to an external service for data synchronization.

After setting up the debug logs as described and triggering the flow, you notice that the expected data isn't syncing. Upon accessing the logs, you discover that the `HTTP callout` is returning an "Unauthorized" status. By checking the debug levels and ensuring that all settings, including named credentials, are correctly configured, you manage to resolve the authorization issues, leading to successful data synchronization in subsequent tests.

By following these detailed steps, Salesforce administrators and developers can efficiently troubleshoot and ensure their asynchronous processes function as expected.

Wrapping it up 👏
Debugging asynchronous Apex methods in Salesforce flows requires careful setup and analysis of debug logs. Crank up the log levels, analyze those breadcrumbs - watch Salesforce complexities unravel like a bad sweater.

Cheers! 🍺
