// Source registry — every entry is free and keyless (see docs/DATA_SOURCES.md).
// Scope: AI/LLM companies only — frontier labs (Anthropic, OpenAI, Google, xAI,
// NVIDIA, Microsoft) and open-source model labs (DeepSeek, Moonshot/Kimi,
// Zhipu/GLM, Qwen, Meta/Llama), plus Hugging Face for model releases.
// type: 'rss' | 'atom' | 'json' | 'html'. weight: 0–1 source credibility/priority.
// Sources are fallible: fetch.js must skip+log failures, never crash.

export const SOURCES = [
  // ── Tier A — official lab/company feeds ───────────────────────────────
  {
    name: 'Anthropic News', org: ['anthropic'], topic: 'ai', type: 'html',
    url: 'https://www.anthropic.com/news', weight: 0.95,
    parse: 'anthropicNews', // no RSS — parse the news index page (1 req/run)
  },
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
    url: 'https://research.google/blog/rss/', weight: 0.85,
  },
  {
    name: 'NVIDIA Blog', org: ['nvidia'], topic: 'compute', type: 'rss',
    url: 'https://blogs.nvidia.com/feed/', weight: 0.85,
  },
  {
    name: 'Microsoft Research', org: ['microsoft'], topic: 'ai', type: 'rss',
    url: 'https://www.microsoft.com/en-us/research/feed/', weight: 0.8,
  },
  {
    name: 'Microsoft Blog', org: ['microsoft'], topic: 'ai', type: 'rss',
    url: 'https://blogs.microsoft.com/feed/', weight: 0.75,
    filter: 'frontier', // corporate newsroom — keep only AI/model items
  },
  {
    name: 'Qwen Blog', org: ['qwen'], topic: 'ai', type: 'rss',
    url: 'https://qwenlm.github.io/blog/index.xml', weight: 0.9,
  },
  {
    name: 'Hugging Face Blog', org: [], topic: 'ai', type: 'rss',
    url: 'https://huggingface.co/blog/feed.xml', weight: 0.8,
  },

  // ── Tier B — Hugging Face model releases (open-source labs) ──────────
  // The HF models API is keyless; one call per org, newest 5 models each.
  ...[
    ['HF · DeepSeek', 'deepseek-ai', 'deepseek'],
    ['HF · Moonshot', 'moonshotai', 'moonshot'],
    ['HF · Zhipu', 'zai-org', 'zhipu'],
    ['HF · Qwen', 'Qwen', 'qwen'],
    ['HF · Meta Llama', 'meta-llama', 'meta'],
    ['HF · OpenAI', 'openai', 'openai'],
    ['HF · Google', 'google', 'google'],
  ].map(([name, author, org]) => ({
    name, org: [org], topic: 'ai', type: 'json', weight: 0.75,
    url: `https://huggingface.co/api/models?author=${author}&sort=createdAt&direction=-1&limit=5`,
    parse: 'hfModels',
  })),

  // ── Tier C — community signal & aggregators ───────────────────────────
  {
    name: 'Hacker News', org: [], topic: 'ai', type: 'json', weight: 0.55,
    url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
    parse: 'hnAlgolia',
    filter: 'frontier', // front page carries everything; keep only on-beat items
  },
  // Targeted HN queries for orgs with no (scrapeable) English feed —
  // xAI blocks scrapers (403); the Chinese labs publish on WeChat/HF.
  ...[
    ['HN · xAI', 'grok', 'xai', /\bgrok\b|\bxai\b/i],
    ['HN · DeepSeek', 'deepseek', 'deepseek', /deepseek/i],
    ['HN · Kimi', 'kimi', 'moonshot', /\bkimi\b|moonshot/i],
    ['HN · GLM', 'zhipu', 'zhipu', /zhipu|\bglm\b/i],
  ].map(([name, query, org, mustMatch]) => ({
    name, org: [org], topic: 'ai', type: 'json', weight: 0.5,
    url: `https://hn.algolia.com/api/v1/search_by_date?query=${query}&tags=story&numericFilters=points>10&hitsPerPage=10`,
    parse: 'hnAlgolia',
    mustMatch, // Algolia matches body/author too; require the term in the title
  })),
  {
    name: 'The Verge AI', org: [], topic: 'ai', type: 'rss', weight: 0.55,
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    filter: 'frontier', // keep only items about the tracked companies/models
  },
];

// Keyword rules — override a source's default topic per item.
// Checked against the item title (case-insensitive). First match wins.
export const TOPIC_RULES = [
  { re: /\b(chip|chips|fab|semiconductor|gpu|tpu|cuda|lithography|datacenter|data center|silicon)\b/i, topic: 'compute' },
];

export const ORG_RULES = [
  { re: /\banthropic\b|\bclaude\b/i, org: 'anthropic' },
  { re: /\bopenai\b|chatgpt|gpt-\d|gpt-oss|\bsora\b/i, org: 'openai' },
  { re: /\bdeepmind\b|\bgemini\b|\bgemma\b|\bgoogle\b/i, org: 'google' },
  { re: /\bxai\b|\bgrok\b/i, org: 'xai' },
  { re: /\bnvidia\b|\bcuda\b/i, org: 'nvidia' },
  { re: /\bmicrosoft\b|\bazure\b|\bcopilot\b|\bphi-\d/i, org: 'microsoft' },
  { re: /\bmeta\b|\bllama\b/i, org: 'meta' },
  { re: /\bdeepseek\b/i, org: 'deepseek' },
  { re: /\bmoonshot\b|\bkimi\b/i, org: 'moonshot' },
  { re: /\bzhipu\b|\bglm-?\d|\bz\.ai\b/i, org: 'zhipu' },
  { re: /\bqwen\b|\balibaba\b|\btongyi\b/i, org: 'qwen' },
];

// Badge rules — optional labels rendered as chips on cards.
export const BADGE_RULES = [
  { re: /arxiv\.org/i, on: 'url', badge: 'paper' },
  { re: /\b(open[- ]?source|open[- ]?weights|github|oss)\b/i, on: 'title', badge: 'oss' },
  { re: /\b(paper|study|research)\b/i, on: 'title', badge: 'research' },
];
