---
title: "Is Graph RAG Worth Eight Times the Cost? Reading a Framework's Own Benchmarks"
date: 2026-09-21T09:00:00-04:00
author: Yoonsoo Park
description: "An AWS framework puts GraphRAG and LightRAG on one stack and publishes what eight retrieval strategies cost and score. The headline is 0.12 F1 for eight times the query cost, but the more useful findings are inside: the strategy named for thematic questions loses to plain vector search, and the cheapest arm beats the flagship at the same price."
categories:
  - AWS
  - Machine Learning
  - RAG
tags:
  - RAG
  - Amazon Bedrock
  - Amazon Neptune
  - Knowledge Graphs
---

Vector RAG answers a question when the answer sits in a passage you can find by similarity. It strains when the answer is spread across documents, or lives in the relationships between things rather than in the words. "Which obligations are exposed if this milestone slips" is a question about structure, and no amount of top-k similarity will retrieve a structure.

Knowledge-graph RAG is built for that shape. It extracts entities and relationships from your corpus, then reasons over the graph instead of over isolated chunks. The open question has always been whether the extra accuracy justifies the extra machinery, and it is usually argued rather than measured.

On 2026-09-14, AWS published an Open Source blog post for `unified-kg-rag-on-aws` (Apache-2.0), which addresses that by publishing numbers. It puts two methodologies, Microsoft's GraphRAG and LightRAG, on one stack of Bedrock, Neptune, and OpenSearch, exposes eight retrieval strategies that you can switch per query, and benchmarks them against the same questions with the same model and scorer.

The numbers are the reason this post is worth an article rather than a bookmark, and so are the places where the numbers contradict the marketing.

## What the benchmark says

Two public multi-hop benchmarks, MuSiQue and 2WikiMultihopQA, 100 questions each, built so no single document holds the answer. Scores are token-F1, the mean of three runs, and costs come from separate 20-question runs executed one at a time. Pricing is Claude Sonnet 4.5 and Titan Text Embeddings V2 on-demand in us-west-2 as measured in August 2026.

| Strategy | Methodology | MuSiQue | 2Wiki | Query cost per 1,000 | Median response |
| --- | --- | --- | --- | --- | --- |
| hybrid | LightRAG | **0.634** | 0.628 | $42.29 | 19.8s |
| mix | LightRAG | 0.602 | **0.654** | $38.67 | 23.6s |
| local | GraphRAG | 0.519 | 0.577 | **$5.23** | **6.5s** |
| drift | GraphRAG | 0.379 | 0.541 | $7.99 | 12.0s |
| naive | LightRAG, vector only | 0.354 | 0.424 | $8.56 | 7.3s |
| global | GraphRAG | 0.231 | 0.396 | $66.22 | 17.3s |
| simple | GraphRAG | 0.209 | 0.374 | $7.41 | 5.1s |

The headline tradeoff is one line of this table. The most accurate strategy gains about 0.12 F1 over the cheapest graph strategy, at eight times the query cost and three times the latency.

Whether that matters is entirely a volume question, and the post does the arithmetic. At 1,000 questions a month, hybrid is $42 against local's $5. At 100,000 questions a month, the same 0.12 F1 costs $3,700. That is the framing that decides the architecture, and it is why "which retrieval strategy" is not the interesting question. "How many questions per month, and how long can the user wait" is.

## Finding 1: the strategy named for thematic questions loses to plain vector search

`global` is GraphRAG's community-summary mode. It is designed to answer corpus-wide, thematic questions by map-reducing over summaries of the graph's communities. It is also the most expensive strategy measured, at $66.22 per 1,000 questions, because a single answer takes about 17.6 model calls.

When the authors tested it against genuinely thematic questions, using 28 questions from UltraDomain with an LLM judge, `global` won only 64% of head-to-head comparisons against plain vector search. At that sample size, 64% is not distinguishable from chance. `mix` won 93% and `local` won 82%.

The explanation the post gives is variety, not volume. `global` assembled 4.2 context items per question against `mix`'s 134.8, but not because it lacked material: four long summaries describe the corpus at one level of abstraction, while 135 shorter items reach into many different documents. The answering model reasons better over more distinct things.

There is a cost consequence too. Because `global` reads batches of summaries and combines partial answers, its per-query cost scales with corpus size rather than with how much it retrieves. Growing the corpus makes every question more expensive instead of spreading the cost. The post's own recommendation is to use `global` only when a corpus-wide narrative is itself the deliverable, and to use `mix` when you want the best answer, including for questions that sound thematic.

