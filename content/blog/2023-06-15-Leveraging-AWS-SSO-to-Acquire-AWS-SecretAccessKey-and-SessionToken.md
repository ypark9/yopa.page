---
title: Leveraging AWS SSO to Acquire AWS SecretAccessKey and SessionToken
date: 2023-06-15T01:25:00-04:00
author: Yoonsoo Park
description: "Using AWS SSO to Acquire AWS SecretAccessKey and SessionToken"
categories:
  - AWS
tags:
  - AWS-SSO
---

Developing secure applications necessitates the safe management of resource access. AWS SSO (Single Sign-On), a widely utilized service for safeguarding access management, comes in handy for this purpose. This article will delve into the utilization of AWS SSO to obtain role credentials, which will subsequently be used to fetch AWS SecretAccessKey and sessionToken. Note that this isn't the official way of obtaining these secrets and incorporates a workaround approach. Our tools for the task will be Node.js and its modules: child_process, fs, path, and ini.

## Breaking Down the Code

Our script can be divided into two primary segments. The first segment is the `readCredentials` function that fetches the requisite SSO credentials. The second part is the `getAwsSecrets` function, which employs these credentials to obtain AWS SecretAccessKey and sessionToken.

### Gathering SSO Credentials

The `readCredentials` function initiates its operation by reading the AWS config file and the SSO cache.

```javascript
const profile = process.env.AWS_PROFILE || 'default';
const awsConfigPath = join(process.env.HOME as string, '.aws', 'config');
const ssoCacheDir = join(process.env.HOME as string, '.aws', 'sso', 'cache');

const awsConfig = ini.parse(readFileSync(awsConfigPath, 'utf-8'));
```

It then extracts the AWS SSO account ID and role name from the AWS config file:

```javascript
const ssoAccountId = awsConfig[`profile ${profile}`]?.sso_account_id;
const ssoRoleName = awsConfig[`profile ${profile}`]?.sso_role_name;
```

The access token is retrieved from the first file in the SSO cache directory:

```javascript
const files = readdirSync(ssoCacheDir);
// This assumes that you have cache data after you ran aws sso.
const ssoCacheFile = files[0];
const ssoCacheFilePath = join(ssoCacheDir, ssoCacheFile);
const ssoCache = JSON.parse(readFileSync(ssoCacheFilePath, 'utf-8'));
const accessToken = ssoCache.accessToken;
```

### Collecting AWS Secrets

Armed with these credentials, the `getAwsSecrets` function executes the AWS CLI command to obtain the essential role credentials:

```javascript
const creds = await readCredentials();
const command = `aws sso get-role-credentials --account-id ${creds.ssoAccountId} --role-name ${creds.ssoRoleName} --access-token ${creds.accessToken}`;

const { stdout } = await exec(command);

const credentials = JSON.parse(stdout).roleCredentials;
```

These credentials are then employed to gather AWS secrets:

```javascript
const roleCredentials = {
	AccessKeyId: credentials.accessKeyId,
	SecretAccessKey: credentials.secretAccessKey,
	SessionToken: credentials.sessionToken,
	Region: process.env.AWS_REGION || 'us-east-1',
};
```

## Wrapping Up

This script exemplifies how AWS SSO credentials can be utilized to invoke an API Gateway. The procedure involves sourcing the SSO credentials from the AWS config file and SSO cache, and subsequently employing these credentials to acquire the necessary role credentials. This method ensures the safeguarding of access management. 

As always, remember to store your sensitive data securely and avoid exposing them publicly.

Cheers! 🍺
