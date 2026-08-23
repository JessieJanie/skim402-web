import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const CONTACT_EMAIL = "hello@skim402.com";
const LAST_UPDATED = "August 16, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold tracking-tight mt-12 mb-4">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground leading-relaxed mb-4 last:mb-0">
      {children}
    </p>
  );
}

function Mail() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="text-primary underline-offset-4 hover:underline"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

export default function Privacy() {
  useDocumentMeta({
    title: "Privacy Policy | Skim",
    description:
      "How Skim handles data. The short version: the public x402 API requires no account and collects no personal information, the site runs no analytics, and operational telemetry is minimal and transient.",
    canonical: "https://skim402.com/privacy",
  });

  return (
    <PublicLayout>
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-3xl">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6 md:p-8 mb-4">
          <p className="text-foreground font-medium leading-relaxed mb-3">
            The short version.
          </p>
          <P>
            Skim is built to take as little as possible. The public reader API
            requires no account, no signup, and no API key, so there is no
            profile to collect on that path. We run no analytics or advertising
            trackers on this website. The personal data we touch is limited: an
            email address if you pay by card or write to us, the billing details
            Stripe needs to process a card payment, and an operator login on the
            internal dashboard. Everything below is the longer, precise version.
          </P>
        </div>

        <P>
          In this policy, "Skim," "we," "us," and "our" refer to the company
          that operates Skim, identified in the "Who we are" section of our{" "}
          <a
            href="/terms"
            className="text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </a>
          . You can reach us any time at <Mail />.
        </P>

        <H2>The public reader API (wallet pay)</H2>
        <P>
          The public endpoints (for example <code className="font-mono text-sm">/api/v1/read</code>{" "}
          and <code className="font-mono text-sm">/api/v1/extract</code>) are
          pure x402: an agent sends a request, pays a USDC micropayment, and
          receives clean content back. There are no accounts and no API keys,
          so we do not collect names, emails, passwords, or any user profile on
          this path.
        </P>
        <P>
          To perform a read we process the URL you submit and the content
          fetched from that URL transiently, only for as long as it takes to
          return the response. We may briefly cache fetched content to improve
          performance and avoid redundant requests. We do not sell, share, or
          build profiles from the content we fetch on your behalf.
        </P>
        <P>
          For operational health, abuse prevention, and to report honest
          lifetime traffic, we keep minimal metadata about paid API calls. For
          each call this includes the timestamp, the HTTP method and endpoint
          path, the response status and latency, whether a payment settled, the
          paying wallet address, the price and network, and whether the result
          was served from cache. We keep this in two forms: live in-memory
          counters that reset when the service restarts, and a persistent
          per-call record in our database that survives restarts.
        </P>
        <P>
          Importantly, this record stores call metadata only. We do not store
          the specific URLs that individual callers submit, and we do not store
          the page content returned in those records. The wallet address is
          already public on the blockchain (see below) and is not linked by us
          to any real-world identity.
        </P>

        <H2>Payments and the blockchain</H2>
        <P>
          Payments are made over the x402 protocol and settle in USDC on Base,
          a public blockchain. By design, wallet addresses and transactions on
          a public blockchain are visible to anyone and are pseudonymous rather
          than anonymous. We do not control the blockchain and cannot delete,
          alter, or hide on-chain records. Payment verification and settlement
          are handled through the Coinbase CDP facilitator on mainnet; their
          handling of that data is governed by Coinbase's own policies.
        </P>

        <H2>Card payments and accounts</H2>
        <P>
          As an alternative to the wallet rail, you can buy reads with a normal
          credit or debit card. Card payments and subscriptions are processed by{" "}
          <strong>Stripe</strong>; we do not see or store your full card number.
          Stripe collects and handles your card and billing details under its
          own privacy policy, and returns to us only what we need to run your
          account — a customer and subscription identifier, your billing email,
          and the plan and payment status.
        </P>
        <P>
          When you buy a plan we create an account keyed to an API token (it
          begins with <code className="font-mono text-sm">sk402_</code>). We
          store that account's token, its plan, its remaining read credits, and
          the Stripe identifiers above so we can meter usage, bill overage, and
          let you manage or cancel your subscription. The token is your account:
          it is shown once at checkout and whoever holds it can spend its
          credits. We use your billing email only for receipts, service
          notices, and support.
        </P>
        <P>
          The API calls made with a card token are logged as the same minimal
          per-call metadata described above (timestamp, endpoint, status,
          latency, cache hit), associated with your account token rather than a
          wallet address. As with the wallet rail, we do not store the specific
          URLs you submit or the page content returned.
        </P>

        <H2>Free API keys</H2>
        <P>
          The home page can issue a limited free API key with no signup. To
          prevent abuse and keep the free tier available to everyone, we apply
          simple daily limits (per requester and overall). To enforce the
          per-requester limit we derive and store a short, non-reversible key
          from the requesting IP address for the day, alongside a count — we do
          not store the raw IP address, and this website does not set any cookie
          to issue or track the free key. A free key is otherwise an ordinary
          account as described above, funded with a small starter balance and
          no card on file.
        </P>

        <H2>This website</H2>
        <P>
          The marketing site sets no analytics, advertising, or tracking
          cookies, and issuing a free API key sets no cookie. The contact page
          is a plain email link — there is no form that collects your
          information. If you email us at <Mail />, we receive your email
          address and whatever you choose to include, and we use it only to
          reply to you and keep a record of the correspondence.
        </P>
        <P>
          When you start a card plan, we hand you off to Stripe's hosted
          checkout to enter payment details; Stripe may set cookies necessary
          for that checkout and for fraud prevention, governed by Stripe's own
          policy.
        </P>
        <P>
          The internal operator dashboard uses Clerk for sign-in and is
          intended only for Skim operators, not the general public. If you sign
          in there, Clerk processes your email and authentication details and
          sets cookies necessary for that login. That is the only place on the
          site where authentication cookies are used.
        </P>

        <H2>Service providers</H2>
        <P>
          We rely on a small number of third parties to run Skim: a cloud
          hosting provider for the website and API, Clerk for operator
          authentication, the Coinbase CDP facilitator for wallet (USDC)
          payment settlement, and Stripe for card payments and subscription
          billing. These providers process only the data needed to perform
          their function, under their own privacy terms.
        </P>

        <H2>Data retention</H2>
        <P>
          We keep only what we need. Live in-memory counters reset whenever the
          service restarts. The persistent per-call records described above
          (call metadata, not URLs or page content) are retained so we can
          report accurate lifetime usage and investigate abuse, and we keep them
          no longer than is useful for those purposes. Email correspondence is
          kept for as long as needed to handle your request and our records.
          On-chain transactions, as noted above, are permanent and outside our
          control.
        </P>

        <H2>Your rights</H2>
        <P>
          Depending on where you live (for example under the GDPR in Europe or
          the CCPA/CPRA in California), you may have rights to access, correct,
          or delete personal data we hold about you, or to object to certain
          processing. Because we hold so little, this is usually simple. To make
          a request, email us at <Mail /> and we will respond. We will not
          discriminate against you for exercising these rights.
        </P>

        <H2>Children</H2>
        <P>
          Skim is a developer and agent infrastructure product. It is not
          directed to children, and we do not knowingly collect personal
          information from anyone under 16.
        </P>

        <H2>Changes to this policy</H2>
        <P>
          If we change how we handle data, we will update this page and revise
          the "last updated" date above. Material changes will be reflected
          here before they take effect.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about privacy, or a request about your data, can go to{" "}
          <Mail />. We read every message.
        </P>
      </article>
    </PublicLayout>
  );
}
