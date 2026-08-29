---
title: "Alexa Skill이 Certified인데 Live가 아닌 이유와 publish 방법"
date: 2026-08-29
author: Yoonsoo Park
description: "Alexa Developer Console에서 Skill이 Certified인데 Echo에서는 예전 동작이 보일 때 확인할 것. Development·Certified·Live version의 차이, publish만 하면 되는 경우와 새 certification submission이 필요한 경우, endpoint 비교 방법을 설명한다."
categories:
  - Voice AI
  - Release Management
tags:
  - Alexa Skills Kit
  - Voice AI
  - Troubleshooting
  - Release Management
---

Alexa Developer Console에는 **Certified**라고 나오는데 Echo에서는 여전히 예전 skill처럼 동작한다면, 먼저 Lambda를 다시 배포하지 말자. 어떤 skill version이 인증됐는지, 그리고 Amazon이 그 snapshot의 publishing을 시작했는지를 먼저 확인해야 한다.

짧게 말하면 **Certified는 제출한 version이 심사를 통과했다는 뜻이고, Live는 한 version이 실제 사용자에게 publish됐다는 뜻이다. 둘은 연결되어 있지만 같은 상태가 아니다.** Amazon의 [submission 문서](https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html)도 development, certified, live version을 구분한다.

이 차이가 중요한 이유는, 어떤 snapshot이 심사 중이거나 이미 통과한 뒤에도 development version을 계속 수정할 수 있기 때문이다. development endpoint가 public skill보다 더 최신 Lambda code를 가리킬 수도 있다.

## 먼저 봐야 할 세 가지 version 상태

Developer Console을 하나의 mutable skill이 아니라 snapshot을 관리하는 도구로 생각하면 이해가 쉽다.

| 상태 | 의미 | 일반 사용자가 쓸 수 있는가? |
| --- | --- | --- |
| **Development / In Dev** | 수정 가능한 작업 버전. model, endpoint, store metadata를 바꿀 수 있다. | 아니다. owner와 development test용이다. |
| **Certified** | 제출한 snapshot이 Amazon certification을 통과했다. | 반드시 그렇지는 않다. manual publish를 기다릴 수 있다. |
| **Live** | publish된 snapshot이 지정한 marketplace의 사용자에게 제공된다. | 그렇다. 일반적인 store availability와 전파 시간은 별도다. |

skill을 publish하면 Amazon은 live version을 바탕으로 새 development version을 자동으로 만든다. 계속 개선할 수 있게 해 주는 좋은 동작이지만, Console에서 certified나 live snapshot 옆에 더 새로운 편집용 version이 나란히 보이므로 혼란의 원인이 된다. development code가 자동으로 customer에게 전달되는 것은 아니다.

## 첫 질문: submission 때 어떤 publishing preference를 골랐나?

Certification submission 화면에는 서로 다른 두 선택지가 있다.

- **Certify and publish now**: 심사를 통과한 뒤 Amazon이 publishing 절차를 시작한다.
- **Certify now and publish later**: 심사를 통과하면 Certified 상태가 되고, 언제 publishing을 시작할지 직접 고른다.

[공식 submission 안내](https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html)에 나온 실제 release 분기다. 그러므로 다음 행동도 달라진다.

```text
Certified 상태
    |
    +-- certified snapshot이 바뀌지 않았고 publish later를 골랐는가?
    |       -> 그 certified version의 publishing을 시작한다. 다시 submit하지 않는다.
    |
    +-- submission 뒤 Development version을 수정했는가?
    |       -> 그것은 새로운 snapshot이다. 별도 certification submission이 필요하다.
    |
    +-- publish now를 골랐는데도 사용자는 예전 동작을 보는가?
            -> code를 바꾸기 전에 Live version, marketplace availability,
               live endpoint를 확인한다.
```

핵심은 **certified snapshot을 publish하는 일**과 **더 새로운 development snapshot을 인증받는 일**을 구분하는 것이다. publish later만 선택한 unchanged version을 다시 Submit하면 불필요한 심사 cycle이 시작된다. 반대로 그 뒤 Development에서 바꾼 code나 interaction model은 이전 certified snapshot을 publish해도 들어가지 않는다.

## 안전하고 빠른 확인 순서

### 1. Version message와 submission 시간을 읽는다

각 certification submission에는 version message를 남길 수 있다. deployment note와 message, 시간을 비교한다. 이전 release를 설명하는 message라면 Console은 정확한 정보를 주고 있는 것이다. 새 기능이 아니라 예전 snapshot이 통과한 것이다.

### 2. Skill list만 보지 말고 Certification 탭을 연다

