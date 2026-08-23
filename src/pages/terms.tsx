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

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
      {children}
    </ul>
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

export default function Terms() {
  useDocumentMeta({
    title: "Terms of Service | Skim",
    description:
      "The terms that govern use of Skim, the clean reader API operated by Angeles Crest LLC, paid by wallet (x402) or card (Stripe). Service is provided as-is; you are responsible for the URLs you submit.",
    canonical: "https://skim402.com/terms",
  });

  return (
    <PublicLayout>
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-3xl">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <H2>1. Agreement</H2>
        <P>
          These Terms of Service ("Terms") govern your access to and use of the
          Skim website, API, and related services (collectively, the
          "Service"). By using the Service — including by sending a request to
          any Skim API endpoint — you agree to these Terms. If you do not agree,
          do not use the Service.
        </P>

        <H2>2. The Service</H2>
        <P>
          Skim is a clean reader API for AI agents. You send a URL and Skim
          returns the readable content of that page as markdown plus structured
          metadata, or, where you supply a schema, as typed JSON. Skim offers
          two ways to pay for and access the Service:
        </P>
        <List>
          <li>
            <strong>Wallet (x402) pay.</strong> The x402-native rail has no
            accounts and no API keys — your wallet and its per-call USDC
            payment are your means of access.
          </li>
          <li>
            <strong>Card pay.</strong> You may instead buy read credits with a
            credit or debit card through a plan or subscription. This creates an
            account identified by an API key (beginning with{" "}
            <code className="font-mono text-sm">sk402_</code>) that you send with
            each request. A limited free API key with no card is also available.
          </li>
        </List>

        <H2>3. License grant and restrictions</H2>
        <P>
          Subject to your compliance with these Terms, we grant you a limited,
          non-exclusive, non-transferable, and revocable license to access and
          use the Service and the content it returns for your own lawful
          purposes — including building and operating AI agents and
          applications that consume the API in the ordinary, intended manner.
        </P>
        <P>This license is expressly limited. You may not:</P>
        <List>
          <li>
            reverse engineer, decompile, disassemble, or otherwise attempt to
            derive the source code, models, or underlying structure of the Skim
            API or Service;
          </li>
          <li>
            circumvent, bypass, or interfere with any security measure or
            payment mechanism of the Service, including the x402 micropayment
            system;
          </li>
          <li>
            use the Service or its outputs to create, develop, or operate a
            product or service that directly replicates or substantially mimics
            Skim's core functionality;
          </li>
          <li>
            use Skim's outputs or data to train or improve competing AI models
            or data-extraction tools without our prior written permission;
          </li>
          <li>
            reproduce, modify, or create derivative works of the Service or API
            beyond what is reasonably necessary for the normal use described
            above;
          </li>
          <li>
            access or use the Service through automated means outside of the
            official API and its documented interfaces; or
          </li>
          <li>
            remove or alter any copyright, trademark, or other proprietary
            notices.
          </li>
        </List>
        <P>
          These restrictions exist to protect the Service while keeping it fair
          and developer-friendly; nothing here is intended to prevent the
          ordinary, intended use of the API by you or your agents. Any material
          violation of this section may result in suspension or termination of
          your access to the Service.
        </P>

        <H2>4. Payments and pricing</H2>
        <P>
          <strong>Wallet (x402) pay.</strong> Access is paid per call using the
          x402 protocol, settled in USDC on Base. The price that applies to any
          given request is advertised in the HTTP 402 response before you pay,
          so you always see the price before authorizing payment. You are
          responsible for funding your own wallet and for any network (gas)
          costs. Because payments settle on a public blockchain and are final, a
          completed payment is generally non-refundable. If you believe you were
          charged for a successful response you did not receive, contact us at{" "}
          <Mail /> and we will review it in good faith.
        </P>
        <P>
          <strong>Card pay.</strong> You may instead buy read credits through a
          plan or subscription paid by card. Card payments and recurring billing
          are processed by Stripe; the plan price, included read allowance, and
          any overage rate are those shown on the plan at the time of purchase.
          Paid subscriptions renew automatically each billing period until you
          cancel, and usage beyond a plan's included reads may be billed as
          metered overage on your next invoice. You can cancel at any time from
          the Stripe billing portal; cancellation stops future renewals but does
          not retroactively refund the current period. A free plan (with a limited
          monthly read allowance) or a free API key (with a one-time starter
          balance) may be offered as-is, subject to fair-use and anti-abuse
          limits, and may be changed or withdrawn at any time.
        </P>
        <P>
          Under either rail, prices may change, and the price advertised or
          shown at the time of your request or purchase controls. Failed reads
          are not charged (on the card rail, credits for a failed read are
          refunded to your balance).
        </P>

        <H2>5. Acceptable use</H2>
        <P>You agree that you will not, and will not allow your agents to:</P>
        <P>
          (a) submit URLs or request content you do not have the legal right to
          access, or use the Service in a way that violates a target site's
          terms of use, its robots directives, applicable copyright, or any
          law; (b) use the Service to attempt to reach private, internal,
          loopback, or otherwise non-public network resources, or to probe or
          attack infrastructure; (c) use the Service for any unlawful,
          infringing, deceptive, or abusive purpose; or (d) attempt to disrupt,
          overload, reverse-engineer, or circumvent the Service or its
          protections. You are solely responsible for the URLs you submit and
          for how you use the content you receive.
        </P>

        <H2>6. Third-party content</H2>
        <P>
          Skim returns content that originates from third-party websites we do
          not own or control. We do not endorse, verify, or take responsibility
          for that content, and returning it to you does not grant you any
          rights in it. You are responsible for complying with the rights of
          the content's owners, including any copyright, licensing, and
          attribution obligations.
        </P>

        <H2>7. Availability</H2>
        <P>
          The Service is provided on an "as-is" and "as-available" basis. We do
          not guarantee any particular uptime, speed, or result, and we may
          modify, suspend, or discontinue all or part of the Service, or change
          its pricing or features, at any time. Any performance figures or
          benchmarks we publish are illustrative and not a guarantee of future
          results.
        </P>

        <H2>8. Intellectual property</H2>
        <P>
          Skim retains all ownership and intellectual property rights in and to
          the Service, the Skim API, and the underlying software, technology,
          design, website, documentation, name, and marks (collectively, the
          "Skim Materials"). The Skim Materials are owned by Angeles Crest LLC
          and protected by applicable intellectual property and other laws.
        </P>
        <P>
          You are granted only the limited rights expressly described in the
          License grant and restrictions section above. All rights not
          expressly granted to you are reserved by Skim, and these Terms do not
          transfer any of our intellectual property to you. Content returned
          from third-party sources remains the property of its respective
          owners, as described in the Third-party content section.
        </P>

        <H2>9. Disclaimer of warranties</H2>
        <P>
          To the fullest extent permitted by law, the Service is provided
          without warranties of any kind, whether express or implied, including
          but not limited to implied warranties of merchantability, fitness for
          a particular purpose, title, and non-infringement. We do not warrant
          that the Service will be uninterrupted, error-free, secure, or that
          any content returned will be accurate or complete.
        </P>

        <H2>10. Limitation of liability</H2>
        <P>
          To the fullest extent permitted by law, Angeles Crest LLC and its
          members, officers, and contractors will not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or
          any loss of profits, data, or goodwill, arising out of or related to
          your use of the Service. Our total liability for any claim relating to
          the Service will not exceed the greater of the amounts you paid us for
          the Service in the thirty (30) days before the event giving rise to
          the claim, or USD $50.
        </P>

        <H2>11. Indemnification</H2>
        <P>
          You agree to indemnify and hold harmless Angeles Crest LLC from any
          claims, damages, liabilities, and expenses (including reasonable legal
          fees) arising from your use of the Service, the URLs or content you
          submit or request, or your breach of these Terms.
        </P>

        <H2>12. Changes to these Terms</H2>
        <P>
          We may update these Terms from time to time. When we do, we will
          revise the "last updated" date above. Your continued use of the
          Service after a change takes effect constitutes acceptance of the
          updated Terms.
        </P>

        <H2>13. Who we are</H2>
        <P>
          The Service is operated by Angeles Crest LLC, a Wyoming limited
          liability company doing business as "Skim" ("Skim," "we," "us,"
          "our"). You can reach us at{" "}
          <Mail />.
        </P>

        <H2>14. Governing law</H2>
        <P>
          These Terms are governed by the laws of the State of Wyoming,
          without regard to its conflict-of-laws rules. You agree that the
          state and federal courts located in Wyoming will have exclusive
          jurisdiction over any dispute arising out of or relating to these
          Terms or the Service, and you consent to venue there.
        </P>

        <H2>15. Contact</H2>
        <P>
          Questions about these Terms can be sent to <Mail />.
        </P>
      </article>
    </PublicLayout>
  );
}
