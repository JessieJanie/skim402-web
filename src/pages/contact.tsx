import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const CONTACT_EMAIL = "hello@skim402.com";

export default function Contact() {
  useDocumentMeta({
    title: "Contact | Skim",
    description:
      "Get in touch with Skim. Email us with questions about the API, integration help, partnerships, or feedback. We read every message.",
    canonical: "https://skim402.com/contact",
  });

  return (
    <PublicLayout>
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-2xl">
        <header className="mb-12 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Contact
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
            Get in touch.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Questions about the API, integration help, partnership ideas, or
            just feedback — send us a note. We read every message.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-8 md:p-12 text-center mb-12">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Email
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-2xl md:text-3xl font-bold tracking-tight text-foreground hover:text-primary transition-colors break-all"
          >
            {CONTACT_EMAIL}
          </a>
          <div className="mt-6">
            <Button asChild size="lg">
              <a href={`mailto:${CONTACT_EMAIL}`}>Open in your mail app</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            We aim to reply within two business days.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-2">
              Before you write
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A lot of common questions are already answered in the{" "}
              <a
                href="/docs"
                className="text-primary underline-offset-4 hover:underline"
              >
                API docs
              </a>{" "}
              and on{" "}
              <a
                href="https://github.com/JessieJanie/skim-tools"
                target="_blank"
                rel="noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                GitHub
              </a>{" "}
              (tool definitions for every major framework).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Protocol questions vs Skim questions
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about the x402 protocol itself (spec, facilitators,
              SDKs in other languages), the canonical source is{" "}
              <a
                href="https://www.x402.org"
                target="_blank"
                rel="noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                x402.org
              </a>
              . For questions specifically about Skim — the reader, pricing,
              uptime, integrations — email is the right place.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Reporting an issue</h2>
            <p className="text-muted-foreground leading-relaxed">
              If something looks broken, please include the URL you were trying
              to read, the time the call was made (with timezone), and any
              transaction hash if a payment was involved. That information lets
              us trace the request quickly and reply with something useful.
            </p>
          </section>
        </div>
      </article>
    </PublicLayout>
  );
}
