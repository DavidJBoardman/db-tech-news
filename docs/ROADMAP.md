# Roadmap

Work phases in order; each has a "done when" gate. Keep commits small and scoped.

## Phase 0 — Repo bootstrap (≈30 min)
- [ ] Public GitHub repo; copy this starter kit in.
- [ ] Enable GitHub Pages (Settings → Pages → deploy from `main`, root).
- [ ] Serve `prototype/frontier-briefing-prototype.html` temporarily as `index.html`
      to confirm Pages works.
- **Done when:** the prototype is live at the github.io URL.

## Phase 1 — Pipeline MVP (the real milestone)
- [ ] `scripts/sources.js`: registry with 5 reliable starters — arXiv (cs.AI),
      HN Algolia front page, NASA RSS, Ars Technica Science, MIT Tech Review.
      (Start with feeds known to be stable; add lab blogs in Phase 3.)
- [ ] `scripts/fetch.js`: fetch → normalise → dedupe → score → tldr-extract →
      write `data/items.json` + `data/digest.json`. Zero deps if possible
      (`fast-xml-parser` allowed).
- [ ] Per-source error isolation + run summary logged.
- [ ] Wire up `.github/workflows/update-feed.yml` (skeleton provided) and verify a
      manual `workflow_dispatch` run commits fresh JSON.
- **Done when:** `node scripts/fetch.js` produces valid JSON locally AND the Action
  does the same on a manual trigger.

## Phase 2 — Live frontend
- [ ] Convert prototype → `index.html` driven by `data/items.json` (see
      ARCHITECTURE.md "Frontend" steps): render hero from top-scored item, cards
      from tier 2, wire rail from per-source freshest item, digest from
      digest.json.
- [ ] Relative timestamps + 60s refresh; staleness banner when `generated` > 2h.
- [ ] Filters work against data attributes as in the prototype.
- [ ] Hide "why it matters" blocks when the field is absent.
- **Done when:** the live site shows real stories that update every ~30 min with no
  human involvement.

## Phase 3 — Source depth
- [ ] Add lab/company sources (OpenAI, DeepMind, Google Research RSS; Anthropic/
      xAI/SpaceX HTML parses) per DATA_SOURCES.md, one PR per source.
- [ ] Launch Library integration: a dedicated "next launch" item type with a small
      special card (date, vehicle, mission, stream link).
- [ ] Keyword rules for topic/org tagging (terafab, fusion, quantum, etc.).
- [ ] HN cross-matching to feed `communitySignal` into scores.
- **Done when:** every org chip in the UI reliably has content behind it.

## Phase 4 — Optional intelligence layer (still $0 paths)
The TL;DR extraction is rule-based. To get genuinely written summaries and "why it
matters" lines without billing:
- **Option A (recommended):** a local enrichment loop — run Claude Code on your
  machine against `data/items.json` with a repo skill/prompt that fills in `why`
  fields for tier-1/2 items, then commit. Manual cadence (e.g. once daily), zero
  marginal cost on an existing Claude subscription.
- **Option B:** a free-tier hosted LLM endpoint, if one with acceptable terms is
  available at build time — research current options then; do not hardcode an
  assumption.
- **Option C:** stay rule-based; write `why` templates per badge type
  (paper/launch/product) — surprisingly serviceable.
- Pipeline must treat `why` as optional forever, so any option can be dropped.

## Phase 5 — Nice-to-haves (backlog, unordered)
- Daily digest as an RSS/Atom feed *output* (data/feed.xml) so users can subscribe.
- Per-topic deep links (`#topic=space`) and shareable story permalinks.
- 7-day archive pages from git history of items.json.
- PWA manifest + offline cache of last JSON for phone home-screen use.
- Dark mode (derive from existing tokens; keep ultramarine accent).
- Lightweight analytics via GoatCounter free tier (optional, privacy-friendly).

## Explicit non-goals
- No accounts, no comments, no server, no database.
- No scraping behind paywalls; no full-text republication.
- No paid API keys anywhere in the repo or Actions secrets.
