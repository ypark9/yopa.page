---
title: "When Google Standardizes the Thing You Built Anyway"
date: 2026-06-22T18:30:00-04:00
author: Yoonsoo Park
description: "I built knowledge-base agents that generate an LLM wiki instead of running a vector RAG pipeline. It always nagged at me that this wasn't an industry standard, that it was toy logic. Then Google published the Open Knowledge Format, which specifies almost exactly the pattern I'd been using. Here's what OKF is, why a directory of markdown files beats a vector store for some jobs, and what it cost me to become conformant."
categories:
  - AI
  - Engineering
tags:
  - agents
  - rag
  - knowledge-base
  - llm-wiki
  - okf
---

For the last several months I've been building knowledge-base agents that do something slightly heretical. Instead of standing up a vector store, chunking documents, and running similarity search at query time, the agent reads source material once and compiles it into a wiki. A directory of markdown files with YAML frontmatter, cross-linked, with an index and a change log. When a downstream agent needs to answer a question, it reads the wiki the way a person would: open the index, follow the links, read the pages.

It worked well. Better than the RAG pipeline it replaced, for the kind of slow-changing structured knowledge I was dealing with. But it always nagged at me. Vector RAG is what everyone writes blog posts about. It's what the frameworks assume. My markdown-wiki thing felt like a toy I'd built in a corner, a clever hack that no serious team would adopt. I kept waiting for someone to tell me I was doing it wrong.

Then Google published the Open Knowledge Format.

## What OKF actually is

OKF is a draft spec from the Google Cloud knowledge-catalog project. The one-line version: a knowledge corpus is a directory of markdown files with YAML frontmatter, and that's it. No schema registry. No central authority. No required SDK. The spec's own line is "if you can `cat` a file, you can read OKF; if you can `git clone` a repo, you can ship it."

The structure is almost embarrassingly small:

- Every concept is one markdown file. The file path minus `.md` is its ID.
- Each file has a frontmatter block. Exactly one field is required: `type`. Everything else (`title`, `description`, `resource`, `tags`, `timestamp`) is recommended but optional.
- `index.md` is a reserved filename for a directory listing. `log.md` is reserved for a change history. Both are optional.
- Links between concepts are plain markdown links. A link from A to B just asserts "these are related." The kind of relationship is left to the surrounding prose. Consumers treat every link as an untyped directed edge.
- Broken links are allowed. The target might be knowledge that hasn't been written yet.

That's the whole format. The conformance rules in the spec are equally permissive: a bundle is conformant if its non-reserved markdown files have parseable frontmatter and every frontmatter has a non-empty `type`. Consumers are explicitly forbidden from rejecting a bundle over missing optional fields, unknown types, unknown keys, broken links, or a missing index. The format is built to stay useful while it's half-written and partially machine-generated, which is exactly the state most real knowledge ends up in.

And the spec names its inspirations directly. Section 10 lists "LLM wiki repos" and "metadata as code" as the patterns OKF is intentionally close to. That was the sentence that made me sit up. The thing I'd been quietly building was, word for word, one of the named reference patterns for an emerging open standard.

## Why a directory of files beats a vector store for some jobs

The instinct in 2026 is that RAG means embeddings and a vector database. For a lot of problems that's correct. If your corpus is huge, unstructured, and you need fuzzy recall over millions of chunks, you want a vector store.

But vector RAG rediscovers your knowledge from scratch on every single query. It pulls the top-k chunks that are similar to the question and hands them to the model, and the model has to re-synthesize an answer, re-resolve contradictions, and re-trace relationships every time. The knowledge never compounds. The retrieval is only as good as the chunking, and the chunking throws away the structure that made the source coherent in the first place.

A compiled wiki inverts that. You pay the synthesis cost once, at write time. Cross-references are already there. Contradictions have already been flagged and reconciled by whoever (or whatever) wrote the page. The relationships between concepts are encoded in the link graph, not reconstructed from cosine similarity. When the consuming agent reads a page, it gets the curated view, not a bag of nearest-neighbor fragments.

So the decision is less "RAG vs not RAG" and more about the shape of your knowledge:

- **Slow-changing, structured, relationship-heavy knowledge** (a data model, a set of internal systems, a domain ontology): a compiled wiki wins. The structure is the value, and the wiki preserves it.
- **Huge, fast-changing, unstructured corpora** (a support ticket history, a sprawling document hoard): vector RAG wins. You can't hand-compile a million tickets, and you don't need the relationships.
- **The honest answer for a lot of internal tooling is "both"**: a small curated wiki for the structured core, vector search over the long tail.

The wiki approach also has a property that matters more than it sounds: a human can read it. It's just markdown in git. You get diffs, attribution, code review, and the ability to open it in Obsidian and look at the graph. A vector store is an opaque blob of floats. When the agent gives a weird answer, you can open the wiki page and see exactly what it read.

## The conformance cost was basically zero

Here's the part that turned the nagging feeling into something useful. I checked my existing wikis against the OKF conformance rules to see how far off I was.

I was off by about two lines.

My wiki generator was already emitting markdown files with YAML frontmatter, organized into a directory tree, with cross-links and a machine-readable index. The only thing the spec strictly requires that I wasn't doing was the `type` field in frontmatter. Adding it is one line in the generator's frontmatter dict. The other gap was cosmetic: I had a machine-readable `index.json` but not the spec's `index.md`, so I generate both now. The query library that consumes the index never noticed, because `index.md` and `type` are additive surface for external consumers, not changes to my runtime.

Everything else lined up on its own. My cross-links were Obsidian-style `[[wikilinks]]` rather than the spec's `[text](/path.md)`, but OKF treats links as soft guidance and never rejects a bundle over link format, so I kept the wikilinks (my reader parses them) and the bundle is still conformant. Untyped edges, permissive consumption, frontmatter-per-document: I'd arrived at the same design decisions independently, because they're the decisions the problem pushes you toward.

## Pitfalls I've actually hit

Running this pattern for real surfaced a few things the spec doesn't warn you about:

- **Duplicate pages are the default failure mode.** If the agent doesn't check the index before writing, it creates a second page for an entity that already exists under a slightly different name. The fix is a hard rule: orient first, search the index, then write. The wiki degrades into a pile the moment you skip this.
- **Orphan pages are invisible.** A page with no inbound links might as well not exist, because nothing will ever traverse to it. Every new page needs at least a couple of inbound links from existing pages, or it's dead weight.
- **The index and the log are the navigational backbone, not bookkeeping.** It's tempting to skip updating them. Don't. The index is how everything gets found; a stale index means real pages become unreachable.
- **Broken links are fine until they're not.** The spec is right that a broken link can mean "not written yet." But you still want a lint pass that distinguishes intentional forward-references from typos, or the graph slowly rots.

## What I actually got out of this

The practical win is small and concrete: a couple of lines in a generator and I can describe my knowledge bases as OKF-conformant instead of as a bespoke hack. When I explain the design to someone now, I have a reference to point at.

The bigger thing is the feeling going away. I'd been carrying this low-grade doubt that the markdown-wiki approach was a toy, that I'd taken a wrong turn while everyone else went vector. It turns out the intuition was pointing the same direction Google is now trying to standardize. The pattern wasn't a hack. It was an early implementation of something that was going to get a spec eventually.

That's worth writing down, if only as a note to self: when a simple design keeps working and you can't find the standard it conforms to, sometimes the standard just hasn't been written yet. Build the simple thing. Wait for the spec to catch up.
