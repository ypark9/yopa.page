---
title: Python CLI를 패키징하고 격리 설치하는 방법
date: 2026-08-01
author: Yoonsoo Park
description: pyproject metadata, console entry point, 격리 설치와 검증된 upgrade 경로를 갖춘 Python command-line application을 만든다.
categories:
  - Python
tags:
  - Python
  - CLI
  - Package Management
---

Shebang, executable bit, symlink만으로 로컬 script를 노출할 수는 있지만 dependency를 설명하거나 환경을 격리하지 못하고 Windows 설치, 안정적인 upgrade와 uninstall도 제공하지 못한다. 유지할 CLI는 Python application으로 package하고 격리 환경에 설치한다.

이 글은 2026년 8월 1일 PyPA의 [command-line tool 만들기](https://packaging.python.org/en/latest/guides/creating-command-line-tools/), [독립 CLI 설치](https://packaging.python.org/en/latest/guides/installing-stand-alone-command-line-tools/), [entry points 명세](https://packaging.python.org/en/latest/specifications/entry-points/)를 기준으로 확인했다.

## 프로젝트 구조

```text
code-collector/
├── pyproject.toml
├── src/code_collector/
│   ├── __init__.py
│   └── cli.py
└── tests/test_cli.py
```

명령 동작은 호출 가능한 함수에 두고 business logic 깊은 곳에서 `sys.exit`를 호출하지 말고 exit code를 반환한다.

```python
import argparse

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()
    print(args.path)
    return 0
```

## 명령 선언

Hatchling을 사용하는 표준 기반 예제다.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "code-collector"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
code-collector = "code_collector.cli:main"
```

`[project.scripts]`는 플랫폼에 맞는 launcher를 만든다. 사용자가 symlink를 직접 만들지 않아도 macOS, Linux, Windows에서 같은 package를 사용할 수 있다. Hatchling은 예시이며 저장소 정책에 맞는 유지 중인 build backend를 선택하고 고정한다.

## 개발과 검증

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --editable .
code-collector --help
python -m pytest
python -m build
```

Editable install은 source 변경을 재설치 없이 반영해 개발에 적합하다. release 전 wheel과 source distribution을 만들고 내용을 검사한 뒤 fresh environment에서 wheel을 시험한다. Build configuration에서 project code를 import하거나 실행하지 않는다.

## 애플리케이션 설치

`pipx`는 애플리케이션별 가상 환경을 만들면서 명령을 `PATH`에 노출한다.

```bash
pipx install .
code-collector --help
pipx upgrade code-collector
pipx uninstall code-collector
```

승인된 package index 또는 명시적으로 신뢰한 source에서 설치한다. 검토하지 않은 URL 설치를 권하지 않고 index credential을 문서나 저장소에 넣지 않는다.

## 대안과 trade-off

- Shell alias는 개인용 한 줄 명령에는 충분하지만 배포 application은 아니다.
- 저장소 기여자만 쓰면 `python path/to/script.py`가 가장 단순할 수 있다.
- zipapp은 일부 pure-Python 앱을 한 archive로 배포하지만 dependency와 native extension 제약을 확인해야 한다.
- Typer나 Click은 풍부한 CLI 기능을 제공하고 `argparse`는 외부 runtime dependency가 없다.
- standalone bundler는 사용자 Python 요구를 없앨 수 있지만 artifact가 커지고 플랫폼별 build가 필요하다.

## 이전 체크리스트

1. 기존 command name, argument, exit code, configuration, dependency를 기록한다.
2. 동작을 import 가능한 package와 작은 `main` 함수로 옮긴다.
3. `pyproject.toml` metadata와 console entry point를 추가한다.
4. help, invalid input, 정상 출력, nonzero failure를 시험한다.
5. 지원 플랫폼의 clean environment에서 wheel을 설치한다.
6. `pipx` install, upgrade, uninstall을 문서화한다.
7. `command -v code-collector`가 packaged launcher를 가리키고 acceptance test가 통과한 뒤 old symlink를 제거한다.

## 검증 기준

검증일을 기록하고 다음을 실행한다.

```bash
python -m build
python -m pip install --force-reinstall dist/*.whl
code-collector --help
python -m pytest
```

CLI가 지원하는 환경에서 signal handling, filesystem permission, encoding, exit status도 확인한다.

## Release와 유지보수

Tag가 붙은 clean commit에서 release를 build하고 변경되지 않는 versioned artifact를 publish한다. CI에서 PyPI로 배포한다면 가능한 경우 장기 token 대신 trusted publishing을 사용한다. 배포 맥락에 따라 provenance 증거도 생성한다.

stdout과 stderr를 interface로 취급한다. Machine-readable output은 안정적으로 유지하거나 version을 두고 diagnostic은 stderr로 보내며 exit code를 문서화한다. 시작을 지연시키거나 사용자 기대를 어기는 update check와 telemetry는 피한다. Python 지원 종료, configuration 이동, option 변경에는 migration note를 제공하고 이전 failure path도 시험한다. Dependency update, 지원 플랫폼, 취약점 대응, 오래된 release 제거의 소유자를 정한다.
