---
title: AWS SSO with TypeScript
date: 2023-05-23T01:25:00-04:00
author: Yoonsoo Park
description: "AWS SSO"
categories:
  - AWS
tags:
  - AWS SSO
---

# AWS Single Sign-On: An In-depth Guide with TypeScript Example

AWS Single Sign-On (AWS SSO) is a cloud-based service that makes it easier to manage SSO access to AWS accounts and business applications. By using AWS SSO, you can centrally manage access to multiple AWS accounts which improves user productivity and security.

## Overview of AWS SSO

AWS SSO offers the following features:

- **Centralized access management**: You can manage access to all your AWS accounts from a single location.
- **Integration with business applications**: AWS SSO is pre-configured with many business platforms (e.g. Salesforce, Office 365, and Box).
- **Automated setup**: AWS SSO is easy to set up and connect to your existing identity providers (e.g. Microsoft Active Directory or AWS Managed Microsoft AD).
- **Compliance and Security**: AWS SSO logs all SSO access events in AWS CloudTrail that helps you meet the requirements.

## Configuring AWS SSO

Following steps are required to configure AWS SSO:

1. Sign into the AWS Management Console and open the AWS SSO console at https://console.aws.amazon.com/singlesignon/.
2. On the dashboard, choose "Enable AWS SSO".
3. Under "Choose your identity source", select AWS Managed Microsoft AD.
4. Choose "Next: Permission Sets" and define the AWS managed policies that you want to be part of your permission sets.
5. Review the settings and choose "Enable AWS SSO".

## AWS CLI Profile Configuration

To use AWS CLI with AWS SSO, you MUST configure a profile that contains your AWS SSO credentials. You can do this with the following steps:

1. Open the terminal and run `aws configure sso`.
2. Enter the requested SSO information.
3. Once your browser completes the sign-in, return to the terminal to proceed.
4. Choose a profile name (default is 'default').
5. Once this process is complete, AWS CLI v2 will use this profile's settings when interacting with AWS.

Your AWS SSO configuration will be saved in the `~/.aws/config` file and looks like the below example:

```bash
[profile my-aws-profile]
sso_start_url = https://my-sso-portal.awsapps.com/start
sso_region = us-west-2
sso_account_id = 123456789012
sso_role_name = ReadOnly
region = us-west-2
output = json
```

## Execute The AWS CLI Command for AWS SSO Authentication

We can use Node.js' built-in `child_process` module to start a new process to execute the AWS CLI command for AWS SSO authentication. The example of how to accomplish this is in the below section:

```typescript
import { exec } from "child_process";

function authenticateWithAwsSso(profileName: string) {
  // Command to initiate AWS SSO login
  const command = `aws sso login --profile ${profileName}`;

  // Spawn a shell then execute the command within that shell
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }

    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }

    // If successful, the command prints to stdout
    console.log(`stdout: ${stdout}`);
  });
}

// Use the function
authenticateWithAwsSso("my-aws-profile");
```

In this example, we're using the `exec` function from the `child_process` module to spawn a shell and then execute the AWS CLI command in that shell. We're passing in the command to start the AWS SSO login process with the specified profile.

The `exec` function takes a callback function as the second argument, which is invoked when the process terminates. If there is an error starting the process or if it exits with a non-zero status code, the `error` object will be non-null. The `stdout` and `stderr` parameters contain the output of the command.

> Note: Before running this code, make sure that you have configured the 'my-aws-profile' with AWS SSO,
> and you have AWS CLI v2 installed in your machine.
> This approach assumes that the AWS CLI is accessible in the system's `PATH`.
> It also assumes that the AWS SSO login session is not expired.
> The login session duration is typically 1 hour, but it depends on the configuration.
> If the session has expired,
> you'll need to log in again by opening a browser and authenticating against your AWS SSO user portal.

Cheers! 🍺
