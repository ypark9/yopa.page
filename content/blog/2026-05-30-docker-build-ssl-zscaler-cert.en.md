---
title: "Docker Build SSL Failures Behind a Corporate MITM Proxy: Two Patterns"
date: 2026-05-30T12:30:00-04:00
author: Yoonsoo Park
description: "If your laptop sits behind Zscaler (or any TLS-intercepting proxy) and your Docker builds keep failing on `pip install` with cert verification errors, here are the two injection patterns I use — one for custom images, one for Lambda bundling — and the gotchas that bit me on each."
categories:
  - AWS
  - Docker
tags:
  - docker
  - zscaler
  - cdk
  - lambda
  - ssl
---

If you work somewhere with Zscaler or Netskope, Cisco Umbrella, ... any "secure web gateway" that does TLS interception; you have probably seen this during a `docker build`:

```
ERROR: Could not install packages due to an OSError:
HTTPSConnectionPool(host='files.pythonhosted.org', port=443):
Max retries exceeded with url: .../something-1.9.0-py3-none-any.whl.metadata
(Caused by SSLError(SSLCertVerificationError(1,
'[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed:
unable to get local issuer certificate (_ssl.c:1032)')))
```

Your host laptop is fine — macOS Keychain trusts the proxy's root CA. The Docker container is not, because it's a fresh Linux filesystem with only the public CA bundle. The proxy intercepts the TLS handshake to PyPI, presents its own cert, and the container has no idea who signed it.

The fix is the same idea in both directions: **get the proxy's root CA into the container's trust store before the package manager runs**. The how-to differs depending on whether you control the Dockerfile or not.

## Pattern 1 — You control the Dockerfile (custom images, `DockerImageAsset`)

This is the easy case. Add an early `RUN` block that takes a base64-encoded cert as a build arg and installs it.

```dockerfile
ARG ZSCALER_CERT_BASE64
RUN if [ -n "$ZSCALER_CERT_BASE64" ]; then \
    echo "$ZSCALER_CERT_BASE64" | base64 -d > /usr/local/share/ca-certificates/zscaler.crt && \
    update-ca-certificates; \
    fi
```

Two things matter here:
- **Position**: this block must come *before* any `pip install`, `apt-get update` (over HTTPS), `npm install`, etc. Anything that hits the internet needs the trust store updated first.
- **It's gated on the build arg.** When the build arg is empty (CI/CD, where there is no proxy), the block is a no-op. You don't want to ship a Zscaler cert to production.

On the build orchestrator side (CDK in my case), pull the cert from Keychain at synth time:

```typescript
import { execSync } from 'child_process';

function getZscalerCertBase64(): string {
  const pem = execSync(
    'security find-certificate -a -c "Zscaler" -p /Library/Keychains/System.keychain',
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  if (!pem || pem.trim().length === 0) {
    throw new Error('No Zscaler cert in System Keychain');
  }
  return Buffer.from(pem).toString('base64');
}

const buildArgs: Record<string, string> = {};
if (devMode) {
  buildArgs.ZSCALER_CERT_BASE64 = getZscalerCertBase64();
}

new DockerImageAsset(this, 'ImageAsset', { directory: srcDir, buildArgs });
```

`security find-certificate -a -c "Zscaler" -p` returns one or more PEM blocks concatenated. Base64-encode the whole blob; on the container side, `update-ca-certificates` happily handles a multi-cert PEM bundle.

That's it for images you own.

## Pattern 2 — You don't control the Dockerfile (`PythonFunction`, `PythonLayerVersion`)

This is the case that took me a few hours to figure out. AWS CDK's `@aws-cdk/aws-lambda-python-alpha` (`PythonFunction`, `PythonLayerVersion`) bundles your Lambda code by spinning up `public.ecr.aws/sam/build-python3.13` (or whichever runtime) and running `pip install` *inside that container*. You don't write that Dockerfile. So Pattern 1 doesn't help.

The fix: pre-bake a custom bundling image with the Zscaler cert already installed, push it to ECR, and tell CDK to use that image instead of the default SAM one.

### The custom bundling Dockerfile

