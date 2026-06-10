# Data Sources

All sources below are **free and keyless**. This is the approved registry; adding a
source that needs an API key or payment requires explicit sign-off from the owner.

URLs were correct as of June 2026 but publishers move feeds — `scripts/fetch.js`
must treat every URL as fallible. If a feed 404s persistently, check the publisher's
site for a new path (many sites expose feeds at `/feed`, `/rss.xml`, `/atom.xml`, or
advertise them in HTML `<link rel="alternate" type="application/rss+xml">` tags).

## Tier A — primary lab/company sources (highest weight, 0.9–1.0)

| Source | Org | Topic | Type | Endpoint / strategy |
|---|---|---|---|---|
| Anthropic News | anthropic | ai | rss | `https://www.anthropic.com/news` — check for an RSS link; if none, parse the news index page's JSON-LD or HTML list (be gentle: 1 req/run) |
| OpenAI Blog | openai | ai | rss | `https://openai.com/blog/rss.xml` (path has changed before — verify) |
| Google DeepMind Blog | google | ai | rss | `https://deepmind.google/blog/rss.xml` (verify; fall back to page parse) |
| Google Research Blog | google | ai | rss | `https://research.google/blog/rss/` |
| xAI News | xai | ai | html | `https://x.ai/news` — no known feed; parse index page |
| SpaceX Updates | spacex | space | html | `https://www.spacex.com/updates/` — parse page; launches come from Launch Library instead |
| Tesla / Terafab | terafab | compute | — | No first-party feed; Terafab coverage arrives via Tier C news + HN. Tag any item whose title matches /terafab/i with org `terafab` |

HTML-parse sources: extract title + link + date only; keep selectors in
`scripts/sources.js` so breakage is a one-line fix.

## Tier B — research & structured data (weight 0.7–0.85)

| Source | Topic | Type | Endpoint |
|---|---|---|---|
| arXiv API | ai/science | atom | `http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=25` — also a second query for `cond-mat`, `quant-ph`, `eess.SY`. **3s between requests, descriptive User-Agent** |
| Launch Library 2 | space | json | `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10` — free tier ~15 req/hr; one call per run |
| NASA Breaking News | space | rss | `https://www.nasa.gov/news-release/feed/` |

arXiv volume control: take only the newest 25 per category per run; ranking +
dedupe keeps the feed from being swamped. Future upgrade: rank papers by early
citation velocity via the free Semantic Scholar / OpenAlex APIs (also keyless).

## Tier C — community signal & aggregators (weight 0.4–0.6)

| Source | Type | Endpoint |
|---|---|---|
| Hacker News (Algolia) | json | `https://hn.algolia.com/api/v1/search?tags=front_page` and targeted queries like `...search_by_date?query=anthropic&tags=story&numericFilters=points>50`. Keyless, generous limits |
| Reddit r/spacex, r/MachineLearning | json | `https://www.reddit.com/r/spacex/top.json?t=day&limit=10` — set a real User-Agent or you'll get 429s |
| Ars Technica Science | rss | `https://feeds.arstechnica.com/arstechnica/science` |
| The Verge AI | rss | `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` (verify path) |
| MIT Technology Review | rss | `https://www.technologyreview.com/feed/` |
| TechCrunch AI | rss | `https://techcrunch.com/category/artificial-intelligence/feed/` |

HN double-duty: besides supplying items, match HN stories against already-fetched
items by URL to attach `points` as the `communitySignal` ranking input.

## Topic taxonomy

`ai` · `space` · `compute` · `science` · `energy`

Each source carries a default topic; override per-item with keyword rules
(e.g. /chip|fab|semiconductor|gpu|terafab/i → compute; /fusion|tokamak|battery|grid/i
→ energy; /quantum|protein|physics|materials/i → science). Keep the rules table in
`scripts/sources.js` next to the registry.

## Org taxonomy

`anthropic` · `openai` · `google` · `xai` · `spacex` · `terafab` · (none)

An item can carry multiple orgs (Terafab stories are usually also xai/spacex).
Detect via keyword match on title for Tier B/C items.

## Etiquette / legal

- Respect robots.txt for HTML-parse sources; cache aggressively; ≤1 request per
  source per run.
- Store and display only: title, link, date, source name, and a short extracted
  snippet — always linking out to the original. Do not republish full article text.
