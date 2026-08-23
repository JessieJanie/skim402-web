import { PublicLayout } from "@/components/layout/PublicLayout";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowRight } from "lucide-react";

type Signal = {
  name: string;
  endpoint: string;
  docsAnchor: string;
  blurb: string;
  sources: string;
  price: string;
};

const SIGNALS: Signal[] = [
  {
    name: "x402 Signal",
    endpoint: "GET /v2/feeds/x402/latest",
    docsAnchor: "/docs#feed",
    blurb:
      "New services and price changes across the public x402 registries. The market map for the machine economy: when a new paid API appears or a competitor moves its price, your agent hears about it on the next poll.",
    sources: "x402-list.com, 402index.io",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "AI Tech Signal",
    endpoint: "GET /v2/signal/ai-news/latest",
    docsAnchor: "/docs#signal-ai-news",
    blurb:
      "High-signal AI and tech news: score-gated Hacker News front-page stories, fresh arXiv AI papers, and official vendor announcements. Title, excerpt, source, and link — the signal, not the noise.",
    sources: "Hacker News, arXiv, vendor announcements",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "SEC Filings Signal",
    endpoint: "GET /v2/signal/sec-filings/latest",
    docsAnchor: "/docs#signal-sec",
    blurb:
      "Live SEC EDGAR filings translated into plain language: 8-K is a material corporate event, S-1 is an IPO registration, SC 13D is an activist stake, Form 4 is an insider trade. Filter by form type with ?forms=.",
    sources: "SEC EDGAR",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Crypto Signal",
    endpoint: "GET /v2/signal/crypto-news/latest",
    docsAnchor: "/docs#signal-crypto",
    blurb:
      "Headlines from the major crypto newsrooms, tagged with the assets they mention (BTC, ETH, SOL, and more) so your agent can filter to the tokens it cares about.",
    sources: "CoinDesk, Cointelegraph, Decrypt, The Block",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Macro Signal",
    endpoint: "GET /v2/signal/macro/latest",
    docsAnchor: "/docs#signal-macro",
    blurb:
      "Official press releases from the Federal Reserve and the SEC — monetary policy, enforcement actions, rulemaking — straight from the source, not filtered through a news outlet's take.",
    sources: "Federal Reserve, SEC press releases",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Security Signal",
    endpoint: "GET /v2/signal/security/latest",
    docsAnchor: "/docs#signal-security",
    blurb:
      "Live CISA cybersecurity advisories with CVE identifiers extracted into structured entities, so an agent can match new vulnerabilities against its own dependency list automatically.",
    sources: "CISA advisories",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Regulations Signal",
    endpoint: "GET /v2/signal/regulations/latest",
    docsAnchor: "/docs#signal-regulations",
    blurb:
      "New final rules, proposed rules, and presidential documents from the Federal Register — the US government's official daily journal — tagged with the issuing agencies. Routine notices are filtered out so only the rulemaking that changes things comes through.",
    sources: "Federal Register (official API)",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Courts Signal",
    endpoint: "GET /v2/signal/courts/latest",
    docsAnchor: "/docs#signal-courts",
    blurb:
      "Published opinions from the US Supreme Court and the thirteen federal courts of appeals: case name, court, filing date, and an opening excerpt. The precedent-setting layer of the federal judiciary, without the noise of every district and state court.",
    sources: "CourtListener (Free Law Project)",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Recalls Signal",
    endpoint: "GET /v2/signal/recalls/latest",
    docsAnchor: "/docs#signal-recalls",
    blurb:
      "Official US product recalls and safety alerts from the CPSC and the FDA, with hazard and product tags. An agent watching a shopping list, a pantry, or a product catalog can match recalls against it automatically.",
    sources: "CPSC, FDA",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Deals Signal",
    endpoint: "GET /v2/signal/deals/latest",
    docsAnchor: "/docs#signal-deals",
    blurb:
      "Price drops and vetted deals across consumer categories — the single most tracked e-commerce topic. Community-vetted deals from Slickdeals plus editor-vetted deals from DealNews, with price, retailer, and category tags. Filter by category with ?categories=.",
    sources: "Slickdeals, DealNews",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Launches Signal",
    endpoint: "GET /v2/signal/launches/latest",
    docsAnchor: "/docs#signal-launches",
    blurb:
      "New product launches from Product Hunt's daily feed: product name, tagline, maker, and link. An agent tracking a market segment sees every new entrant the day it ships.",
    sources: "Product Hunt",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Research Signal",
    endpoint: "GET /v2/signal/research/latest",
    docsAnchor: "/docs#signal-research",
    blurb:
      "Fresh arXiv papers across the most-followed research fields — AI, machine learning, NLP, computer vision, robotics, multi-agent systems, security, and quantum — with abstract excerpts, authors, and PDF links. Filter by field with ?fields=. Pair with /v2/read to pull any paper page as clean markdown.",
    sources: "arXiv",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Energy Signal",
    endpoint: "GET /v2/signal/energy/latest",
    docsAnchor: "/docs#signal-energy",
    blurb:
      "Oil and energy-sector intelligence from the U.S. Energy Information Administration: daily data briefs and official press releases, tagged with the commodities they cover — crude oil, natural gas, gasoline, electricity, renewables. Forecast revisions and market shifts, straight from the source.",
    sources: "EIA Today in Energy, EIA Press Room",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Entertainment Signal",
    endpoint: "GET /v2/signal/entertainment/latest",
    docsAnchor: "/docs#signal-entertainment",
    blurb:
      "Hollywood and entertainment-industry headlines from the four major trades — Deadline, Variety, The Hollywood Reporter, and TheWrap — tagged with the studios, streamers, and guilds they mention. Deals, greenlights, box office, and labor news as structured items.",
    sources: "Deadline, Variety, The Hollywood Reporter, TheWrap",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Studio Jobs Signal",
    endpoint: "GET /v2/signal/studio-jobs/latest",
    docsAnchor: "/docs#signal-studio-jobs",
    blurb:
      "Weekly counts of AI and content-ops job postings across the major Hollywood studios — Netflix, Warner Bros. Discovery, Disney, Amazon MGM Studios, NBCUniversal — pulled from each studio's ATS API instead of fragile app-style careers pages. One item per studio per ISO week; track hiring momentum per query term week-over-week.",
    sources:
      "Studio ATS APIs (Eightfold, Phenom, TalentBrew, amazon.jobs, SmartRecruiters)",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Campaign Finance Signal",
    endpoint: "GET /v2/signal/campaign-finance/latest",
    docsAnchor: "/docs#signal-campaign-finance",
    blurb:
      "New FEC electronic filings as structured items: which committee filed, what form, covering what period, with a plain-language meaning tag per form type. Filter by form with ?forms= or track specific organizations with ?committees=. Public records, reported equally for every committee.",
    sources: "FEC electronic filing system",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Film Incentives Signal",
    endpoint: "GET /v2/signal/film-incentives/latest",
    docsAnchor: "/docs#signal-film-incentives",
    blurb:
      "New state film-incentive award rounds and allocations across California, New York, Georgia, New Mexico, and Texas: official California Film Commission and Texas Governor announcements plus incentive-focused press coverage per state — who just won tax credits, where, and for how much. Filter by state with ?states=.",
    sources:
      "California Film Commission, Office of the Texas Governor, per-state press coverage",
    price: "2 credits · $0.005 per poll",
  },
  {
    name: "Trending Signal",
    endpoint: "GET /v2/signal/trending/latest",
    docsAnchor: "/docs#signal-trending",
    blurb:
      "What US consumers are searching for right now, from Google Trends: the query, an approximate search volume, and the top news stories driving the spike. Demand surges are the leading indicator for product and market interest.",
    sources: "Google Trends (US)",
    price: "2 credits · $0.005 per poll",
  },
];

