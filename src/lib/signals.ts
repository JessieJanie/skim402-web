/** Live catalog slugs and documented filters — do not invent extras. */

export type SignalFilterKey = "forms" | "categories" | "fields" | "states" | "committees";

export type SignalEntry = {
  slug: string;
  name: string;
  endpoint: string;
  docsAnchor: string;
  blurb: string;
  sources: string;
  price: string;
  filters: SignalFilterKey[];
  /** Shown after the primary AI/security/research/SEC group. */
  niche?: boolean;
};

export const SIGNAL_PRICE = "2 credits · $0.005 per poll";

/**
 * Catalog order: AI / security / research / SEC lead, then the rest of the
 * live feeds. Entertainment / studio-jobs / film-incentives stay listed,
 * visually demoted. x402 uses its own feed path, not /signal/{slug}.
 */
export const SIGNAL_CATALOG: SignalEntry[] = [
  {
    slug: "ai-news",
    name: "AI Tech Signal",
    endpoint: "GET /api/t/signal/ai-news/latest",
    docsAnchor: "/docs/#signal-ai-news",
    blurb:
      "High-signal AI and tech news: score-gated Hacker News front-page stories, fresh arXiv AI papers, and official vendor announcements. Title, excerpt, source, and link — the signal, not the noise.",
    sources: "Hacker News, arXiv, vendor announcements",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "security",
    name: "Security Signal",
    endpoint: "GET /api/t/signal/security/latest",
    docsAnchor: "/docs/#signal-security",
    blurb:
      "Live CISA cybersecurity advisories with CVE identifiers extracted into structured entities, so an agent can match new vulnerabilities against its own dependency list automatically.",
    sources: "CISA advisories",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "research",
    name: "Research Signal",
    endpoint: "GET /api/t/signal/research/latest",
    docsAnchor: "/docs/#signal-research",
    blurb:
      "Fresh arXiv papers across the most-followed research fields — AI, machine learning, NLP, computer vision, robotics, multi-agent systems, security, and quantum — with abstract excerpts, authors, and PDF links. Filter by field with ?fields=. Pair with /t/read to pull any paper page as clean markdown.",
    sources: "arXiv",
    price: SIGNAL_PRICE,
    filters: ["fields"],
  },
  {
    slug: "sec-filings",
    name: "SEC Filings Signal",
    endpoint: "GET /api/t/signal/sec-filings/latest",
    docsAnchor: "/docs/#signal-sec",
    blurb:
      "Live SEC EDGAR filings translated into plain language: 8-K is a material corporate event, S-1 is an IPO registration, SC 13D is an activist stake, Form 4 is an insider trade. Filter by form type with ?forms=.",
    sources: "SEC EDGAR",
    price: SIGNAL_PRICE,
    filters: ["forms"],
  },
  {
    slug: "x402",
    name: "x402 Signal",
    endpoint: "GET /api/t/feeds/x402/latest",
    docsAnchor: "/docs/#feed",
    blurb:
      "New services and price changes across the public x402 registries. The market map for the machine economy: when a new paid API appears or a competitor moves its price, your agent hears about it on the next poll.",
    sources: "x402-list.com, 402index.io",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "crypto-news",
    name: "Crypto Signal",
    endpoint: "GET /api/t/signal/crypto-news/latest",
    docsAnchor: "/docs/#signal-crypto",
    blurb:
      "Headlines from the major crypto newsrooms, tagged with the assets they mention (BTC, ETH, SOL, and more) so your agent can filter to the tokens it cares about.",
    sources: "CoinDesk, Cointelegraph, Decrypt, The Block",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "macro",
    name: "Macro Signal",
    endpoint: "GET /api/t/signal/macro/latest",
    docsAnchor: "/docs/#signal-macro",
    blurb:
      "Official press releases from the Federal Reserve and the SEC — monetary policy, enforcement actions, rulemaking — straight from the source, not filtered through a news outlet's take.",
    sources: "Federal Reserve, SEC press releases",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "regulations",
    name: "Regulations Signal",
    endpoint: "GET /api/t/signal/regulations/latest",
    docsAnchor: "/docs/#signal-regulations",
    blurb:
      "New final rules, proposed rules, and presidential documents from the Federal Register — the US government's official daily journal — tagged with the issuing agencies. Routine notices are filtered out so only the rulemaking that changes things comes through.",
    sources: "Federal Register (official API)",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "courts",
    name: "Courts Signal",
    endpoint: "GET /api/t/signal/courts/latest",
    docsAnchor: "/docs/#signal-courts",
    blurb:
      "Published opinions from the US Supreme Court and the thirteen federal courts of appeals: case name, court, filing date, and an opening excerpt. The precedent-setting layer of the federal judiciary, without the noise of every district and state court.",
    sources: "CourtListener (Free Law Project)",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "recalls",
    name: "Recalls Signal",
    endpoint: "GET /api/t/signal/recalls/latest",
    docsAnchor: "/docs/#signal-recalls",
    blurb:
      "Official US product recalls and safety alerts from the CPSC and the FDA, with hazard and product tags. An agent watching a shopping list, a pantry, or a product catalog can match recalls against it automatically.",
    sources: "CPSC, FDA",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "deals",
    name: "Deals Signal",
    endpoint: "GET /api/t/signal/deals/latest",
    docsAnchor: "/docs/#signal-deals",
    blurb:
      "Price drops and vetted deals across consumer categories — the single most tracked e-commerce topic. Community-vetted deals from Slickdeals plus editor-vetted deals from DealNews, with price, retailer, and category tags. Filter by category with ?categories=.",
    sources: "Slickdeals, DealNews",
    price: SIGNAL_PRICE,
    filters: ["categories"],
  },
  {
    slug: "launches",
    name: "Launches Signal",
    endpoint: "GET /api/t/signal/launches/latest",
    docsAnchor: "/docs/#signal-launches",
    blurb:
      "New product launches from Product Hunt's daily feed: product name, tagline, maker, and link. An agent tracking a market segment sees every new entrant the day it ships.",
    sources: "Product Hunt",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "energy",
    name: "Energy Signal",
    endpoint: "GET /api/t/signal/energy/latest",
    docsAnchor: "/docs/#signal-energy",
    blurb:
      "Oil and energy-sector intelligence from the U.S. Energy Information Administration: daily data briefs and official press releases, tagged with the commodities they cover — crude oil, natural gas, gasoline, electricity, renewables. Forecast revisions and market shifts, straight from the source.",
    sources: "EIA Today in Energy, EIA Press Room",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "campaign-finance",
    name: "Campaign Finance Signal",
    endpoint: "GET /api/t/signal/campaign-finance/latest",
    docsAnchor: "/docs/#signal-campaign-finance",
    blurb:
      "New FEC electronic filings as structured items: which committee filed, what form, covering what period, with a plain-language meaning tag per form type. Filter by form with ?forms= or track specific organizations with ?committees=. Public records, reported equally for every committee.",
    sources: "FEC electronic filing system",
    price: SIGNAL_PRICE,
    filters: ["forms", "committees"],
  },
  {
    slug: "trending",
    name: "Trending Signal",
    endpoint: "GET /api/t/signal/trending/latest",
    docsAnchor: "/docs/#signal-trending",
    blurb:
      "What US consumers are searching for right now, from Google Trends: the query, an approximate search volume, and the top news stories driving the spike. Demand surges are the leading indicator for product and market interest.",
    sources: "Google Trends (US)",
    price: SIGNAL_PRICE,
    filters: [],
  },
  {
    slug: "entertainment",
    name: "Entertainment Signal",
    endpoint: "GET /api/t/signal/entertainment/latest",
    docsAnchor: "/docs/#signal-entertainment",
    blurb:
      "Hollywood and entertainment-industry headlines from the four major trades — Deadline, Variety, The Hollywood Reporter, and TheWrap — tagged with the studios, streamers, and guilds they mention. Deals, greenlights, box office, and labor news as structured items.",
    sources: "Deadline, Variety, The Hollywood Reporter, TheWrap",
    price: SIGNAL_PRICE,
    filters: [],
    niche: true,
  },
  {
    slug: "studio-jobs",
    name: "Studio Jobs Signal",
    endpoint: "GET /api/t/signal/studio-jobs/latest",
    docsAnchor: "/docs/#signal-studio-jobs",
    blurb:
      "Weekly counts of AI and content-ops job postings across the major Hollywood studios — Netflix, Warner Bros. Discovery, Disney, Amazon MGM Studios, NBCUniversal — pulled from each studio's ATS API instead of fragile app-style careers pages. One item per studio per ISO week; track hiring momentum per query term week-over-week.",
    sources:
      "Studio ATS APIs (Eightfold, Phenom, TalentBrew, amazon.jobs, SmartRecruiters)",
    price: SIGNAL_PRICE,
    filters: [],
    niche: true,
  },
  {
    slug: "film-incentives",
    name: "Film Incentives Signal",
    endpoint: "GET /api/t/signal/film-incentives/latest",
    docsAnchor: "/docs/#signal-film-incentives",
    blurb:
      "New state film-incentive award rounds and allocations across California, New York, Georgia, New Mexico, and Texas: official California Film Commission and Texas Governor announcements plus incentive-focused press coverage per state — who just won tax credits, where, and for how much. Filter by state with ?states=.",
    sources:
      "California Film Commission, Office of the Texas Governor, per-state press coverage",
    price: SIGNAL_PRICE,
    filters: ["states"],
    niche: true,
  },
];

