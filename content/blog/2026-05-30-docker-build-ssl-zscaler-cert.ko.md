---
title: "사내 MITM 프록시 뒤에서 Docker build SSL 에러 잡기 — 두 가지 패턴"
date: 2026-05-30T12:30:00-04:00
author: Yoonsoo Park
description: "Zscaler(혹은 비슷한 TLS intercepting proxy) 환경에서 Docker build 중 `pip install`이 cert verification 에러로 멈춘다면, 내가 쓰는 두 가지 주입 패턴 — 직접 만든 이미지용과 Lambda 번들링용 — 그리고 둘 다에서 한 번씩 밟은 gotcha."
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

회사 네트워크가 Zscaler — 또는 Netskope, Cisco Umbrella, 뭐든지 TLS interception 하는 "secure web gateway" — 뒤에 있다면, `docker build` 중 다음 에러를 본 적 있을 것이다:

```
ERROR: Could not install packages due to an OSError:
HTTPSConnectionPool(host='files.pythonhosted.org', port=443):
Max retries exceeded with url: .../something-1.9.0-py3-none-any.whl.metadata
(Caused by SSLError(SSLCertVerificationError(1,
'[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed:
unable to get local issuer certificate (_ssl.c:1032)')))
```

호스트 노트북에서는 작동 — macOS Keychain이 프록시 root CA를 신뢰하니까. 허나 컨테이너는 신뢰하지 않는다. 새로운 Linux filesystem에 public CA bundle만 들어있기때문. 프록시는 PyPI로 가는 TLS handshake를 가로채서 자기 cert를 들이미는데, 컨테이너는 이게 누가 서명한 건지 모른다.

해결책은 양쪽 다 같은 아이디어다: **패키지 매니저가 돌기 전에 프록시 root CA를 컨테이너 trust store에 설정**. 다만 Dockerfile을 누가 작성할 수 있나?에 따라 방법이 갈린다.

## Pattern 1 — Dockerfile을 내가 만들수 있는 경우 (custom image, `DockerImageAsset`)

쉬운 케이스. base64 인코딩된 cert를 build arg로 받아서 설치하는 `RUN` 블록을 미리 넣어 둔다.

```dockerfile
ARG ZSCALER_CERT_BASE64
RUN if [ -n "$ZSCALER_CERT_BASE64" ]; then \
    echo "$ZSCALER_CERT_BASE64" | base64 -d > /usr/local/share/ca-certificates/zscaler.crt && \
    update-ca-certificates; \
    fi
```

두 가지가 중요:
- **위치**. 이 블록은 `pip install`, `apt-get update`(HTTPS 거치는), `npm install` 등 설치 명령 *앞*에 와야 한다.
- **build arg로 게이팅한다**. arg가 비어 있으면 (CI/CD처럼 프록시가 없는 환경) 블록은 의미 없음. 프로덕션 이미지에 Zscaler cert를 굽는건 피하고 싶음.

빌드 오케스트레이터 쪽 (내 경우 CDK)에서는 synth 시점에 Keychain에서 cert를 뽑는다:

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

`security find-certificate -a -c "Zscaler" -p`는 PEM 블록 하나 또는 여러 개를 이어붙여서 출력한다. 통째로 base64 인코딩하고, 컨테이너 쪽 `update-ca-certificates`는 multi-cert PEM bundle을 잘 처리한다.

내가 쓴 이미지는 여기까지면 된다.

## Pattern 2 — Dockerfile을 못 쓰는 경우 (`PythonFunction`, `PythonLayerVersion`)

이게 처음에 몇 시간 헤맸던 케이스다. AWS CDK의 `@aws-cdk/aws-lambda-python-alpha`(`PythonFunction`, `PythonLayerVersion`)는 Lambda 코드를 번들링할 때 `public.ecr.aws/sam/build-python3.13` (또는 해당 런타임 이미지)을 띄워서 *그 안에서* `pip install`을 돌린다. 그 Dockerfile은 우리가 어쩔수 있는게 아님. Pattern 1이 안 통한다.

해결: Zscaler cert를 미리 박아둔 커스텀 번들링 이미지를 만들어 ECR에 푸시하고, CDK에 기본 SAM 이미지 대신 그걸 쓰라고 알려줌.

