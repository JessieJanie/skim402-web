import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type QA = {
  q: string;
  a: React.ReactNode;
};

type Section = {
  id: string;
  title: string;
  items: QA[];
};

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

const SECTIONS: Section[] = [
  {
    id: "product",
    title: "Product",
    items: [
      {
        q: "What is Skim?",
        a: (
          <p>
            Skim is a reader API for AI agents. Your agent sends a URL and gets
            back clean, agent-ready markdown plus structured metadata —
            typically in about a second. Start with a free{" "}
            <InlineCode>sk402_</InlineCode> API key (1,000 credits, no wallet).
            Monthly plans are optional; so is paying per call in USDC.
          </p>
        ),
      },
      {
        q: "What do I get back from a call?",
        a: (
          <p>
            Clean markdown of the page's main content, a plain-text version,
            and structured metadata (title, author, published date, canonical
            URL, word count). Need typed JSON instead of prose? Use{" "}
            <InlineCode>/v1/extract</InlineCode> with your own schema.
          </p>
        ),
      },
      {
        q: "How is Skim different from other reader APIs?",
        a: (
          <p>
            Skim is deliberately narrow — one URL in, clean markdown out — and
            priced for agents, not LLM-token rates. You can start with a free
            API key (no wallet, no crypto). Teams that want invoices use a
            card plan. Agents that already have a Base wallet can pay per
            call instead. It&apos;s not a search engine and not a site-wide
            crawler.
          </p>
        ),
      },
      {
        q: "How fast is it?",
        a: (
          <p>
            Median read is well under a second for typical pages, and output
            is around 4x smaller than raw HTML — so your agent spends fewer
            tokens and less time per page. We benchmark against alternatives
            continuously and Skim comes back consistently faster on normal
            pages.
          </p>
        ),
      },
      {
        q: "What kinds of pages work best?",
        a: (
          <p>
            Articles, docs, blog posts, news, product pages — anything with
            real content in the HTML. Pages behind hard paywalls or heavy
            bot walls may fail; when a site blocks a read, Skim escalates to a
            full browser render automatically before giving up, and a failed
            read costs you nothing.
          </p>
        ),
      },
      {
        q: "Can Skim crawl a whole site?",
        a: (
          <p>
            No — one URL in, one clean read out. That keeps it fast and keeps
            pricing simple. If you need many pages, your agent loops over the
            URLs it cares about and pays per read.
          </p>
        ),
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & billing",
    items: [
      {
        q: "Is Skim free?",
        a: (
          <p>
            Yes. Create a free API key on the{" "}
            <PageLink href="/">homepage</PageLink> (1,000 credits, no wallet),
            or start the <PageLink href="/pricing">monthly Free Plan</PageLink>{" "}
            — card on file, never charged, 1,000 reads every month. Beyond
            that, reads cost fractions of a cent.
          </p>
        ),
      },
      {
        q: "How much does each request cost?",
        a: (
          <p>
            Paying per call: $0.002 per read, $0.015 per structured extract,
            $0.005 per Signal poll. Paying by card: plans start free (1,000
            reads a month) and go up from $15, where a standard read is one
            credit. See <PageLink href="/pricing">pricing</PageLink> and{" "}
            <PageLink href="/pricing">card plans</PageLink> for details.
          </p>
        ),
      },
      {
        q: "Do you charge for failed requests?",
        a: (
          <p>
            No. Paying per call, payment settles only when a read succeeds —
            if a page can't be read, you don't pay. On card plans, failed
            reads are refunded to your credit balance automatically.
          </p>
        ),
      },
      {
        q: "What payment methods do you accept?",
        a: (
          <p>
            Start with a free <InlineCode>sk402_</InlineCode> key, or a{" "}
            <PageLink href="/pricing">card plan</PageLink> — normal credit
            card, real invoices, cancel anytime. Agents that already have a{" "}
            <PageLink href="/wallet">funded wallet</PageLink> can optionally
            pay per call in USDC instead.
          </p>
        ),
      },
      {
        q: "Is there a monthly plan?",
        a: (
          <p>
            Only if you want one. <PageLink href="/pricing">Card plans</PageLink>{" "}
            are monthly with a generous free tier. Paying per call has no plan
            at all — your bill is exactly proportional to what your agent
            actually did.
          </p>
        ),
      },
      {
        q: "How does accounting work?",
        a: (
          <p>
            Card plans come with real invoices and a dashboard showing credits
            remaining. Per-call payments each produce their own receipt.
            Either way, totals tie out exactly to per-read prices — no
            estimated usage.
          </p>
        ),
      },
    ],
  },
  {
    id: "trust",
    title: "Trust & setup",
    items: [
      {
        q: "Is it safe to put Skim in my agent?",
        a: (
          <p>
            Skim holds no credentials for the pages it reads and has no access
            to your systems — it takes a URL and returns text. Treat your{" "}
            <InlineCode>sk402_</InlineCode> key like any other API secret; on
            the optional wallet path, use a small dedicated wallet. Fetches
            are SSRF-protected: private, loopback, and cloud-metadata address
            ranges are rejected at every redirect hop.
          </p>
        ),
      },
      {
        q: "What does Skim log?",
        a: (
          <p>
            Operational basics only: call metadata like timing, response size,
            and payment settlement. We don't store the specific URLs
            individual callers submit. Fetched content is processed
            transiently and may be briefly cached to improve performance —
            see the <PageLink href="/privacy">privacy policy</PageLink> for
            the full picture.
          </p>
        ),
      },
      {
        q: "How do I add Skim to my agent?",
        a: (
          <p>
            Easiest: create a free API key on the{" "}
            <PageLink href="/">homepage</PageLink> and send it as{" "}
            <InlineCode>Authorization: Bearer sk402_…</InlineCode> to{" "}
            <InlineCode>/api/t/read</InlineCode>. Copy-paste snippets are in
            the <PageLink href="/docs">docs</PageLink>. The MCP server (
            <InlineCode>npx -y skim-mcp</InlineCode>) is the optional wallet
            path. Connectors also live on{" "}
            <ExtLink href="https://github.com/JessieJanie/skim-tools">
              GitHub
            </ExtLink>
            .
          </p>
        ),
      },
      {
        q: "Is the code open source?",
        a: (
          <p>
            The connectors, MCP server, and agent tooling are open source on{" "}
            <ExtLink href="https://github.com/JessieJanie/skim-tools">
              GitHub
            </ExtLink>
            . The reader service itself is not.
          </p>
        ),
      },
      {
        q: "I have a question that isn't here.",
        a: (
          <p>
            Email{" "}
            <a
              href="mailto:hello@skim402.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              hello@skim402.com
            </a>{" "}
            — we read every message.
          </p>
        ),
      },
    ],
  },
];

export default function FAQ() {
  useDocumentMeta({
    title: "FAQ | Skim™",
    description:
      "Frequently asked questions about Skim — what it returns, what it costs, how billing works, and how to add it to your agent.",
    canonical: "https://skim402.com/faq",
  });

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECTIONS.flatMap((s) =>
      s.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: "See https://skim402.com/faq for the full answer.",
        },
      })),
    ),
  };

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-3xl">
        <header className="mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            FAQ
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
            Frequently asked questions
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            What Skim returns, what it costs, and how to plug it in. Anything
            else, email{" "}
            <a
              href="mailto:hello@skim402.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              hello@skim402.com
            </a>
            .
          </p>
        </header>

        <div className="space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-2xl font-bold tracking-tight mb-6">
                {section.title}
              </h2>
              <div className="space-y-8">
                {section.items.map((item) => (
                  <div key={item.q}>
                    <h3 className="text-base font-semibold mb-2">{item.q}</h3>
                    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
                      {item.a}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PublicLayout>
  );
}
