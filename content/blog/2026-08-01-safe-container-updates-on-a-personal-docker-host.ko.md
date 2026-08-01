---
title: "개인 Docker 호스트의 컨테이너를 안전하게 갱신하기"
date: 2024-01-22
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2024-01-22-harnessing-the-power-of-watchtower-for-docker-automated-updates-made-simple.html"
author: Yoonsoo Park
description: "latest 태그 자동 교체 대신 버전 고정, 알림, 백업, health check와 rollback을 사용하는 Docker·Synology 갱신 절차."
categories:
  - Docker
  - DevOps
tags:
  - Docker
  - Container Updates
  - Security
  - Reliability
---

컨테이너 자동 교체는 단순 유지보수가 아니라 사람이 없는 production deployment다. 변경 가능한 `latest` 태그를 받아 여러 stateful 서비스를 재시작하면 검토하지 않은 breaking change나 DB migration이 백업·rollback 준비 없이 적용될 수 있다.

개인 Docker 또는 Synology 호스트에서도 자동화를 없앨 필요는 없다. 대신 **업데이트 발견**과 **배포**를 분리하고 모든 변경을 관찰 가능하고 복구 가능하게 만든다.

## 현재의 멘탈 모델

새 이미지 탐지와 알림은 자동화한다. release note를 검토한 뒤 maintenance window에 특정 버전이나 digest를 승격한다. 영속 데이터를 백업하고 의존성이 있는 서비스 묶음 하나씩 갱신한다. health check와 실제 사용자 흐름을 확인하고 rollback 기간이 끝날 때까지 이전 이미지를 보관한다.

Watchtower는 monitor-only 모드에서 여전히 유용하다. `/var/run/docker.sock` mount는 컨테이너에 Docker daemon을 제어할 강한 권한을 주므로 사실상 호스트 신뢰 경계다. 신뢰하는 Watchtower 버전을 고정하고 label 또는 명시적인 목록으로 감시 범위를 제한하며 API를 외부에 공개하지 않는다.

```yaml
services:
  app:
    image: ghcr.io/example/app:2.4.1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    volumes:
      - app-data:/var/lib/app

  watchtower:
    image: containrrr/watchtower:1.7.1
    command: --monitor-only --label-enable --notifications-level info
    environment:
      WATCHTOWER_SCHEDULE: "0 30 8 * * 1"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped

volumes:
  app-data:
```

Watchtower cron은 초를 포함한 여섯 필드다. `0 30 8 * * 1`은 월요일 08:30을 뜻한다. 일반적인 다섯 필드 표현은 거부되거나 의도와 다르게 해석될 수 있다. 실제 배포 버전에서 schedule과 timezone을 확인한다.

예제의 `--label-enable`은 `com.centurylinklabs.watchtower.enable=true` label이 있는 컨테이너만 관찰한다. 알림 설정은 provider마다 다르므로 실제 업데이트 전에 시험한다.

## Maintenance window 절차

1. 중간 버전 요구와 schema 변경을 포함해 release note를 읽는다.
2. 현재 이미지와 Compose 설정을 기록한다.
3. 일관된 백업에 필요하면 쓰기 작업을 중단한다.
4. volume과 외부 DB를 백업한다. 정기적으로 restore까지 시험해야 한다.
5. 특정 버전 또는 digest로 바꾸고 이미지를 pull한다.
6. volume과 dependency를 삭제하지 않고 대상 서비스만 재생성한다.
7. health check 뒤 로그인, 읽기·쓰기, 예약 작업과 연동 서비스를 시험한다.
8. rollback 기간 동안 로그와 리소스 사용량을 관찰한다.

단방향 데이터 migration 전 실패라면 이전 이미지로 되돌릴 수 있다. 스키마가 비호환으로 바뀌었다면 애플리케이션의 downgrade 절차나 갱신 전 백업을 사용한다. 새 스키마에 이전 이미지만 실행하면 손상이 커질 수 있다.

완전 자동 갱신은 보안 패치 지연을 줄이지만 검토하지 않은 변경을 받아들인다. monitor-only는 사람의 시간이 들지만 결정 gate를 유지한다. digest는 불변이고 재현성이 높다. version tag는 읽기 쉽지만 publisher가 태그를 바꾸지 않는다는 신뢰가 필요하다. Git으로 Compose를 관리한다면 Renovate나 Dependabot이 변경 PR을 만들게 해 검토 기록을 남길 수 있다.

stateless이고 쉽게 재생성되는 서비스에는 강한 health·rollback 자동화와 auto-update가 맞을 수 있다. DB, 미디어 인덱스, ID 서비스처럼 대체할 수 없는 상태가 있으면 maintenance gate를 둔다.

## 마이그레이션 체크리스트

- `latest`를 버전이나 digest로 바꾼다.
- 정책 변경 전 Watchtower를 monitor-only로 전환한다.
- 여섯 필드 schedule과 timezone을 확인한다.
- 실제 health check와 알림을 추가한다.
- volume, DB, 설정, secret을 조사하고 backup·restore를 문서화한다.
- 서비스 묶음 하나와 dependency 순서, rollback을 시험한다.
- rollback 기간 후에만 이전 이미지를 정리한다.
- Docker socket 권한과 관리 UI의 비공개 상태를 점검한다.

공식 자료 확인일: **2026-08-01**.

## 공식 자료

- [Watchtower arguments](https://containrrr.dev/watchtower/arguments/)
- [Watchtower lifecycle hooks](https://containrrr.dev/watchtower/lifecycle-hooks/)
- [Docker Compose healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
- [Docker image digest](https://docs.docker.com/dhi/core-concepts/digests/)
