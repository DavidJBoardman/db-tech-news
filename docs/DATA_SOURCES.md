# Data Sources

All sources below are **free and keyless**. This is the approved registry; adding a
source that needs an API key or payment requires explicit sign-off from the owner.

**Scope (Sept 2026): AI/LLM companies + broader frontier-tech categories.** The
core AI beat — frontier labs (Anthropic, OpenAI, Google DeepMind/Research, xAI,
NVIDIA, Microsoft) and open-source model labs (DeepSeek, Moonshot/Kimi, Zhipu/GLM,
Alibaba/Qwen, Meta/Llama), plus Hugging Face — is joined by five sibling
categories, each a tab in the UI: **space**, **hardware/chips** (`compute`),
**robotics**, **cybersecurity** (`security`) and **gaming**. (June 2026 had
narrowed the feed to AI-only; broadened again by owner request Sept 2026.) Every
new source is still free and keyless.

URLs were correct as of June 2026 but publishers move feeds — `scripts/fetch.js`
must treat every URL as fallible. If a feed 404s persistently, check the
publisher's site for a new path.

## Tier A — official lab/company sources (weight 0.75–0.95)

| Source | Org | Type | Endpoint / strategy |
|---|---|---|---|
| Anthropic News | anthropic | html | `https://www.anthropic.com/news` — no RSS; parse anchors + `<time>`/`__title` classes (selectors in fetch.js, 1 req/run) |
| Meta AI Blog | meta | html | `https://ai.meta.com/blog/` — no RSS; parse the bottom grid's `listview-card` blocks (date → category h4 → title h4 → desc p → link). Posts ~monthly |
| Meta Newsroom | meta | rss | `https://about.fb.com/news/feed/` — fresh daily but general corporate; `mustMatch` AI-keyword guard (the frontier filter can't help: every title contains "Meta") |
| OpenAI Blog | openai | rss | `https://openai.com/blog/rss.xml` |
| Google DeepMind | google | rss | `https://deepmind.google/blog/rss.xml` |
| Google Research | google | rss | `https://research.google/blog/rss/` |
| NVIDIA Blog | nvidia | rss | `https://blogs.nvidia.com/feed/` |
| Microsoft Research | microsoft | rss | `https://www.microsoft.com/en-us/research/feed/` |
| Microsoft Blog | microsoft | rss | `https://blogs.microsoft.com/feed/` — corporate newsroom, `filter: 'frontier'` keeps only AI items |
| Qwen Blog | qwen | rss | `https://qwenlm.github.io/blog/index.xml` — posts sporadically; Qwen news mostly arrives via HF + aggregators |
| Hugging Face Blog | — | rss | `https://huggingface.co/blog/feed.xml` — orgs attached via title keyword rules |

Notes:
- **xAI has no scrapeable feed** — `x.ai/news` returns 403 to non-browser agents.
  Coverage comes from the targeted HN query (grok/xai) + aggregators.
- **Meta has no AI RSS** (`ai.meta.com/blog/rss/` 404s; `research.facebook.com/feed/`
  is dead since 2023; `engineering.fb.com/feed/` is infra, not AI). Hence the HTML
  parse + filtered newsroom above, plus HF (`meta-llama`) and keyword tagging.

## Tier B — Hugging Face model releases (weight 0.75)

One keyless API call per org, newest 5 models each:
`https://huggingface.co/api/models?author=<org>&sort=createdAt&direction=-1&limit=5`

| Registry name | HF org | Tagged org |
|---|---|---|
| HF · DeepSeek | `deepseek-ai` | deepseek |
| HF · Moonshot | `moonshotai` | moonshot |
| HF · Zhipu | `zai-org` | zhipu |
| HF · Qwen | `Qwen` | qwen |
| HF · Meta Llama | `meta-llama` | meta |
| HF · OpenAI | `openai` | openai |
| HF · Google | `google` | google |

These yield items only when an org pushed a model in the last 7 days — empty most
runs, which is correct. Variant uploads (Base/Flash etc.) merge via fuzzy title
dedupe. Items get a `model` badge.

## Tier C — community signal & aggregators (weight 0.5–0.55)

| Source | Endpoint | Notes |
|---|---|---|
| Hacker News | `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30` | `filter: 'frontier'` — keep only items matching org/topic keyword rules |
| HN · xAI / DeepSeek / Kimi / GLM | `…/search_by_date?query=<term>&tags=story&numericFilters=points>10` | one query per under-covered org; `mustMatch` regex requires the term in the *title* (Algolia also matches body/author) |
| The Verge AI | `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` | `filter: 'frontier'` |

HN double-duty: besides supplying items, HN points feed the `communitySignal`
ranking input after dedupe-merge.

## Tier D — sibling categories (weight 0.7–0.85)

**Purist source policy (owner request, Sept 2026):** each beat leads with
straight-**news** publications / official press. Enthusiast sites that mix in
reviews, deals, opinion and features (Tom's Hardware, IEEE Spectrum, Space.com,
and the consumer gaming outlets Eurogamer/RPS/PC Gamer/Polygon/IGN) were dropped
in favour of news-only feeds. The `NOISE_RE` filter in `sources.js` is now a
safety net, not the primary quality lever.

Category-native feeds (explicit `topic`, whole feed on-beat):

| Category | Source | Endpoint |
|---|---|---|
| space | NASA | `https://www.nasa.gov/feed/` |
| space | SpaceNews | `https://spacenews.com/feed/` |
| space | ESA Space News | `https://www.esa.int/rssfeed/Our_Activities/Space_News` |
| space | Ars Technica · Space | `https://arstechnica.com/tag/space/feed/` |
| compute | Ars Technica · Gadgets | `https://feeds.arstechnica.com/arstechnica/gadgets` |
| robotics | The Robot Report | `https://www.therobotreport.com/feed/` |
| security | Krebs on Security | `https://krebsonsecurity.com/feed/` |
| security | BleepingComputer | `https://www.bleepingcomputer.com/feed/` |
| security | The Hacker News | `https://feeds.feedburner.com/TheHackersNews` |
| gaming | GamesIndustry.biz | `https://www.gamesindustry.biz/feed` |

### Routed general-news wires (`route: true`)

Straight-news publications that aren't tied to one beat. `fetch.js` sends each
item to the **first** matching category in `ROUTE_RULES` (security → space →
gaming → robotics → compute → ai) and **drops** anything matching none (generic
enterprise-IT/business isn't one of our beats). One good wire thus feeds every
tab with only on-beat, actual-news stories.

| Wire | Endpoint |
|---|---|
| Ars Technica (main) | `https://feeds.arstechnica.com/arstechnica/index` |
| BBC Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` |
| TechCrunch | `https://techcrunch.com/feed/` |

- **The Register** was tried (best straight-news tech wire) but its feed
  302-redirects non-browser clients and returns nothing to the pipeline — don't
  re-add without solving the cookie/redirect handshake.
- **Robotics has no pure-news wire.** The Robot Report is the trade-news anchor;
  it still emits the odd interview/sponsored post, so this one beat leans on
  `NOISE_RE` more than the others.

Notes:
- NVIDIA Blog (Tier A) also carries `topic: compute`, so it appears under Hardware
  as well as AI.
- **Per-topic cap** in `fetch.js` (`PER_TOPIC_CAP = { default: 12, gaming: 6 }`)
  stops any one beat swamping the "All" view — the score-ranked list is walked in
  order and a topic is skipped once it hits its cap, so the strongest signals still
  lead. Gaming is capped lower by owner request. Adjust caps or source `weight` to
  shift the mix.

## Topic taxonomy

`ai` (default) · `space` · `compute` (hardware/chips; also the AI `chip/GPU/…`
keyword rule) · `robotics` · `security` · `gaming`. The UI renders one tab per
topic plus an "All" tab.

## Org taxonomy

`anthropic` · `openai` · `google` · `xai` · `nvidia` · `microsoft` · `meta` ·
`deepseek` · `moonshot` · `zhipu` · `qwen` · (none)

Each source carries default orgs; additional orgs attach via title keyword rules
in `scripts/sources.js` (e.g. /claude/ → anthropic, /llama/ → meta, /kimi/ →
moonshot). An item can carry multiple orgs.

## Etiquette / legal

- Respect robots.txt for HTML-parse sources; cache aggressively; ≤1 request per
  source per run.
- Store and display only: title, link, date, source name, and a short extracted
  snippet — always linking out to the original. Do not republish full article text.