skill의 Certification 탭에서 Submission을 확인한다. 여기서 review 결과와 publish action이 남아 있는지를 볼 수 있다. Skill list는 여러 stage를 함께 보여 줄 수 있으므로 Certified라는 단어 하나만으로 판단하면 안 된다.

### 3. Development와 Live endpoint를 나란히 비교한다

AWS Lambda를 쓰는 custom skill에서 endpoint ARN은 skill configuration의 일부다. development version은 beta Lambda alias를, live version은 production alias를 바라볼 수 있다. 안전한 구조이지만 development test 성공이 public route의 성공을 뜻하지는 않는다.

문제를 고치려 ARN을 복사하지 말고 먼저 다음 표를 채운다.

| 확인 항목 | Development | Live |
| --- | --- | --- |
| Interaction model build 시각 | | |
| Endpoint ARN 또는 alias | | |
| 그 alias가 가리키는 Lambda published version | | |
| Version message / certification snapshot | | |

두 열의 차이가 원인인 경우가 많다.

### 4. 진단하는 stage를 의도적으로 테스트한다

Developer Console simulator는 Development와 Live를 각각 테스트할 수 있다. 비교할 때는 stage를 명시적으로 고르고 매번 새 session을 쓴다. developer account로 로그인한 Echo는 development version을 실행할 수 있고, 다른 사람의 기기는 live version만 받을 수 있다. 그래서 기기와 account context도 test record에 적는 편이 좋다.

### 5. 올바른 publish 경로를 확인한 뒤에만 기다린다

Store publishing에는 Lambda deploy 밖의 전파 단계가 있다. 의도한 certified version이 publish되고 있음을 Console에서 확인했다면 live 상태와 store listing이 갱신될 시간을 준다. 하지만 UI에 publish action이 그대로 남아 있다면 기다린다고 publishing이 시작되지는 않는다.

## Lambda를 다시 배포해도 해결되지 않는 이유

Lambda와 Alexa skill publishing은 서로 다른 release system이다.

```text
Git commit -> Lambda artifact -> Lambda version / alias
                                      |
                                      v
Alexa Development endpoint ----> development testing

Alexa certification snapshot --> review --> certified --> publishing --> Live endpoint
```

새 Lambda artifact를 배포하면 alias가 제공하는 code는 바꿀 수 있다. 하지만 development interaction model이 자동으로 published Alexa skill이 되지는 않는다. 반대로 Certified 상태도 live endpoint가 기대한 최신 artifact를 가리킨다는 보장은 아니다.

그래서 immutable Lambda version과 분명한 alias 이름이 필요하다. 예를 들어 "Development는 `beta`를 통해 version 12를 테스트했고, Live는 `prod`를 통해 version 11을 제공한다"고 account number나 full ARN 없이 기록할 수 있다. 그러면 publishing 문제인지, endpoint 설정 문제인지, code 문제인지 분리할 수 있다.

## 피해야 할 두 가지 재작업 loop

**Certified가 미완성처럼 보여서 다시 submit하는 경우.** version이 바뀌지 않았고 publish later를 골랐다면 certified snapshot을 publish한다. 새 submission은 새 development snapshot을 위한 것이다.

**조사하는 동안 Development version을 계속 바꾸는 경우.** metadata나 endpoint를 조금 바꾼 일도 다음 submission에 무엇이 들어가는지 불명확하게 만든다. 잠시 변경을 멈추고 certified snapshot과 현재 development state를 기록한 뒤 움직인다.

Amazon의 [distribution 문서](https://developer.amazon.com/en-US/docs/alexa/custom-skills/submit-an-alexa-skill-for-certification.html)도 이미 publish된 skill을 수정할 때는 development version을 고친 뒤 다시 certification에 제출한다고 설명한다. 이것은 Console의 오류가 아니라 정상적인 release versioning이다.

## Publish 전 체크리스트

- [ ] 의도한 snapshot이 Development, Certified, Live 중 어디인지 확인한다.
- [ ] version message와 submission 시간을 publish하려는 release와 비교한다.
- [ ] Certified이고 변경되지 않았다면 resubmit 대신 publish action을 사용한다.
- [ ] certification 뒤 Development를 수정했다면 새 release candidate로 취급한다.
- [ ] Lambda를 바꾸기 전에 live와 development endpoint alias를 비교한다.
- [ ] 진단하는 stage와 같은 stage를 테스트한다. beta는 Development, customer는 Live다.
- [ ] version message, endpoint alias, test result를 release note에 남긴다.

snapshot이라는 모델로 보면 상태 표시는 더 이상 이상하지 않다. Certified는 "Amazon이 이 제출 version을 승인했는가?", Live는 "그 version이 지금 사용자에게 publish됐는가?"에 답한다. 둘 다 필요한 서로 다른 확인이다.
