# Architecture

## Why this shape

The product promise is "the absolute latest, easily digestible." The constraint is
zero spend and GitHub Pages hosting. Those resolve cleanly into a **static-site +
scheduled-pipeline** architecture:

```
┌─────────────────────────── GitHub (free, public repo) ───────────────────────────┐
│                                                                                  │
│  GitHub Actions (cron ~*/30)                GitHub Pages                         │
│  ┌──────────────────────────┐               ┌──────────────────────────┐         │
│  │ scripts/fetch.js          │   commits    │ index.html               │         │
│  │  1. fetch all sources     │ ───────────▶ │  fetch('./data/items.json')        │
│  │  2. normalise to schema   │  data/*.json │  render: wire rail, hero,│         │
│  │  3. de-duplicate          │              │  cards, filters, digest  │         │
│  │  4. score + tier          │              └──────────────────────────┘         │
│  │  5. extract TL;DRs        │                                                   │
│  │  6. write items + digest  │                                                   │
│  └──────────────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

No server, no database, no keys. The repo *is* the database; git history is a free
audit log of every feed refresh.

## Pipeline stages (scripts/fetch.js)

### 1. Fetch
Iterate `scripts/sources.js`. Each source declares: `name`, `org`, `topic`, `type`
(`rss` | `atom` | `json`), `url`, `weight` (0–1 source credibility/priority), and an
optional `parse` override for odd JSON APIs (HN Algolia, Launch Library). Fetch with
a 10s timeout and a descriptive User-Agent (`signal-briefing/1.0 (+repo URL)`).
**Per-source failures are caught, logged to the Action summary, and skipped** — one
dead feed must never abort the run.

### 2. Normalise
Map every raw item into the schema in CLAUDE.md. Canonicalise URLs (strip utm_*
params, trailing slashes) before hashing into `id`. Drop items older than 7 days.

### 3. De-duplicate
The same story arrives from multiple outlets. Strategy:
- Exact: same canonical URL → merge.
- Fuzzy: normalise titles (lowercase, strip punctuation/stopwords) and compare token
  Jaccard similarity; ≥ 0.6 → treat as the same story.
- On merge: keep the item from the highest-weight source, set `dupes` to the count.
  `dupes` is a strong ranking signal (cross-source coverage = importance).

### 4. Score and tier
Heuristic score in [0,1], roughly:

```
score = 0.35 * recency          // exp decay, half-life ~18h
      + 0.25 * sourceWeight     // primary sources (labs) > aggregators
      + 0.25 * crossCoverage    // min(dupes,4)/4
      + 0.15 * communitySignal  // normalised HN points if matched on HN
```

Tiers: top item of the run → `tier 1` (hero); next ~12 → `tier 2` (cards);
rest → `tier 3`. Cap output at ~60 items so items.json stays small (<150 KB).

### 5. TL;DR extraction (no LLM, Phase 1)
Take the item's own `description`/`summary` field, strip HTML, take the first two
sentences, hard-cap ~220 chars at a word boundary. Feed descriptions are usually
written as summaries already, so this reads well. arXiv abstracts: first sentence +
"(arXiv preprint)". If a description is missing, fall back to the title alone and
omit the tldr element in the UI.

### 6. Write outputs
- `data/items.json`: `{ generated: ISO, items: [...] }`
- `data/digest.json`: top 5 by score in the last 24h, with `n`, `title`, `tldr`,
  `meta` — drives Daily Digest mode.

The workflow commits both with `[skip ci]` and pushes. Concurrency group set so
overlapping runs don't race.

## Frontend

Evolve `prototype/frontier-briefing-prototype.html` into `index.html`:
1. Delete the hard-coded sample articles.
2. On load, `fetch('./data/items.json')` and render hero/cards from data. Keep the
   existing filter/digest JS, but drive it from the data instead of the DOM.
3. Wire rail: render one row per source with its most recent item age (derive from
   items.json — group by source, take max published).
4. Relative timestamps computed client-side from `published`; refresh every 60s.
5. Staleness banner if `generated` is older than 2h.
6. `why it matters` block: render only when an item has a `why` field (Phase 4).

Keep it one HTML file + maybe one css/js pair. No build step.

## Deployment

- Repo Settings → Pages → "Deploy from branch", branch `main`, root.
  (Simplest; the data commits automatically trigger a Pages rebuild.)
- Custom domain optional later; default `https://<user>.github.io/<repo>/` is fine.
  Note the subpath: use relative URLs (`./data/items.json`), never absolute paths.

## Failure modes and answers

| Failure | Behaviour |
|---|---|
| One source 404s/times out | Skipped + logged; run continues |
| All sources fail | Action fails loudly; site keeps serving last good JSON |
| Cron fires late | UI shows honest "updated Xm ago"; no fake freshness |
| items.json malformed | Frontend catches parse error, shows last-updated notice + retry |
| Rate limit (Launch Library) | One call per run, cached `next launch` reused on 429 |
