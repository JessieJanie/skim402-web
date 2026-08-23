import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

type Plan = {
  id: "free" | "s15" | "s45" | "s250";
  name: string;
  price: string;
  cadence: string;
  reads: string;
  tagline: string;
  bullets: string[];
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Plan",
    price: "$0",
    cadence: "per month",
    reads: "1,000 credits/mo",
    tagline: "1,000 credits on us, every month.",
    bullets: [
      "1,000 credits a month, refreshed monthly",
      "Card on file, but never charged on this plan",
      "Same API, same speed as every paid tier",
    ],
  },
  {
    id: "s15",
    name: "Solo",
    price: "$15",
    cadence: "per month",
    reads: "5,500 credits/mo",
    tagline: "For a side project or a single agent in production.",
    bullets: [
      "5,500 credits a month",
      "Keep going past the cap — extra reads billed as you go",
      "Cancel anytime from the billing portal",
    ],
    featured: true,
  },
  {
    id: "s45",
    name: "Team",
    price: "$45",
    cadence: "per month",
    reads: "57,000 credits/mo",
    tagline: "Production workloads with room to breathe.",
    bullets: [
      "57,000 credits a month",
      "Overage priced below the sticker rate",
      "One invoice your accountant will actually understand",
    ],
  },
  {
    id: "s250",
    name: "Scale",
    price: "$250",
    cadence: "per month",
    reads: "475,000 credits/mo",
    tagline: "High-volume pipelines and platforms.",
    bullets: [
      "475,000 credits a month",
      "Best per-read rate of any tier",
      "Priority support by email",
    ],
  },
];

