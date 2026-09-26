---
title: "Is Graph RAG Worth Eight Times the Cost? Reading a Framework's Own Benchmarks"
date: 2026-09-21T09:00:00-04:00
author: Yoonsoo Park
description: "An AWS framework puts GraphRAG and LightRAG on one stack and publishes what eight retrieval strategies cost and score. The headline is 0.12 F1 for eight times the query cost. The more useful findings are inside: the strategy built for big-picture questions loses to plain vector search, and the cheapest option from a different AWS project beats this one at the same price."
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

RAG (retrieval-augmented generation) means you search your documents first, then hand what you found to the model so it can answer from it. The usual way to search is vector search with top-k similarity. Every passage is turned into a list of numbers that stands for its meaning, the question is turned into the same kind of list, and you take the k passages whose numbers are closest to the question. k is usually somewhere between 3 and 10.

That works well when the answer sits in one passage that reads like the question. It works badly when the answer is spread across several documents. Take this question: "If this milestone is late, which of our contract duties get into trouble?" The answer is not written in any one place. It is spread across three documents, starting with a master agreement that ties a payment to the milestone. No single passage looks like the question, so top-k similarity never pulls the right three together.

Knowledge graph RAG is built for that kind of question. While it reads your documents, it pulls out entities (the things: a contract, a company, a milestone) and edges (the links between them: "this payment depends on this milestone"). It stores those as a graph. At question time it can start from the milestone and walk the edges to the payment, then on to whatever depends on that payment, even when those facts live in three different files. That walk is where the extra accuracy comes from. The open question has always been whether that accuracy is worth the extra machinery, and people usually argue about it instead of measuring it.

On 2026-09-14, AWS published an Open Source blog post for `unified-kg-rag-on-aws` (Apache-2.0), and it measures. It puts two methods, Microsoft's GraphRAG and LightRAG, on one stack of Bedrock, Neptune, and OpenSearch. It gives you eight retrieval strategies that you can switch per question, and it tests them on the same questions with the same model and the same scorer.

The numbers are why this post is worth a whole article and not just a bookmark. So are the places where the numbers disagree with the marketing.

## What the benchmark says

The authors used two public multi-hop benchmarks, MuSiQue and 2WikiMultihopQA. "Multi-hop" means the answer needs facts from more than one document. Each set has 100 questions, and no single document holds any answer. Costs come from separate 20-question runs, one question at a time. Pricing is Claude Sonnet 4.5 and Titan Text Embeddings V2, on-demand in us-west-2, measured in August 2026.

The score is token-F1, averaged over three runs. Here is what it measures. Split the model's answer and the correct answer into words. Precision is the share of the model's words that also appear in the correct answer, so it goes down when the model adds extra stuff. Recall is the share of the correct answer's words that the model got, so it goes down when the model misses parts. F1 is a balanced average of the two. 1.0 means the answer matches the correct one word for word, and 0.0 means they share nothing.

| Strategy | Method | MuSiQue | 2Wiki | Query cost per 1,000 | Median response |
| --- | --- | --- | --- | --- | --- |
| hybrid | LightRAG | **0.634** | 0.628 | $42.29 | 19.8s |
| mix | LightRAG | 0.602 | **0.654** | $38.67 | 23.6s |
| local | GraphRAG | 0.519 | 0.577 | **$5.23** | **6.5s** |
| drift | GraphRAG | 0.379 | 0.541 | $7.99 | 12.0s |
| naive | LightRAG, vector only | 0.354 | 0.424 | $8.56 | 7.3s |
| global | GraphRAG | 0.231 | 0.396 | $66.22 | 17.3s |
| simple | GraphRAG | 0.209 | 0.374 | $7.41 | 5.1s |

Each strategy is a different way of pulling context out of the same graph and the same search indexes. You pick one per question.

GraphRAG side. During ingestion GraphRAG also groups tightly linked entities into clusters it calls communities, and has the model write a short summary of each one. Some strategies use those summaries.

