---
title: AWS SSO with TypeScript
date: 2023-05-24T01:25:00-04:00
author: Yoonsoo Park
description: "AWS SSO"
categories:
  - AWS
tags:
  - AWS SSO
---

# AWS Single Sign-On: An In-depth Guide with TypeScript Example

AWS Single Sign-On (AWS SSO) is a cloud-based service that simplifies managing SSO access to AWS accounts and business applications. By using AWS SSO, you can centrally manage access to multiple AWS accounts and business applications, thus improving user productivity, security, and compliance.

## Overview of AWS SSO

AWS SSO offers the following features:

- **Centralized access management**: You can manage access to all your AWS accounts from a single place.
- **Integration with business applications**: AWS SSO is preintegrated with many business applications, such as Salesforce, Office 365, and Box.
- **Automated setup**: AWS SSO is easy to set up and connect to your existing identity source, such as Microsoft Active Directory or AWS Managed Microsoft AD.
- **Compliance and Security**: AWS SSO logs all SSO access events in AWS CloudTrail, enabling you to meet compliance requirements.

## Configuring AWS SSO

To configure AWS SSO, you need to perform the following steps:

1. Sign into the AWS Management Console and open the AWS SSO console at https://console.aws.amazon.com/singlesignon/.
2. On the dashboard, choose "Enable AWS SSO".
3. Under "Choose your identity source", select AWS Managed Microsoft AD.
4. Choose "Next: Permission Sets" and define the AWS managed policies that you want to be part of your permission sets.
5. Review the settings and choose "Enable AWS SSO".

## AWS CLI Profile Configuration

To use AWS CLI with AWS SSO, you must configure a profile that contains your AWS SSO credentials. Here's how to do it:

1. Open the terminal and run `aws configure sso`. 
2. Enter the requested SSO information.
3. Once your browser completes the sign-in, return to the terminal to proceed.
4. Choose a profile name (default is 'default').
5. Once this process is complete, AWS CLI v2 will use this profile's settings when interacting with AWS.

Your AWS SSO configuration is stored in the `~/.aws/config` file and looks like this:

```bash
[profile my-aws-profile]
sso_start_url = https://my-sso-portal.awsapps.com/start
sso_region = us-west-2
sso_account_id = 123456789012
sso_role_name = ReadOnly
region = us-west-2
output = json
```

## Executes The AWS CLI Command for AWS SSO Authentication

Certainly, we can utilize Node.js' built-in `child_process` module to spawn a new process that executes the AWS CLI command for AWS SSO authentication. Here is an example of how to accomplish this:

```typescript
import { exec } from 'child_process';

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
authenticateWithAwsSso('my-aws-profile');
```

In this example, we're using the `exec` function from the `child_process` module to spawn a shell and then execute the AWS CLI command within that shell. We're passing in the command to initiate the AWS SSO login process with the specified profile.

The `exec` function takes a callback function as the second argument, which is invoked when the process terminates. If there is an error starting the process or if it exits with a non-zero status code, the `error` object will be non-null. The `stdout` and `stderr` parameters contain the output of the command.

> Note: Before running this code, make sure that you have configured the 'my-aws-profile' with AWS SSO, 
> and you have AWS CLI v2 installed in your machine. 
> This approach assumes that the AWS CLI is accessible in the system's `PATH`. 
> It also assumes that the AWS SSO login session is not expired. 
> The login session duration is typically 1 hour, but it depends on the configuration. 
> If the session has expired, 
> you'll need to log in again by opening a browser and authenticating against your AWS SSO user portal.

## Conclusion

AWS SSO provides a flexible and secure solution for managing SSO access to AWS accounts and business applications. Leveraging AWS SSO allows for improved productivity, heightened security, and streamlined compliance. With the help of the AWS SDK, you can programmatically manage and interact with AWS SSO, allowing you to build scalable and efficient applications.


Cheers! 🍺
