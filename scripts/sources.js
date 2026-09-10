// Source registry — every entry is free and keyless (see docs/DATA_SOURCES.md).
// Scope (Sept 2026): AI/LLM companies PLUS broader frontier-tech categories —
// space, hardware/chips (compute), robotics, cybersecurity (security) and gaming.
// Each source declares a `topic`; the frontend surfaces one tab per topic.
// AI frontier labs: Anthropic, OpenAI, Google, xAI, NVIDIA, Microsoft, and the
// open-source model labs (DeepSeek, Moonshot/Kimi, Zhipu/GLM, Qwen, Meta/Llama),
// plus Hugging Face for model releases.
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
    name: 'Meta AI Blog', org: ['meta'], topic: 'ai', type: 'html',
    url: 'https://ai.meta.com/blog/', weight: 0.95,
    parse: 'metaAiBlog', // no RSS — parse the blog index page (1 req/run)
  },
  {
    name: 'Meta Newsroom', org: ['meta'], topic: 'ai', type: 'rss',
    url: 'https://about.fb.com/news/feed/', weight: 0.75,
    // corporate newsroom — every title says "Meta", so the frontier filter
    // can't discriminate; require an actual AI keyword in the title instead
    mustMatch: /\bAI\b|artificial intelligence|llama|superintelligen|\bmodel\b|data ?cent(er|re)|compute|smart glasses/i,
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

  // ── General news wires (routed) ──────────────────────────────────────
  // Straight-news publications not tied to one beat. route:true sends each
  // item to a category by ROUTE_RULES and drops off-beat items — so these
  // feed every tab with only on-beat, actual-news stories. (The Register was
  // tried but its feed 302-redirects bots and returns nothing to the pipeline.)
  { name: 'Ars Technica', org: [], topic: 'ai', type: 'rss', weight: 0.8,
    url: 'https://feeds.arstechnica.com/arstechnica/index', route: true },
  { name: 'BBC Technology', org: [], topic: 'ai', type: 'rss', weight: 0.75,
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', route: true },
  { name: 'TechCrunch', org: [], topic: 'ai', type: 'rss', weight: 0.75,
    url: 'https://techcrunch.com/feed/', route: true },

  // Purist source policy (owner request): each beat below leads with straight-news
  // publications / official press; the routed wires above (The Register, TechCrunch)
  // supplement every beat. Enthusiast sites that mix in reviews/deals/features
  // (Tom's Hardware, IEEE Spectrum, Space.com, the consumer gaming outlets) were
  // dropped in favour of news-only feeds.

  // ── Space & aerospace ────────────────────────────────────────────────
  { name: 'NASA', org: [], topic: 'space', type: 'rss', weight: 0.85,
    url: 'https://www.nasa.gov/feed/' },
  { name: 'SpaceNews', org: [], topic: 'space', type: 'rss', weight: 0.8,
    url: 'https://spacenews.com/feed/' },
  { name: 'ESA Space News', org: [], topic: 'space', type: 'rss', weight: 0.8,
    url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News' },
  { name: 'Ars Technica · Space', org: [], topic: 'space', type: 'rss', weight: 0.7,
    url: 'https://arstechnica.com/tag/space/feed/' },

  // ── Hardware & chips (topic: compute) ────────────────────────────────
  // NVIDIA (Tier A) is compute-topic too; The Register/TechCrunch route their
  // chip/hardware items here. Ars Gadgets is the news-focused consumer-tech anchor.
  { name: 'Ars Technica · Gadgets', org: [], topic: 'compute', type: 'rss', weight: 0.7,
    url: 'https://feeds.arstechnica.com/arstechnica/gadgets' },

  // ── Robotics ─────────────────────────────────────────────────────────
  // No pure-news robotics wire exists; The Robot Report is the trade-news anchor
  // (still needs the noise filter for its occasional interviews/sponsored posts).
  { name: 'The Robot Report', org: [], topic: 'robotics', type: 'rss', weight: 0.7,
    url: 'https://www.therobotreport.com/feed/' },

  // ── Cybersecurity (topic: security) ──────────────────────────────────
  { name: 'Krebs on Security', org: [], topic: 'security', type: 'rss', weight: 0.8,
    url: 'https://krebsonsecurity.com/feed/' },
  { name: 'BleepingComputer', org: [], topic: 'security', type: 'rss', weight: 0.7,
    url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'The Hacker News', org: [], topic: 'security', type: 'rss', weight: 0.65,
    url: 'https://feeds.feedburner.com/TheHackersNews' },

  // ── Gaming ───────────────────────────────────────────────────────────
  // GamesIndustry.biz is the only pure games-*news* wire; consumer outlets were
  // dropped. The routed wires add gaming-industry items from The Register/TechCrunch.
  { name: 'GamesIndustry.biz', org: [], topic: 'gaming', type: 'rss', weight: 0.8,
    url: 'https://www.gamesindustry.biz/feed' },
];

// Keyword rules — override a source's default topic per item.
// Checked against the item title (case-insensitive). First match wins.
export const TOPIC_RULES = [
  { re: /\b(chip|chips|fab|semiconductor|gpu|tpu|cuda|lithography|datacenter|data center|silicon)\b/i, topic: 'compute' },
];

// Routing rules — for general news wires (route:true) that aren't tied to one
// beat. Each item is sent to the FIRST matching category; items matching none
// are dropped (generic enterprise IT/business isn't one of our beats). Order
// matters: security → space → gaming → robotics → compute → ai. AI is last so a
// specific beat wins ("AI chip" → compute, "AI in games" → gaming).
export const ROUTE_RULES = [
  { re: /\b(breach|breached|hack(?:ed|er|ers|ing)?|ransomware|malware|phishing|vulnerabilit|exploit(?:ed|s)?|\bcve\b|zero[- ]?day|cyber[- ]?attack|cybersecurity|data leak|spyware|botnet|infostealer|credential|patched?)\b/i, topic: 'security' },
  { re: /\b(nasa|spacex|rocket|satellite|orbit(?:al)?|astronaut|\bmars\b|\bmoon\b|lunar|telescope|spacecraft|\besa\b|starship|space station|asteroid|cosmic|galaxy|nebula|exoplanet)\b/i, topic: 'space' },
  { re: /\b(video game|gaming|\bgame\b|\bgames\b|playstation|\bps5\b|\bxbox\b|nintendo|\bsteam\b|\bconsole\b|esports|game studio)\b/i, topic: 'gaming' },
  { re: /\b(robot(?:ic|ics|s)?|humanoid|\bdrones?\b|autonomous|cobot|actuator|\blidar\b)\b/i, topic: 'robotics' },
  { re: /\b(chip|chips|\bgpu\b|\bcpu\b|semiconductor|processor|silicon|\bfab\b|foundry|data ?cent(?:er|re)|nvidia|\bamd\b|\bintel\b|\btsmc\b|\barm\b|wafer|nanometer)\b/i, topic: 'compute' },
  { re: /\b(\bai\b|a\.i\.|artificial intelligence|\bllm\b|language model|openai|anthropic|chatgpt|gpt-\d|\bgemini\b|\bclaude\b|deepseek|neural network|machine learning|\bmodel\b)\b/i, topic: 'ai' },
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

  // ── hardware / chips ──
  { re: /\bamd\b|\bradeon\b|\bryzen\b|\bepyc\b/i, org: 'amd' },
  { re: /\bintel\b|\bxeon\b|core ultra/i, org: 'intel' },
  { re: /\bapple\b|\biphone\b|\bipad\b|\bairpods\b/i, org: 'apple' },
  { re: /\bqualcomm\b|\bsnapdragon\b/i, org: 'qualcomm' },
  { re: /\btsmc\b/i, org: 'tsmc' },
  { re: /\bsamsung\b/i, org: 'samsung' },
  { re: /\bmicron\b/i, org: 'micron' },
  { re: /\basml\b/i, org: 'asml' },

  // ── space ──
  { re: /\bnasa\b/i, org: 'nasa' },
  { re: /\bspacex\b|\bstarship\b|falcon 9|falcon heavy/i, org: 'spacex' },
  { re: /\besa\b|european space agency/i, org: 'esa' },
  { re: /blue origin|new glenn|new shepard/i, org: 'blue-origin' },
  { re: /rocket lab|\belectron\b/i, org: 'rocket-lab' },
  { re: /\bboeing\b|\bstarliner\b/i, org: 'boeing' },
  { re: /united launch alliance/i, org: 'ula' },
  { re: /\broscosmos\b/i, org: 'roscosmos' },
  { re: /\bisro\b/i, org: 'isro' },
  { re: /virgin galactic/i, org: 'virgin-galactic' },
  { re: /arianespace|ariane \d/i, org: 'arianespace' },

  // ── gaming ──
  { re: /\bsony\b|\bplaystation\b|\bps5\b|\bps plus\b/i, org: 'sony' },
  { re: /\bxbox\b|game pass/i, org: 'microsoft' },
  { re: /\bnintendo\b|switch 2/i, org: 'nintendo' },
  { re: /\bvalve\b|\bsteam\b|steam deck/i, org: 'valve' },
  { re: /epic games/i, org: 'epic' },
  { re: /electronic arts|ea sports/i, org: 'ea' },
  { re: /\bubisoft\b/i, org: 'ubisoft' },
  { re: /\bactivision\b|\bblizzard\b/i, org: 'activision' },
  { re: /\brockstar\b|take-?two|\bgta\b/i, org: 'rockstar' },
  { re: /\bsega\b/i, org: 'sega' },
  { re: /\bcapcom\b/i, org: 'capcom' },
  { re: /square enix/i, org: 'square-enix' },
  { re: /\bkojima\b/i, org: 'kojima' },

  // ── robotics ──
  { re: /boston dynamics/i, org: 'boston-dynamics' },
  { re: /\bunitree\b/i, org: 'unitree' },
  { re: /agility robotics/i, org: 'agility' },
  { re: /\btesla\b|\boptimus\b/i, org: 'tesla' },
];

// Badge rules — optional labels rendered as chips on cards.
export const BADGE_RULES = [
  { re: /arxiv\.org/i, on: 'url', badge: 'paper' },
  { re: /\b(open[- ]?source|open[- ]?weights|github|oss)\b/i, on: 'title', badge: 'oss' },
  { re: /\b(paper|study|research)\b/i, on: 'title', badge: 'research' },
];

// Noise filter — drop items that aren't news. High-volume beats (gaming,
// hardware) publish a lot of listicles, reviews, opinion, thought-leadership,
// photo columns and shopping deals; this site wants actual news, so any item
// whose title matches is discarded in normalise() before it can be ranked.
//
// IMPORTANT: deals are matched by their FRAMING ("save $", "now just", "% off",
// "best … deal"), never by the presence of a price. A product launch such as
// "Sony announces the PS6 starting at $799" names a price but is real news and
// must survive — so nothing here keys on "$"/digits alone. Likewise a bare
// "deal"/"sale" is left alone (M&A deals, "goes on sale" release dates are news).
export const NOISE_RE = new RegExp([
  // listicles: "15 classic games…", "8 biggest…", "10 most anticipated…"
  String.raw`\b\d+\s+(?:best|worst|biggest|greatest|coolest|hidden|underrated|essential|most|anticipated|favou?rite|classic|must[- ]?(?:play|have|watch|read|see)|amazing|awesome|things|ways|reasons|tips|tricks|games|gadgets|apps|tools|moments|facts)\b`,
  String.raw`\b(?:best|worst|top)\s+\d+\b`,
  String.raw`\bbest way\b`,
  // opinion / reviews / features / interviews / thought-leadership / columns
  String.raw`\b(?:review|reviews|hands[- ]on|preview|opinion|editorial|op[- ]?ed|column|interview|retrospective|impressions|first[- ]person|dev diary|video friday|the case for|in defen[cs]e of|makes? the case|reflects on|explains? why|why i\b|on making|studio on|has taught|have taught|to discuss|discusses|behind closed doors|slopfest|meeting the moment)\b`,
  String.raw`^why\b`,
  // photo / picture columns (daily images, not news)
  String.raw`\b(?:apod|(?:astronomy )?picture of the day|photo of the day|image of the day)\b`,
  // service / catalogue pieces (monthly free games, subscription line-ups)
  String.raw`\b(?:ps plus|playstation plus|game pass|games with gold|free games this|monthly games|here are (?:our|your))\b`,
  // shopping DEALS — keyed on deal framing, NEVER on a price alone
  String.raw`\bsave\s+\$?\d`,
  String.raw`\bnow\s+(?:just|only)\s+\$?\d`,
  String.raw`\b(?:drops?|down)\s+to\s+\$?\d`,
  String.raw`\d+%\s*off\b`,
  String.raw`\b(?:discount(?:ed|s)?|coupons?|clearance|prime day|black friday|cyber monday|msrp|giveaways?|sweepstakes)\b`,
  String.raw`\bdeal of the\b`,
  String.raw`\bbest\b[^:]{0,25}\bdeals?\b`,
  String.raw`\bgrab (?:this|these|the)\b`,
  // buying guides / how-tos / roundups / rankings / service pages
  String.raw`\b(?:how[- ]?to|buying guide|explainer|everything you need to know|tips and tricks|tier list|wishlist|round[- ]?up|ranked|ranking|what time (?:does|is|do|are)|time zone)\b`,
  // entertainment / merch fluff — not tech news
  String.raw`\b(?:gaming chair|office chair|mug|merch|t[- ]?shirt|hoodie|plush(?:ie)?|figurine|collectible|mouse pad|desk mat|board games?|tabletop|comic strip|lego|cosplay)\b`,
].join('|'), 'i');