export const CONTACT_EMAIL = "hello@skim402.com";

export const SIGNAL_CREDITS = 2;

export const VERTICAL_SIGNAL_COUNT = SIGNAL_CATALOG.filter((s) => s.slug !== "x402").length;

/**
 * Exact bazaar `output.example` from GET /api/v2/signal/ai-news/latest
 * `payment-required` (captured 2026-08-24). Do not invent items.
 */
export const SIGNAL_BAZAAR_EXAMPLE = {
  feed: "ai-news",
  asOf: "2026-07-13T12:00:00Z",
  ttlSeconds: 600,
  crawl: {
    status: "ok",
    lastCrawlAt: "2026-07-13T12:00:00Z",
    durationMs: 1800,
  },
  count: 2,
  items: [
    {
      id: 101,
      kind: "story",
      title: "New open-weights model tops reasoning benchmarks",
      summary: "Hacker News front page: 412 points, 187 comments.",
      source: "hackernews",
      url: "https://example.com/model-announcement",
      payload: {
        hnId: 48880000,
        score: 412,
        comments: 187,
        discussionUrl: "https://news.ycombinator.com/item?id=48880000",
      },
      at: "2026-07-13T11:40:00Z",
    },
    {
      id: 100,
      kind: "vendor_news",
      title: "Introducing our next-generation API",
      summary:
        "Official OpenAI announcement: a faster, cheaper flagship model tier for production agents.",
      source: "openai",
      url: "https://openai.com/news/example",
      payload: {
        vendor: "OpenAI",
        publishedAt: "2026-07-13T10:00:00Z",
      },
      at: "2026-07-13T11:40:00Z",
    },
  ],
} as const;