export default function Signals() {
  useDocumentMeta({
    title: "Signals — intelligence feeds for AI agents | Skim",
    description:
      "Skim Signals: structured, machine-readable intelligence feeds for AI agents — AI/tech news, SEC filings, crypto headlines, macro policy, security advisories, regulations, court opinions, recalls, deals, launches, trending searches, research papers, energy, entertainment trades, and more. Poll with your plan's API key (2 credits per poll) or pay per poll by wallet.",
    canonical: "https://skim402.com/signals",
  });

  return (
    <PublicLayout>
      <div className="pt-20 pb-32">
        <div className="container mx-auto px-4 text-center max-w-3xl mb-14">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Skim Signals
          </h1>
          <p className="text-xl text-muted-foreground">
            Vertical intelligence feeds for AI agents. Each Signal watches one
            slice of the world — a market, a regulator, a threat landscape —
            and turns it into structured items an agent can act on: title,
            summary, source, timestamp, link, and extracted entities where
            they matter.
          </p>
          <p className="mt-6 text-lg font-medium text-foreground">
            Eighteen Signals are live — and custom Signals are built to
            order. Requests get an immediate response, and Skim ships new
            requested Signals in days, not quarters.{" "}
            <Link href="/contact" className="text-primary hover:underline">
              Request yours →
            </Link>
          </p>
        </div>

        <div className="container mx-auto px-4 max-w-4xl mb-16 space-y-4">
          {/* Card pay — primary */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Pay by card · monthly plan
            </p>
            <p>
              Every Signal works the same way: one{" "}
              <code className="font-mono text-xs text-foreground">GET</code>,
              one JSON feed, newest-first.{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                Pick a plan
              </Link>
              , and poll with the API key you received at checkout — 2 credits
              per poll, on the same key your agent already uses for reads. Feeds
              refresh on a 10-minute cycle (the x402 Signal on 15) and always
              serve the latest good copy, so a poll never errors because an
              upstream source hiccuped — and a poll that can't be served is
              never charged.
            </p>
            <p className="mt-3">
              Each item links to its source. When your agent needs the full page
              behind an item, pass that link to{" "}
              <code className="font-mono text-xs text-foreground">/read</code>.
            </p>
          </div>

          {/* Transition + wallet pay */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Pay by wallet · per-poll x402
            </p>
            <p>
              Running an autonomous agent that shouldn't need a billing
              account? Every Signal is also available pay-per-poll over x402 at
              $0.005 in USDC — no signup, no key, no monthly commitment. Your
              agent pays exactly for what it polls and nothing else.{" "}
              <Link href="/wallet" className="text-primary hover:underline">
                Wallet setup →
              </Link>
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border-2 border-primary rounded-2xl p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h2 className="text-lg font-bold">Skim Watch</h2>
                <span className="text-xs font-medium text-primary whitespace-nowrap">
                  $0.005 per check
                </span>
              </div>
              <code className="font-mono text-xs text-muted-foreground mb-3 block">
                POST /t/watch · GET /t/watch/diff
              </code>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3 flex-1">
                Your own private Signal. Register the exact pages your agent
                cares about — pricing pages, docs, a competitor's changelog —
                then ask "what changed?" whenever you like. You get clean
                line-level diffs of the actual content, not raw HTML noise.
                Use the same API key as Signals and reads: 4 credits to
                register up to 20 URLs, then 2 credits per check. Wallet
                pay-per-poll is available too.
              </p>
              <p className="text-xs text-muted-foreground/80 mb-4">
                Sources: any pages you choose
              </p>
              <a
                href="/docs#watch"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Docs and agent code
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="bg-card border-2 border-primary rounded-2xl p-6 flex flex-col">
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h2 className="text-lg font-bold">Custom Signal</h2>
                <span className="text-xs font-medium text-primary whitespace-nowrap">
                  Built to order
                </span>
              </div>
              <code className="font-mono text-xs text-muted-foreground mb-3 block">
                Your vertical here
              </code>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3 flex-1">
                Need a vertical we don't cover yet? Tell us what your agent
                needs to watch and we build it. Requests get an immediate
                response, and new Signals ship in days, not quarters — no
                other reader offers anything like this.
              </p>
              <p className="text-xs text-muted-foreground/80 mb-4">
                Sources: whatever your agent needs
              </p>
              <Link
                href="/contact"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Request a Signal
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {SIGNALS.map((s) => (
              <div
                key={s.name}
                className="bg-card border border-border rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-baseline justify-between mb-2 gap-3">
                  <h2 className="text-lg font-bold">{s.name}</h2>
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    {s.price}
                  </span>
                </div>
                <code className="font-mono text-xs text-muted-foreground mb-3 block">
                  {s.endpoint}
                </code>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3 flex-1">
                  {s.blurb}
                </p>
                <p className="text-xs text-muted-foreground/80 mb-4">
                  Sources: {s.sources}
                </p>
                <a
                  href={s.docsAnchor}
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Docs and agent code
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">
              Polling a Signal from your agent
            </h2>
            <p className="text-muted-foreground mb-4">
              On a plan, it's one line with your API key — any language, any
              HTTP client:
            </p>
            <pre className="bg-muted rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap text-left mb-6">
{`curl "https://skim402.com/api/t/signal/ai-news/latest?limit=20" \\
  -H "Authorization: Bearer sk402_YOUR_KEY"`}
            </pre>
            <p className="text-muted-foreground mb-6">
              Swap <code className="font-mono text-xs">ai-news</code> for any
              Signal in the catalog. No plan yet?{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                Start with the Free Plan
              </Link>{" "}
              — 1,000 credits a month covers a poll every ~90 minutes, around
              the clock. Paying by wallet instead? The{" "}
              <a href="/docs#payment" className="text-primary hover:underline">
                payment section of the docs
              </a>{" "}
              has copy-paste x402 clients for JavaScript and Python.
            </p>
            <p className="text-muted-foreground">
              Don't see your vertical in the catalog?{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Request a custom Signal →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