That is the finding I would carry into a design review. The strategy whose description matches your question is not automatically the strategy that answers it.

## Finding 2: at the cheap end, a different AWS project wins

AWS also ships `aws-graphrag-toolkit`, which builds its own graph of topics, statements, and facts rather than reproducing either paper. At the top of the accuracy range the two implementations land on the same scores inside the confidence interval, so the authors state plainly that there is no accuracy advantage in either direction.

At the cheap end the ranking is clearer, and it does not favor the newer framework. For essentially the same money, $5.77 against $5.23 per 1,000 questions, the toolkit's traversal mode scores 0.590 against `local`'s 0.519 and returns slightly faster, a gap the authors report as significant.

So the choice between the two is not an accuracy choice. It is reach for the toolkit when per-query cost binds, and reach for this framework when you need the retrieval behavior a specific paper describes or when you want to compare strategies on your own corpus.

## Finding 3: the ingestion cost story is exaggerated

The intuitive objection to GraphRAG is that it pays at ingestion, summarizing every community before the first question arrives. Measured on one corpus, community summarization was 7.6% of the total ingestion bill. The dominant cost is extracting entities and relationships from every document, and both methodologies need that step.

Community detection is also optional by design: `global` and `drift` need it, the LightRAG modes do not, so if you land on the LightRAG side you can turn it off. What is not optional is that changing extraction prompts or chunking configuration requires a full rebuild, because those settings change what every document would produce. Incremental indexing re-indexes only new or changed documents, which is the right default and does not rescue you from that case.

## The caveats the authors state, which I would keep

- Both benchmarks were designed to need hops between documents, so they flatter graph retrieval by construction. Expect your own corpus to reshuffle the order.
- 100 questions detects a difference of roughly 0.1 F1 but cannot prove two strategies equivalent. Read "matching" as "no difference we can detect".
- Treat any single-run difference under about 0.05 as noise, and note that the band varies by strategy.
- The top two strategies swapped places between the two datasets, and individual scores moved by up to 0.16. Two datasets were enough to reorder the ranking.

## What I would actually decide

- **Low thousands of questions per month, accuracy matters, 20-second responses are acceptable**: `hybrid` or `mix`. The cost difference is $40-ish per month at that volume, which is not the constraint.
- **Volume beyond that, or answers needed under 10 seconds**: `local`, at roughly 82% of `hybrid`'s accuracy for an eighth of the cost.
- **Single-fact lookups**: evaluate plain vector search before adopting a graph at all. A graph earns its cost on the questions that need hops.
- **A corpus-wide narrative is the deliverable**: `global`, knowing it is the most expensive strategy and that its cost grows with the corpus.

## What I have not run

I have not deployed this framework. It provisions real Neptune, OpenSearch, and Bedrock capacity, and the post states plainly that it is a reference implementation rather than production-ready as-is. So this is a reading of published benchmarks and stated caveats, with an evidence class of documentation-derived, and the numbers in the table are the authors' measurements on their benchmarks, not mine on my corpus.

What I would want before adopting it: the same table regenerated on a sample of my own corpus, with my own model, because the two benchmarks in the post were enough to reverse the top two strategies and yours can plausibly do it again. That is a paid experiment rather than a local one, so it is a decision with a cost attached.

## Sources

- AWS Open Source Blog, [Unified Knowledge Graph RAG on AWS: GraphRAG and LightRAG on one stack](https://aws.amazon.com/blogs/opensource/unified-knowledge-graph-rag-on-aws-graphrag-and-lightrag-on-one-stack/), September 14, 2026.
- Framework repository, [awslabs/unified-kg-rag-on-aws](https://github.com/awslabs/unified-kg-rag-on-aws) (Apache-2.0).
- Comparison project, [awslabs/graphrag-toolkit](https://github.com/awslabs/graphrag-toolkit).
- Upstream methodologies: Microsoft GraphRAG ([arXiv:2404.16130](https://arxiv.org/abs/2404.16130)) and LightRAG ([arXiv:2410.05779](https://arxiv.org/abs/2410.05779)).

Related: [choosing a vector store on AWS](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html), where graph-aware retrieval gets one row in the decision table and this article is the depth behind it.

Verified on 2026-09-21. All figures come from the published benchmark table in the source post and were not re-measured.
