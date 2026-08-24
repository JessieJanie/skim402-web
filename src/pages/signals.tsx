import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowRight } from "lucide-react";
import {
  SIGNAL_CATALOG,
  SIGNAL_SAMPLE_EXAMPLE,
  signalKeyPath,
  signalWalletPath,
  type SignalEntry,
} from "@/lib/signals";

type SampleItem = {
  title?: string;
  source?: string;
  at?: string;
  url?: string;
  summary?: string;
  kind?: string;
};

type SamplePayload = {
  sample?: boolean;
  charged?: number;
  label?: string;
  feed?: string;
  asOf?: string;
  ttlSeconds?: number;
  crawl?: { status?: string; lastCrawlAt?: string; durationMs?: number };
  count?: number;
  items?: SampleItem[];
};

const PRIMARY = SIGNAL_CATALOG.filter((s) => !s.niche);
const NICHE = SIGNAL_CATALOG.filter((s) => s.niche);

function formatWhen(value?: string) {
  if (!value) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function SignalCard({ s, muted = false }: { s: SignalEntry; muted?: boolean }) {
  return (
    <div
      className={`bg-card rounded-2xl p-6 flex flex-col ${
        muted ? "border border-dashed border-border/70 opacity-90" : "border border-border"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <h2 className="text-lg font-bold">{s.name}</h2>
        <span className="text-xs font-medium text-primary whitespace-nowrap">{s.price}</span>
      </div>
      <div className="font-mono text-xs text-muted-foreground mb-3 space-y-2">
        <p>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
            API key · 2 credits
          </span>
          <code>GET {signalKeyPath(s.slug)}</code>
        </p>
        <p>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Wallet · USDC
          </span>
          <code>GET {signalWalletPath(s.slug)}</code>
        </p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3 flex-1">{s.blurb}</p>
      <p className="text-xs text-muted-foreground/80 mb-4">Sources: {s.sources}</p>
      <a
        href={s.docsAnchor}
        className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        Docs and agent code
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function Signals() {
  useDocumentMeta({
    title: "Signals — intelligence feeds for AI agents | Skim",
    description:
      "Skim Signals: 17 vertical /signal/{slug} feeds plus the x402 ecosystem feed. Poll with a free sk402_ API key (2 credits). Wallet pay is optional.",
    canonical: "https://skim402.com/signals",
  });

  const [sample, setSample] = useState<SamplePayload>(SIGNAL_SAMPLE_EXAMPLE);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    void fetch(`${base}/api/t/signal/sample`)
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as SamplePayload | null;
        if (cancelled || !body || !Array.isArray(body.items) || body.items.length === 0) return;
        const firstTitle = body.items[0]?.title;
        if (firstTitle !== SIGNAL_SAMPLE_EXAMPLE.items[0].title) return;
        setSample(body);
      })
      .catch(() => {
        // Keep the bazaar example when the sample route is not mounted yet.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const item = sample.items?.[0] ?? SIGNAL_SAMPLE_EXAMPLE.items[0];
  const sampleJson = {
    feed: sample.feed ?? SIGNAL_SAMPLE_EXAMPLE.feed,
    asOf: sample.asOf ?? SIGNAL_SAMPLE_EXAMPLE.asOf,
    ttlSeconds: sample.ttlSeconds ?? SIGNAL_SAMPLE_EXAMPLE.ttlSeconds,
    crawl: sample.crawl ?? SIGNAL_SAMPLE_EXAMPLE.crawl,
    count: sample.count ?? SIGNAL_SAMPLE_EXAMPLE.count,
    items: sample.items ?? SIGNAL_SAMPLE_EXAMPLE.items,
  };

  return (
    <PublicLayout>
      <div className="pt-20 pb-32">
        <div className="container mx-auto px-4 text-center max-w-3xl mb-14">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Skim Signals</h1>
          <p className="text-xl text-muted-foreground">
            Vertical intelligence feeds for AI agents. Each Signal watches one
            slice of the world — a market, a regulator, a threat landscape —
            and turns it into structured items an agent can act on: title,
            summary, source, timestamp, link, and extracted entities where
            they matter.
          </p>
          <p className="mt-6 text-lg font-medium text-foreground">
            Seventeen vertical Signals are live, plus the x402 ecosystem feed.
            Custom Signals are built to order — we
            aim to reply within two business days.{" "}
            <Link href="/signals/request" className="text-primary hover:underline">
              Request yours →
            </Link>
          </p>
        </div>

        <div className="container mx-auto px-4 max-w-4xl mb-16 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              API key · sk402_ credits
            </p>
            <p>
              Start with a free{" "}
              <code className="font-mono text-xs text-foreground">sk402_</code>{" "}
              key on the{" "}
              <Link href="/" className="text-primary hover:underline">
                homepage
              </Link>{" "}
              (1,000 credits, no wallet) or a{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                monthly plan
              </Link>
              . Every Signal is one{" "}
              <code className="font-mono text-xs text-foreground">GET</code>{" "}
              with{" "}
              <code className="font-mono text-xs text-foreground">
                Authorization: Bearer sk402_…
              </code>
              — 2 credits per poll, on the same key your agent already uses for
              reads. Feeds refresh on a 10-minute cycle (the x402 Signal on 15)
              and always serve the latest good copy. A poll that can&apos;t be
              served is never charged.
            </p>
            <p className="mt-3">
              Try a poll in the{" "}
              <Link href="/playground?mode=signal" className="text-primary hover:underline">
                Workbench
              </Link>{" "}
              — same trial key as a single read. When your agent needs the full
              page behind an item, pass that link to{" "}
              <code className="font-mono text-xs text-foreground">/t/read</code>.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Wallet pay · optional
            </p>
            <p>
              Running an autonomous agent that shouldn&apos;t need a billing
              account? Every Signal is also available pay-per-poll over x402 at
              $0.005 in USDC — no signup, no key, no monthly commitment.{" "}
              <Link href="/wallet" className="text-primary hover:underline">
                Wallet setup →
              </Link>
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-4xl mb-16">
          <div
            className="bg-card border-2 border-primary rounded-2xl p-6 md:p-8"
            data-testid="signal-sample"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Bazaar example · not billed
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {sample.feed ?? "ai-news"} · {formatWhen(item.at || sample.asOf)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {sample.label ?? SIGNAL_SAMPLE_EXAMPLE.label} Both items from that
              header are shown in the JSON below — no invented rows.
            </p>
            <h2 className="text-xl font-bold mb-2">{item.title}</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {item.summary}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Source: {item.source}
              {item.url ? (
                <>
                  {" · "}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    className="text-primary hover:underline break-all"
                  >
                    {item.url}
                  </a>
                </>
              ) : null}
            </p>
            <pre className="bg-muted rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap text-left">
              {JSON.stringify(sampleJson, null, 2)}
            </pre>
            <p className="mt-4 text-xs text-muted-foreground">
              Unauthenticated sample:{" "}
              <code className="font-mono">GET /api/t/signal/sample</code>
              {" "}· machine catalog:{" "}
              <code className="font-mono">GET /api/signals</code>
              {" "}or{" "}
              <code className="font-mono">/signals.json</code>
              {" "}· charged 0. Poll the live feed with your key in the{" "}
              <Link href="/playground?mode=signal" className="text-primary hover:underline">
                Workbench
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRIMARY.map((s) => (
              <SignalCard key={s.slug} s={s} />
            ))}
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
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
                Need a vertical we don&apos;t cover yet? Tell us what your agent
                needs to watch and we build it. New Signals ship in days, not
                quarters. We aim to reply within two business days — same as{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  /contact
                </Link>
                .
              </p>
              <p className="text-xs text-muted-foreground/80 mb-4">
                Sources: whatever your agent needs
              </p>
              <Link
                href="/signals/request"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Request a Signal
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-14 rounded-2xl border border-border bg-muted/30 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Watching your own URLs
            </p>
            <h2 className="text-lg font-bold mb-2">Skim Watch is not a catalog Signal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Watch is a Workbench mode: you register the exact pages your agent
              cares about, then ask what changed. It is not one of the seventeen
              vertical Signals. Same{" "}
              <code className="font-mono text-xs text-foreground">sk402_</code>{" "}
              key as reads and Signals.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              <Link href="/playground?mode=watch" className="text-primary hover:underline inline-flex items-center gap-1">
                Try Watch in the Workbench
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="/docs/#watch" className="text-primary hover:underline inline-flex items-center gap-1">
                Watch docs
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Industry and media feeds
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
              Same poll, same price — listed separately so AI, security,
              research, and SEC stay first.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {NICHE.map((s) => (
                <SignalCard key={s.slug} s={s} muted />
              ))}
            </div>
          </div>

          <div className="mt-16 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Polling a Signal from your agent</h2>
            <p className="text-muted-foreground mb-4">
              On a plan, it&apos;s one line with your API key — any language, any
              HTTP client:
            </p>
            <pre className="bg-muted rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap text-left mb-6">
{`curl "https://skim402.com/api/t/signal/ai-news/latest?limit=20" \\
  -H "Authorization: Bearer sk402_YOUR_KEY"`}
            </pre>
            <p className="text-muted-foreground mb-6">
              Swap <code className="font-mono text-xs">ai-news</code> for any
              Signal in the catalog. The x402 ecosystem feed is{" "}
              <code className="font-mono text-xs">GET /api/t/feeds/x402/latest</code>
              . No plan yet?{" "}
              <Link href="/" className="text-primary hover:underline">
                Create a free key
              </Link>{" "}
              or{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                start the Free Plan
              </Link>
              . Wallet pay is optional — see the{" "}
              <a href="/docs/#payment" className="text-primary hover:underline">
                payment section of the docs
              </a>
              .
            </p>
            <p className="text-muted-foreground">
              Don&apos;t see your vertical in the catalog?{" "}
              <Link href="/signals/request" className="text-primary hover:underline">
                Request a custom Signal →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
