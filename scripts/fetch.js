// SIGNAL pipeline: fetch → normalise → dedupe → score → tldr → write data/*.json
// Node 20+, ES modules, zero npm dependencies. Run: node scripts/fetch.js

import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { SOURCES, TOPIC_RULES, ORG_RULES, BADGE_RULES, NOISE_RE, ROUTE_RULES } from './sources.js';

const USER_AGENT = 'signal-briefing/1.0 (+https://github.com/dboardman/signal)';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_AGE_DAYS = 7;
const MAX_ITEMS = 66;
// Max items any single topic contributes to the feed — stops high-volume beats
// swamping the "All" view. Gaming is capped lower: it's the noisiest beat and the
// owner wants it a smaller slice of the mix. Any topic not listed uses `default`.
const PER_TOPIC_CAP = { default: 12, gaming: 6 };
const capFor = (topic) => PER_TOPIC_CAP[topic] ?? PER_TOPIC_CAP.default;
const ARXIV_DELAY_MS = 3_000; // arXiv asks for 3s between requests

// Ranking tunables (see docs/ARCHITECTURE.md).
const RECENCY_HALFLIFE_H = 30; // recency score halves every ~30h — long enough
                               // that a major evening event isn't half-decayed by
                               // the next morning, short enough to stay fresh.
const BURST_CAP = 3;           // saturation point for the "event burst" signal:
                               // the recency-weighted mass of OTHER recent stories
                               // sharing an item's org (a keynote spawns many).
// Per-topic priority in the CROSS-topic competition (hero + card order). Gaming
// is a lower-priority beat here, so a gaming item only leads the whole feed when
// it's genuinely huge; it still ranks normally *within* the Gaming tab. 1 = full.
const TOPIC_WEIGHT = { default: 1, space: 0.95, robotics: 0.95, gaming: 0.82 };
const topicWeight = (t) => TOPIC_WEIGHT[t] ?? TOPIC_WEIGHT.default;

// ───────────────────────── fetch ─────────────────────────

async function fetchSource(src) {
  const res = await fetch(src.url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (src.type === 'json') return parseJsonSource(src, JSON.parse(body));
  if (src.type === 'html') return parseHtmlSource(src, body);
  return parseFeed(src, body);
}

// ─────────────────── minimal XML feed parsing ───────────────────
// Hand-rolled on purpose (zero deps). Handles the well-formed RSS 2.0 and
// Atom feeds in the registry; anything it can't read just yields no items
// and the per-source error isolation reports it.

function blocks(xml, tag) {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, 'g');
  return xml.match(re) ?? [];
}

function field(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeEntities(stripCdata(m[1]).trim()) : '';
}