export default function Pricing() {
  useDocumentMeta({
    title: "Plans — free plan included, from $15/mo | Skim",
    description:
      "Sign up for a Skim plan in one Stripe checkout: a Free Plan with 1,000 credits every month, or paid plans from $15. Real invoices, cancel anytime, API key delivered instantly.",
    canonical: "https://skim402.com/pricing",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(plan: Plan["id"]) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/card/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "checkout failed");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <PublicLayout>
      <div className="pt-20 pb-32">
        <div className="container mx-auto px-4 text-center max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <CreditCard className="h-4 w-4" />
            One Stripe checkout. No signup form.
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Pick a plan. Get your key.
          </h1>
          <p className="text-xl text-muted-foreground">
            Every plan runs through a normal Stripe checkout: card in, invoice
            out, API key delivered the moment you pay. Start on the Free Plan —
            1,000 credits every month, card never charged — and upgrade only
            when you outgrow it.
          </p>
          <p className="mt-6 italic text-foreground/70 text-base max-w-2xl mx-auto">
            Skim never charges you for a page it couldn't read.
          </p>
        </div>

        <div className="container mx-auto px-4 max-w-6xl">
          {error && (
            <p className="text-center text-sm text-destructive mb-6">{error}</p>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={
                  plan.featured
                    ? "bg-card border-2 border-primary rounded-3xl p-8 shadow-md flex flex-col"
                    : "bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col"
                }
              >
                <div className="text-sm font-semibold mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.cadence}</span>
                </div>
                <div className="text-sm font-medium text-primary mb-3">{plan.reads}</div>
                <p className="text-muted-foreground text-sm mb-6">{plan.tagline}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex items-start text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mr-2 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.featured ? "default" : "outline"}
                  className="w-full"
                  disabled={busy !== null}
                  onClick={() => buy(plan.id)}
                >
                  {busy === plan.id ? "Opening checkout…" : plan.id === "free" ? "Start free" : "Subscribe"}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-card border border-border rounded-3xl p-8 max-w-3xl mx-auto text-center">
            <h2 className="text-lg font-semibold mb-2">Need more than 475,000 reads a month?</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Volume pricing, custom terms, and a human to talk to.
            </p>
            <Button asChild variant="outline">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>

          <div className="mt-16 max-w-3xl mx-auto" id="how-it-works">
            <h2 className="text-2xl font-bold text-center mb-8">
              Signing up takes about a minute
            </h2>
            <ol className="space-y-6">
              <li className="bg-card border border-border rounded-2xl p-6">
                <div className="font-semibold mb-1">1. Pick a plan above</div>
                <p className="text-sm text-muted-foreground">
                  The button opens a standard Stripe checkout — the same secure
                  payment page used by millions of businesses. No signup form,
                  no password, no sales call. The Free Plan asks for a card too,
                  but never charges it.
                </p>
              </li>
              <li className="bg-card border border-border rounded-2xl p-6">
                <div className="font-semibold mb-1">2. Copy your API key from the confirmation page</div>
                <p className="text-sm text-muted-foreground">
                  Right after payment you land on a page showing your key — it
                  starts with <code className="font-mono text-xs">sk402_</code>{" "}
                  and is shown <strong className="text-foreground">once</strong>.
                  Save it in a password manager, like any other API key. The key{" "}
                  <em>is</em> your account: whoever holds it can spend the
                  credits. If you missed it, write to us via the{" "}
                  <Link href="/contact" className="text-primary hover:underline">
                    contact page
                  </Link>{" "}
                  with your purchase email.
                </p>
              </li>
              <li className="bg-card border border-border rounded-2xl p-6">
                <div className="font-semibold mb-1">3. Order reads with the key</div>
                <p className="text-sm text-muted-foreground mb-3">
                  Send the key in a header with every request. Any language, any
                  tool — here's the whole thing with curl:
                </p>
                <pre className="bg-muted rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`curl "https://skim402.com/api/t/read?url=https://example.com" \\
  -H "Authorization: Bearer sk402_YOUR_KEY"`}
                </pre>
                <p className="text-sm text-muted-foreground mt-3">
                  You get the page back as clean markdown. A standard read is 1
                  credit; pages that need a full browser render cost 2–3. Batch
                  and extract endpoints are in the{" "}
                  <Link href="/docs" className="text-primary hover:underline">
                    docs
                  </Link>
                  .
                </p>
              </li>
              <li className="bg-card border border-border rounded-2xl p-6">
                <div className="font-semibold mb-1">4. Check your balance anytime</div>
                <p className="text-sm text-muted-foreground">
                  Paste your key on the{" "}
                  <Link href="/card/account" className="text-primary hover:underline">
                    account page
                  </Link>{" "}
                  to see credits remaining and any pending overage. Invoices,
                  receipts, and cancelling are handled in the Stripe billing
                  portal, one click from the same page.
                </p>
              </li>
            </ol>

            <div className="mt-8 bg-muted rounded-2xl p-6 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">
                Handing the key to an AI agent? That's the point.
              </div>
              Buy with the company card, give the key to your agent, and every
              read it makes lands on one normal Stripe invoice — conventional
              accounting, no crypto wallet anywhere in the loop.
            </div>
          </div>

          <div className="mt-12 max-w-2xl mx-auto text-center text-sm text-muted-foreground space-y-2">
            <p>
              A standard read is 1 credit. Pages that need a full browser
              render cost 2–3 credits. Batch reads are 1 credit per
              successful URL (up to 10). Structured extract is 8 credits.
              Watching a page uses a normal read — 1 credit each time you
              actually fetch. Failed reads and failed extracts are refunded
              — you only pay for work Skim delivered.
            </p>
            <p>
              Paid plans keep working past the cap: extra reads are metered and
              appear on your next invoice. The Free Plan stops at its monthly
              1,000 — upgrade whenever you outgrow it. Cancel anytime. We never
              see or store your full card number.
            </p>
            <p>
              Agent carries its own wallet? Skim is also x402-native — pay per
              call in USDC with no account at all.{" "}
              <Link href="/wallet" className="text-primary hover:underline">
                Wire up wallet pay →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
