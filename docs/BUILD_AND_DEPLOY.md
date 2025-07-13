# How to Build and Deploy `yopa.page`

This document outlines the complete process for creating content, running the local development server, and deploying this Hugo-based blog to AWS.

## Prerequisites

Before you begin, ensure you have the following tools installed:

- **Hugo**: The static site generator.
- **Terraform**: For managing AWS infrastructure.
- **AWS CLI**: For interacting with AWS services.
- **Make**: To run the helper commands in the `makefile`.
- The following image optimization tools: `exiftool`, `jpegoptim`, `optipng`, `mogrify`, `cwebp`.

You must also have your AWS credentials configured locally for Terraform and the AWS CLI to use.

## 1. Content Creation

To create a new blog post, use the Hugo CLI:

```bash
hugo new blog/YYYY-MM-DD-your-post-title.md
```

This will create a new markdown file in the `content/blog/` directory with the basic front matter. You can then edit this file to add your content.

## 2. Local Development

To preview your changes, you can run a local development server. The `makefile` provides a convenient command for this:

```bash
make serve
```

This will start the Hugo development server, and you can view your site at `http://localhost:1313`. The server will automatically reload when you make changes to your content or theme files.

## 3. The Deployment Pipeline

The deployment process is managed by Terraform and orchestrated with `make`. It involves building the static site, uploading it to S3, and invalidating the CloudFront cache.

### AWS Infrastructure Overview

The infrastructure is defined in the `terraform/` directory and consists of the following core components:

- **S3 Bucket**: A private S3 bucket is used to store the static files of the website. It is not publicly accessible directly.
- **CloudFront Distribution**: A CloudFront distribution acts as the CDN, serving content from the S3 bucket. It handles HTTPS termination using an ACM certificate and improves performance by caching content at edge locations.
- **CloudFront OAI (Origin Access Identity)**: This allows CloudFront to securely access the files in the private S3 bucket.

This setup ensures that the website is served securely and efficiently.

### Deployment Commands

The `makefile` provides a set of commands to manage the deployment:

1.  **`make build`**: This command runs `hugo` to generate the static site into the `public/` directory.
2.  **`make optimize`**: This performs several image optimization tasks, including stripping EXIF data and creating `.webp` versions of images.
3.  **`make deploy`**: This is the main deployment command. It's a wrapper that executes the following Terraform commands in sequence:
    - `terraform init`: Initializes the Terraform backend.
    - `terraform validate`: Validates the Terraform configuration.
    - `terraform plan`: Creates an execution plan.
    - `terraform apply -auto-approve`: Applies the plan to create or update the AWS resources. This step also uploads the files from the `public/` directory to S3.
4.  **`make invalidate`**: After a deployment, the CloudFront cache needs to be invalidated to ensure the latest changes are served. This command gets the CloudFront distribution ID from the Terraform output and creates a new invalidation for all paths (`/*`).

### Full Deployment Workflow

A typical workflow for deploying changes would be:

```bash
# 1. Build the static site
make build

# 2. Optimize images (optional, but recommended)
make optimize

# 3. Deploy the changes to AWS
make deploy

# 4. Invalidate the CloudFront cache
make invalidate
```

A convenience target `all` is available to run all four steps in sequence:

```bash
make all
```

This command should be run from the root of the project. You can also specify the environment (e.g., `dev` or `prod`), though `prod` is the default. For example, to deploy to the `dev` environment:

```bash
make all ENV=dev
```
