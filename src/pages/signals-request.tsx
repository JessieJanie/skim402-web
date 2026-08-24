import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CONTACT_EMAIL, signalRequestMailto } from "@/lib/signals";

export default function SignalsRequest() {
  useDocumentMeta({
    title: "Request a custom Signal | Skim",
    description:
      "Ask Skim to build a custom intelligence feed for your agent. We aim to reply within two business days — same as the contact page.",
    canonical: "https://skim402.com/signals/request",
  });

  const [vertical, setVertical] = useState("");
  const [sources, setSources] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    window.location.href = signalRequestMailto({ vertical, sources, email, note });
  };

  return (
    <PublicLayout>
      <article className="container mx-auto px-4 py-16 md:py-24 max-w-xl">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Custom Signal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
            Request a Signal.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Tell us the vertical your agent needs to watch and a few example
            sources. This goes to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            {" "}
            — the same inbox as{" "}
            <Link href="/contact" className="text-primary hover:underline">
              /contact
            </Link>
            . We aim to reply within two business days.
          </p>
        </header>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="signal-vertical" className="text-sm font-medium text-foreground">
              Vertical
            </label>
            <input
              id="signal-vertical"
              required
              value={vertical}
              onChange={(event) => setVertical(event.target.value)}
              placeholder="e.g. EU AI Act updates, hospital staffing, satellite launches"
              className="mt-2 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-signal-vertical"
            />
          </div>
          <div>
            <label htmlFor="signal-sources" className="text-sm font-medium text-foreground">
              Example sources
            </label>
            <textarea
              id="signal-sources"
              required
              value={sources}
              onChange={(event) => setSources(event.target.value)}
              rows={4}
              placeholder={"https://example.gov/press\nhttps://example.org/feed.xml"}
              className="mt-2 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-signal-sources"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Official pages, RSS, or APIs your agent should watch. One per line is fine.
            </p>
          </div>
          <div>
            <label htmlFor="signal-email" className="text-sm font-medium text-foreground">
              Your email
            </label>
            <input
              id="signal-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="mt-2 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-signal-email"
            />
          </div>
          <div>
            <label htmlFor="signal-note" className="text-sm font-medium text-foreground">
              Anything else <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="signal-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Filters, update cadence, or how your agent will use the feed."
              className="mt-2 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-signal-note"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" data-testid="button-signal-request">
            Open email to {CONTACT_EMAIL}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-8 leading-relaxed">
          If your mail app doesn&apos;t open, write us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          . We do not promise an immediate response — two business days, same
          as the rest of Skim.
        </p>
      </article>
    </PublicLayout>
  );
}