- `simple`: plain search in OpenSearch, by meaning (vector) and by keyword. No graph at all.
- `local`: finds the entities the question mentions, walks the graph to their neighbors and links, and adds matching text passages.
- `global`: reads the community summaries in batches, gets a partial answer from each batch, then merges the partial answers into one. This pattern is called map-reduce.
- `drift`: does one search, looks at what came back, and searches again with a sharper query. It repeats for a few rounds until the results stop changing.
- `auto` is not in the table. It lets the model pick one of the four above for each question.

LightRAG side. LightRAG first has the model pull two kinds of keywords from the question: broad ones (themes, like "payment risk") and specific ones (names, like "Acme").

- `naive`: vector search on text chunks only. It is the no-graph starting point, which is why the table says "vector only".
- `hybrid`: broad keywords search an index of edges, specific keywords search an index of entities, and then the graph adds the nodes next to what was found.
- `mix`: `hybrid`, plus the plain vector search from `naive`, merged into one result.

The main tradeoff sits in two rows of the table. `hybrid`, the most accurate, scores 0.634 on MuSiQue. `local`, the cheapest graph strategy, scores 0.519. The gap is about 0.12. On a 0 to 1 scale that sounds small, but it means `hybrid`'s answers share about 22% more of the right words than `local`'s do. The price for it is eight times the query cost ($5.23 to $42.29 per 1,000 questions) and three times the wait (6.5 seconds to 19.8 seconds).

So the real question is not "which retrieval strategy". It is "how many questions a month, and how many seconds can the user wait". The volume decides the architecture, and the post does the math. At 1,000 questions a month, `hybrid` costs $42 and `local` costs $5. At 100,000 questions a month, the same 0.12 F1 costs $3,700 a month.

## Finding 1: the strategy built for big-picture questions loses to plain vector search

Some questions are about the whole collection, not one fact. "What are the main themes in these contracts?" is one. `global` is GraphRAG's strategy for that kind of question. Since the community summaries cover the whole collection, reading all of them should give a good big-picture answer. It is also the most expensive strategy in the table, $66.22 per 1,000 questions, because one answer takes about 17.6 model calls.

Neither benchmark above has big-picture questions, so the authors ran a separate test. They took 28 of them from a dataset called UltraDomain. For each question, they put a `global` answer next to a plain vector search answer and had an LLM (large language model) judge pick the better one. `global` was better only 64% of the time. With just 28 questions, you can't tell 64% apart from a coin flip. In the same test, `mix` was better 93% of the time and `local` 82%.

The post says the reason is how different the pieces of context are, not how many there are. `global` gave the answering model about 4 pieces of context per question, and `mix` gave about 135. But `global` was not short on text; its 4 pieces were long summaries. The problem is that all 4 describe the collection from the same high-up view. `mix`'s 135 short pieces come from many different documents. The model gives better answers when it has many different things to work from.

Cost makes it worse. `global` reads summaries in batches and merges partial answers, so its cost per question grows with the size of the collection, not with how much it finds. Add more documents and every single question gets more expensive. The post's own advice: use `global` only when a summary of the whole collection is the thing you are asked to produce. When you want the best answer, use `mix`, even for questions that sound like big-picture ones.

This is the finding I would bring to a design review. A strategy whose description matches your question is not always the one that answers it best.

## Finding 2: at the cheap end, a different AWS project wins

AWS also ships `aws-graphrag-toolkit`. It does not copy either paper. It builds its own graph of topics, statements, and facts. The authors compared its best mode against the best strategy here on each dataset. On MuSiQue, `hybrid` scored 0.634 and the toolkit's traversal mode, which follows the links in its graph, scored 0.590. On 2Wiki, `mix` scored 0.654 and the toolkit's semantic-guided mode scored 0.652. Those gaps are small enough to be noise. The authors computed a 95% confidence interval for each, which is the range the real gap probably falls in, and both ranges include zero. So they say plainly that neither one is more accurate at the top.

