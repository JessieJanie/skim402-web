import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function TheElephantInTheDashboard() {
  useDocumentMeta({
    title: "The Elephant in Your Usage Dashboard | Skim™",
    description:
      "A startup's agent-fleet dashboard showed $803 of weekly spend — 99% of it LLM tokens. Most of that is deterministic work billed at model rates. Announcing the Skim Audit: send us your usage dashboard, get a free executive savings estimate.",
    canonical: "https://skim402.com/articles/the-elephant-in-the-dashboard",
  });

  return (
    <PublicLayout>
      <article className="pt-20 pb-24 md:pt-28">
        <div className="container mx-auto px-4 max-w-2xl">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>

          <header className="mb-12">
            <time
              dateTime="2026-07-19"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              July 19, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              The Elephant in Your Usage Dashboard
            </h1>
            <p className="mt-3 text-lg font-medium text-primary tracking-tight">
              Announcing the Skim Audit — a free agent-spend analysis
            </p>
            <p className="mt-4 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              99% of your agent bill is LLM tokens. Roughly half of those tokens
              are doing work that never needed a model.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              Last week, an engineer at a well-funded agent-platform startup
              shared a screenshot of his company's usage dashboard in a
              conversation with us. It was a good dashboard — clean, honest,
              itemized per agent. It showed a small fleet of five or six agents
              spending $803 in a single week. And it showed something else, in a
              quiet corner of the cost breakdown: of every dollar spent, about
              99 cents went to LLM tokens. Compute was under a penny. Storage
              was zero.
            </p>

            <p>
              The dashboard was offered as evidence of cost control. Look — we
              have budgeting built in. We can see everything.
            </p>

            <p>
              But a dashboard measures spend. It does not shrink it. Knowing
              that one agent burned $661 on 7.3 million tokens is not the same
              as spending less. A speedometer is not a brake.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              The elephant
            </h2>

            <p>
              Here is what nearly everyone in the room is not looking at: a
              large share of those tokens are not doing intelligence work. They
              are doing clerical work at intelligence prices.
            </p>

            <p>
              When an agent reads the web the default way, it feeds raw HTML
              into the model — navigation bars, cookie banners, script tags,
              tracking pixels, footers, all of it — and pays token rates for
              every character. Our measured median across real pages: raw HTML
              is about four times larger than the clean article inside it. That
              means roughly three-quarters of every web-reading token an agent
              buys is spent on content nobody, human or machine, wanted.
            </p>

            <p>
              Fetching a page is deterministic. Stripping the boilerplate is
              deterministic. Parsing a table is deterministic. None of it needs
              a model. All of it is being billed as if it does. That is the
              elephant — it is massive, it is standing in the middle of the
              usage dashboard, and the industry's attention is pointed at the
              other side of the room, debating which LLM to switch to.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              What the numbers look like
            </h2>

            <p>
              We ran an executive-level estimate on that startup's dashboard
              (anonymized here; the numbers are theirs, the assumptions are ours
              and stated plainly).
            </p>

            <p>
              <strong>Clean reading alone:</strong> for assistant- and
              research-style agents, a conservative 25-35% of input tokens are
              raw web content. Cleaning removes about three-quarters of those
              tokens. That is roughly a 20% cut to the total LLM bill — about
              $690 a month on their current fleet — and the reads that produce
              it cost $0.002 each. The savings-to-cost ratio is around 100 to
              one.
            </p>

            <p>
              <strong>A full deterministic layer:</strong> clean reading plus
              four non-competing pieces of boring infrastructure — prompt
              caching, a search API, a retrieval store, and a code sandbox for
              math and data work. Each attacks a different slice of token waste.
              Combined, an honest range is 45-60% of the LLM bill. On their
              fleet: roughly $1,700 a month. And that dashboard showed five
              agents. The company talks publicly about thousand-agent teams. At
              that scale this is not a line item; it is a seed round.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              A 55-minute proof
            </h2>

            <p>
              The counter-example, from our own world: a founder we work with
              runs an autonomous agent that does real prospecting — reading
              company pages, regulatory filings, and news, hundreds of pages per
              session. A common rule of thumb for an agent doing heavy web work
              the default way is on the order of a dollar a minute in tokens.
              His agent recently worked for 55 minutes straight.
            </p>

            <p>The session cost $5.80.</p>

            <p>
              Not because the model was cheaper, but because the model almost
              never saw the raw web. The agent paid a fifth of a cent per page
              to read clean markdown, and the expensive part of the stack — the
              intelligence — was reserved for the part of the job that actually
              required intelligence. That is the whole thesis in one receipt.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              The Skim Audit: free, no signup, no wallet
            </h2>

            <p>
              The estimate we ran on that startup's dashboard took us an
              afternoon and two screenshots. It is worth real money to the
              company in the screenshots. So we are making it a standing offer.
            </p>

            <p>
              Send us your agent usage dashboard — a screenshot is enough — and
              we will send back a free, executive-level savings estimate: where
              your token spend is doing deterministic work at model rates, what
              routing it to flat-priced infrastructure would save, and which
              changes pay back first. Stated assumptions, honest ranges, no
              black box. If the answer is "your spend is already lean," we will
              say that too.
            </p>

            <p>
              No signup. No wallet. No sales call unless you ask for one. Your
              numbers stay private — we never publish or reference them without
              your permission.
            </p>

            <p>
              The details are on the{" "}
              <Link href="/audit" className="text-primary hover:underline">
                Skim Audit page
              </Link>
              . The short version: email{" "}
              <a
                href="mailto:hello@skim402.com?subject=Skim%20Audit"
                className="text-primary hover:underline"
              >
                hello@skim402.com
              </a>{" "}
              with the subject "Skim Audit" and attach your dashboard.
            </p>

            <p>
              The elephant does not care whether you look at it. It eats the
              same either way. But it is remarkable how much smaller it gets
              once someone finally points at it.
            </p>
          </div>

          <div className="mt-16 pt-8 border-t border-border/60">
            <p className="text-sm text-muted-foreground mb-4">
              By Karilyn Colegrove
            </p>
            <Link
              href="/audit"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Get your free Skim Audit
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
