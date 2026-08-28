---
title: "DynamoDB Now Does Vector Search: When It Replaces Your Vector DB (and When It Doesn't)"
date: 2026-08-06T09:00:00-04:00
lastmod: 2026-08-28
reviewed_at: 2026-08-28
author: Yoonsoo Park
description: "DynamoDB can now store embeddings and run similarity search on the same table as your operational data. Here is a running example, a before/after of the sync pipeline it removes, and an honest read on when it actually replaces a dedicated vector store."
categories:
  - AWS
  - RAG
tags:
  - amazon-dynamodb
  - vector-search
  - rag
  - amazon-bedrock
  - semantic-search
  - architecture
---

> DynamoDB now supports native vector search. You store embeddings as an attribute on your items and run similarity search directly on the table, so one table is both your operational datastore and your vector store. This is a real simplification for a specific shape of app, and a trap for others. Here is the running example, the pipeline it deletes, and where the line actually sits.

> **Review note (2026-08-28):** The current API contract is `SearchVectors`, not `Query`. The example and the tenant-isolation warning below follow the current [DynamoDB vector-index documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/VectorSearchWorkingWith.html).

If you read my [AWS vector database decision guide](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html), this is a new entry on that same cost/latency curve. The pitch is different from every other option there: it is not a better vector store, it is *no separate vector store at all*.

## The running example

Say you run a product catalog. Every product already lives in a DynamoDB table, keyed by `product_id`, with `title`, `description`, `price`, `category`. Reads and writes are already fast and cheap. Now the product team wants "find similar products" and natural-language search ("a warm jacket for hiking in the rain") that matches by meaning, not keywords.

That semantic layer needs embeddings and nearest-neighbor search. The question is where those vectors live.

## Before: a second database and a pipeline to keep it honest

The standard answer until now was a dedicated vector store next to DynamoDB. You generate an embedding for each product, write it to the vector store keyed back to `product_id`, and at query time you search the vector store, get IDs, then round-trip to DynamoDB to fetch the actual product rows.

The cost is not the vector store itself. It is the plumbing:

```
DynamoDB (source of truth)
    | DynamoDB Streams
    v
Lambda (embed on change) --> Bedrock (Titan embeddings)
    |
    v
Vector store (OpenSearch / pgvector / etc.)   <-- must stay in sync

query time:
  query --embed--> vector store --> [product_id, ...] --> DynamoDB BatchGetItem --> rows
```

Three durable problems come bundled with that diagram:

- **Sync drift.** Every product write has to fan out to the vector store. Miss one (Lambda error, throttle, a backfill that half-finished) and search silently returns stale or missing results. You now own a reconciliation job.
- **Two round trips.** The vector store returns IDs, so you still hit DynamoDB to get the row the user actually wants to see. That is latency and a second failure surface on every search.
- **Two bills, two scaling stories.** You provision, patch, and pay for a second datastore whose only job is to mirror data you already have.

## After: the vector is just an attribute

With native vector search you add a vector index to the table you already have. The embedding becomes an attribute on the product item. There is no second store and no sync pipeline, because the vector lives on the same item as the row it describes.

Create the index (you can also add one to an existing table with `UpdateTable`, no re-create):

```python
dynamodb.create_table(
    TableName="Products",
    AttributeDefinitions=[{"AttributeName": "product_id", "AttributeType": "S"}],
    KeySchema=[{"AttributeName": "product_id", "KeyType": "HASH"}],
    VectorIndexes=[
        {
            "IndexName": "VectorIndex",
            "VectorAttribute": {"AttributeName": "embedding"},
            "Dimensions": 1024,                 # must match your embedding model
            "DistanceFunction": "DOT_PRODUCT",  # COSINE | DOT_PRODUCT | EUCLIDEAN
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
    BillingMode="PAY_PER_REQUEST",
)
```

Write a product with its embedding on the same item, in the same call that writes the row:

```python
emb = bedrock_embed(f"{title}. {description}")   # Titan Text Embeddings V2, normalized
table.put_item(Item={
    "product_id": pid, "title": title, "description": description,
    "price": price, "category": category, "embedding": emb,
})
```

Search returns the product rows directly, not just IDs:

```python
q = bedrock_embed("a warm jacket for hiking in the rain")
resp = dynamodb.search_vectors(
    TableName="Products",
    IndexName="VectorIndex",
    SearchVector=[{"N": str(value)} for value in q],
    TopK=5,
    ProjectionExpression="product_id, title, price, category",
)
# Each result has an Item and a Score; no second round trip is needed.
items = [result["Item"] for result in resp["SearchResults"]]
```