function atomLink(xml) {
  // prefer rel="alternate" (or no rel), skip rel="self" etc.
  for (const m of xml.matchAll(/<link\b([^>]*?)\/?>(?:<\/link>)?/gi)) {
    const attrs = m[1];
    const rel = attrs.match(/rel="([^"]*)"/i)?.[1];
    if (rel && rel !== 'alternate') continue;
    const href = attrs.match(/href="([^"]*)"/i)?.[1];
    if (href) return decodeEntities(href);
  }
  return '';
}

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripHtml(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseFeed(src, xml) {
  const items = [];
  if (src.type === 'atom' || (!xml.includes('<rss') && xml.includes('<entry'))) {
    for (const e of blocks(xml, 'entry')) {
      items.push({
        title: stripHtml(field(e, 'title')),
        url: atomLink(e) || field(e, 'id'),
        description: field(e, 'summary') || field(e, 'content'),
        published: field(e, 'published') || field(e, 'updated'),
      });
    }
  } else {
    for (const it of blocks(xml, 'item')) {
      items.push({
        title: stripHtml(field(it, 'title')),
        url: field(it, 'link') || it.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || '',
        description: field(it, 'description') || field(it, 'content:encoded'),
        published: field(it, 'pubDate') || field(it, 'dc:date'),
      });
    }
  }
  return items;
}

// ─────────────────── JSON API parsers ───────────────────

function parseJsonSource(src, data) {
  if (src.parse === 'hnAlgolia') {
    return (data.hits ?? []).filter(h => h.url && h.title).map(h => ({
      title: h.title,
      url: h.url,
      description: '',
      published: h.created_at,
      points: h.points ?? 0,
    }));
  }
  if (src.parse === 'hfModels') {
    return (Array.isArray(data) ? data : []).map(m => ({
      title: `New model on Hugging Face: ${m.id ?? m.modelId}`,
      url: `https://huggingface.co/${m.id ?? m.modelId}`,
      description: '',
      published: m.createdAt,
      isModel: true,
    }));
  }
  return [];
}

// ─────────────────── HTML page parsers ───────────────────
// Last resort for sources with no feed. Selectors live here so breakage
// is a one-line fix; a redesign just yields zero items, never a crash.

function parseHtmlSource(src, html) {
  if (src.parse === 'anthropicNews') {
    const items = [];
    for (const m of html.matchAll(/<a [^>]*href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const [, path, inner] = m;
      // featured grid wraps titles in <h*>, the publication list in a
      // <span class="…__title…"> — match the class, fall back to the heading
      const title = inner.match(/class="[^"]*__title[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|span|div)>/)?.[1]
        ?? inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/)?.[1];
      const date = inner.match(/<time[^>]*>([\s\S]*?)<\/time>/)?.[1];
      if (!title || !date) continue;
      items.push({
        title: stripHtml(title),
        url: `https://www.anthropic.com${path}`,
        description: stripHtml(inner.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
        published: stripHtml(date), // "May 28, 2026" — Date() parses this
      });
    }
    return items; // same story can appear in two page sections; URL dedupe merges
  }
  if (src.parse === 'metaAiBlog') {
    // Class names on ai.meta.com are obfuscated and rotate, but the page's
    // bottom grid tags every post card with a 'listview-card' analytics
    // marker. Each card reads: date → category <h4> → title <h4> →
    // description <p> → "Learn More" anchor with the post URL.
    const items = [];
    const dateRe = /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/;
    for (const chunk of html.split('listview-card').slice(1)) {
      const um = chunk.match(/href="(https:\/\/ai\.meta\.com\/blog\/[a-z0-9-]+\/)"/);
      if (!um || um.index > 3000) continue; // tiny inter-marker chunk or stray link
      const block = chunk.slice(0, um.index); // stop at the link so we never read the next card
      const date = block.match(dateRe)?.[0];
      const h4s = [...block.matchAll(/<h4[^>]*>([^<]{4,}?)<\/h4>/g)];
      if (!date || !h4s.length) continue;
      items.push({
        title: stripHtml(h4s.at(-1)[1]), // last <h4>: the title (first is the category)
        url: um[1],
        description: stripHtml([...block.matchAll(/<p[^>]*>([^<]{60,}?)<\/p>/g)][0]?.[1] ?? ''),
        published: date,
      });
    }
    return items; // upstream URL dedupe merges repeats
  }
  return [];
}

// ─────────────────── normalise ───────────────────

function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    }
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString();
  } catch {
    return raw;
  }
}

function sha1(s) {
  return createHash('sha1').update(s).digest('hex');
}

function classifyTopic(title, fallback) {
  // Sources with an explicit topic (space, gaming, robotics, …) keep it; keyword
  // reclassification only refines the generic 'ai' default (e.g. ai → compute).
  if (fallback !== 'ai') return fallback;
  for (const r of TOPIC_RULES) if (r.re.test(title)) return r.topic;
  return fallback;
}

// General news wires (route:true) aren't tied to one beat — route each item to a
// category by its title, and drop anything that doesn't clearly belong to one of
// our beats (generic enterprise-IT, business, etc.). Returns a topic or null.
function routeTopic(title) {
  for (const r of ROUTE_RULES) if (r.re.test(title)) return r.topic;
  return null;
}

function classifyOrgs(title, defaults) {
  const orgs = new Set(defaults);
  for (const r of ORG_RULES) if (r.re.test(title)) orgs.add(r.org);
  return [...orgs];
}

function classifyBadges(item) {
  const badges = [];
  for (const r of BADGE_RULES) {
    const target = r.on === 'url' ? item.url : item.title;
    if (r.re.test(target) && !badges.includes(r.badge)) badges.push(r.badge);
  }
  if (item.isModel && !badges.includes('model')) badges.unshift('model');
  return badges;
}

function extractTldr(description, sourceName) {
  const text = stripHtml(description ?? '');
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  const isArxiv = /arxiv/i.test(sourceName);
  let tldr = sentences.slice(0, isArxiv ? 1 : 2).join(' ').trim();
  if (tldr.length > 220) {
    tldr = tldr.slice(0, 220).replace(/\s+\S*$/, '') + '…';
  }
  if (isArxiv && tldr) tldr += ' (arXiv preprint)';
  return tldr;
}

