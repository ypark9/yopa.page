---
title: "2026년 AWS 접근 제어: 페더레이션과 임시 자격 증명부터"
date: 2023-05-22T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-05-22-aws-iam-user-vs-role.html"
author: Yoonsoo Park
description: "사람과 워크로드에 AWS 접근 권한을 줄 때 장기 IAM 액세스 키를 기본값으로 삼지 않는 실전 결정 가이드."
categories:
  - AWS
  - Security
tags:
  - AWS IAM
  - IAM Identity Center
  - Temporary Credentials
  - Security
---

이제 유용한 질문은 “IAM 사용자와 역할 중 무엇을 쓸까?”가 아니다. **누가, 어디에서 AWS에 접근하며, 그 경계에 어떤 임시 자격 증명 방식이 맞는가**를 먼저 물어야 한다.

AWS의 현재 권장은 사람과 워크로드 모두 임시 자격 증명을 쓰는 것이다. IAM 사용자는 여전히 존재하지만 페더레이션이나 역할을 쓸 수 없는 예외를 위한 수단이지 기본 출발점이 아니다.

## 현재의 멘탈 모델

IAM 사용자는 한 AWS 계정 안에 존재하는 장기 ID다. 비밀번호와 액세스 키는 교체하거나 폐기할 때까지 유효하다. 이 지속성 때문에 유출됐을 때 피해 가능 기간도 길어진다.

IAM 역할에는 권한과 신뢰 정책이 있지만 장기 자격 증명은 없다. 사람, 워크로드 또는 AWS 서비스가 역할을 맡으면 AWS STS가 만료되는 액세스 키, 시크릿 키, 세션 토큰을 발급한다. 신뢰 정책은 “누가 역할을 맡을 수 있는가”, 권한 정책은 “그 세션이 무엇을 할 수 있는가”를 정한다.

다음 원칙을 기본값으로 삼는다.

1. **직원 접근:** AWS IAM Identity Center 또는 외부 IdP로 페더레이션한다. 개인별 정책 대신 그룹에 permission set을 할당한다.
2. **AWS 워크로드:** Lambda, ECS task, EC2 등에 서비스 역할을 연결하고 SDK 기본 credential provider가 이를 찾게 한다.
3. **외부 CI/CD:** GitHub Actions OIDC 같은 workload identity federation으로 범위가 좁은 역할을 맡는다.
4. **계정 간 접근:** 대상 계정의 역할을 사용하고 신뢰 주체와 조건을 명시한다.
5. **지원되지 않는 레거시 워크로드:** 역할과 페더레이션이 불가능한지 확인한 뒤에만 IAM 사용자를 쓴다. 키 범위 축소, 교체, 감시와 제거 계획이 필요하다.

## 안전한 로컬 흐름

AWS CLI v2에서 IAM Identity Center 프로필을 만든다.

```bash
aws configure sso --profile engineering-dev
aws sso login --profile engineering-dev
aws sts get-caller-identity --profile engineering-dev
```

마지막 명령으로 변경 작업 전에 계정과 ARN을 확인한다. 애플리케이션은 프로필만 선택하고 SDK가 임시 자격 증명을 해석하게 한다. 발급된 액세스 키를 소스 코드나 `.env`로 복사하지 않는다.

```bash
AWS_PROFILE=engineering-dev aws s3api list-buckets
```

AWS에서 실행되는 컨테이너 안에서는 `aws configure`를 실행하지 않는다. 실행 역할이나 task role을 연결하고 명시적 키 없이 SDK 클라이언트를 만든다.

## 권한 설계

임시 자격 증명은 유효 기간을 줄일 뿐 넓은 권한을 안전하게 바꾸지는 않는다. 필요한 기능을 확인한 뒤 IAM Access Analyzer와 실제 사용 기록으로 권한을 줄인다. 조직 ID, source account, 리소스 태그, OIDC subject처럼 요청 범위를 실질적으로 좁히는 조건을 사용한다.

사람의 접근에는 가능한 경우 피싱 저항성이 있는 MFA를 요구한다. 루트 사용자는 별도로 보호하고 루트 액세스 키는 만들지 않는다. 사용하지 않는 역할, permission set, 정책과 자격 증명을 정기적으로 검토한다.

## 선택지와 비용

Identity Center는 중앙 설정과 정상적인 IdP가 필요하지만 여러 계정의 권한과 단기 세션을 한곳에서 관리할 수 있다. 서비스 역할은 AWS compute에서 간단하지만 임의의 외부 서버 문제를 직접 해결하지는 않는다. OIDC는 CI 비밀값을 없애지만 audience와 subject 조건을 세심하게 제한해야 한다. IAM 사용자는 일부 레거시 연동을 지원하지만 키 교체, 저장, 감시와 사고 대응 비용이 따라온다.

## 마이그레이션 체크리스트

- IAM 사용자, 액세스 키, 마지막 사용 기록과 실제 소유자를 조사한다.
- 사람, AWS 워크로드, 외부 워크로드, 비상용으로 분류한다.
- 동일하거나 더 좁은 권한의 permission set 또는 역할을 만든다.
- `sts get-caller-identity`와 대표 읽기·쓰기 작업으로 검증한다.
- 애플리케이션의 명시적 키를 SDK 기본 provider chain으로 바꾼다.
- 정해진 병행 기간 동안 CloudTrail을 관찰한다.
- 이전 키는 삭제 전에 비활성화한다. 확인된 의존성이 있을 때만 되돌린다.
- 사용하지 않는 IAM 사용자를 제거하고 남은 예외는 근거를 기록한다.

공식 문서 확인일: **2026-08-01**.

## 공식 자료

- [IAM 보안 모범 사례](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [IAM ID와 자격 증명 비교](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_identity-management.html)
- [AWS IAM Identity Center User Guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [IAM Access Analyzer 정책 생성](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
