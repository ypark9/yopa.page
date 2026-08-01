---
title: Python 프로젝트와 의존성 관리 도구를 선택하는 기준
date: 2026-08-01
author: Yoonsoo Park
description: 하나의 도구 이전을 범용 업그레이드로 보지 않고 프로젝트 요구사항에 따라 venv, pip-tools, Pipenv, Poetry, PDM, Hatch, uv를 선택한다.
categories:
  - Python
tags:
  - Python
  - Package Management
  - CLI
---

Python 환경과 packaging에는 여러 유효한 workflow가 있다. `venv`에서 Pipenv로 옮긴다고 자동으로 개선되는 것은 아니다. `venv`는 설치 패키지를 격리하고, 상위 workflow tool은 dependency resolution, lock, build, publish, task 실행까지 일부 또는 전부 제공한다. 먼저 저장소가 필요한 기능을 정한다.

이 글은 2026년 8월 1일 [Python Packaging User Guide 도구 권장사항](https://packaging.python.org/en/latest/guides/tool-recommendations/), [`venv` 문서](https://docs.python.org/3/library/venv.html), [재현 가능한 환경 명세](https://packaging.python.org/en/latest/specifications/)를 기준으로 확인했다.

## 현재 mental model

네 가지 관심사를 구분한다.

1. pyenv 같은 interpreter manager가 Python release를 선택한다.
2. environment manager가 설치 패키지를 격리한다. 표준 `venv`가 최소 기준선이다.
3. resolver가 호환되는 dependency version을 선택한다.
4. package를 배포한다면 build backend가 wheel 또는 source distribution을 만든다.

하나의 도구가 여러 역할을 담당할 수 있지만 어떤 파일이 원본이고 어떤 출력이 재생성되는지는 문서화한다.

## 안전한 최소 기준선

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
python -m pytest
```

`python -m pip`으로 대상 interpreter를 명시한다. `.venv/`는 Git에 넣지 않는다. 완전히 반복 가능한 배포가 필요한 애플리케이션은 오래된 환경의 `pip freeze`에 의존하지 말고 저장소가 선택한 lock 또는 compiled constraints workflow를 사용한다.

## 도구 선택

- `venv`와 pip는 널리 사용할 수 있고 debugging이 쉽지만 하나의 lock 방식을 강제하지 않는다.
- pip-tools는 검토한 입력을 고정 출력으로 compile하며 기존 pip 배포와 잘 맞는다.
- Pipenv는 환경과 `Pipfile.lock`을 관리한다. 팀과 자동화가 이미 그 계약을 사용한다면 유지할 이유가 있다.
- Poetry와 PDM은 project metadata, resolution, lock, packaging을 서로 다른 규칙으로 제공한다.
- Hatch는 환경, build, publish, script workflow에 초점을 둔다.
- uv는 빠른 환경·의존성 workflow와 여러 현대 Python 표준을 지원한다.

인기도는 migration 요구사항이 아니다. 지원 Python, 플랫폼 동작, private index 인증, lock 이식성, CI 설치, editor 지원, maintainer 지속성을 평가한다.

## 증거를 삭제하지 않는 이전

1. 현재 interpreter, 직접 의존성 선언, lock 또는 constraints, 성공한 test 명령을 기록한다.
2. 새 branch와 별도 clean environment를 만든다. 기존 환경부터 지우지 않는다.
3. 모든 transitive package를 직접 요구사항으로 옮기지 말고 프로젝트 의도에서 후보 도구를 구성한다.
4. version, hash, index, platform marker 변화를 검토한다.
5. 지원 플랫폼에서 unit, integration, build, smoke test를 실행한다.
6. CI와 onboarding 문서를 같은 변경에서 갱신한다.
7. clean clone 재현을 증명한 뒤 기존 파일을 제거한다.

`rm -rf venv`를 migration의 첫 단계로 두지 않는다. 요구사항과 동작 증거가 보존된 뒤에만 환경을 폐기할 수 있다.

## 애플리케이션과 라이브러리

애플리케이션은 배포 환경 전체를 lock하는 경우가 많다. 라이브러리는 downstream 애플리케이션이 해결할 수 있도록 호환 범위를 선언한다. 라이브러리는 소비자에게 application lock을 강제하기보다 지원 범위를 시험한다.

독립 Python 명령은 `pipx`로 격리한다. PyPI CI publish는 지원되는 경우 장기 upload token보다 trusted publishing을 우선한다.

## 검증 기준

```bash
python -c 'import sys; print(sys.executable, sys.version)'
python -m pip check
python -m build
python -m pytest
```

저장소에 필요한 명령만 사용하되 clean clone 설치와 기존 production entry point를 반드시 확인한다. 새 workflow가 통과하고 rollback을 이해할 때까지 이전 방식을 보존한다.

## 이전 후 운영 확인

Resolver 변경은 설치 시간, cache 동작, artifact 크기, private index 요청, CI 실패 메시지에도 영향을 준다. 자동 dependency PR이 authoritative declaration을 갱신할 수 있는지, 개인 credential을 commit하지 않아도 되는지 확인한다. Index가 없을 때 설명되지 않은 global package를 사용하는 대신 bootstrap이 명확히 실패하는지도 시험한다.

직접 dependency의 추가·삭제·업데이트, resolved output 재생성, reviewer 확인 파일을 문서화한다. 지원 Python matrix와 active interpreter를 증명하는 명령도 남긴다. 나중의 팀원이 당시의 도구 유행을 몰라도 clean checkout에서 환경을 재현할 수 있어야 한다.
