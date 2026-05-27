---
title: "Hugo 블로그에 llms.txt 추가하기 — Output Format으로 자동 생성"
date: 2026-05-27T03:00:00-04:00
author: Yoonsoo Park
description: "Hugo 정적 사이트에 /llms.txt 엔드포인트를 커스텀 Output Format으로 추가하는 방법. LLM이 180개 HTML 페이지를 크롤링하지 않고도 블로그를 흡수할 수 있게 — 그리고 그게 실제로 효과가 있는지에 대한 솔직한 이야기."
categories:
  - Hugo
  - SEO
tags:
  - llms-txt
  - hugo
  - llm
  - aws
---

2024년 9월, Answer.AI 공동창업자이자 fast.ai의 [Jeremy Howard](https://jeremy.fast.ai/)가 [`/llms.txt`](https://llmstxt.org/)를 제안했다. `robots.txt`, `sitemap.xml` 옆에 두는 큐레이션된 마크다운 인덱스다. 명분은 단순하다: LLM 컨텍스트 윈도우는 작고, HTML은 노이즈가 많고, 크롤러가 사이트를 이해하려고 180개 HTML 페이지를 파싱할 필요는 없다. 그러니 사람이 직접 만든 지도를 줘라.

그럴듯하다. 더 어려운 질문은 — 이게 지금 실제로 작동하느냐다.

## `llms.txt`가 뭔가

엄격한 파서블 구조를 가진 마크다운 파일이다:

```
# 사이트 이름                ← H1, 정확히 1개, 필수
> 한두 줄 요약              ← blockquote
자유 서술 단락 (선택)

## Docs                     ← H2 섹션
- [제목](URL): 짧은 설명

## Optional                 ← 특수 의미: 컨텍스트 부족 시 생략
- [부록](URL)
```

스펙엔 두 가지 보조 규약이 같이 있다:

- **`llms-full.txt`** — 위와 같은 구조에 모든 링크 콘텐츠를 인라인으로 평탄화한 단일 파일. "전체 문서를 한 번에 컨텍스트 윈도우에 던진다"는 용도.
- **`.md` 미러 URL** — `/foo/` 페이지가 `/foo.md`로도 마크다운 형태로 접근 가능. nbdev는 자동으로 한다. FastHTML이 처음 도입했다.

## 채택 현황 — 문서 사이트는 yes, LLM 제공자는… 아직 아니다

문서 사이트들은 광범위하게 채택했다. Anthropic 공식 docs, Cloudflare, Mintlify (자동 생성), Vercel, Supabase, Hugging Face, FastHTML — 다 `/llms.txt`를 게시한다. Mintlify, Fern, Docusaurus 플러그인이 보급의 주역이다.

아무도 입 밖으로 잘 안 꺼내는 부분: **주요 LLM 제공자 중 누구도 `llms.txt`를 페치한다고 공식적으로 인정한 적 없다.** OpenAI의 GPTBot, Anthropic의 ClaudeBot, Google-Extended — 다 HTML을 크롤하고 `sitemap.xml`을 따른다. 어느 공식 문서에도 `llms.txt`를 우선시한다거나 읽는다는 언급이 없다. Google의 John Mueller도 2024년 말 "현재 어떤 AI 서비스도 llms.txt를 사용한다는 증거가 없다"는 취지로 공개 발언을 했다.

그래서 오늘 `llms.txt`는 **작동하는 SEO 채널이라기보단 좋은 문서 위생** 쪽에 가깝다. 다만 추가 비용이 거의 zero고, 만약 제공자들이 나중에 소비하기 시작하면 — 이미 갖춰져 있는 거다.

## Hugo 구현

추가하는 방법은 두 가지다:

1. `static/llms.txt`에 정적 파일을 넣는다. 끝. 한 달 뒤면 노후화된다.
2. Hugo의 [Output Formats](https://gohugo.io/templates/output-formats/)를 통해 콘텐츠에서 자동 생성한다. 새 글 올라올 때마다 자동 갱신.

포스트가 정기적으로 추가되는 블로그에선 (2)가 유일한 정답이다.

### 1단계 — output format 등록

`config.yaml`:

```yaml
outputFormats:
  LLMS:
    mediaType: "text/plain"
    baseName: "llms"
    isPlainText: true
    notAlternative: true

outputs:
  home: ["HTML", "RSS", "JSON", "LLMS"]
```

`isPlainText: true`는 Hugo의 HTML-aware 처리를 건너뛴다. `notAlternative: true`는 `<link rel="alternate">` 체인에서 제외시킨다 — `llms.txt`는 홈페이지의 alternate representation이 아니니까.

### 2단계 — 템플릿 작성

`layouts/index.llms.txt`:

```go-html-template
# {{ .Site.Title }}

> {{ .Site.Params.siteDesc }}

{{ .Site.Params.siteName }} is the personal tech blog of {{ .Site.Params.author }}.

## Pages
- [About]({{ "about.html" | absURL }}): About the author
- [Articles]({{ "articles.html" | absURL }}): Curated articles index

## Blog Posts
{{- range first 80 (where .Site.RegularPages "Section" "blog") }}
- [{{ .Title }}]({{ .Permalink }}){{ with (.Description | default (.Summary | plainify | truncate 140)) }}: {{ . }}{{ end }}
{{- end }}

## Optional
- [RSS Feed]({{ "index.xml" | absURL }})
- [Tags]({{ "tags/" | absURL }})
```

빌드하면 Hugo가 `public/llms.txt`를 자동으로 emit한다. 다른 정적 파일처럼 S3/CloudFront에 동기화. `Content-Type` 검증:

```bash
hugo --gc --minify
head public/llms.txt              # '# thats.nono'로 시작
curl -I https://www.yopa.page/llms.txt   # Content-Type: text/plain
```

끝.

## 일부러 안 한 것들

- **`llms-full.txt`**. 끌리긴 하는데, 180개+ 포스트를 가진 블로그라면 용량이 거대해지고, 누가 페치한다는 증거도 없다.
- **`.md` 미러 URL.** `outputs.page`에 두 줄만 추가하면 되긴 하지만, 캐싱/콘텐츠 drift 표면적을 두 배로 늘린다. 보류.

## 솔직한 견해

`llms.txt`를 yopa.page에 추가한 이유는 — Claude나 ChatGPT가 내일부터 이걸 읽기 시작할 거라 기대해서가 아니라, 비용이 템플릿 하나에 ongoing maintenance가 zero이기 때문이다. 표준이 자리잡으면 내 사이트는 준비되어 있다. 안 자리잡으면? 30분 잃은 거다.

이 비대칭 — **싸게 채택하고, 미래 upside에 대한 free option** — 이 지금 이걸 하는 유일한 이유다. 콘텐츠 전략을 이걸 중심으로 다시 짜지 마라. 상사한테 SEO 지표 올려준다고 하지 마라. 그냥 파일 하나 ship하고 다음 일로 넘어가라.

## 참고

- 스펙: <https://llmstxt.org/>
- 저장소: <https://github.com/AnswerDotAI/llms-txt>
- 이 블로그의 [`llms.txt`](https://www.yopa.page/llms.txt)
- 추가한 PR: [ypark9/yopa.page#19](https://github.com/ypark9/yopa.page/pull/19)