The cheap end is a different story, and it does not favor the newer framework. The same toolkit traversal mode costs $5.77 per 1,000 questions, almost the same as `local` at $5.23. For that price it scores 0.590 against `local`'s 0.519 (same token-F1 score, same MuSiQue questions), and it answers a bit faster. This time the authors say the gap is statistically significant, which means it is too big to be chance.

So picking between the two is not about accuracy.

- **aws-graphrag-toolkit.** Pro: better answers for the same money at the cheap end. Con: its own graph design, so it does not behave like either paper.
- **unified-kg-rag-on-aws.** Pro: you get the retrieval behavior a specific paper describes, and you can compare all the strategies on your own documents. Con: its cheapest graph strategy scores lower for the same price.

## Finding 3: the ingestion cost worry is overblown

The common complaint about GraphRAG is that you pay a lot up front, because it writes a summary for every community before anyone asks a question. On the one collection the authors measured, those community summaries were only 7.6% of the total ingestion bill. Most of the bill is pulling entities and edges out of every document, and both methods need that step anyway.

You can also skip communities. `global` and `drift` need them, and the LightRAG strategies do not. So if you end up on the LightRAG side, you can turn community building off. What you cannot skip is a full rebuild when you change the extraction prompts or the chunking settings, because those settings change what every document produces. Incremental indexing, which re-indexes only new or changed documents, is the right default, but it does not help in that case.

## The limits the authors state, which I would keep

- Both benchmarks were built to need facts from more than one document, so they favor graph retrieval by design. Expect your own documents to change the order.
- 100 questions is enough to spot a gap of about 0.1 F1, but not enough to prove two strategies are equal. When a gap is not significant, read it as "no difference we could detect", not "the same".
- Treat any single-run difference under about 0.05 as noise. That band is different for each strategy.
- The top two strategies swapped places between the two datasets, and single scores moved by up to 0.16. Two datasets were enough to change the ranking.

## What I would actually decide

- **Low thousands of questions a month, accuracy matters, 20-second answers are OK**: `hybrid` or `mix`. At that volume the extra cost is around $40 a month, which is not the thing holding you back.
- **More volume than that, or answers needed in under 10 seconds**: `local`. It gets about 82% of `hybrid`'s score for one-eighth of the cost.
- **Questions that look up one fact**: try plain vector search before you add a graph at all. A graph pays off only on questions that need facts from more than one document.
- **A summary of the whole collection is what you have to deliver**: `global`, knowing it is the most expensive strategy and that its cost grows with the collection.

## What I have not run, and what running it would cost

I have not deployed this framework. It spins up real Neptune, OpenSearch, and Bedrock capacity, and the post says plainly that it is a reference implementation, not ready for production as it is. So this article is my reading of the published numbers and the limits the authors wrote down. The table is their measurement on their benchmarks, not mine on my documents.

The right move is to rerun the table on a sample of my own documents with my own model, because two benchmarks were enough to swap the top two strategies. So I priced that out, and then I decided not to run it.

### The estimate

A two-week window, 250 documents, 150 questions, three runs, four strategies, single-AZ (one data center) dev setup.

| Line item | 14 days | Share |
| --- | --- | --- |
| Neptune cluster, OpenSearch domain, NAT gateway, support services | $211 | 52% |
| Bedrock ingestion: pulling out entities and edges, three builds | $165 | 41% |
| Bedrock queries: 450 per strategy at the source post's per-1,000 rates | $26 | 6% |

About $400 before a safety margin, and $400 to $650 with one.

The biggest line is not the model. It is the hourly base charge. A Neptune cluster and a managed OpenSearch domain both bill by the hour, and neither one can scale down to zero. So that 52% keeps adding up whether anyone is asking questions or not.

