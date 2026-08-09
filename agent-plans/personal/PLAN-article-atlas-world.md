# Article Atlas World Plan

Status: concept and product-definition draft
Scope: planning only; no implementation or publication approval implied

## 1. The decision in front of us

Article Atlas currently answers **where are the articles?** It groups posts into
seven themed regions, plots related posts as trails, and lets a visitor wander
between them. That already works as an alternative blog index.

The next version needs to answer a larger question:

> What exists here even when the visitor is not looking for an article?

The recommended answer is:

> **Atlas is a living personal world where ideas are discovered, tested, built,
> remembered, and connected. Articles are the field records left by that work.**

This changes the product from an illustrated content taxonomy into a world that
can contain writing, experiments, tools, decisions, unfinished work, visitors,
and future creations without losing its identity.

### Product sentence

**Explore a living world built from one engineer's questions, experiments, and
field notes.**

### What Atlas is not

- Not a gamified category page with scenery between links.
- Not a full RPG with accounts, inventory grind, or a fictional plot that must
  be maintained separately from the real work.
- Not a social network or analytics surface disguised as a world.
- Not a collection of unrelated mini-games.

The fiction should explain the real content and activity. It should not create
a second content business that competes with the blog.

## 2. The world model

The world should have four layers. Every future feature must belong to at least
one layer and strengthen another.

| Layer | Meaning in the world | Real yopa.page material |
| --- | --- | --- |
| Land | Durable domains that have developed over time | engineering, cloud, agents, code, Salesforce, Python, archive |
| Routes | Questions, dependencies, and journeys between domains | related-post trails, learning paths, project histories |
| Activity | Things happening now or recently | experiments, builds, current investigations, changelog events |
| Memory | What the world retains | articles, decisions, retired approaches, field notes |

This permits each existing region to gain a purpose beyond holding posts:

- **Cloud Highlands:** systems are observed and operated.
- **Agent Grove:** agents are trained, tested, and given tools.
- **Codeworks:** prototypes and utilities are built.
- **Salesforce Springs:** platform constraints are translated into working
  practices.
- **Python Meadow:** small experiments grow into reusable techniques.
- **Engineering Ridge:** architecture, tradeoffs, and decisions are surveyed.
- **Archive Harbor:** old knowledge arrives, is restored, superseded, or sent
  onward.

These are starting interpretations, not permanent lore. Phase 0 must test
whether they feel truthful to the existing body of work.

## 3. Why the current map feels disconnected

The current implementation has one coordinate system, an explicit region graph,
transition chunks, paired signposts, and a future portal. Technically the map is
connected. Visually and semantically, however, three seams remain:

1. **Ground seam:** large repeated transition tiles read as a background layer;
   they do not show why one biome becomes another.
2. **Route seam:** graph connections and destination menus provide navigation,
   but the world does not consistently depict roads, rivers, bridges, elevation,
   or other continuous travel corridors.
3. **Meaning seam:** arriving in another village changes the post category, but
   not what the visitor can do.

The solution is therefore not one larger background illustration. Build a
**world spine** first: a small set of continuous geographic systems that cross
region boundaries and also carry meaning.

### Recommended world spine

- **The Atlas River:** knowledge flows from active regions toward Archive
  Harbor. Bridges become intentional crossings and the harbor gains a reason to
  exist.
- **The Maker's Road:** a continuous walkable route linking Agent Grove,
  Codeworks, and Engineering Ridge. It represents question → prototype →
  decision.
- **The Cloudline:** wind, elevation, and observation landmarks connect Cloud
  Highlands to Engineering Ridge rather than leaving two floating biomes.
- **The Living Edge:** coast, forest, meadow, ridge, and mist form natural
  borders. Transitions occupy shaped corridors, not rectangular fill chunks.

Only two of these should be prototyped first. The Atlas River and Maker's Road
provide the clearest test because they connect both geography and product
meaning.

## 4. Core visitor loops beyond reading posts

Atlas needs several lightweight loops, but only one primary loop per visit.

### A. Expedition loop — recommended primary loop

1. A visitor receives or chooses a question.
2. The map indicates several relevant places, not a single waypoint.
3. The visitor finds an article, artifact, or landmark in each place.
4. The collected evidence completes a short expedition summary.
5. The summary offers a next question or a practical action outside Atlas.

Examples:

- “How does an agent reach production safely?” crosses Agent Grove, Cloud
  Highlands, and Engineering Ridge.
- “How did this idea change?” starts at Archive Harbor, visits an old field
  note, and ends at a current guide.
