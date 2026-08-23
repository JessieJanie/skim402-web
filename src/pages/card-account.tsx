import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { KeyRound, LogOut, ExternalLink, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
const STORAGE_KEY = "skim_card_key";

type Account = {
  plan: string;
  status: string;
  planCredits: number;
  packCredits: number;
  overageThisPeriod: number;
  periodEnd: string | null;
  creditCosts: Record<string, number>;
};

const PLAN_NAMES: Record<string, string> = {
  none: "Pack credits",
  free: "Free Plan",
  s19: "Solo — $19/mo",
  s15: "Solo — $15/mo",
  s45: "Team — $45/mo",
  s250: "Scale — $250/mo",
  s99: "Team — $99/mo",
  s499: "Scale — $499/mo",
};

export default function CardAccount() {
  useDocumentMeta({
    title: "Your account | Skim",
    description:
      "Check your Skim balance: credits remaining, plan status, and pending overage. Manage billing or cancel anytime.",
    canonical: "https://skim402.com/card/account",
  });

  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  // Auto-load a remembered key.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setKey(saved);
      setRemember(true);
      void lookup(saved, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(k: string, silent = false) {
    const token = k.trim();
    if (!token.startsWith("sk402_")) {
      if (!silent) setError("That doesn't look like a Skim key — it starts with sk402_");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/card/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "lookup failed");
      setAccount(json as Account);
      if (remember) localStorage.setItem(STORAGE_KEY, token);
    } catch (e) {
      setAccount(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setAccount(null);
    setKey("");
    setRemember(false);
  }

  async function openPortal() {
    setPortalBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/card/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "could not open billing portal");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPortalBusy(false);
    }
  }

  const totalCredits = account ? account.planCredits + account.packCredits : 0;

  return (
    <PublicLayout>
      <div className="pt-20 pb-32">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-4">
              <KeyRound className="h-4 w-4" />
              Card account
            </div>
            <h1 className="text-4xl font-bold mb-4">Your account</h1>
            <p className="text-muted-foreground">
              Your API key <em>is</em> your account. Paste it below to see your
              balance and manage billing — no password, no signup.
            </p>
          </div>

          {!account && (
            <div className="bg-card border border-border rounded-3xl p-8">
              <label className="block text-sm font-semibold mb-2" htmlFor="skim-key">
                API key
              </label>
              <input
                id="skim-key"
                type="password"
                autoComplete="off"
                placeholder="sk402_…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup(key)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => {
                    setRemember(e.target.checked);
                    if (!e.target.checked) localStorage.removeItem(STORAGE_KEY);
                  }}
                />
                Remember on this device (don't use on a shared computer)
              </label>
              {error && (
                <p className="text-sm text-destructive mb-4 flex items-start gap-2">
                  <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </p>
              )}
              <Button className="w-full" disabled={busy} onClick={() => lookup(key)}>
                {busy ? "Checking…" : "Show my account"}
              </Button>
              <p className="text-xs text-muted-foreground mt-6 text-center">
                Lost your key? It's only shown once at purchase, so we can't
                recover the same one — but write to us via the{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>{" "}
                with your purchase email and we'll sort you out.
              </p>
            </div>
          )}

          {account && (
            <>
              <div className="bg-card border border-border rounded-3xl p-8 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Plan</div>
                    <div className="text-lg font-semibold">
                      {PLAN_NAMES[account.plan] ?? account.plan}
                      {account.plan !== "none" && account.status !== "active" && (
                        <span className="ml-2 text-sm text-muted-foreground">({account.status})</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-1" /> Forget key
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted rounded-2xl p-5">
                    <div className="text-3xl font-bold">{totalCredits.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">credits remaining</div>
                  </div>
                  <div className="bg-muted rounded-2xl p-5">
                    <div className="text-3xl font-bold">
                      {account.overageThisPeriod.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      extra reads pending (billed on your next invoice)
                    </div>
                  </div>
                </div>

                <dl className="text-sm space-y-2">
                  {account.planCredits > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Monthly allowance left</dt>
                      <dd className="font-medium">{account.planCredits.toLocaleString()}</dd>
                    </div>
                  )}
                  {account.packCredits > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Pack credits (never expire)</dt>
                      <dd className="font-medium">{account.packCredits.toLocaleString()}</dd>
                    </div>
                  )}
                  {account.periodEnd && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Allowance resets</dt>
                      <dd className="font-medium">
                        {new Date(account.periodEnd).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Standard read</dt>
                    <dd className="font-medium">{account.creditCosts.read} credit</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Browser-rendered read</dt>
                    <dd className="font-medium">
                      {account.creditCosts.readJsFallback}–{account.creditCosts.readJs} credits
                    </dd>
                  </div>
                </dl>
              </div>

              {error && (
                <p className="text-sm text-destructive mb-4 text-center">{error}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {account.plan !== "none" ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={portalBusy}
                    onClick={openPortal}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalBusy ? "Opening…" : "Manage billing / cancel"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={portalBusy}
                    onClick={openPortal}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalBusy ? "Opening…" : "Invoices & receipts"}
                  </Button>
                )}
                <Button asChild className="flex-1">
                  <Link href="/pricing">Buy more reads</Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-8 text-center">
                Same balance from the command line:{" "}
                <code className="font-mono">GET /api/card/account</code> with
                your key in the <code className="font-mono">Authorization</code>{" "}
                header.
              </p>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