The whole `Streams -> Lambda -> vector store` diagram, plus the reconciliation job, plus the `BatchGetItem` round trip, is gone. Because `Projection` is `ALL`, the search returns every projected non-vector attribute in one call; the large vector attribute itself is omitted from results by default.

A few knobs that matter:

- **Dimensions** must equal your model's output (Titan V2 is 1024). Up to 4,096 is supported.
- **Capacity and result limits**: vector indexes require on-demand capacity (`PAY_PER_REQUEST`), and `TopK` is capped at 100 per request.
- **Distance function**: use `DOT_PRODUCT` when your embeddings are already unit-normalized (it equals cosine but skips the normalization step). Use `COSINE` for un-normalized vectors, `EUCLIDEAN` when magnitude matters. For `COSINE`/`EUCLIDEAN` lower is more similar, for `DOT_PRODUCT` higher is more similar.
- **Projection**: `ALL` returns the whole row, `INCLUDE` returns a chosen subset (smaller, cheaper index), `KEYS_ONLY` sends you back to a round trip. Pick `INCLUDE` when items are large.
- **Search is ANN** (approximate nearest neighbor), so you trade a sliver of exactness for predictable speed and cost. That is the right trade at scale, but it means recall is not 100 percent, which matters for the decision below.

## Multi-tenant isolation: the partition key does real work here

If your catalog is multi-tenant (each customer sees only their own products), the vector index's optional **partition key** is the interesting part. Define the index with a partition key of `tenant_id` and every search must supply a tenant value in `SearchConditionExpression`, so DynamoDB searches only that tenant's slice of the index. You get cheaper searches (less data scanned) and throughput that scales across partition-key values.

This is useful data scoping, but it is **not an access-control boundary**. Any principal with `dynamodb:SearchVectors` on the index can submit another tenant's partition-key value, and fine-grained `LeadingKeys` conditions do not apply to this API. For strict tenant isolation, use separate tables or indexes with separate IAM grants; still enforce the tenant value in your application authorization path.

## So when does this actually replace your vector DB?

Reach for DynamoDB native vector when:

- **DynamoDB is already your operational store** and the vectors describe rows you already keep there. This is the whole point. The win is deleting a pipeline, not gaining a better index.
- **Your dominant query is "give me the similar items and their data"** in one shot. Returning the row with the match is where this earns its keep.
- **You want per-tenant isolation and throughput** and a partition key maps cleanly onto your tenant boundary.
- **You want one bill and no second thing to operate.**

Do NOT reach for it when:

- **You need a full managed RAG pipeline.** DynamoDB gives you vector *search*. It does not give you document chunking, an ingestion pipeline, or a retrieve-and-generate orchestration. If you want that turnkey, Bedrock Knowledge Bases is still the fast path, and you would be rebuilding its plumbing by hand.
- **Recall has to be near-exact** over a modest corpus. ANN plus a tuned dedicated index (OpenSearch) will beat a general-purpose store on recall quality. Measure on your own golden set before you commit, this is the one number that quietly decides the migration.
- **Your source of truth is not in DynamoDB.** If the data lives in S3 or Postgres, adding DynamoDB just to hold vectors reintroduces the exact sync problem this feature removes, pointed the other way.

## Pitfalls

- **"Vector search" is not "RAG."** The feature returns nearest items. Chunking, embedding orchestration, and generation are still yours to build. Do not scope a project as "we'll use DynamoDB instead of a RAG stack" without accounting for the parts it does not do.
- **Dimensions are fixed at index creation and must match the model.** Switching embedding models later (different dimension) means a new index and a backfill. Pin your model choice deliberately.
- **`KEYS_ONLY` projection quietly brings back the round trip.** If you set it to keep the index small, you are back to a second `GetItem` per hit. Use `INCLUDE` with just the fields the result view needs.
- **The read API is not `Query` or `Scan`.** Vector indexes are readable through `SearchVectors` only. Results are capped at 16 MB with no pagination, so a wide `ALL` projection plus a high `TopK` can exceed the response limit; narrow the projection or reduce `TopK` for large items.
- **Measure recall, not vibes.** ANN trades exactness for speed. A demo that looks great on ten queries can miss on the long tail. Build a golden set of query-to-expected-result pairs and check recall against your current store before migrating.

## What to actually do

If you already run DynamoDB as your operational database and you have been eyeing a bolt-on vector store, prototype this first. Add a vector index to a copy of the table, embed a slice of your data, and run your real queries against it with a golden set to check recall. If recall holds, you delete an entire database, a sync pipeline, and a round trip. If it does not, you learned that cheaply, and the dedicated-store options in the [decision guide](/blog/2025-05-25-aws-vector-databases-rag-applications-complete-architectural-decision-guide.html) are still there.

The mental shift is the same one that post ended on: the question stopped being "which vector database" and became "do I need a separate one at all."