- “Build a small tool” moves from Python Meadow or Codeworks to Engineering
  Ridge with a runnable artifact and a tradeoff note.

This reuses real content relationships while making travel purposeful.

### B. Workshop loop

Small, client-side interactions live at landmarks: compare two architectures,
toggle a design constraint, arrange a request flow, inspect a cost or reliability
tradeoff, or run a safe embedded demo. The result points to supporting articles.

The goal is understanding, not scoring. A workshop must still be useful with no
login and must not send private input to a server by default.

### C. Observatory loop

Visitors inspect the shape of the world: new constellations for recent writing,
topic growth over time, bridges between previously separate domains, and areas
with unresolved questions. This is an editorial view of the corpus, not visitor
tracking.

### D. World-event loop

Publishing, revising, archiving, or releasing a project creates a visible but
finite event: a new trail opens, scaffolding appears, a harbor bell rings, a
night light turns on, or a portal becomes stable. Events are generated from
real repository metadata and expire into permanent world state.

### E. Quiet social presence — optional, later

Anonymous visitors may be seen as transient lights or travelers, but there is
no identity, chat, leaderboard, durable activity history, or behavioral profile.
Presence should make the world feel inhabited, never become its purpose.

## 5. Content types the world can hold

The existing article beacon becomes one member of a small world-object grammar:

| Object | Represents | Interaction |
| --- | --- | --- |
| Field note | Published article | preview and read |
| Trail | Semantic relationship or authored learning path | follow or inspect why it connects |
| Workshop | Interactive explanation or runnable local demo | manipulate and learn |
| Observatory | Corpus-level view | see patterns and open questions |
| Ruin | Superseded or archived knowledge | compare past and present |
| Construction site | Publicly acknowledged work in progress | see intent and status, no fake promise |
| Artifact | Tool, repository, diagram, or downloadable output | inspect or use |
| Resident | A recurring system, agent, or concept | contextual guide, not a chatbot by default |
| Portal | A genuinely different experience or world | cross only when the destination exists |

This grammar is deliberately small. New object types require a distinct visitor
action, not merely a new drawing.

## 6. Information architecture changes

### Separate geography from taxonomy

Today region assignment is inferred in the browser from tags and categories.
That is useful for bootstrapping but too unstable for authored worldbuilding.
Move gradually toward explicit content metadata:

```yaml
atlas:
  region: agents
  landmark: field-note
  journeys:
    - production-agent
  era: current
  coordinates: auto
```

- `region` is editorial and stable.
- `journeys` may cross regions and drive expedition routes.
- `era` distinguishes current, superseded, and historical material.
- coordinates remain deterministic by default; only landmarks need authored
  placement.

### Make the manifest semantic

Keep rendering data, but add separate semantic structures for `routes`,
`landmarks`, `worldEvents`, and `expeditions`. Avoid embedding product meaning
only in canvas drawing code.

### Preserve the blog contract

Every Atlas destination needs a normal URL, keyboard access, a list-based
fallback, and a useful page without canvas. Atlas enhances discovery; it never
becomes the only way to reach content.

## 7. Phased plan and gates

### Phase 0 — Decide what the world is

Deliverables:

- One-page world charter using the product sentence and four-layer model.
- A labelled map sketch showing the Atlas River and Maker's Road across the
  existing seven regions.
- Three storyboarded visits: expedition, workshop, and observatory.
- A content audit mapping 20 representative posts and 3 non-article artifacts
  into the proposed object grammar.
- A short list of lore terms in Korean and English; keep names understandable
  without a glossary.

Gate:

- A first-time visitor can explain Atlas without saying only “a map of blog
  posts.”
- Each storyboard is useful even if no new article is opened.
- The world fiction can be generated from real work with little separate
  editorial maintenance.

Do not generate final art or expand world bounds before this gate passes.

### Phase 1 — Connected-world visual spike

Scope one corridor only: **Agent Grove → Codeworks → Engineering Ridge**.

Deliverables:

- Replace rectangular meadow fill along the corridor with authored transition
  masks: road, vegetation gradient, water/elevation crossings, and edge props.
- Draw a continuous Maker's Road through all three regions.
- Give each border a visible cause: bridge, pass, gate, ferry, or trailhead.
- Add an optional atlas overview that shows geography, not only graph lines.
- Compare current and proposed corridors at desktop and mobile scale.

Gate:

- Five-second screenshot test: viewers can point to a continuous route between
  all three places without UI assistance.
- Travel never exposes rectangular seams or obvious repeated 512px patterns.
- Existing coordinates, deep links, reduced-motion behavior, and home minimap
  remain valid.

If the spike fails, revise the terrain composition system before making more
regions.