### 커스텀 번들링 Dockerfile

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

한 번 빌드해서 ECR에 푸시:

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

CDK 쪽에서는 devMode일 때만 번들링 이미지를 갈아끼운다: (고민해야될점: 여기서 dev build랑 QA, Production의 빌드 환경이 달라진다. 같은 환경을 유지하기 위해서는 codebuild쪽 변경도 필요할것)

```typescript
import { DockerImage } from 'aws-cdk-lib';

function getBundlingImage(account: string, region: string, devMode: boolean) {
  if (!devMode) return undefined; // CI/CD는 기본 SAM 이미지
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

이미지가 ECR에 한 번 올라가면, 같은 계정의 다른 프로젝트들도 그대로 가져다 쓸 수 있다. 프로젝트마다 다시 빌드할 필요 없음.

## 실제로 밟은 함정들

- **Base distro에 맞지 않는 cert 경로**. SAM 빌드 이미지는 Amazon Linux다. trust store 경로는 `/etc/pki/ca-trust/source/anchors/`이고 update 커맨드는 `update-ca-trust extract`. Debian/Ubuntu 스니펫(`/usr/local/share/ca-certificates/` + `update-ca-certificates`)을 그대로 복사하면 cert가 조용히 무시되고, "고쳤는데 왜 또 같은 SSL 에러야" 단계로 돌아간다.
- **pip cache 디렉토리에 `chmod 755`**. CDK는 번들링 컨테이너를 non-root user(보통 `503:20`)로 돌린다. `/tmp/pip-cache`가 755면 번들링 끝에 rsync가 exit code 23으로 죽는다 — non-root가 거기에 못 쓴다. 일회성 번들링 이미지 안에서는 cache 디렉토리 `chmod 777`이 짜증나도 필수.
- **`uv`가 시스템 trust store 무시**. `uv`는 기본적으로 자체 TLS 구현을 쓴다. `UV_NATIVE_TLS=true`를 박아야 OpenSSL CA store를 fallback으로 쓰는데, 거기가 바로 `update-ca-trust`가 cert를 넣는 곳이다. 이 env var 없으면 cert는 제자리에 있는데 `uv`만 못 본다.
- **CI/CD에는 프록시가 없다**. 두 패턴 다 `devMode` 게이팅. CodePipeline, GitHub Actions runner 등은 PyPI에 직접 붙으니까 거기에 stale Zscaler cert를 주입하면 잘해야 바이트 낭비, 못하면 cert 만료됐을 때 footgun. 주입은 항상 conditional로.
- **`security find-certificate`는 macOS 전용**. 같은 프록시 뒤에 있는 Linux dev host는 추출 방식이 다르다(`/etc/ssl/certs/...`나 IT가 푸시하는 경로). CDK 코드에서 host OS 감지하고 다르게 추출하거나 아예 주입 자체를 스킵해야 한다.
- **Keychain에 Zscaler cert가 여러 개**. `security find-certificate -a -c "Zscaler" -p`는 매칭되는 걸 전부 이어붙여 출력한다. 괜찮다 — `update-ca-trust`도 `update-ca-certificates`도 multi-cert PEM bundle 받는다. "하나만 골라야지" 같은 필터링 시도하지 말 것.

## 그래서 뭘 해야 하나

처음 이 문제 부딪혔는데 내가 쓴 custom image라면 Pattern 1 — Dockerfile 다섯 줄에 build arg 하나. `PythonFunction`/`PythonLayerVersion`(혹은 번들링 이미지를 알아서 골라 쓰는 CDK construct) 쪽이라면, 한 번 마음먹고 커스텀 번들링 이미지 만들어서 ECR에 푸시하고 `devMode` 체크로 분기하기.

Pattern 2 셋업하는 데 들이는 10분이, 다음에 만날 "cert 분명 추가했는데 왜 `pip`이 또 죽지" 세 시간을 살려준다 — 왜냐하면 그 `pip`은 우리 컨테이너가 아니라 CDK가 골라서 띄운 컨테이너 안에서 돌고 있고, 그 컨테이너를 변경하지 않으면 cert를 박을 방법이 없기 때문.
