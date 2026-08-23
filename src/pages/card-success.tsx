import { useEffect, useRef, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

type ClaimState =
  | { phase: "waiting" }
  | { phase: "token"; token: string }
  | { phase: "claimed" }
  | { phase: "error"; message: string };

export default function CardSuccess() {
  useDocumentMeta({
    title: "Payment received | Skim",
    description: "Your Skim API token.",
    canonical: "https://skim402.com/card/success",
  });
  const [state, setState] = useState<ClaimState>({ phase: "waiting" });
  const [copied, setCopied] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setState({ phase: "error", message: "Missing checkout reference in the URL." });
      return;
    }
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      attempts.current += 1;
      try {
        const res = await fetch(
          `${API_BASE}/card/claim?session_id=${encodeURIComponent(sessionId!)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "ok" && json.token) {
          setState({ phase: "token", token: json.token });
          return;
        }
        if (json.status === "claimed") {
          setState({ phase: "claimed" });
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (attempts.current >= 30) {
        setState({
          phase: "error",
          message:
            "Payment went through, but the token is taking longer than usual. Refresh this page in a minute — your purchase is safe.",
        });
        return;
      }
      setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PublicLayout>
      <div className="pt-24 pb-32">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          {state.phase === "waiting" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">Payment received</h1>
              <p className="text-muted-foreground">Setting up your API token…</p>
            </>
          )}

          {state.phase === "token" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
              <h1 className="text-3xl md:text-4xl font-bold mb-4">You're in</h1>
              <p className="text-muted-foreground mb-8">
                This is your API token. It's shown{" "}
                <strong className="text-foreground">once</strong> — copy it now
                and keep it somewhere safe, like a password manager.
              </p>
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <code className="font-mono text-sm break-all select-all">{state.token}</code>
              </div>
              <Button onClick={() => copyToken(state.token)} className="mb-10">
                <Copy className="h-4 w-4 mr-2" />
                {copied ? "Copied" : "Copy token"}
              </Button>
              <div className="bg-muted rounded-2xl p-6 text-left text-sm">
                <div className="font-semibold mb-2">First read, right now:</div>
                <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`curl "https://skim402.com/api/t/read?url=https://example.com" \\
  -H "Authorization: Bearer ${state.token.slice(0, 12)}..."`}
                </pre>
                <p className="text-muted-foreground mt-3">
                  Check your balance anytime at{" "}
                  <code className="font-mono text-xs">GET /api/card/account</code>{" "}
                  with the same header.{" "}
                  <Link href="/docs" className="text-primary hover:underline">
                    Full docs →
                  </Link>
                </p>
              </div>
            </>
          )}

          {state.phase === "claimed" && (
            <>
              <TriangleAlert className="h-10 w-10 text-primary mx-auto mb-4" />
              <h1 className="text-3xl md:text-4xl font-bold mb-4">Token already collected</h1>
              <p className="text-muted-foreground">
                The token for this purchase was already shown once (tokens are
                single-reveal for security). If you didn't save it, write to us
                via the{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>{" "}
                and we'll sort you out.
              </p>
            </>
          )}

          {state.phase === "error" && (
            <>
              <TriangleAlert className="h-10 w-10 text-primary mx-auto mb-4" />
              <h1 className="text-3xl md:text-4xl font-bold mb-4">Almost there</h1>
              <p className="text-muted-foreground">{state.message}</p>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