function normalise(src, raw) {
  const url = canonicalUrl(raw.url);
  const published = new Date(raw.published);
  if (!raw.title || !url.startsWith('http') || isNaN(published)) return null;

  // aggregators carry off-beat stories; require a frontier keyword match
  if (src.filter === 'frontier'
      && !TOPIC_RULES.some(r => r.re.test(raw.title))
      && !ORG_RULES.some(r => r.re.test(raw.title))) return null;
  // targeted search sources match on body/author too; require the term in the title
  if (src.mustMatch && !src.mustMatch.test(raw.title)) return null;
  // drop non-news: listicles, reviews, opinion, buying guides, deals, merch
  if (NOISE_RE.test(raw.title)) return null;

  // general news wires: route to a beat by title, skip off-beat items
  let topic = src.topic;
  if (src.route) {
    const routed = routeTopic(raw.title);
    if (!routed) return null;
    topic = routed;
  } else {
    topic = classifyTopic(raw.title, src.topic);
  }

  const ageMs = Date.now() - published.getTime();
  if (ageMs > MAX_AGE_DAYS * 864e5 || ageMs < -36e5) return null; // stale or future-dated

  return {
    id: sha1(url),
    title: raw.title.trim(),
    url,
    source: src.name,
    org: classifyOrgs(raw.title, src.org),
    topic,
    tldr: extractTldr(raw.description, src.name),
    published: published.toISOString(),
    badges: classifyBadges(raw),
    points: raw.points ?? 0,
    weight: src.weight,
    dupes: 1,
  };
}

// ─────────────────── de-duplicate ───────────────────

const STOPWORDS = new Set(('a an the of in on at to for and or with from by as is are was be been being '
  + 'has have had its it this that these those new news says said also amid over into out up down off '
  + 'than then now but not you your they their he she we our will would could can may').split(/\s+/));

// Very light stemmer — collapses plural/verb inflections so differently-worded
// headlines about the same story share tokens (publish / publishes / publishing
// / published → publish). Not linguistically correct, just consistent.
function stem(w) {
  w = w.replace(/['’]s$/, '');                                    // possessive
  if (w.length > 4 && /(?:ches|shes|ses|xes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);      // -ing
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);  // -ed
  return w;
}

function titleTokens(title) {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w))
      .map(stem),
  );
}

function overlap(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter;
}

// Two headlines describe the same story when either their wording is broadly
// similar (jaccard) OR one is largely a reworded superset of the other — a high
// share of the *shorter* title's words appear in the longer one. Containment
// catches the case token-jaccard misses: four outlets running the same scoop
// with very different sentence structure (e.g. the Kojima/Physint story).
function sameStory(a, b) {
  if (!a.size || !b.size) return false;
  const inter = overlap(a, b);
  if (inter / (a.size + b.size - inter) >= 0.5) return true;
  const minSize = Math.min(a.size, b.size);
  return minSize >= 5 && inter >= 5 && inter / minSize >= 0.5;
}

function dedupe(items) {
  const byUrl = new Map();
  for (const item of items) {
    const existing = byUrl.get(item.id);
    if (!existing) byUrl.set(item.id, item);
    else mergeInto(existing.weight >= item.weight ? existing : item,
                   existing.weight >= item.weight ? item : existing, byUrl);
  }

  const unique = [];
  for (const item of byUrl.values()) {
    item._tokens = titleTokens(item.title);
    const match = unique.find(u => sameStory(u._tokens, item._tokens));
    if (!match) { unique.push(item); continue; }
    const [keep, drop] = match.weight >= item.weight ? [match, item] : [item, match];
    keep.dupes += drop.dupes;
    keep.points = Math.max(keep.points, drop.points);
    keep.org = [...new Set([...keep.org, ...drop.org])];
    if (keep !== match) unique[unique.indexOf(match)] = keep;
  }
  for (const u of unique) delete u._tokens;
  return unique;

  function mergeInto(keep, drop, map) {
    keep.dupes += drop.dupes;
    keep.points = Math.max(keep.points, drop.points);
    keep.org = [...new Set([...keep.org, ...drop.org])];
    map.set(keep.id, keep);
  }
}

// ─────────────────── score & tier ───────────────────

function recencyOf(item) {
  const ageH = Math.max(0, (Date.now() - new Date(item.published).getTime()) / 36e5);
  return Math.exp(-Math.LN2 * ageH / RECENCY_HALFLIFE_H);
}

