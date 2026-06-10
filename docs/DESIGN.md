# Design System — "SIGNAL"

Source of truth: `prototype/frontier-briefing-prototype.html`. This document
extracts the system so it survives refactors. The design intent: a **wire-service /
telemetry briefing** — the page should feel like a calm control room in daylight,
not a neon dashboard and not a newspaper.

## Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EDF0F4` | page background (cool daylight ground) |
| `--card` | `#FFFFFF` | card surfaces |
| `--ink` | `#0E1626` | primary text, hero background, dark chips |
| `--ink-soft` | `#4A5568` | secondary text, metadata |
| `--line` | `#D4DAE3` | borders, dividers |
| `--signal` | `#2438E8` | accent: electric ultramarine — links, active chips, signal bars, "why it matters" |
| `--signal-soft` | `#E4E8FD` | badge backgrounds |
| `--breaking` | `#FF4D12` | breaking/tier-1 indicator, launch badges |
| `--ok` | `#0E9F6E` | feed-health LEDs, paper badges |

Do not add colors. Amber `#C9A227` exists only for "slow feed" LEDs.

### Dark theme (the live site)

The shipped `index.html` uses a black theme (SpaceX/xAI marketing register —
black ground, telemetry voice) derived from the tokens above; the light palette
remains in the prototype for reference. Mapping:

| Token | Dark value | Notes |
|---|---|---|
| `--paper` | `#000000` | black ground |
| `--card` | `#0B0E14` | near-black surface |
| `--ink` | `#F2F4F8` | text (the hero's light text in the light theme) |
| `--ink-soft` | `#8C95A8` | secondary text |
| `--line` | `#1C2230` | borders |
| `--signal` | `#2438E8` | unchanged — fills (active topic chip) |
| `--signal-on-dark` | `#8FA0FF` | periwinkle from the hero's "why" line — accent text, signal bars |
| `--breaking` / `--ok` | unchanged | |

Active org chips invert to white-on-black (`--ink` fill, black text). Everything
else — type, radii, motion budget, components — is identical to the system above.

### Type
| Role | Face | Notes |
|---|---|---|
| Display | **Archivo** (variable, width ~75–80%, weight 650–800) | headlines, wordmark — condensed, urgent but clean |
| Body | **Inter** 400/500/600 | summaries, UI text |
| Utility | **IBM Plex Mono** 400/500 | timestamps, source names, tickers, eyebrows — the "telemetry" voice |

Rule of thumb: anything that is *data about the data* (time, source, counts, tiers)
is set in mono, uppercase, letter-spaced. Everything editorial is Archivo/Inter.

### Shape & motion
- Radii: cards 10px, hero 12px, chips 999px (topic) / 6px (org).
- Motion budget: the pulsing live-dot keyframe (`pulse`) and a 1px hover lift on
  cards. Nothing else. `prefers-reduced-motion` disables all of it.

## Components & their jobs

1. **Wire rail** (signature element) — sticky left rail listing every source feed
   with a health LED (green = fresh, amber = slow) and a mono freshness stamp.
   Job: prove the "absolute latest" promise visibly. On mobile it becomes a
   horizontal scroller under the header.
2. **Hero (tier 1)** — exactly one story per view, dark ink panel, breaking tag,
   "Why it matters →" line in periwinkle (`#8FA0FF` on dark). Job: hierarchy — the
   page tells you what matters most today.
3. **Cards (tier 2)** — white cards in a 2-col grid (1-col mobile). Anatomy, top to
   bottom: signal-strength bars (1–3, encode `tier`/`score`) + source + relative
   age → headline → 2-sentence TL;DR → badges → "WHY IT MATTERS" footer (omit the
   footer entirely if no `why` field).
4. **Filters** — topic chips (pill, accent fill when active) and org chips (square,
   mono, ink fill when active). Both AND-combined. Empty state offers a one-click
   "Clear filters".
5. **Mode toggle** — LIVE FEED / DAILY DIGEST in the header. Digest = numbered
   top-5 "90-second read", mono index numbers, no images, no chrome.
6. **Count line** — mono strip above the feed: `N ITEMS · RANKED BY SIGNAL
   STRENGTH · UPDATED 6 MIN AGO`. Job: honesty about ranking + freshness. Wire the
   "updated" value to `items.json:generated` and add a staleness banner if >2h.

## Voice & microcopy

- Sentence case everywhere except mono eyebrows/labels (uppercase).
- TL;DRs: two sentences max, plain verbs, no hype adjectives.
- "Why it matters" lines: one sentence, concrete consequence, no "this could
  revolutionize…" filler.
- Timestamps always relative under 24h ("23m ago"), then "Mon 9 Jun".
- Empty/error states give a next action, never just apologise.

## Accessibility floor

Visible keyboard focus (`:focus-visible` ring in `--signal`), signal bars carry
`aria-label` importance text, color is never the only channel (LEDs pair with
timestamps; tiers pair with bars *and* layout), contrast ≥ 4.5:1 for text
(`--ink-soft` on `--paper` passes), reduced-motion respected.
