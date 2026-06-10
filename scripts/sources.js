// Source registry — every entry is free and keyless (see docs/DATA_SOURCES.md).
// type: 'rss' | 'atom' | 'json'. weight: 0–1 source credibility/priority.
// Sources are fallible: fetch.js must skip+log failures, never crash.

export const SOURCES = [
  // ── Tier A — primary lab/company feeds ────────────────────────────────
  {
    name: 'OpenAI Blog', org: ['openai'], topic: 'ai', type: 'rss',
    url: 'https://openai.com/blog/rss.xml', weight: 0.95,
  },
  {
    name: 'Google DeepMind', org: ['google'], topic: 'ai', type: 'rss',
    url: 'https://deepmind.google/blog/rss.xml', weight: 0.95,
  },
  {
    name: 'Google Research', org: ['google'], topic: 'ai', type: 'rss',
    url: 'https://research.google/blog/rss/', weight: 0.9,
  },

  // ── Tier B — research & structured data ───────────────────────────────
  {
    name: 'arXiv cs.AI/LG', org: [], topic: 'ai', type: 'atom', weight: 0.8,
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=25',
  },
  {
    name: 'arXiv physics', org: [], topic: 'science', type: 'atom', weight: 0.75,
    url: 'http://export.arxiv.org/api/query?search_query=cat:quant-ph+OR+cat:cond-mat.supr-con&sortBy=submittedDate&sortOrder=descending&max_results=25',
  },
  {
    name: 'Launch Library', org: [], topic: 'space', type: 'json', weight: 0.85,
    url: 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10',
    parse: 'launchLibrary', // one call per run — free tier ~15 req/hr
  },
  {
    name: 'NASA News', org: [], topic: 'space', type: 'rss', weight: 0.8,
    url: 'https://www.nasa.gov/news-release/feed/',
  },

  // ── Tier C — community signal & aggregators ───────────────────────────
  {
    name: 'Hacker News', org: [], topic: 'ai', type: 'json', weight: 0.55,
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
    parse: 'hnAlgolia',
    filter: 'frontier', // front page carries everything; keep only on-beat items
  },
  {
    name: 'Ars Technica', org: [], topic: 'science', type: 'rss', weight: 0.6,
    url: 'https://feeds.arstechnica.com/arstechnica/science',
  },
  {
    name: 'The Verge AI', org: [], topic: 'ai', type: 'rss', weight: 0.55,
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  },
  {
    name: 'MIT Tech Review', org: [], topic: 'ai', type: 'rss', weight: 0.6,
    url: 'https://www.technologyreview.com/feed/',
  },
  {
    name: 'TechCrunch AI', org: [], topic: 'ai', type: 'rss', weight: 0.5,
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
];

// Keyword rules — override a source's default topic per item, and tag orgs.
// Checked against the item title (case-insensitive). First topic match wins.
export const TOPIC_RULES = [
  { re: /\b(chip|chips|fab|semiconductor|gpu|tpu|lithography|terafab|datacenter|data center)\b/i, topic: 'compute' },
  { re: /\b(fusion|tokamak|battery|batteries|grid|solar|nuclear|reactor)\b/i, topic: 'energy' },
  { re: /\b(rocket|launch|orbit|orbital|starship|satellite|mars|lunar|moon landing|spacecraft)\b/i, topic: 'space' },
  { re: /\b(quantum|protein|physics|materials|superconduct\w*|genome|crispr)\b/i, topic: 'science' },
  { re: /\b(llm|model|agent|transformer|neural|machine learning|artificial intelligence)\b/i, topic: 'ai' },
];

export const ORG_RULES = [
  { re: /\banthropic|claude\b/i, org: 'anthropic' },
  { re: /\bopenai|chatgpt|gpt-\d/i, org: 'openai' },
  { re: /\bdeepmind|google|gemini\b/i, org: 'google' },
  { re: /\bxai\b|\bgrok\b|colossus/i, org: 'xai' },
  { re: /\bspacex|starship|falcon (9|heavy)|starlink\b/i, org: 'spacex' },
  { re: /terafab/i, org: 'terafab' },
];

// Badge rules — optional labels rendered as chips on cards.
export const BADGE_RULES = [
  { re: /arxiv\.org/i, on: 'url', badge: 'paper' },
  { re: /\b(launch|liftoff|maiden flight)\b/i, on: 'title', badge: 'launch' },
  { re: /\b(open[- ]?source|github|oss)\b/i, on: 'title', badge: 'oss' },
  { re: /\b(paper|study|research)\b/i, on: 'title', badge: 'research' },
];
