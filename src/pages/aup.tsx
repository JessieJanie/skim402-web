import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Link } from "wouter";

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

export default function AUP() {
  useDocumentMeta({
    title: "Acceptable Use Policy | Skim",
    description:
      "The Skim Acceptable Use Policy: the activities and content that are prohibited when using Skim, the clean reader API operated by Angeles Crest LLC.",
    canonical: "https://skim402.com/aup",
  });

  return (
    <PublicLayout>
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-3xl">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
            Acceptable Use Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <H2>1. Overview</H2>
        <P>
          This Acceptable Use Policy ("AUP") describes the activities and
          content that are prohibited when accessing or using Skim, the
          clean reader API operated by Angeles Crest LLC, a Wyoming
          limited liability company doing business as "Skim" ("Skim,"
          "we," "us," "our"). This AUP supplements, and is incorporated into,
          our{" "}
          <Link
            href="/terms"
            className="text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          . By using the Service — including by sending a request to any Skim
          API endpoint — you and any agents acting on your behalf agree to this
          AUP.
        </P>

        <H2>2. General principles</H2>
        <P>
          Skim returns the readable content of web pages you request. You are
          responsible for the URLs you submit, for having the legal right to
          access the content you request, and for how you use the content you
          receive. You must use the Service lawfully, respect the rights of
          others, and not use it to harm Skim, our infrastructure, other users,
          or third parties.
        </P>

        <H2>3. Prohibited activities</H2>
        <P>You may not, and may not allow your agents to, use the Service to:</P>
        <List>
          <li>
            violate any applicable law or regulation, or facilitate any illegal
            activity;
          </li>
          <li>
            access, request, or distribute content you do not have the legal
            right to access or use, or that infringes another party's
            copyright, trademark, trade secret, or other intellectual property
            rights;
          </li>
          <li>
            access content in a manner that violates a target site's terms of
            use, robots directives, or other access restrictions;
          </li>
          <li>
            attempt to reach private, internal, loopback, or otherwise
            non-public network resources, or to scan, probe, overload, or attack
            any infrastructure;
          </li>
          <li>
            circumvent, bypass, or interfere with any security measure or
            payment mechanism of the Service, including the x402 micropayment
            system;
          </li>
          <li>
            distribute malware, spyware, or other malicious code, or engage in
            phishing, fraud, deceptive, or misleading activity;
          </li>
          <li>
            collect, process, or expose personal data in violation of
            applicable privacy or data-protection laws, or harvest personal
            information for unlawful purposes;
          </li>
          <li>
            resell, replicate, or substantially mimic the Service, or use its
            outputs to train or improve competing AI models or data-extraction
            tools without our prior written permission;
          </li>
          <li>
            generate or facilitate spam, or impose an unreasonable or
            disproportionately large load on the Service; or
          </li>
          <li>
            use the Service in any way that is abusive, harassing, defamatory,
            or otherwise harmful to others.
          </li>
        </List>

        <H2>4. Prohibited content and uses</H2>
        <P>
          You may not use the Service in connection with content or activities
          that are illegal or that facilitate harm, including, without
          limitation: child sexual abuse material or any content that exploits
          or endangers minors; content that promotes terrorism, violence, or
          unlawful weapons; the sale or distribution of illegal goods or
          controlled substances; human trafficking or exploitation; or any
          fraudulent, money-laundering, or sanctions-evading activity. We
          reserve the right to determine, in our reasonable judgment, whether a
          use falls within these categories.
        </P>

        <H2>5. Enforcement</H2>
        <P>
          We may investigate suspected violations or attempted violations of
          this AUP, including any attempt to circumvent the Service or its
          protections, and take any action we consider appropriate, including
          suspending or terminating your access to the Service, blocking
          requests, and, where required or appropriate, reporting activity to
          law enforcement or other authorities. We may also share information
          about violations or attempted violations with our payment,
          facilitator, and card-network partners for compliance and
          loss-prevention purposes. Depending on how you access the Service,
          enforcement may take the form of technical blocking of requests or
          payment sources on the wallet rail, or suspension or revocation of
          API keys and cancellation of plans on the card rail. A material
          violation of this AUP is a material breach of our Terms of Service.
        </P>

        <H2>6. Reporting abuse</H2>
        <P>
          If you become aware of any use of the Service that violates this AUP,
          please report it to us at <Mail />. We review reports in good faith
          and act on them as appropriate.
        </P>

        <H2>7. Changes to this policy</H2>
        <P>
          We may update this AUP from time to time. When we do, we will revise
          the "last updated" date above. Your continued use of the Service after
          a change takes effect constitutes acceptance of the updated AUP.
        </P>
      </article>
    </PublicLayout>
  );
}