### Phase 2 — One meaningful expedition

Deliverables:

- One authored cross-region question with 3–5 stops.
- A field journal showing discovered evidence and why each stop matters.
- Resume locally on the same browser; no account or server state.
- A normal HTML route page as accessible fallback and share target.
- Authoring schema and build-time validation for expedition references.

Gate:

- A visitor can start, pause, resume, and finish the expedition.
- Completion produces a useful summary or next action rather than a badge.
- All stops work as direct URLs and stale references fail the build.
- The expedition adds no required backend cost.

### Phase 3 — First non-reading landmark

Build one Workshop or Observatory, not both. Recommended first candidate:
an architecture tradeoff bench in Engineering Ridge tied to a real article
series.

Deliverables:

- A two-to-five-minute client-side interaction.
- An accessible non-canvas form or document equivalent.
- Links from its choices to evidence in field notes.
- Anonymous, local-only state with a clear reset.

Gate:

- Testers report learning or deciding something, not merely enjoying animation.
- Interaction remains comprehensible without Atlas lore.
- Performance stays within the existing canvas/mobile budget.

### Phase 4 — Living-world publishing pipeline

Deliverables:

- Build-time derivation of new/revised/archived content events.
- Construction, opening, and settled visual states with explicit expiry rules.
- Authored coordinates and journeys in frontmatter or a reviewed data file.
- Validation for collisions, broken destinations, unsupported object types, and
  bilingual metadata gaps.

Gate:

- Publishing an ordinary article updates Atlas without hand-editing JavaScript.
- A revision or archive changes world state predictably and reversibly.
- No event implies live user behavior that is not actually measured.

### Phase 5 — Broader world expansion

Only after the first four gates:

- Open App Garden for deployed tools and interactive artifacts.
- Add the Atlas River through Archive Harbor.
- Add seasonal/editorial expeditions that reuse existing landmarks.
- Consider quiet live presence behind the existing fail-closed flag and cost
  gates.
- Expand bounds by meaningful destinations, never to make the map merely large.

Gate:

- Every new region introduces a distinct activity and a necessary relationship
  to the existing world.
- Static solo exploration remains the complete default experience.
- Operational and moderation burden stays appropriate for a personal site.

## 8. Feature candidates, prioritized

### Now

1. World charter and vocabulary.
2. Connected corridor terrain prototype.
3. Authored journeys/expedition schema.
4. One expedition and local field journal.
5. One Workshop or Observatory prototype.

### Next

6. Semantic manifest split and build validation.
7. World events driven by publishing metadata.
8. Ruins and archive/history comparison.
9. App Garden as an artifact destination.
10. Atlas overview and geographic navigation.

### Later or only with evidence

11. Anonymous presence.
12. Reactions that affect temporary ambience only.
13. Procedural weather or seasons.
14. Residents with scripted contextual guidance.
15. Cross-site or guest worlds through portals.

### Avoid for now

- Accounts, profiles, currencies, inventory, daily quests, streaks, and
  leaderboards.
- Open-ended AI NPC chat without a bounded task and privacy model.
- Persistent user-generated marks requiring moderation.
- A huge empty map built before activities justify it.
- Lore that cannot be derived from or connected to actual work.

## 9. Success measures

Use small qualitative tests before analytics. Atlas should pass these questions:

- **Comprehension:** what did the visitor think Atlas was after 30 seconds?
- **Orientation:** can they predict what lies beyond a visible route or border?
- **Agency:** can they choose a meaningful activity besides opening a random
  article?
- **Continuity:** does crossing between regions feel like moving through one
  world?
- **Return value:** is there a reason to return after reading the same posts?
- **Truthfulness:** does every world event correspond to real published or
  project state?

Possible privacy-light counters, only if later needed: expedition starts and
completions, landmark opens, article exits, and coarse performance failures.
Do not collect paths, cursor trails, identity, or durable visitor histories.

## 10. Immediate decision package

Before implementation, choose these three items:

1. Accept or revise the core definition: **a living personal world of questions,
   experiments, artifacts, and field notes**.
2. Approve the first geographic spine: **Maker's Road from Agent Grove through
   Codeworks to Engineering Ridge**.
3. Choose the first proof of activity:
   - Expedition: strongest proof of cross-region world structure.
   - Workshop: strongest proof that Atlas is more than reading.
   - Observatory: strongest proof that the corpus itself has a living shape.

Recommendation: build the Phase 1 corridor and storyboard the Expedition in
parallel on paper, then implement the Expedition first. It tests geography,
meaning, content relationships, and return value with the least new operational
surface.
