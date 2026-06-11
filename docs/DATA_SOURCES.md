# Data Sources

All sources below are **free and keyless**. This is the approved registry; adding a
source that needs an API key or payment requires explicit sign-off from the owner.

**Scope (June 2026): AI/LLM companies only.** Frontier labs — Anthropic, OpenAI,
Google (DeepMind/Research), xAI, NVIDIA, Microsoft — and the open-source model
labs — DeepSeek, Moonshot (Kimi), Zhipu (GLM), Alibaba (Qwen), Meta (Llama) — plus
Hugging Face as the venue where open-weights releases actually land. Space,
general science, and energy sources were removed by owner request; do not re-add
without sign-off.

URLs were correct as of June 2026 but publishers move feeds — `scripts/fetch.js`
must treat every URL as fallible. If a feed 404s persistently, check the
publisher's site for a new path.

## Tier A — official lab/company sources (weight 0.75–0.95)

| Source | Org | Type | Endpoint / strategy |
|---|---|---|---|
| Anthropic News | anthropic | html | `https://www.anthropic.com/news` — no RSS; parse anchors + `<time>`/`__title` classes (selectors in fetch.js, 1 req/run) |
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
- **Meta AI blog has no RSS** (`ai.meta.com/blog/rss/` 404s). Llama coverage comes
  from HF (`meta-llama`) + keyword tagging on aggregator items.

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

## Topic taxonomy

`ai` (default) · `compute` (chips/GPU/datacenter keyword rule). The old
space/science/energy topics are retired with the scope change; the schema field
remains for forward compatibility.

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
