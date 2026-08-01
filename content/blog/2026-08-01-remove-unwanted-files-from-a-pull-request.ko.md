---
title: Pull Request에서 원치 않는 파일을 안전하게 제거하는 방법
date: 2023-06-19T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
maintenance_status: replacement
replaces_url: "/blog/2023-06-19-how-to-delete-unwanted-files-from-a-pull-request.html"
author: Yoonsoo Park
description: 파일의 Git 상태를 먼저 확인하고 가장 작은 범위의 되돌릴 수 있는 수정으로 PR을 정리한다.
categories:
  - Git
tags:
  - Git
  - GitHub
  - CLI
---

Pull Request에서 파일을 제거하는 작업은 하나의 Git 명령으로 정리되지 않는다. 파일이 아직 추적되지 않았는지, stage에만 있는지, 이미 commit 또는 push되었는지, 프로젝트에서 실제로 삭제하려는지에 따라 안전한 명령이 달라진다. 이 상태를 구분하지 않으면 관련 없는 작업까지 잃기 쉽다.

이 글은 2026년 8월 1일 공식 [`git status`](https://git-scm.com/docs/git-status), [`git restore`](https://git-scm.com/docs/git-restore), [GitHub Pull Request](https://docs.github.com/en/pull-requests) 문서를 기준으로 확인했다. 모든 수정 전후에 `git status --short`를 실행한다.

## PR의 실제 차이부터 확인하기

대상 브랜치를 가져오고 PR과 같은 merge-base 기준으로 확인한다.

```bash
git fetch origin
git status --short
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD -- path/to/file
```

`origin/main`은 실제 PR base branch로 바꾼다. 세 점 비교는 공통 조상부터 현재 브랜치 끝까지를 보여준다. 두 점 비교는 양쪽 끝의 tree를 직접 비교하므로 base branch에서 별도로 움직인 변경까지 섞일 수 있다. GitHub CLI를 쓴다면 `gh pr diff --name-only`도 읽기 전용 확인 방법이다.

## Stage에만 올라간 파일

작업 사본은 유지하고 다음 commit에서만 제외한다.

```bash
git restore --staged -- path/to/file
git status --short
```

앞으로도 저장소에 들어가면 안 되는 파일이면 팀 공통 규칙은 `.gitignore`, 개인 로컬 규칙은 `.git/info/exclude`에 추가한다. 이미 추적 중인 파일에는 ignore 규칙만 추가해도 효과가 없다.

## 추적 중인 파일의 미커밋 수정 폐기

먼저 내용을 확인하고 해당 경로만 복원한다.

```bash
git diff -- path/to/file
git restore --source=HEAD --worktree -- path/to/file
```

이 명령은 그 경로의 stage 전 변경을 의도적으로 버린다. 일부라도 필요하면 먼저 복사하거나 stash한다. `git restore .`, `git checkout -- .`, `git reset --hard`처럼 저장소 전체에 작용하는 명령은 이 작업보다 범위가 훨씬 크므로 사용하지 않는다.

## 이미 commit된 변경 제거

PR base의 파일을 가져와 별도의 교정 commit을 만든다.

```bash
git fetch origin
git restore --source=origin/main --staged --worktree -- path/to/file
git diff --cached -- path/to/file
git commit -m "Restore path excluded from this pull request"
git push
```

공개된 기록을 보존하면서 리뷰 가능한 수정이 된다. 실수로 수정한 파일과 실수로 삭제한 파일 모두 같은 원리로 처리할 수 있다. commit 자체를 정리해야 한다면 interactive rebase도 대안이지만, 이미 push한 기록을 다시 쓰는 작업은 협의와 보통 `--force-with-lease`가 필요하다. 기본 정리 방법으로 사용하지 않는다.

## 프로젝트에서 파일을 실제로 삭제

PR의 목적이 파일 삭제라면 `git rm`으로 stage하고 차이를 검토한다.

```bash
git rm -- path/to/file
git diff --cached -- path/to/file
git commit -m "Remove obsolete file"
```

생성 파일이나 로컬 파일의 작업 사본은 남기되 추적만 중단하려면 ignore 규칙을 먼저 합의한 뒤 다음을 사용한다.

```bash
git rm --cached -- path/to/file
git diff --cached -- path/to/file
```

이 변경 이후 협업자도 해당 파일을 저장소에서 받지 않으므로 개인 설정이 아니라 프로젝트 결정이다.

## Fork, 생성 파일, 비밀정보

Fork에서 연 PR은 같은 head branch에 교정 commit을 push해야 갱신된다. 새 브랜치를 만드는 것만으로 기존 PR이 바뀌지는 않는다.

lockfile, snapshot, migration처럼 생성된 파일은 크다는 이유만으로 제외하지 않는다. 저장소 규칙을 확인하고 생성 도구를 다시 실행해 결과를 재현한다.

자격 증명이 들어간 파일이라면 후속 commit에서 지우는 것만으로 Git 기록에서 사라지지 않는다. 즉시 비밀정보를 폐기 또는 교체하고 저장소 소유자에게 알린 뒤 GitHub의 [민감정보 제거 지침](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)을 따른다. 기록 재작성은 협업이 필요한 사고 대응 작업이다.

## 최종 검증

```bash
git status --short
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD -- path/to/file
```

최종 PR diff에는 의도한 변경만 남아야 한다. 프로젝트 테스트를 실행하고, 저장소 규칙에 맞게 생성 결과를 확인하고, 리뷰 요청 전에 웹의 PR 화면을 한 번 더 읽는다.

여러 파일을 정리할 때도 저장소 전체로 명령 범위를 넓히지 말고 경로별 절차를 반복한다. 작고 목적이 분명한 교정 commit은 검토하기 쉽고 저장소 정책에 따라 나중에 squash할 수 있다. 핵심은 관찰 가능성이다. 쓰기 전에 어떤 Git 상태가 바뀌는지 알고, 쓴 뒤에는 `status`와 PR diff로 결과를 확인한다. 이 습관이 하나의 정리 명령을 외우는 것보다 안전하다.