```dockerfile
ARG IMAGE=public.ecr.aws/sam/build-python3.13
FROM $IMAGE

ARG ZSCALER_CERT_BASE64=""

ENV PIP_CACHE_DIR=/tmp/pip-cache
ENV POETRY_CACHE_DIR=/tmp/poetry-cache
ENV UV_CACHE_DIR=/tmp/uv-cache
ENV PATH="/usr/app/venv/bin:$PATH"

USER root

RUN if [ -n "$ZSCALER_CERT_BASE64" ]; then \
      echo "$ZSCALER_CERT_BASE64" | base64 -d > /etc/pki/ca-trust/source/anchors/zscaler.crt && \
      update-ca-trust extract; \
    fi

ENV REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
ENV SSL_CERT_FILE=/etc/pki/tls/certs/ca-bundle.crt
ENV UV_NATIVE_TLS=true

RUN python -m venv /usr/app/venv && \
    mkdir -p /tmp/pip-cache /tmp/poetry-cache /tmp/uv-cache && \
    chmod -R 777 /tmp/pip-cache /tmp/poetry-cache /tmp/uv-cache && \
    pip install --upgrade pip && \
    pip install pipenv poetry uv && \
    rm -rf /tmp/pip-cache/* /tmp/poetry-cache/* /tmp/uv-cache/*

USER nobody
CMD [ "python" ]
```

Build it once, push to ECR:

```bash
aws ecr create-repository --repository-name python-bundling --region us-east-1 || true

ZSCALER_CERT_BASE64=$(security find-certificate -a -c "Zscaler" -p /Library/Keychains/System.keychain | base64)

docker build \
  --build-arg ZSCALER_CERT_BASE64="$ZSCALER_CERT_BASE64" \
  -t "$ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/python-bundling:3.13" \
  scripts/build/python-bundling

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.us-east-1.amazonaws.com"

docker push "$ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/python-bundling:3.13"
```

Then in CDK, swap the bundling image only in dev mode:

```typescript
import { DockerImage } from 'aws-cdk-lib';

function getBundlingImage(account: string, region: string, devMode: boolean) {
  if (!devMode) return undefined; // CI/CD uses the default SAM image
  return DockerImage.fromRegistry(
    `${account}.dkr.ecr.${region}.amazonaws.com/python-bundling:3.13`
  );
}

const image = getBundlingImage(account, region, devMode);

new PythonLayerVersion(this, 'Layer', {
  entry: path.join(__dirname, '..', 'layers', 'shared'),
  compatibleRuntimes: [Runtime.PYTHON_3_13],
  ...(image && { bundling: { image } }),
});

new PythonFunction(this, 'Fn', {
  entry: path.join(__dirname, '..', 'functions', 'create_chat'),
  runtime: Runtime.PYTHON_3_13,
  ...(image && { bundling: { image } }),
});
```

Once the image is in ECR, every project in that account can reuse it. No more rebuilding per project.

## Pitfalls I actually hit

- **Wrong cert path for the base distro.** SAM build images are Amazon Linux. The trust store path is `/etc/pki/ca-trust/source/anchors/` and the update command is `update-ca-trust extract`. If you copy a Debian/Ubuntu snippet (`/usr/local/share/ca-certificates/` + `update-ca-certificates`), the cert is silently ignored and you keep getting the same SSL error wondering why your "fix" didn't take.
- **`chmod 755` on pip cache dirs.** CDK runs the bundling container as a non-root user (typically `503:20`). With `chmod 755` on `/tmp/pip-cache`, the rsync step at the end of bundling fails with exit code 23 because the non-root user can't write. `chmod 777` on cache dirs is annoying but necessary inside throwaway bundling images.
- **`uv` ignoring the system trust store.** `uv` ships its own TLS implementation by default. Setting `UV_NATIVE_TLS=true` makes it fall back to OpenSSL's CA store, which is where `update-ca-trust` puts your cert. Without this env var, your cert is in the right place and `uv` still doesn't see it.
- **CI/CD doesn't have the proxy.** Both patterns are gated on `devMode`. CodePipeline, GitHub Actions runners, etc. talk to PyPI directly; injecting a stale Zscaler cert there is at best wasted bytes and at worst a footgun if the cert ever expires. Always make the injection conditional.
- **`security find-certificate` is macOS-only.** Linux dev hosts behind the same proxy need a different extraction (`/etc/ssl/certs/...` or whatever your IT pushes). The CDK code should detect host OS and either extract differently or skip injection entirely.
- **Multiple Zscaler certs in Keychain.** `security find-certificate -a -c "Zscaler" -p` concatenates every match. That's fine — `update-ca-trust` and `update-ca-certificates` both accept multi-cert PEM bundles. Don't try to filter to "just one".

## What to do

If you're hitting this for the first time and it's a custom image you wrote, use Pattern 1 — five lines of Dockerfile and a build arg. If it's `PythonFunction`/`PythonLayerVersion` (or any CDK construct that picks its own bundling image), bite the bullet, build the custom bundling image once, push to ECR, and gate it behind a `devMode` check.

The 10 minutes you spend setting up Pattern 2 saves you from the next three hours of "but I added the cert, why is `pip` still failing?" — because `pip` is running in a container you didn't write, and you can't add the cert without owning that container.
