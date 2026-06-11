// SIGNAL pipeline: fetch → normalise → dedupe → score → tldr → write data/*.json
// Node 20+, ES modules, zero npm dependencies. Run: node scripts/fetch.js

import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { SOURCES, TOPIC_RULES, ORG_RULES, BADGE_RULES } from './sources.js';

const USER_AGENT = 'signal-briefing/1.0 (+https://github.com/dboardman/signal)';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_AGE_DAYS = 7;
const MAX_ITEMS = 60;
const ARXIV_DELAY_MS = 3_000; // arXiv asks for 3s between requests

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
  for (const r of TOPIC_RULES) if (r.re.test(title)) return r.topic;
  return fallback;
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

  const ageMs = Date.now() - published.getTime();
  if (ageMs > MAX_AGE_DAYS * 864e5 || ageMs < -36e5) return null; // stale or future-dated

  return {
    id: sha1(url),
    title: raw.title.trim(),
    url,
    source: src.name,
    org: classifyOrgs(raw.title, src.org),
    topic: classifyTopic(raw.title, src.topic),
    tldr: extractTldr(raw.description, src.name),
    published: published.toISOString(),
    badges: classifyBadges(raw),
    points: raw.points ?? 0,
    weight: src.weight,
    dupes: 1,
  };
}

// ─────────────────── de-duplicate ───────────────────

const STOPWORDS = new Set('a an the of in on at to for and or with from by as is are was its it this that new says said'.split(' '));

function titleTokens(title) {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w)),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
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
    const match = unique.find(u => jaccard(u._tokens, item._tokens) >= 0.6);
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

function score(item, maxPoints) {
  const ageH = Math.max(0, (Date.now() - new Date(item.published).getTime()) / 36e5);
  const recency = Math.exp(-Math.LN2 * ageH / 18); // half-life ~18h
  const crossCoverage = Math.min(item.dupes, 4) / 4;
  const community = maxPoints > 0 ? item.points / maxPoints : 0;
  return +(0.35 * recency + 0.25 * item.weight + 0.25 * crossCoverage + 0.15 * community).toFixed(3);
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
  const maxPoints = Math.max(0, ...unique.map(i => i.points));
  for (const item of unique) item.score = score(item, maxPoints);
  unique.sort((a, b) => b.score - a.score);

  const items = unique.slice(0, MAX_ITEMS).map((item, i) => {
    const { points, weight, ...out } = item;
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
