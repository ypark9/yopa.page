---
title: "Lambda Version과 Alias로 Alexa Skill을 안전하게 배포하는 법"
date: 2026-08-29
author: Yoonsoo Park
description: "Alexa Skill을 AWS Lambda에 배포할 때 immutable version, beta와 production alias, 작은 canary, alias pointer rollback, GitHub Actions OIDC를 사용하는 초보자용 배포 패턴."
categories:
  - AWS
  - DevOps
tags:
  - Alexa Skills Kit
  - AWS Lambda
  - GitHub Actions
  - Infrastructure as Code
  - DevOps
---

AWS Lambda의 기본 흐름은 code를 올리고 `$LATEST`를 호출하는 것이다. prototype에는 괜찮다. 그러나 live Alexa Skill의 rollback 방식으로는 좋지 않다. 새 음성 흐름에 문제가 생겼을 때 `$LATEST`는 사용자가 정확히 어떤 code를 받았는지 알려주지 않고, rollback은 과거 ZIP을 급히 다시 만드는 일이 된다.

Lambda version과 alias는 이 문제를 작은 pointer 변경으로 바꾼다. 이 글에서는 Development endpoint는 beta alias, customer endpoint는 production alias, 그 아래에는 immutable version을 두는 배포 구조를 설명한다. traffic이 충분할 때만 작은 canary를 사용한다.

## 먼저 알아야 할 Lambda 이름 네 가지

| 이름 | 의미 | 바꿀 수 있는가? |
| --- | --- | --- |
| Function | code와 configuration을 담는 container | 예 |
| `$LATEST` | publish 전에 업데이트하는 작업 copy | 예 |
| Published version | `12`처럼 code와 configuration을 고정한 snapshot | 아니오 |
| Alias | `beta`, `prod`처럼 published version을 가리키는 이름 | 예 |

