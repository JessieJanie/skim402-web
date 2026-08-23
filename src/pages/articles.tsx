import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowRight, ExternalLink } from "lucide-react";

type Article = {
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  dateDisplay: string;
  excerpt: string;
  author: string;
  image?: string;
  url?: string;
};

const BASE = import.meta.env.BASE_URL;

const ARTICLES: Article[] = [
  {
    slug: "the-elephant-in-the-dashboard",
    title: "The Elephant in Your Usage Dashboard",
    subtitle: "Announcing the Skim Audit — a free agent-spend analysis.",
    date: "2026-07-19",
    dateDisplay: "July 19, 2026",
    excerpt:
      "A startup's agent-fleet dashboard showed $803 of weekly spend — 99% of it LLM tokens, much of it deterministic work billed at model rates. Meanwhile a founder's agent did 55 minutes of real prospecting for $5.80. Send us your usage dashboard and we'll run the same executive savings estimate for you, free.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "skim-on-cloudflare-agents",
    title: "Run Skim from a Cloudflare Agent",
    subtitle: "Ten lines of Worker code, no API key, $0.002 a read.",
    date: "2026-07-12",
    dateDisplay: "July 12, 2026",
    excerpt:
      "Cloudflare made agent payments a first-class feature of its Agents SDK — and Skim is a plain x402 HTTP endpoint, so the whole integration is a wrapped fetch and a Worker secret. A step-by-step guide, including where withX402Client fits and where it isn't needed.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "skim-on-aws-agentcore",
    title: "Run Skim from AWS AgentCore",
    subtitle:
      "One tool file, one secret, clean web reads from any hosted agent.",
    date: "2026-07-12",
    dateDisplay: "July 12, 2026",
    excerpt:
      "Amazon Bedrock AgentCore hosts your agent; Skim gives it paid web reads with one Python tool and one managed secret. A step-by-step guide for Strands, plus ready-made connectors for LangChain, CrewAI, and LlamaIndex — and why you can skip AgentCore Gateway entirely.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "nothing-to-steal",
    title: "Nothing to Steal",
    subtitle:
      "The safest way to read a hostile web page is with a reader that has nothing to steal and nothing to hijack.",
    date: "2026-07-01",
    dateDisplay: "July 1, 2026",
    excerpt:
      "The wild web is turning hostile to AI agents — recent research tricked six AI browsers into handing over passwords. The fix isn't a smarter guardrail; it's least privilege. Skim is a reader that carries no credentials and takes no actions, so there's nothing for a malicious page to reach for.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "the-last-human-in-the-loop",
    title: "The Last Human in the Loop",
    subtitle: "Why an autonomous agent needs a wallet, not an API key.",
    date: "2026-06-23",
    dateDisplay: "June 23, 2026",
    excerpt:
      "An API key is the residue of a human procurement decision: someone signed up, entered a card, and holds the billing relationship. It exists because card rails can't price a fifth of a cent per call. A wallet removes that last human — the agent discovers, pays, and uses a service in one motion.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "the-missing-primitive",
    title: "The Missing Primitive",
    subtitle: "The Building Block AI Agents Were Waiting For",
    date: "2026-06-19",
    dateDisplay: "June 19, 2026",
    excerpt:
      "In any well-designed system, certain operations become primitives — reliable, foundational functions everything else builds upon. Reading the live web has lacked one: a clean reader that asks nothing of the agent — no account, no key, no permission. Skim is that primitive.",
    author: "Karilyn Colegrove",
    image: `${BASE}articles/missing-primitive-hero.png`,
    url: "https://x.com/skim402/status/2068154112529862883",
  },
  {
    slug: "the-invisible-economy",
    title: "The Invisible Economy Is Already Being Built",
    subtitle: "Why Raoul Pal's machine-speed thesis describes exactly what Skim does.",
    date: "2026-06-08",
    dateDisplay: "June 8, 2026",
    excerpt:
      "Raoul Pal has been pounding the table on an 'invisible economy' where AI agents transact and settle at machine speed on crypto rails. Skim is that thesis already working — clean reads, paid per call in USDC on Base.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "give-your-agent-web-access",
    title: "How to Give Your AI Agent Clean Web Reads",
    subtitle: "A working setup in about five minutes.",
    date: "2026-06-06",
    dateDisplay: "June 6, 2026",
    excerpt:
      "A five-minute quickstart: give your agent a wallet, point an x402 client at Skim, and turn any URL into clean markdown for $0.002 a call — no signup, no API keys.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "agent-wallet-setup",
    title: "How to Set Up Your Agent's Wallet",
    subtitle: "One wallet, one budget, the whole stack.",
    date: "2026-05-30",
    dateDisplay: "May 30, 2026",
    excerpt:
      "The one decision that trips people up early isn't how to pay — it's how many wallets. Use one wallet for your whole deterministic-infra stack, not one per service. Here's why, and how to set it up.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "your-agent-is-not-a-user",
    title: "The API Key Is Today's Floppy Disk",
    subtitle: "Up to 30x faster. Up to 30x cheaper.",
    date: "2026-05-26",
    dateDisplay: "May 26, 2026",
    excerpt:
      "API keys still work — the shelf is full — but a quiet substitution is underway. One thousand web reads cost $60 on Claude Sonnet 4. On Skim, paid from a wallet: $2.",
    author: "Karilyn Colegrove",
  },
  {
    slug: "saner-way-forward",
    title: "At AI's Growing Pain Moment",
    subtitle: "The Saner Way Forward",
    date: "2026-05-23",
    dateDisplay: "May 23, 2026",
    excerpt:
      "Something has gone wrong with how we're using AI. Or maybe nothing has gone wrong — maybe we've just arrived at a growing pain moment. A great deal of what gets billed as AI work is not AI work at all.",
    author: "Karilyn Colegrove",
    image: `${BASE}articles/saner-way-forward-hero.png`,
  },
];

export default function ArticlesIndex() {
  useDocumentMeta({
    title: "Articles | Skim™",
    description:
      "Essays and writing from the team behind Skim on AI infrastructure, agent payments, and the right shape for the stack.",
    canonical: "https://skim402.com/articles",
  });

  return (
    <PublicLayout>
      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Articles
          </h1>
          <p className="text-lg text-muted-foreground">
            Essays on AI infrastructure, agent payments, and the right shape
            for the stack.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <ul className="divide-y divide-border/60">
            {ARTICLES.map((a) => {
              const inner = (
                <>
                  {a.image && (
                    <img
                      src={a.image}
                      alt=""
                      className="w-full h-auto rounded-lg mb-5 shadow-sm"
                    />
                  )}
                  <time
                    dateTime={a.date}
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {a.dateDisplay}
                  </time>
                  <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {a.title}
                  </h2>
                  {a.subtitle && (
                    <p className="mt-1 text-lg text-muted-foreground italic">
                      {a.subtitle}
                    </p>
                  )}
                  <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                    {a.excerpt}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {a.url ? "Read on X" : "Read"}
                    {a.url && <span className="sr-only"> (opens in new tab)</span>}
                    {a.url ? (
                      <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    By {a.author}
                  </p>
                </>
              );
              return (
                <li key={a.slug} className="py-8 first:pt-0">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      href={`/articles/${a.slug}`}
                      className="group block"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
