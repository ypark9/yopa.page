---
title: "AgentCore Identity, 이제 공유 시크릿 없이"
date: 2026-07-30T09:00:00-04:00
author: Yoonsoo Park
description: "AgentCore Identity가 이제 Private Key JWT client authentication을 지원한다. 같은 에이전트, 같은 목표인데 공유 client secret이 사라지고 private key는 KMS 밖으로 나가지 않는다. 하나의 예시로 before/after, 세 가지 grant flow, 그리고 함정을 정리한다."
categories:
  - AWS
tags:
  - agentcore
  - identity
  - security
  - oauth
  - kms
  - bedrock
---

에이전트 하나를 딱 잡고 끝까지 그걸로 가보자.

고객지원 에이전트가 내부 orders API에서 고객의 주문내역을 읽어야 한다. 이 API는 우리 IdP(identity provider)로 보호돼 있다. 그래서 에이전트가 API를 부르기 전에 access token이 필요하고, 그 토큰을 받으려면 IdP한테 *자기가 누구인지* 증명해야 한다.

바로 그 마지막 단계, 에이전트가 IdP한테 신원을 어떻게 증명하느냐가 이 글의 전부다. 2026년 7월, AWS가 [Amazon Bedrock AgentCore Identity에 Private Key JWT client authentication을 추가](https://aws.amazon.com/blogs/machine-learning/authenticate-with-private-key-jwt-using-amazon-bedrock-agentcore-identity/)했는데, 이게 그 답을 꽤 의미 있게 바꾼다.

## AgentCore에서 Identity가 앉는 자리

에이전트가 보호된 downstream 리소스를 부를 때, 토큰을 하드코딩하지 않는다. AgentCore Identity한테 달라고 한다:

```
agent → GetResourceOauth2Token → (access token) → orders API
```

AgentCore Identity가 우리 IdP의 token endpoint로 가서 인증하고, access token을 받아다가 에이전트한테 건네주는 조각이다. 그러면 에이전트가 그 토큰으로 orders API를 불러 주문내역을 읽는다.

재밌는 질문은 "인증하고" 안에 숨어 있다. IdP는 아무한테나 토큰을 내주지 않는다. client(여기선 에이전트를 대신하는 AgentCore Identity)가 먼저 자기 자신을 인증해야 한다. 그 방법이 두 가지 있고, 예전 방식에서 새 방식으로 넘어가는 게 이 글의 핵심이다.

## 예전: 공유 client secret

고전적인 OAuth 2.0 client-credentials 셋업은 공유 시크릿을 쓴다. 에이전트를 IdP에 client로 등록하면 `client_id`와 `client_secret`을 받고, 그 secret을 우리 쪽에 저장한다. AgentCore Identity가 토큰을 요청할 때 둘 다 보낸다:

```
POST /token
grant_type=client_credentials
client_id=support-agent
client_secret=SUPER_SECRET_VALUE   ← 공유되는 문자열
```

동작은 한다. 근데 이제 뭘 떠안게 됐는지 보자. 우리 쪽 어딘가(Secrets Manager, 환경변수, config store)에 상주해야 하는 수명 긴 secret, 양쪽이 똑같은 사본을 들고 있는 secret, 그리고 그걸 읽는 사람 누구에게나 에이전트 완전 사칭 권한을 주는 secret이다. 그래서 secret 수명주기의 익숙한 잡일들을 전부 물려받는다:

- **어딘가 at rest로 앉아 있다.** 이제 그걸 보호하고 감사해야 한다.
- **로테이션이 수동이고 양측 동시다.** IdP에서 돌리고, 우리 store를 업데이트하고, 그 사이 틈에 아무 호출도 안 오길 빈다.
- **유출 = 신원 도용.** 그 문자열을 가진 사람은 우리 에이전트로 토큰을 발급할 수 있고, 요청만 봐서는 그 사람과 우리를 구분할 방법이 없다.
- **스케일이 안 된다.** 에이전트나 integration이 하나 늘 때마다 저장하고 로테이션하고 걱정할 secret이 하나씩 는다.

근본 문제는 신뢰 모델이다. 공유 시크릿은 *대칭*이다. 양쪽이 같은 문자열을 들고 있으니, 소유가 곧 신원이다. IdP는 "진짜 에이전트"와 "문자열을 복사해간 누군가"를 구별하지 못한다.

## 지금: Private Key JWT

Private Key JWT은 대칭 시크릿을 *비대칭* 서명으로 갈아끼운다. 키페어를 만들고, IdP에는 **공개키**만 등록하고, **개인키**는 AWS KMS 안에 둔다. 개인키는 거기서 절대 안 나온다.

이제 에이전트가 토큰이 필요하면:

1. 에이전트가 AgentCore Identity의 `GetResourceOauth2Token`을 부른다.
2. AgentCore Identity가 credential provider 설정(client ID, KMS key ARN, signing algorithm)을 읽어 수명 짧은 JWT client assertion을 만들고, 우리 KMS 키에 `kms:Sign`을 건다.
3. KMS가 assertion에 서명해 서명값을 돌려준다. **개인키는 KMS를 벗어나지 않는다.**
4. AgentCore Identity가 서명된 assertion을 `grant_type=client_credentials`와 `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`로 IdP token endpoint에 POST한다.
5. IdP가 등록된 공개키로 서명을 검증하고 access token을 돌려준다.
6. AgentCore Identity가 토큰을 에이전트한테 넘기고, 에이전트는 orders API를 불러 주문내역을 읽는다.

같은 에이전트, 같은 orders API, 같은 결과. 바뀐 건 중간이다. secret 문자열을 실어 보내는 대신, client가 뭔가에 서명해서 신원을 증명한다. 쓸 수는 있지만 끄집어낼 수는 없는 키로.

credential provider 설정을 보면 이 전환이 그대로 드러난다. 예전엔 민감한 재료가 곧 설정 자체였다:

```
client_id:     support-agent
client_secret: SUPER_SECRET_VALUE     ← 우리가 지켜야 하는 그것
```

지금은 설정이 키를 *가리키기만* 하고, 비밀 부분은 IAM 정책 아래 KMS 안에 산다:

```
client_id:      support-agent
kms_key_arn:    arn:aws:kms:us-east-1:111122223333:key/....
signing_alg:    ES256                 ← secret이 안 보인다
```

앞에서 나열한 잡일 목록을 그대로 다시 훑으면 대부분 증발한다:

- **우리 쪽에 민감한 게 at rest로 안 남는다.** 개인키는 KMS 안이고, 우리는 ARN만 저장한다.
- **로테이션이 한쪽에서 깔끔하게 끝난다.** 키를 돌리고, 새 공개키를 등록하고, 옛것을 은퇴시킨다. 개인 재료를 어디로도 복사할 필요가 없다.
- **설정이 유출돼도 신원 유출이 아니다.** ARN은 그 키에 대한 `kms:Sign` 권한 없이는 쓸모없다.
- **에이전트별 키까지 잘게 내려간다.** 키마다 정책, 키마다 감사 흔적.

## 어떤 grant flow? 내 케이스에 매핑하기

Private Key JWT은 *client*를 인증한다. 이건 결과로 나오는 토큰이 *누구의* 신원을 대표하느냐와는 별개다. AgentCore Identity는 세 가지 grant flow를 지원하는데, 고르는 건 결국 에이전트가 누구로서 행동하느냐의 문제다:

- **Machine-to-machine (M2M)**: 에이전트가 *자기 자신*으로 행동. 사람이 안 낀다. 누가 트리거하든 어떤 지원 에이전트나 그 데이터를 읽을 수 있다. `client_credentials` grant를 쓰고, 토큰의 subject는 client 자신이다. **우리 예시가 여기 해당한다.** 주문내역 읽기는 특정 로그인 유저에 묶인 게 아니라 서비스 레벨 조회다.

- **On-behalf-of (OBO)**: 에이전트가 *특정 유저를 대신해* 그 유저의 기존 토큰으로 행동. 유저가 이미 어딘가 로그인했고, 그 권한과 신원을 downstream 호출까지 그대로 끌고 가고 싶을 때다. AgentCore Identity가 들어온 유저 토큰을 downstream 토큰으로 교환(RFC 8693 token exchange 또는 RFC 7523 JWT authorization grant)하면서, 자기 자신은 여전히 client assertion으로 인증한다.

- **User-delegated access**: 에이전트가 유저를 대신하지만 기존 토큰이 없어서, 유저가 인터랙티브 로그인/consent(3-legged authorization-code flow)를 거쳐 에이전트가 뭘 할 수 있는지 먼저 승인한다.

우리 지원 에이전트가 *고객으로서* 고객 본인 권한으로 데이터를 읽어야 했다면 OBO로 갔을 거다. 서비스 레벨로 읽으니 M2M이 맞다. Private Key JWT은 셋 다 밑에서 똑같이 동작한다.

## 내가 지켜볼 함정들

**signing algorithm은 3자 합의다.** IdP가 Private Key JWT에 요구하는 알고리즘을 AWS KMS도 지원하고 *그리고* AgentCore Identity도 지원하고 *그리고* 우리가 설정한 것과 일치해야 한다. 선택지는 RS256, PS256, ES256이고 KMS key spec도 여기 맞아야 한다(AWS 예시는 `ECC_NIST_P256` + `ES256`). 알고리즘을 먼저 정하고, 그걸 지원하는 spec의 KMS 키를 만들어라. 이게 어긋나면 키 생성 시점이 아니라 token endpoint에서 헷갈리는 검증 실패로 터진다.

**`kms:ViaService`로 키를 AgentCore에 묶어라.** KMS key policy에서 `kms:Sign`을 주되, `bedrock-agentcore-identity.<region>.amazonaws.com`으로 스코프한 `kms:ViaService` 조건으로 제한해라. 그러면 요청이 AgentCore Identity를 경유할 때만 서명에 쓸 수 있고, 우연히 `kms:Sign`을 들고 있는 다른 무엇도 못 쓴다. "이 키가 존재한다"와 "이 키는 내가 만든 그 한 가지 일만 할 수 있다"의 차이다.

**키 재료를 누가 소유할지 정해라.** 두 갈래다. KMS에서 키페어를 만들고 공개키를 IdP로 export(`kms:GetPublicKey`)하거나, IdP가 페어를 생성하게 하고 개인 재료를 KMS로 import(`kms:GetParametersForImport` + `kms:ImportKeyMaterial`)한다. 첫 번째가 개인키를 KMS-born으로 두고 export 불가로 유지하니 더 강한 자세다. IdP가 두 번째를 강제하지 않는 한 첫 번째를 택해라.

**CloudTrail로 서명 호출을 감사해라.** credential provider가 거는 모든 `kms:Sign`이 CloudTrail에 남는다. 에이전트를 위한 토큰이 언제, 누구 요청으로 발급됐는지 기록이 생긴다는 뜻이다. 공유 시크릿이 절대 못 주던 가시성이 바로 이거다(secret이 유출돼 딴 데서 재사용돼도 우리 쪽엔 아무 흔적이 안 남는다).

## 그래서 뭘 해야 하나

공유 client secret을 아직 쓰는 credential provider가 있으면 마이그레이션 목록에 올려라. 손이 가는 건 소박하고(KMS 키 하나, 공개키 등록, 설정 변경), 얻는 건 수명 긴 secret 하나를 공격면에서 지우는 거다.

신규는 처음부터 Private Key JWT으로 시작해라. 2026년에 client가 서명으로 자기를 증명하고 개인키를 아예 안 들 수 있는데, 굳이 새 공유 시크릿을 들일 이유가 별로 없다. 신뢰 모델이 "우리 둘 다 비밀번호를 안다"에서 "나는 서명할 수 있지만 그 방법은 너한테 못 알려준다"로 조용히 옮겨갔다. 네 에이전트를 돌릴 때 원하는 건 후자 쪽이다.
