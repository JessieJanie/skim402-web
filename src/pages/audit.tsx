import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowRight, Mail } from "lucide-react";

const STEPS = [
  {
    n: "1",
    title: "Send your dashboard",
    body: 'Email a screenshot of your agent usage or spend dashboard to hello@skim402.com with the subject "Skim Audit". Any platform, any format — if it shows token or dollar spend, it works. A usage export (CSV, JSON) is even better, but a screenshot is enough.',
  },
  {
    n: "2",
    title: "We run the numbers",
    body: "We estimate how much of your token spend is deterministic work billed at model rates — raw web reading, repeated context, parsing, data crunching — and what routing each slice to flat-priced infrastructure would save. Every assumption is stated. Every range is honest.",
  },
  {
    n: "3",
    title: "You get the analysis",
    body: "Within two business days you get a short, executive-level write-up: the savings estimate for clean reading alone, the estimate for a full deterministic layer, and which change pays back first. If your spend is already lean, we say that instead.",
  },
];

const FINDINGS = [
  {
    stat: "~99%",
    label: "of a typical agent fleet's spend is LLM tokens",
    detail:
      "From a real (anonymized) startup dashboard we analyzed: $803 of weekly spend, of which compute was under a penny and storage was zero. The entire cost story is tokens.",
  },
  {
    stat: "~4x",
    label: "raw HTML is about four times larger than the clean content inside it",
    detail:
      "Our measured median across real pages. An agent reading the web raw pays token rates for navigation bars, cookie banners, and scripts — roughly three-quarters of every web-reading token is boilerplate.",
  },
  {
    stat: "~20%",
    label: "typical cut to the total LLM bill from clean reading alone",
    detail:
      "Assuming a conservative 25-35% of input tokens are raw web content for assistant- and research-style agents. The reads that produce the saving cost $0.002 each — a savings-to-cost ratio around 100 to one.",
  },
  {
    stat: "45-60%",
    label: "honest combined range for a five-layer deterministic stack",
    detail:
      "Clean reading plus prompt caching, a search API, a retrieval store, and a code sandbox. Non-competing layers, each attacking a different slice of token waste. The savings compound rather than simply add.",
  },
];

export default function Audit() {
  useDocumentMeta({
    title: "The Skim Audit — free agent-spend analysis | Skim™",
    description:
      "Send a screenshot of your agent usage dashboard, get back a free executive-level savings estimate: how much of your LLM spend is deterministic work billed at model rates, and what routing it to flat-priced infrastructure would save. No signup, no wallet, no sales call.",
    canonical: "https://skim402.com/audit",
  });

  return (
    <PublicLayout>
      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-primary mb-4">
            Free. No signup. No wallet.
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            The Skim Audit
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Send us your agent usage dashboard. We send back an executive-level
            estimate of how much of your LLM bill is deterministic work billed
            at model rates — and what fixing that is worth.
          </p>
          <div className="mt-8">
            <a
              href="mailto:hello@skim402.com?subject=Skim%20Audit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email your dashboard to hello@skim402.com
            </a>
            <p className="mt-3 text-sm text-muted-foreground">
              Subject line "Skim Audit". A screenshot is enough.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border/60">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight mb-8">
            How it works
          </h2>
          <ol className="space-y-8">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 text-sm font-semibold text-primary">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-12 border-t border-border/60">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            What we usually find
          </h2>
          <p className="text-muted-foreground mb-8">
            The numbers below come from real analyses. Yours will differ — that
            is the point of running the audit on your data.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {FINDINGS.map((f) => (
              <div
                key={f.stat}
                className="rounded-lg border border-border/60 p-6"
              >
                <p className="text-3xl font-bold text-primary">{f.stat}</p>
                <p className="mt-1.5 font-medium">{f.label}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {f.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border/60">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">
            The fine print, in plain language
          </h2>
          <ul className="space-y-4 text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">It is genuinely free.</strong>{" "}
              No signup, no wallet, no sales call unless you ask for one. The
              analysis is the product demonstration — if the routing advice is
              good, you already know what working with us is like.
            </li>
            <li>
              <strong className="text-foreground">
                Your numbers stay private.
              </strong>{" "}
              We never publish, share, or reference your data without your
              written permission. Anonymized aggregate patterns (like the ones
              above) are the most that ever appears publicly.
            </li>
            <li>
              <strong className="text-foreground">
                It is an estimate, not an invoice.
              </strong>{" "}
              We state every assumption and give ranges, not false precision. A
              screenshot supports an executive estimate; a usage export
              supports a sharper one.
            </li>
            <li>
              <strong className="text-foreground">
                We recommend things we do not sell.
              </strong>{" "}
              Skim is a clean reader. If your biggest saving is prompt caching
              or a retrieval store, the audit says so — those are not our
              products.
            </li>
          </ul>
        </div>
      </section>

      <section className="py-16 border-t border-border/60">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            Point at the elephant
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Read the story behind the audit — a real startup dashboard, a
            55-minute agent session that cost $5.80, and the token spend nobody
            is looking at.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:hello@skim402.com?subject=Skim%20Audit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Get your free audit
            </a>
            <Link
              href="/articles/the-elephant-in-the-dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Read the announcement
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
