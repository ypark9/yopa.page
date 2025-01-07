---
title: Deploying Services with AWS CDK and AWS SSO
date: 2023-06-05T01:25:00-04:00
author: Yoonsoo Park
description: "AWS CDK and AWS SSO"
categories:
  - AWS
tags:
  - AWS-CDK
  - AWS-SSO
---

AWS Cloud Development Kit (CDK) allows developers to define infrastructure resources with the programming languages we are familiar with. It provides a higher-level abstraction to create and manage AWS resources, making it easier to deploy and maintain complex architectures.

This article will show you how to use AWS CDK along with AWS Single Sign-On (SSO) to deploy services (e.g. API Gateway, Lambda functions, Lambda layers, and S3 buckets) with real-life examples.

## Prerequisites

Before getting started, make sure you meet the following requirements:

- An AWS account that has sufficient permissions to create & manage resources.
- AWS CDK and AWS CLI installed and configured on your machine.
- AWS Single Sign-On (SSO) set up with the appropriate users, groups, and permissions.

## Real-Life Example: Deploying API Gateway, Lambda, Lambda Layer, and S3

Let's say you want to create an API Gateway that invokes a Lambda function using a Lambda layer to have shared code. The Lambda function should read data from an S3 bucket and return a response.

### Step 1: Set Up the Project

First, create a new directory for your CDK project and navigate to it:

```bash
mkdir my-cdk-project
cd my-cdk-project
```

Initialize a new CDK project like this:

```bash
cdk init --language typescript
```

### Step 2: Install Required Dependencies

Now install the necessary dependencies for our project:

```bash
npm install aws-cdk-lib @aws-cdk/aws-apigateway @aws-cdk/aws-lambda @aws-cdk/aws-lambda-layer-awscli @aws-cdk/aws-s3 @aws-cdk/aws-ssm
```

### Step 3: Define the CDK Stack

Please create a new file (`MyStack.ts`) and add the following code:

```typescript
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";

export class MyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, "MyBucket");

    // Create a Lambda layer from local code
    const layer = new lambda.LayerVersion(this, "MyLayer", {
      code: lambda.Code.fromAsset("path/to/layer/code"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
    });

    // Create a Lambda function
    const fn = new lambda.Function(this, "MyFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("path/to/function/code"),
      layers: [layer],
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    // Grant read permissions to the Lambda function
    bucket.grantRead(fn);

    // Create an API Gateway REST API
    const api = new apigateway.RestApi(this, "MyAPI");

    // Create an integration between API Gateway and Lambda

    const integration = new apigateway.LambdaIntegration(fn);

    // Create a resource and add the integration to a default method
    api.root.addMethod("GET", integration);
  }
}
```

Make sure to replace `'path/to/layer/code'` and `'path/to/function/code'` with the actual paths of your Lambda layer and function code.

<details>
  <summary>Explain the code</summary>

The code you provided is an example of a CDK stack which deploys various AWS resources using AWS CDK. Let's go through the code and explain what each part does:

```typescript
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
```

These import statements bring in the necessary CDK constructs from the `aws-cdk-lib` library to create the AWS resources. In this case, we are importing constructs for API Gateway, Lambda, and S3.

```typescript
export class MyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
```

This code defines a new class `MyStack` that extends `cdk.Stack`, which is a core construct in the CDK representing a stack. The constructor function is called when instance of this class is created. It takes parameters `scope`, `id`, and `props`.

```typescript
// Create an S3 bucket
const bucket = new s3.Bucket(this, "MyBucket");
```

This creates a new S3 bucket named 'MyBucket' using the `s3.Bucket` construct. The `this` keyword points to the current stack instance.

```typescript
// Create a Lambda layer from local code
const layer = new lambda.LayerVersion(this, "MyLayer", {
  code: lambda.Code.fromAsset("path/to/layer/code"),
  compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
});
```

This creates a Lambda layer named 'MyLayer' using the `lambda.LayerVersion` construct. The layer is created from the code in the project specified by the `code` property. The `compatibleRuntimes` property specifies the runtime compatibility. (in this case, Node.js 14.x)

```typescript
// Create a Lambda function
const fn = new lambda.Function(this, "MyFunction", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("path/to/function/code"),
  layers: [layer],
  environment: {
    BUCKET_NAME: bucket.bucketName,
  },
});
```

This creates a Lambda function named 'MyFunction' using the `lambda.Function` construct. The function is running with the Node.js 14.x runtime and the specified `handler` function. The function code is taken from the local directory pointed by the `code` property. The `layers` property specifies that the previously created layer should be included in the function. The `environment` property sets an environment variable `BUCKET_NAME` which is the name of the S3 bucket.

```typescript
// Grant read permissions to the Lambda function
bucket.grantRead(fn);
```

This grants read permissions to the Lambda function on the S3 bucket(allowing it to access objects in the bucket).

```typescript
// Create an API Gateway REST API
const api = new apigateway.RestApi(this, "MyAPI");
```

This creates a new API Gateway REST API with the `apigateway.RestApi` construct. The API is configured with the current stack and named 'MyAPI'.

```typescript
// Create an integration between API Gateway and Lambda
const integration = new apigateway.LambdaIntegration(fn);
```

This creates an integration between the API Gateway and the previously created Lambda function using the `apigateway.LambdaIntegration` construct. It specifies that the Lambda function `fn` should be invoked when the API Gateway receives requests.

```typescript
// Create a resource and add the integration to a default method
api.root.addMethod("GET", integration);
```

This creates a new resource at the root of the API Gateway and adds a default `GET` method to it. The method is integrated with the Lambda function `fn`. When a `GET` request is made to the API, it will invoke the Lambda function.

---

When using AWS CDK, IAM policies are automatically assigned based on the resources created and the permissions needed by those resources.

e.g.

- When creating an S3 bucket with the `s3.Bucket` construct, the CDK automatically assigns the necessary permissions to the IAM role associated with the Lambda function. In our case, the `bucket.grantRead(fn)` line grants read permissions to the Lambda function `fn`, allowing it to access objects in the bucket.

- In the similar way, when creating an API Gateway REST API using the `apigateway.RestApi` construct, the CDK assigns the required IAM policies to allow the API Gateway to invoke the associated Lambda function. The integration created between the API Gateway and Lambda function handles the necessary permissions behind the scenes.

CDK makes the process of managing IAM policies easier by inferring the required permissions based on the resource dependencies and configuration. It automatically generates the IAM policies needed for the resources in the CDK stack that ensures the appropriate access is granted and reduces the manual IAM policy management.

</details>

### Step 4: Deploy the Stack

Now, Let's deploy our stack to AWS. Make sure you are logged in with the appropriate AWS SSO profile by running the following command:

```bash
aws configure sso --profile <your-profile-name>
```

Then we can build and deploy the CDK stack by:

```bash
cdk deploy --profile <your-profile-name>
```

The CDK will create the necessary resources in your AWS account, including the API Gateway, Lambda function, Lambda layer, and S3 bucket. (fingers crossed!)

### Step 5: Test the API

Once the deployment is complete, you can find the API Gateway URL in the CDK stack output. Use a tool like cURL or Postman (or Bruno, I am a big fan of you) to send a `GET` request to the API and retrieve the response.

Did you get the response? we have successfully deployed services using AWS CDK and AWS SSO. 🎉 heck yeah!

Cheers! 🍺
