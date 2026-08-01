---
title: "Flow가 호출한 Queueable Apex를 연관 로그로 디버깅하기"
date: 2026-08-01
author: Yoonsoo Park
description: "Flow에서 Invocable Apex와 Queueable Apex로 이어지는 비동기 경계를 추적하고 비밀정보 없이 로그를 연결한다."
categories:
  - Salesforce
  - Debugging
tags:
  - Salesforce Flow
  - Apex
  - Asynchronous Apex
  - Debug Logs
---

이 글은 2026-08-01 Salesforce 공식 문서를 기준으로 확인했다.

## 이전 디버깅 흐름을 보관한 이유

이전 글은 Flow가 `@future` 메서드를 호출하는 구조에서 시작했다. Salesforce는 현재 프로덕션 비동기 작업에 Queueable Apex를 권장한다. Job ID를 바로 받을 수 있고, 구조화된 상태를 전달하며, chaining과 모니터링도 더 분명하기 때문이다.

더 중요한 문제는 실행 경계다. Flow transaction과 Queueable transaction은 별개다. 실행 사용자, 시간, governor limit, debug log가 서로 다를 수 있다. 따라서 한쪽 로그만 보고 전체 작업이 성공했다고 판단하면 안 된다.

## 현재의 멘탈 모델

경로를 세 개의 관측 지점으로 나눈다.

1. **Flow interview**가 입력을 검증하고 bulk-safe Apex action을 호출한다.
2. **Invocable Apex**가 비밀이 아닌 correlation ID를 만들고 한도 안에서 job을 enqueue하며 job ID를 남긴다.
3. **Queueable Apex**가 나중에 별도 transaction으로 실행되고 `AsyncApexJob`에서 추적된다.

Flow debugger는 동기 경로를, Apex log와 `AsyncApexJob`은 비동기 경로를 보여준다. 최종 비즈니스 결과는 별도로 확인해야 한다.

## 연관관계를 남기는 구현

Invocable 메서드는 bulk-safe해야 한다. Flow가 넘긴 record마다 무조건 job 하나를 만들면 transaction당 Queueable 한도에 쉽게 닿는다. 아래 예제는 입력을 한 job으로 묶는다.

```apex
public with sharing class SyncAccountsAction {
    public class Request {
        @InvocableVariable(required=true)
        public Id accountId;
    }

    @InvocableMethod(label='Queue Account Sync')
    public static void enqueue(List<Request> requests) {
        Set<Id> accountIds = new Set<Id>();
        for (Request request : requests) {
            if (request != null && request.accountId != null) {
                accountIds.add(request.accountId);
            }
        }
        if (accountIds.isEmpty()) return;

        String correlationId = Crypto.getRandomUUID();
        Id jobId = System.enqueueJob(
            new SyncAccountsJob(new List<Id>(accountIds), correlationId)
        );
        System.debug(LoggingLevel.INFO,
            'account-sync queued correlation=' + correlationId + ' job=' + jobId);
    }
}
```

```apex
public with sharing class SyncAccountsJob
        implements Queueable, Database.AllowsCallouts {
    private final List<Id> accountIds;
    private final String correlationId;

    public SyncAccountsJob(List<Id> accountIds, String correlationId) {
        this.accountIds = accountIds;
        this.correlationId = correlationId;
    }

    public void execute(QueueableContext context) {
        System.debug(LoggingLevel.INFO,
            'account-sync started correlation=' + correlationId
            + ' job=' + context.getJobId() + ' count=' + accountIds.size());

        // 필요한 필드만 조회하고 callout은 Named Credential을 사용한다.
        // 비밀이나 본문 대신 상태, 시간, provider request ID를 기록한다.
    }
}
```

로그 만료 뒤에도 추적해야 한다면 correlation ID, Queueable job ID, 상태, 시간, 정제한 오류 코드만 가진 최소 상태 record를 저장할 수 있다. 보존 기간과 sharing을 적용하고 고객 payload의 복제 저장소로 만들지 않는다.

## 올바른 trace flag 설정

Sandbox나 scratch org에서 짧은 시간 범위로 재현한다.

