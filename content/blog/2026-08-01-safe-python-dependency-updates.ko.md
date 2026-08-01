---
title: Python 프로젝트 의존성을 안전하게 업데이트하는 방법
date: 2026-08-01
author: Yoonsoo Park
description: 설치 환경을 일괄 업그레이드하지 않고 선언된 의존성을 의도적으로 갱신하고 재현성과 동작을 검증한다.
categories:
  - Python
tags:
  - Python
  - Package Management
  - CLI
---

Python 가상 환경은 설치 결과이지 프로젝트의 의존성 정책 그 자체가 아니다. 설치된 모든 배포 패키지를 한 번에 올리면 직접 선택한 요구사항과 간접 의존성이 섞이고, 누구도 검토하지 않은 조합이 만들어질 수 있다. 안전한 업데이트는 선언된 의도에서 시작해 재현 가능한 결과를 만들고 애플리케이션 동작을 검증한다.

이 글은 2026년 8월 1일 [Python Packaging User Guide](https://packaging.python.org/en/latest/), pip의 [`pip install`](https://pip.pypa.io/en/stable/cli/pip_install/) 및 [`pip check`](https://pip.pypa.io/en/stable/cli/pip_check/) 문서, [PyPA 재현 가능한 환경 명세](https://packaging.python.org/en/latest/specifications/)를 기준으로 확인했다.

## 세 가지 층을 구분하기

1. **선언된 의존성**은 프로젝트가 의도적으로 필요로 하는 패키지다. `pyproject.toml`, `requirements.in` 또는 선택한 도구의 프로젝트 파일에 기록한다.
2. **해결된 의존성**은 호환되는 정확한 버전 조합이다. lockfile이나 compile된 requirements 파일로 남길 수 있다.
3. **설치 환경**은 특정 Python 버전과 플랫폼에서 그 해결 결과를 설치한 사례다.

`pip freeze`는 현재 설치된 배포 패키지를 보여주지만 무엇이 직접 요구사항인지, 왜 그 버전이 선택됐는지 알려주지 못한다. 진단이나 일부 환경 snapshot에는 유용하지만 관리되는 프로젝트 선언을 대신하기에는 부족하다.

## 안전한 업데이트 반복 과정

깨끗한 브랜치와 격리 환경에서 시작한다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip list --outdated
```

한 번에 검토할 수 있는 작은 범위를 정한다. 직접 의존성의 release note, 지원 Python 버전, migration 안내를 읽는다. 저장소가 이미 사용하는 도구로 선언을 수정하고 lockfile 또는 compile 결과를 다시 만든 뒤 설치 전에 diff를 확인한다.

pip-tools 기반 requirements 흐름이라면 다음처럼 특정 패키지만 갱신할 수 있다.

```bash
python -m pip install pip-tools
pip-compile --upgrade-package requests requirements.in
pip-sync requirements.txt
```

`pyproject.toml` 프로젝트라면 저장소가 선택한 resolver나 workflow tool을 따른다. 다른 도구가 인기 있다는 이유로 두 번째 lock 형식을 추가하지 않는다. 라이브러리는 보통 호환 범위를 선언하지만 배포 애플리케이션은 반복 가능한 배포를 위해 전체 환경을 고정하는 경우가 많다.

## 보안 업데이트와 자동화

Dependabot이나 Renovate의 자동 PR은 새 버전 발견 시간을 줄여주지만 검토를 대신하지 않는다. 실패 원인을 추적할 수 있을 정도로 묶음을 작게 유지한다. 새 의존성을 추가할 때는 패키지 이름, 배포 주체, 다운로드 index가 의도한 대상인지 확인한다.

취약점 보고서는 우선순위 판단 자료이지 호환성 확인을 생략해도 된다는 뜻은 아니다. 이 프로젝트에서 취약 코드가 실제로 도달 가능한지, 패치된 호환 버전이 있는지, 업데이트를 시험하는 동안 완화책이 필요한지 판단한다. 비공개 lockfile, index 자격 증명, 내부 패키지 이름을 공개 분석 서비스에 올리지 않는다.

## 도구별 trade-off

- `venv`와 pip는 최소 표준 구성이지만 pip 자체가 모든 프로젝트에 적용되는 하나의 lock workflow를 제공하지는 않는다.
- pip-tools는 검토한 입력에서 고정된 requirements를 만들며 기존 pip 배포 흐름에 잘 맞는다.
- Poetry, PDM, Hatch, Pipenv, uv는 환경, 해결, 빌드, 작업 관리 중 서로 다른 범위를 제공한다. CI와 저장소 요구사항으로 선택하며 하나를 범용 정답으로 선언하지 않는다.
- `pipx`는 프로젝트 라이브러리가 아니라 독립 실행형 Python 애플리케이션을 설치하는 도구다.

도구 변경은 별도의 migration 작업이다. 모든 지원 플랫폼에서 새 resolver 결과를 승인하기 전까지 기존 선언을 보존한다.

## freeze 파일에서 이전하기

1. 현재 파일을 증거로 보존하되 모든 줄을 직접 요구사항으로 간주하지 않는다.
2. import, entry point, runtime service, 팀이 명시적으로 선택한 패키지를 찾는다.
3. 근거 있는 버전 범위와 함께 최소 직접 의존성 선언을 만든다.
4. 새 환경에서 해결하고 기존 환경과 동작을 비교한다.
5. 실제 차이를 표현하는 platform marker와 optional dependency group을 추가한다.
6. 하나의 lock 또는 compile 결과 규칙을 선택하고 업데이트 명령을 문서화한다.
7. CI와 배포 검증이 통과한 뒤에만 이전 snapshot을 제거한다.

## 검증 기준

```bash
python -m pip check
python -m pytest
```

애플리케이션의 type check, lint, build, smoke test, 운영과 유사한 시작 절차도 실행한다. 오래 유지한 로컬 환경을 신뢰하지 말고 CI에서 처음부터 환경을 재생성한다. 선언 파일과 해결 결과의 diff를 함께 읽고, 설명되지 않는 간접 의존성의 큰 버전 변화가 있으면 멈추고 조사한다.

PR에는 업데이트 날짜, 바꾼 직접 패키지, 공식 release note, 지원 Python 범위, test 증거, rollback 방법을 기록한다. 서비스는 단계적 배포 동안 error rate, latency, startup 동작을 관찰한다. 라이브러리는 가능한 범위에서 지원 의존성의 최저·최고 범위를 시험한다. 로컬 import 성공은 유용한 증거지만 소비자 관점의 호환성 검증을 대신하지 않는다.