가장 중요한 규칙은 alias가 `$LATEST`가 아니라 **published version**을 가리켜야 한다는 것이다. AWS의 [weighted alias routing 문서](https://docs.aws.amazon.com/lambda/latest/dg/configuring-alias-routing.html)도 이를 명시한다. immutable 경계가 있기 때문에 rollback할 때 확실한 목적지가 생긴다.

```text
Alexa Development endpoint ---> trivia-quiz-time:beta ---> version 12

Alexa Production endpoint ----> trivia-quiz-time:prod ---> version 11
                                                        \-> version 12 (10% canary)
```

Alexa Developer Console에는 endpoint ARN을 넣기 때문에 Development와 Production에 서로 다른 qualified alias ARN을 사용할 수 있다. Lambda permission은 의도한 skill ID로 제한하고 request-handling layer에서도 확인한다. Amazon도 [request-handling 문서](https://developer.amazon.com/en-US/docs/alexa/custom-skills/handle-requests-sent-by-alexa.html)에서 request가 실제 내 skill을 위한 것인지 검증하라고 권한다.

## Customer traffic을 움직이기 전 release를 만든다

중요한 것은 IaC 도구보다 순서다. OpenTofu, CloudFormation, CDK, review된 console 작업 모두 같은 안전한 흐름을 만들 수 있다.

1. staging directory에서 clean artifact를 만든다.
2. function의 working configuration과 code를 업데이트한다.
3. 새 immutable Lambda version을 publish한다.
4. `beta` alias를 그 version으로 옮긴다.
5. Alexa Development endpoint를 simulator와 실제 기기에서 테스트한다.
6. beta check가 끝난 뒤에만 `prod`를 바꾼다.

artifact는 보안 경계의 일부다. application bundle, bundling하지 않은 production dependency, content data, package metadata만 들어 있어야 한다. `.git`, CI workflow, source test, infrastructure state, local `.env`, developer credential은 들어가면 안 된다. forbidden path가 있으면 CI가 실패하도록 하면 source tree 전체를 ZIP으로 배포하는 실수를 막을 수 있다.

첫 migration에서는 기존 동작을 clean package로 version 1에 만들고, modern code를 version 2에 올리는 것이 좋다. 그러면 첫 production rollback도 같은 pipeline으로 만든 known-good destination을 갖는다.

## beta는 branch 이름이 아니라 실제 endpoint여야 한다

`beta` alias는 Alexa **Development** version에 설정한 endpoint여야 한다.

```text
commit -> tested artifact -> published Lambda version -> beta alias
       -> Alexa Development endpoint -> simulator / developer device
```

이 경로는 Lambda invocation 하나보다 더 많은 것을 검증한다. build하지 않은 interaction model, 잘못된 endpoint ARN, Alexa permission 누락, 실제 기기에서 어색한 음성 응답까지 잡는다.

`prod`는 Alexa **Live** version에만 설정한다. production skill endpoint가 `$LATEST`를 가리키게 하지 않는다. development alias 변경이 published interaction model을 바꿔 줄 것이라고 기대하지도 않는다. Lambda deploy와 Alexa publishing은 별개다. Alexa 쪽 version 경계는 [Alexa Skill이 Certified인데 Live가 아닌 이유](/ko/blog/2026-08-29-alexa-skill-certified-but-not-live.html)에서 자세히 설명했다.

## Canary는 유용하지만 마법은 아니다

AWS alias 하나는 두 published version 사이에 traffic을 나눌 수 있다. 예를 들어 `prod`가 version 11에 90%, version 12에 10%를 보낼 수 있다.

```hcl
resource "aws_lambda_alias" "prod" {
  name             = "prod"
  function_name    = aws_lambda_function.skill.function_name
  function_version = aws_lambda_function.skill.version

  routing_config {
    additional_version_weights = {
      "12" = 0.10
    }
  }
}
```

이 snippet은 개념 설명용이다. production infrastructure에서는 version number를 hard-code하지 말고 deploy 결과에서 가져와야 한다. alias 하나에는 primary version이 하나 있고, 추가 weighted version은 최대 하나다. 두 version은 published 상태여야 하고 실행 설정도 호환돼야 한다.

AWS는 이것이 확률적 분배임을 설명하며 traffic이 적으면 설정한 비율과 실제 비율의 차이가 클 수 있다고 경고한다. invocation이 열 번일 때 10% canary는 의미 있는 증거가 아니다. 우연히 새 version에 0번 또는 여러 번 갈 수 있다. promotion 전에는 시간 window와 최소 새-version invocation 수를 함께 쓴다.

개인용 skill이라면 다음 rollout이 현실적이다.

| Gate | `prod` route | 확인할 것 |
| --- | --- | --- |
| Beta | `beta`로 새 version 100% | contract fixture, simulator, 실제 기기, 핵심 smoke path |
| Canary | 이전 90% / 새 버전 10% | 새 version invocation 수, error, throttle, latency |
| Midpoint | 이전 50% / 새 버전 50% | 같은 metric을 다음 관찰 window에서 확인 |
| Promote | 새 version 100% | 계속 관찰하고 이전 version은 rollback baseline으로 보존 |

mode를 막는 bug나 미리 정한 health threshold 실패가 보이면 `prod`를 이전 published version으로 돌린다. 이것이 rebuild가 아닌 rollback이다.

## 실제 실행된 version을 관찰한다

log와 metric은 어떤 immutable version이 request를 처리했는지 알려줘야 한다. Lambda는 invocation logging에 executed version을 남기며, `ExecutedVersion` metric dimension으로 weighted alias 뒤의 version을 구분할 수 있다. 이 observability를 위해 user ID, utterance, session attribute, 질문 전체를 log로 남길 필요는 없다.

```json
{
  "event": "skill_request_complete",
  "requestType": "IntentRequest",
  "mode": "survival",
  "result": "answered",
  "durationMs": 84,
  "executedVersion": "12"
}
```

이 정도면 gameplay를 customer transcript로 만들지 않으면서 release의 집계 동작을 설명할 수 있다. error, throttle, duration, invocation count alarm도 함께 둔다. log retention은 명시적이고 제한된 기간으로 정한다.

## CI는 장기 AWS key 없이 배포한다

GitHub Actions는 AWS access key와 secret을 GitHub에 저장하지 않아도 OpenID Connect(OIDC)로 짧은 AWS credential을 받을 수 있다. deployment role trust policy는 한 repository, 예상한 branch나 GitHub Environment, `sts.amazonaws.com` audience로 좁힌다. GitHub의 [OIDC hardening 가이드](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)가 이 모델을 설명한다.

```text
pull request: lint + test + question validation + package inspection + tofu plan
manual beta dispatch: approved environment -> OIDC role -> publish version -> beta alias
manual production dispatch: approved environment -> OIDC role -> change prod alias
```

branch restriction만으로 review가 대체되지는 않지만, 아무 branch나 environment deployment role을 쓰는 일은 막는다. manual dispatch는 `main` merge가 자동 public release가 되지 않게 한다.

## Permission도 alias를 따라간다

Alexa가 qualified alias ARN을 호출한다면 Lambda resource policy도 그 qualifier에 permission을 줘야 한다. Alexa service principal과 의도한 skill ID로 제한한다. alias permission error를 고치겠다고 unqualified, account-wide invoke permission을 주면 안 된다.

execution role도 function에 필요한 권한만 준다. application log를 쓰는 stateless trivia game이라면 자기 log group에 stream을 만들고 event를 쓰는 CloudWatch Logs action이면 충분할 수 있다. deployment role이 다른 권한을 가진다고 해서 table, bucket, broad IAM access가 필요해지는 것은 아니다.

## Release마다 남길 기록

각 rollout 뒤에는 민감정보 없는 짧은 기록을 남긴다.

- commit SHA와 artifact hash
- published Lambda version number
- beta와 production alias target 및 weight
- Development와 Live endpoint alias
- smoke-test case와 결과
- 관찰 window와 집계 health 결과
- 정확한 rollback target

한 번 build하고, immutable하게 publish하고, `beta`로 테스트한 뒤, `prod`를 `$LATEST`의 복사본이 아니라 되돌릴 수 있는 pointer로 두면 다음 production 변경이 예측 가능해진다.