// Five signals, each 0–1, blended by fixed weights that sum to 1:
//   recency       — exponential decay, RECENCY_HALFLIFE_H half-life
//   weight        — per-source credibility (sources.js)
//   crossCoverage — how many sources ran the SAME story (dupes) → "big news"
//   community     — Hacker News points, normalised to the run's max
//   burst         — recent coverage of the item's ORG by OTHER stories → "big
//                   event" (a keynote spawns many distinct stories about one org,
//                   which crossCoverage alone can't see). Set in main().
function score(item, maxPoints) {
  const recency = recencyOf(item);
  const crossCoverage = Math.min(item.dupes, 4) / 4;
  const community = maxPoints > 0 ? item.points / maxPoints : 0;
  const burst = item.burst ?? 0;
  // Weighted toward "importance" (coverage + event burst) over raw freshness, so
  // a trivial-but-fresh item can't top a major, slightly-older event.
  return 0.22 * recency + 0.16 * item.weight + 0.22 * crossCoverage
       + 0.08 * community + 0.32 * burst;
}

// ─────────────────── main ───────────────────

async function main() {
  const summary = [];
  const all = [];
  let lastArxivAt = 0;

  for (const src of SOURCES) {
    try {
      if (src.url.includes('arxiv.org')) {
        const wait = lastArxivAt + ARXIV_DELAY_MS - Date.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        lastArxivAt = Date.now();
      }
      const raw = await fetchSource(src);
      const items = raw.map(r => normalise(src, r)).filter(Boolean);
      all.push(...items);
      summary.push(`✓ ${src.name}: ${items.length} items (${raw.length} fetched)`);
    } catch (err) {
      summary.push(`✗ ${src.name}: ${err.message}`);
    }
  }

  const unique = dedupe(all);

  // Event-burst signal: sum each org's recency-weighted "attention" across all
  // stories, then give an item credit for how much OTHER recent coverage its org
  // is getting right now. A keynote (many Apple stories at once) lights this up;
  // an isolated story scores ~0. crossCoverage counts one story across sources;
  // burst counts many stories across one entity — the two catch different shapes
  // of "big". Items with no org tag get burst 0 (their weight is via dupes).
  const orgAttention = new Map();
  for (const item of unique) {
    const r = recencyOf(item);
    for (const o of item.org) orgAttention.set(o, (orgAttention.get(o) ?? 0) + r);
  }
  for (const item of unique) {
    const self = recencyOf(item);
    let other = 0;
    for (const o of item.org) other = Math.max(other, (orgAttention.get(o) ?? 0) - self);
    item.burst = Math.min(other, BURST_CAP) / BURST_CAP;
  }

  const maxPoints = Math.max(0, ...unique.map(i => i.points));
  for (const item of unique) {
    item.score = +(score(item, maxPoints) * topicWeight(item.topic)).toFixed(3);
  }
  unique.sort((a, b) => b.score - a.score);

  // Per-topic cap: walk the score-ranked list and skip a topic once it has
  // contributed PER_TOPIC_CAP items. Preserves global score order (so the hero
  // and top cards are still the strongest signals overall) while keeping any one
  // high-volume beat from crowding out the rest of the "All" view.
  const topicCounts = new Map();
  const ranked = [];
  for (const item of unique) {
    const n = topicCounts.get(item.topic) ?? 0;
    if (n >= capFor(item.topic)) continue;
    topicCounts.set(item.topic, n + 1);
    ranked.push(item);
    if (ranked.length >= MAX_ITEMS) break;
  }

  const items = ranked.map((item, i) => {
    const { points, weight, burst, ...out } = item;
    out.tier = i === 0 ? 1 : i <= 12 ? 2 : 3;
    if (!out.badges.length) delete out.badges;
    return out;
  });

  const generated = new Date().toISOString();
  const dayAgo = Date.now() - 864e5;
  const digest = items
    .filter(i => new Date(i.published).getTime() >= dayAgo)
    .slice(0, 5)
    .map((i, n) => ({
      n: n + 1,
      title: i.title,
      tldr: i.tldr,
      url: i.url,
      meta: `${i.topic.toUpperCase()}${i.org.length ? ' · ' + i.org[0].toUpperCase() : ''}${i.tier === 1 ? ' · TIER 1' : ''}`,
    }));

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/items.json', import.meta.url), JSON.stringify({ generated, items }, null, 1) + '\n');
  await writeFile(new URL('../data/digest.json', import.meta.url), JSON.stringify({ generated, digest }, null, 1) + '\n');

  console.log(summary.join('\n'));
  console.log(`\n${all.length} raw → ${unique.length} unique → ${items.length} published. digest: ${digest.length} items.`);
  const failures = summary.filter(s => s.startsWith('✗')).length;
  if (failures === SOURCES.length) {
    console.error('All sources failed — aborting without writing would leave stale data; failing loudly.');
    process.exit(1);
  }
}

main();