export const SIGNAL_SAMPLE_EXAMPLE = {
  sample: true,
  charged: 0,
  label:
    "Bazaar example from GET /api/v2/signal/ai-news/latest payment-required header (asOf 2026-07-13). Not billed.",
  ...SIGNAL_BAZAAR_EXAMPLE,
} as const;

export function isX402Signal(slug: string): boolean {
  return slug === "x402";
}

export function signalKeyPath(slug: string): string {
  return isX402Signal(slug) ? "/api/t/feeds/x402/latest" : `/api/t/signal/${slug}/latest`;
}

export function signalWalletPath(slug: string): string {
  return isX402Signal(slug) ? "/api/v2/feeds/x402/latest" : `/api/v2/signal/${slug}/latest`;
}

/** Card-lane path without the /api prefix (Workbench request path). */
export function signalPollPath(slug: string): string {
  if (isX402Signal(slug)) return "/t/feeds/x402/latest";
  return `/t/signal/${slug}/latest`;
}

export type SignalMachineEntry = {
  slug: string;
  title: string;
  keyPath: string;
  walletPath: string;
  credits: number;
  filters: SignalFilterKey[];
  sources: string;
};

export function machineCatalog(): SignalMachineEntry[] {
  return SIGNAL_CATALOG.map((s) => ({
    slug: s.slug,
    title: s.name,
    keyPath: signalKeyPath(s.slug),
    walletPath: signalWalletPath(s.slug),
    credits: SIGNAL_CREDITS,
    filters: [...s.filters],
    sources: s.sources,
  }));
}

export function signalRequestMailto(fields: {
  vertical: string;
  sources: string;
  email: string;
  note?: string;
}): string {
  const subject = `Custom Signal request: ${fields.vertical.trim() || "new vertical"}`;
  const lines = [
    "Custom Signal request from skim402.com/signals/request",
    "",
    `Vertical: ${fields.vertical.trim() || "(not specified)"}`,
    `Example sources: ${fields.sources.trim() || "(not specified)"}`,
    `Reply-to: ${fields.email.trim() || "(not specified)"}`,
  ];
  if (fields.note?.trim()) {
    lines.push("", fields.note.trim());
  }
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
