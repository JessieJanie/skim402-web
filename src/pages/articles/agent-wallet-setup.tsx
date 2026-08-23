import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft } from "lucide-react";

export default function AgentWalletSetup() {
  useDocumentMeta({
    title: "How to Set Up Your Agent's Wallet | Skim™",
    description:
      "The one decision that matters most when paying for agent infrastructure: how many wallets. Use one wallet for your whole deterministic-infra stack, not one per service. Here's why, and how to set it up.",
    canonical: "https://skim402.com/articles/agent-wallet-setup",
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

          <figure className="mb-12 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <img
              src="/agent-wallet-hero.jpg"
              alt="How many wallets does your agent's infrastructure actually need? One wallet feeds the whole x402 stack — web reads, database, router, and model — instead of a separate wallet per service."
              className="w-full h-auto"
              width={1024}
              height={683}
            />
          </figure>

          <header className="mb-12">
            <time
              dateTime="2026-05-30"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              May 30, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              How to Set Up Your Agent's Wallet
            </h1>
            <p className="mt-2 text-2xl md:text-3xl font-bold tracking-tight leading-tight text-primary">
              One wallet, one budget, the whole stack.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              Paying for agent infrastructure with x402 is refreshingly simple:
              your agent holds a wallet, and it pays a fraction of a cent per
              call, automatically, with no signup and no API keys. But it does
              raise one question that trips people up early — not <em>how</em> to
              pay, but <em>how many wallets</em> to set up.
            </p>

            <p>
              As your agent grows, reading the web through Skim is just one line
              on the bill. It will also lean on other paid infrastructure — a
              vector store for retrieval, a model router, an observability layer,
              a sandboxed code-execution environment — each one its own service.
              So: a separate wallet dedicated to each, or a single wallet for all
              of it?
            </p>

            <p className="text-xl md:text-2xl font-medium text-foreground border-l-4 border-primary pl-6 italic">
              Use one wallet for your whole deterministic-infra stack — not one
              per service.
            </p>

            <p>
              Think of it the way a company thinks about a corporate card. You
              don't issue a separate card for each SaaS subscription. You have
              one card with a sensible limit, and you let the statement show you
              where the money went. Your agent's wallet is that card.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Why one wallet wins
            </h2>

            <p>
              <strong>It's simpler to run.</strong> One wallet means one balance
              to fund, one to watch, one to top up. A wallet per service means
              several funding flows and several ways to run dry in the middle of
              a task — exactly the kind of friction agents are supposed to
              remove.
            </p>

            <p>
              <strong>You don't lose cost visibility.</strong> This is the part
              people miss. Every service has its own receiving address, so even
              when you pay from a single wallet, the blockchain already tags
              each payment by who received it. You can see "spent $9,000 on
              Skim, $45,000 on the vector store" without segmenting wallets at
              all. The recipient does the accounting for you.
            </p>

            <p>
              <strong>Runaway protection still works.</strong> The safety valve
              isn't keeping the balance artificially tiny — it's funding a
              deliberate runway. Load roughly a month of expected spend plus a
              buffer, and that balance itself caps your worst case if something
              loops out of control. A shared tank is actually better at this
              than a wallet per service, because it bounds the whole stack at
              once rather than one line item at a time.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              When to break out a separate wallet
            </h2>

            <p>
              There's a sensible exception, and the rule is: isolate by
              <em> risk</em>, not by vendor. Give a dedicated wallet to anything
              that's expensive, experimental, or from a provider you don't fully
              trust yet — so a surprise can't drain the budget your reliable
              tools depend on. And if a single machine runs several different
              agents for different customers, give each <em>agent</em> its own
              wallet so you can attribute spend per customer. That's per-agent,
              not per-service.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Setting it up
            </h2>

            <p>
              The whole thing takes a couple of minutes:
            </p>

            <ol className="list-decimal pl-6 space-y-3">
              <li>
                Create a <strong>fresh wallet</strong> dedicated to agent
                infrastructure — not your personal one. Its key will live in a
                config file, so treat it as an operating account, not where you
                park your treasury.
              </li>
              <li>
                <strong>Fund it to match your real volume.</strong> Take your
                expected monthly call count and multiply by the per-call rate for
                each service you'll route through it. For Skim that's $0.002 per
                call — so 10 million reads a month is $20,000, and 50 million is
                $100,000. Add a buffer, and that's your top-up. Always in{" "}
                <strong>USDC on Base</strong> (not Ethereum — the most common
                first-time mistake).
              </li>
              <li>
                Point your whole stack at that one wallet — paste its private key
                into each service's config or your agent's MCP setup.
              </li>
              <li>
                Set a runway, monitor the balance, and automate top-ups as
                volume grows. Sizing the balance to a month or two of usage —
                rather than leaving it open-ended — is what makes it your circuit
                breaker.
              </li>
            </ol>

            <p>
              The nice payoff: once your agent has a funded infra wallet,
              adopting a new service like Skim costs almost nothing. You don't
              fund a new wallet — you just point one more tool at the budget you
              already keep. That's the whole promise of paid infrastructure that
              settles in fractions of a cent: it composes.
            </p>

            <p>
              For the step-by-step wallet walkthrough with screenshots, see the{" "}
              <Link href="/wallet" className="text-primary hover:underline">
                wallet setup page
              </Link>
              .
            </p>
          </div>

          <footer className="mt-16 pt-8 border-t border-border/60">
            <p className="text-base text-foreground font-medium">
              Karilyn Colegrove
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Founder, Skim &middot;{" "}
              <a
                href="https://skim402.com"
                className="text-primary hover:underline"
              >
                skim402.com
              </a>
            </p>
          </footer>

          <div className="mt-12 pt-8 border-t border-border/60 flex items-center justify-between">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All articles
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-primary hover:underline"
            >
              How Skim works for agents &rarr;
            </Link>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
