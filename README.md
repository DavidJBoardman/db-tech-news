# SIGNAL — Frontier Tech Briefing

Zero-cost, static briefing site for the latest in AI, space, chips, science, and
energy. GitHub Actions polls free, keyless feeds every ~30 minutes and commits
JSON back to the repo; GitHub Pages serves a single-page, TL;DR-first UI in a
black mission-control theme.

## How it works

```
GitHub Actions (cron */30) ──▶ scripts/fetch.js ──▶ data/items.json + digest.json
                                                          │ (committed back)
GitHub Pages ──▶ index.html ──▶ fetch('./data/items.json') ──▶ briefing UI
```

No server, no database, no API keys, $0/month. Details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deploy (one-time setup)

1. Push this repo to GitHub (**public**, so Actions and Pages are free).
2. **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder
   `/ (root)`.
3. **Actions** tab → enable workflows → run **update-feed** once via
   *Run workflow* to seed `data/*.json`.
4. Done — the cron keeps it fresh. The site is at
   `https://<user>.github.io/<repo>/`.

## Local development

```bash
node scripts/fetch.js            # run the pipeline, writes data/*.json
python3 -m http.server 4173      # preview at http://localhost:4173
```

Node 20+, ES modules, zero npm dependencies.

Docs: [Architecture](docs/ARCHITECTURE.md) · [Data sources](docs/DATA_SOURCES.md) ·
[Design system](docs/DESIGN.md) · [Roadmap](docs/ROADMAP.md)