That turns the obvious way to save money upside down. The number of strategies drives only 6% of the bill, so testing half as many saves about $20. Cutting the window from fourteen days to seven saves $105. For an experiment like this, you save money by shortening the schedule, not by testing fewer strategies. I did not expect that when I started adding it up.

### Which strategies I would test, and which I would drop

Four. `naive` as the no-graph baseline, because without it no other number means anything. `local`, because it is the only graph strategy whose cost per question holds up at real volume. `mix`, as the best accuracy to aim for. And a managed Bedrock Knowledge Base as an outside baseline. It is not in the source table, and it is the most important one, because it is what I would build if I did nothing else.

Dropped:

- `hybrid`: its score is inside the noise band of `mix`, and the two already swapped places between the post's own datasets. Running both is flipping the same coin twice at double the cost.
- `global`: at $66.22 per 1,000 and a 64% win rate against plain vector search, no score it could get would change what I build.
- `drift` and `simple`: `local` beats both on score and on price.
- `auto`: it lets the model pick a strategy, so testing it measures how well the model picks, not how well retrieval works.

### The number that would have changed my mind

One check decides all of this, and it costs nothing: what share of real questions actually need facts from more than one document?

That is this article's own advice turned back on me. For questions that look up one fact, try plain vector search before adding a graph. If most real questions are simple lookups or how-to questions, the graph has nothing to find that vector search is missing, and no result from a $500 run changes what gets built.

There is a harder bar under that. We already have a managed option for the same decision. On our own test set of known questions and answers, it puts the right document in the top 5 results about 90% of the time (hit@5 around 0.9), and it bills only for what you use, with no hourly base charge. For a graph stack to replace that, beating plain vector search is not enough. It has to beat the managed option by enough to pay for a monthly base charge plus a database engine nobody on the team runs today. That margin is not 0.05. It is closer to 0.15.

A gap that big does not show up anywhere in the source table between a graph strategy and vector search, and those benchmarks were built to need facts from several documents. Expecting it on documents that were not built that way is not a good bet.

So this article does not end with a measurement. It ends with a priced decision not to measure, and the line that would change it: if more than a quarter of real questions need facts from more than one document, the $400 to $650 is worth spending, and this section gets replaced with a table. Until then, "rerun it on your own documents" is still the right instinct. It just has a price tag on it now.

One process note I want to keep. I wrote the teardown plan before the setup plan. Neptune and OpenSearch bill by the hour. `cdk destroy` (the AWS CDK, or Cloud Development Kit, command that deletes a deployed stack) does not remove CloudWatch log groups, KMS encryption keys that are still in their waiting period before deletion, Elastic IP addresses left behind by a NAT gateway, or a cache bucket that failed to empty. And you cannot check that everything is gone if you forgot to tag some of it when you deployed. Deciding not to deploy made all of that go away. Writing the teardown plan first is how I found out it was the expensive part.

## Sources

- AWS Open Source Blog, [Unified Knowledge Graph RAG on AWS: GraphRAG and LightRAG on one stack](https://aws.amazon.com/blogs/opensource/unified-knowledge-graph-rag-on-aws-graphrag-and-lightrag-on-one-stack/), September 14, 2026.
- Framework repository, [awslabs/unified-kg-rag-on-aws](https://github.com/awslabs/unified-kg-rag-on-aws) (Apache-2.0).
- Comparison project, [awslabs/graphrag-toolkit](https://github.com/awslabs/graphrag-toolkit).
- Original methods: Microsoft GraphRAG ([arXiv:2404.16130](https://arxiv.org/abs/2404.16130)) and LightRAG ([arXiv:2410.05779](https://arxiv.org/abs/2410.05779)).

Related: [choosing a vector store on AWS](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html). Graph-aware retrieval gets one row in that article's decision table, and this article is the detail behind that row.

Checked on 2026-09-21. All figures come from the published benchmark table in the source post, and I did not measure them again. The cost estimate was added on 2026-09-23. The AWS prices in it are rough, and the ingestion token count is estimated, not measured.
