# SIGNAL — Frontier Tech Briefing

A zero-cost, static news-briefing platform that surfaces the absolute latest from
the AI/LLM companies — frontier labs (Anthropic, OpenAI, Google, xAI, NVIDIA,
Microsoft) and open-source model labs (DeepSeek, Moonshot/Kimi, Zhipu/GLM,
Alibaba/Qwen, Meta/Llama), plus Hugging Face model releases — in a TL;DR-first,
easily digestible format. (Originally broader — space/science/energy — narrowed
to AI-only by owner request in June 2026; see docs/DATA_SOURCES.md.)

This repo was scaffolded from a design session in Claude.ai. A working visual
prototype with final design tokens lives at `prototype/frontier-briefing-prototype.html`
— open it in a browser before touching frontend code. It is the design source of truth.

## Hard constraints (do not violate)

1. **$0/month.** No paid APIs, no paid hosting, no API keys that bill. Hosting is
   GitHub Pages; compute is GitHub Actions on a public repo (free).
2. **Fully static frontend.** No backend server. The site reads pre-built JSON files
   from this repo. All feed fetching happens in GitHub Actions, never in the browser
   (RSS endpoints are CORS-blocked client-side anyway).
3. **Lightweight.** Vanilla HTML/CSS/JS preferred. No framework, no build step unless
   genuinely needed. The prototype is a single HTML file — keep that spirit.
4. **Only keyless/free data sources.** See `docs/DATA_SOURCES.md` for the approved
   list. Do not add sources requiring registration/keys without flagging it first.

## Architecture in one paragraph

A scheduled GitHub Action (cron, ~every 30 min) runs `scripts/fetch.js` (Node 20,
zero or minimal npm deps), which polls RSS/Atom feeds + free JSON APIs, normalises
items into a common schema, de-duplicates near-identical stories, scores importance
heuristically, extracts a 1–2 sentence TL;DR from each item's own description, and
writes `data/items.json` (+ `data/digest.json`). The Action commits the JSON back to
the repo. GitHub Pages serves `index.html`, which fetches the JSON and renders the
briefing UI. Full detail: `docs/ARCHITECTURE.md`.

## Repo layout (target)

```
/index.html              # the live site (evolve from prototype/)
/assets/                 # css/js if split out of index.html
/data/items.json         # generated — never hand-edit
/data/digest.json        # generated — top-5 daily digest
/scripts/fetch.js        # the pipeline (fetch → normalise → dedupe → rank → write)
/scripts/sources.js      # source registry (URL, type, org, topic, weight)
/.github/workflows/update-feed.yml   # cron pipeline (skeleton already present)
/.github/workflows/pages.yml         # Pages deploy if needed (or use repo settings)
/prototype/              # original design prototype — reference only, don't serve
/docs/                   # ARCHITECTURE, DATA_SOURCES, DESIGN, ROADMAP
```

## Item schema (the contract between pipeline and frontend)

```json
{
  "id": "sha1-of-canonical-url",
  "title": "...",
  "url": "https://...",
  "source": "Anthropic News",
  "org": ["anthropic"],
  "topic": "ai",                  // ai | space | compute | science | energy
  "tldr": "1–2 sentences extracted from the item's own description.",
  "published": "2026-06-10T13:09:00Z",
  "score": 0.82,                  // 0–1, see ranking rules in ARCHITECTURE.md
  "tier": 1,                      // 1 = hero, 2 = card, 3 = list-only
  "badges": ["paper", "launch"],  // optional
  "dupes": 3                      // how many sources carried this story
}
```

`why it matters` lines: the prototype shows them, but generating them well needs an
LLM. Phase 1 omits them (hide the element if `why` is absent). See ROADMAP Phase 4
for the optional free-tier LLM upgrade path.

## Commands

```bash
node scripts/fetch.js            # run the pipeline locally, writes data/*.json
npx serve .                      # preview the site locally (or python3 -m http.server)
```

There is no test framework yet. When adding one, prefer node:test (built in, no dep).

## Conventions

- Node 20+, ES modules, no TypeScript (keep it inspectable and dependency-light).
- Prefer zero npm dependencies. `fast-xml-parser` is pre-approved if hand-rolling
  RSS parsing gets ugly. Justify anything else.
- All timestamps UTC ISO-8601 in data; render relative ("23m ago") in the UI.
- Generated files (`data/*.json`) are committed by the Action with message
  `chore(data): refresh feed [skip ci]` — keep `[skip ci]` to avoid loops.
- Frontend must degrade gracefully: stale data shows a "last updated Xh ago" notice;
  fetch failure for one source must never break the whole pipeline run.
- Design tokens (colors, fonts, spacing) come from `docs/DESIGN.md` / the prototype.
  Do not invent new colors; the palette is intentional.

## Gotchas already known

- **GitHub Actions cron is best-effort**: a `*/30` schedule often fires late at busy
  times. Fine for this use case; don't promise minute-level freshness in the UI.
- **Scheduled workflows auto-disable after 60 days of repo inactivity.** The data
  commits themselves count as activity once running, but be aware during early dev.
- **Launch Library 2 free tier is rate-limited (~15 req/hr)** — poll it max once per
  pipeline run and cache hard.
- **arXiv API** asks for a 3-second delay between requests and a descriptive
  User-Agent; respect both.
- **CORS**: never attempt feed fetches from the browser. Pipeline only.
- Some publisher RSS feeds (e.g. OpenAI's) have changed paths historically — the
  pipeline must tolerate 404/timeout per-source and log it, not crash.

## Where to pick up

Work through `docs/ROADMAP.md` phase by phase. Phase 1 (pipeline producing real
items.json from 4–5 sources) is the right first milestone — the frontend already
effectively exists in `prototype/`.