- Flow를 시작한 사용자를 trace해 interview와 invocable 호출을 본다.
- 자동화가 **Automated Process**로 실행된다면 해당 entity에도 trace flag를 추가한다.
- Apex Code를 필요한 수준으로만 올린다. 모든 범주를 `FINEST`로 두면 로그가 잘려 오히려 순서를 놓칠 수 있다.
- Scheduled path나 Platform Event가 시작점이라면 실제 실행 사용자를 확인한다.

하나의 알려진 record로 실행하고 시작 시간과 correlation ID를 기록한다. 다음으로 job을 조회한다.

```bash
sf data query --target-org sandbox --use-tooling-api --query \
  "SELECT Id, Status, JobType, ApexClass.Name, CreatedDate, CompletedDate,
   NumberOfErrors, ExtendedStatus
   FROM AsyncApexJob
   WHERE ApexClass.Name = 'SyncAccountsJob'
   ORDER BY CreatedDate DESC LIMIT 10"
```

Job ID와 시간을 이용해 Queueable 로그를 찾는다. `Completed`는 Apex transaction 완료를 뜻할 뿐 외부 시스템의 비즈니스 처리가 끝났다는 보장은 아니다. 정제된 provider request ID나 결과 상태 조회로 최종 결과를 검증한다.

## 비밀을 남기지 않는 로그

Job ID, correlation ID, record 수, 오류 분류, HTTP status, 처리 시간, 외부 request ID는 유용하다. 다음은 기록하지 않는다.

- access token과 refresh token
- Named Credential 값과 Authorization header
- 전체 request·response body
- 진단에 필요하지 않은 고객 필드
- 사용자에게 그대로 노출되는 stack trace

예상 가능한 연동 실패는 정제한 상태로 남긴다. 예상하지 못한 예외는 출력만 하고 삼키지 말고 Queueable을 실패시켜 `AsyncApexJob`에 실패가 기록되게 한다.

## 한도와 trade-off

Queueable은 단발성 프로덕션 비동기 작업의 기본 선택이지만 일일 비동기 용량과 enqueue 한도를 공유한다. Query 중심의 매우 큰 데이터셋에는 Batch Apex가 적합하다. Platform Event는 생산자와 소비자를 분리하지만 전달과 모니터링 복잡도가 늘어난다. 작업이 짧고 DML 이후 callout이 필요 없다면 동기 invocable action이 가장 단순하다.

Chaining은 순서가 있는 단계를 표현하지만 모든 단계에 멱등성과 중단 조건이 필요하다. 무한 재시도 대신 제한된 횟수, 외부 서비스에 맞는 backoff, 운영자가 확인할 terminal failure 상태를 둔다.

## 마이그레이션 체크리스트

1. `@future`를 호출하는 Flow와 입력·부작용을 목록화한다.
2. Bulk-safe invocable 경계와 Queueable class를 만들고 테스트한다.
3. Correlation ID와 `System.enqueueJob`의 job ID를 보존한다.
4. Raw endpoint와 secret을 Named Credential로 옮긴다.
5. 성공, 재시도 가능 실패, terminal failure 상태를 정의한다.
6. 한 record, Flow batch, callout 실패, permission 실패, limit을 시험한다.
7. Sandbox에서 실제 실행 entity의 단기 trace flag로 비즈니스 결과를 비교한다.
8. 통제된 릴리스로 Flow를 활성화하고 불필요한 trace flag를 제거한다.

## 검증

완전한 검증은 Flow interview, invocable log, Queueable job ID, 비동기 log, 최종 비즈니스 결과를 하나로 연결한다. 테스트에서는 bulk 입력, enqueue 여부, mock callout, 비밀 없는 오류 분류, 재시도 종료를 확인한다.

## 공식 자료

- [Leveling Up Your Apex Skills: Queueable over future methods](https://developer.salesforce.com/blogs/2023/05/leveling-up-your-apex-skills)
- [Queueable Apex](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_queueing_jobs.htm)
- [InvocableMethod Annotation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm)
- [Salesforce CLI data query reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data.html)
