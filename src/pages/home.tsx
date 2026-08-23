import React from "react";
import { SkimBackground, SkimNav, SkimFooter } from "@/components/layout/SkimChrome";

const API_BASE = `${import.meta.env.BASE_URL}api`;
const SESSION_KEY_STORAGE = "skim-workbench-trial-key";

type TrialState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "error"; message: string }
  | { phase: "done"; token: string; credits: number };

type TrialRunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "error"; message: string }
  | { phase: "done"; markdown: string; wordCount: number; credits: number };

function TrialKeyBox() {
  const [state, setState] = React.useState<TrialState>({ phase: "idle" });
  const [copied, setCopied] = React.useState(false);
  const [runUrl, setRunUrl] = React.useState("https://en.wikipedia.org/wiki/Markdown");
  const [run, setRun] = React.useState<TrialRunState>({ phase: "idle" });

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY_STORAGE);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { token?: string; credits?: number };
      if (parsed.token?.startsWith("sk402_")) {
        setState({ phase: "done", token: parsed.token, credits: parsed.credits ?? 0 });
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY_STORAGE);
    }
  }, []);

  async function createKey() {
    setState({ phase: "creating" });
    try {
      const res = await fetch(`${API_BASE}/card/trial-key`, { method: "POST" });
      const body = (await res.json()) as { token?: string; credits?: number; error?: string };
      if (!res.ok || !body.token) {
        setState({ phase: "error", message: body.error ?? "could not create key — try again" });
        return;
      }
      const nextState = { phase: "done" as const, token: body.token, credits: body.credits ?? 1000 };
      setState(nextState);
      window.localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify({
        token: nextState.token,
        credits: nextState.credits,
      }));
    } catch {
      setState({ phase: "error", message: "could not create key — try again" });
    }
  }

  async function runRead() {
    if (state.phase !== "done" || run.phase === "running") return;
    const url = runUrl.trim();
    if (!url) return;
    setRun({ phase: "running" });
    try {
      const res = await fetch(`${API_BASE}/t/read?url=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      const body = (await res.json().catch(() => null)) as
        | { markdown?: string; wordCount?: number; error?: string }
        | null;
      if (!res.ok || !body?.markdown) {
        setRun({ phase: "error", message: body?.error ?? "read failed — try another URL" });
        return;
      }
      const credits = res.headers.get("X-Skim-Fallback") === "js" ? 2 : 1;
      setRun({ phase: "done", markdown: body.markdown, wordCount: body.wordCount ?? 0, credits });
    } catch {
      setRun({ phase: "error", message: "couldn't reach the reader — try again" });
    }
  }

  function copyToken() {
    if (state.phase !== "done") return;
    void navigator.clipboard.writeText(state.token).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <section className="skim-trial">
      <div className="skim-trial-box">
        {state.phase === "done" ? (
          <>
            <h2>Your key is live.</h2>
            <p className="skim-trial-sub">{state.credits} free reads. Save it — it's only shown once.</p>
            <div className="skim-trial-key">
              <code>{state.token}</code>
              <button type="button" onClick={copyToken}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="skim-trial-snippet">{`curl -H "Authorization: Bearer ${state.token}" \\
  "https://skim402.com/api/t/read?url=${encodeURIComponent(runUrl.trim() || "https://example.com")}"`}</pre>
            <div className="skim-trial-run">
              <input
                aria-label="URL to read with your key"
                value={runUrl}
                onChange={(e) => setRunUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runRead();
                }}
                disabled={run.phase === "running"}
                placeholder="https://..."
              />
              <button
                type="button"
                disabled={run.phase === "running" || !runUrl.trim()}
                onClick={() => void runRead()}
              >
                {run.phase === "running" ? "Reading..." : "Run it"}
              </button>
            </div>
            <div aria-live="polite">
              {run.phase === "running" && <p className="skim-trial-sub">Reading…</p>}
              {run.phase === "error" && <p className="skim-trial-error">{run.message}</p>}
              {run.phase === "done" && (
                <div className="skim-trial-result">
                  <div className="skim-trial-result-head">
                    <span>CLEAN MARKDOWN</span>
                    <span>{run.wordCount} words · {run.credits} credit{run.credits === 1 ? "" : "s"}</span>
                  </div>
                  <pre>{run.markdown.slice(0, 2400)}{run.markdown.length > 2400 ? "\n…" : ""}</pre>
                </div>
              )}
            </div>
            <p className="skim-trial-note">
              When you run out: <a href="/pricing">add a card</a> for the Free Plan — 1,000 reads every month.
            </p>
          </>
        ) : (
          <>
            <h2>Create a free API key.</h2>
            <p className="skim-trial-sub">No wallet. No crypto. 1,000 credits — paste the key into your agent and go.</p>
            <button
              type="button"
              className="skim-trial-btn"
              disabled={state.phase === "creating"}
              onClick={() => void createKey()}
            >
              {state.phase === "creating" ? "Creating..." : "Create key"}
            </button>
            {state.phase === "error" && <p className="skim-trial-error">{state.message}</p>}
          </>
        )}
      </div>
    </section>
  );
}

type DemoState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "done";
      markdown: string;
      ms: number;
      originalBytes: number;
      cleanedBytes: number;
      priceUsd: number;
    };

function formatKb(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function useTypewriter(text: string, active: boolean): string {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    setCount(0);
    const step = Math.max(8, Math.ceil(text.length / 220)); // ~2.5s reveal
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + step;
      });
    }, 12);
    return () => window.clearInterval(id);
  }, [text, active]);
  return active ? text.slice(0, count) : "";
}

function HeroDemo() {
  const [value, setValue] = React.useState("");
  const [state, setState] = React.useState<DemoState>({ phase: "idle" });
  const shown = useTypewriter(
    state.phase === "done" ? state.markdown : "",
    state.phase === "done",
  );

  const submit = async () => {
    const url = value.trim();
    if (!url || state.phase === "loading") return;
    setState({ phase: "loading" });
    try {
      const res = await fetch(`${API_BASE}/demo/home`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setState({
          phase: "error",
          message:
            data?.error ??
            (res.status === 429
              ? "Demo limit reached — try again in a minute"
              : "Couldn't read that page"),
        });
        return;
      }
      setState({
        phase: "done",
        markdown: data.markdown ?? "",
        ms: data.ms ?? 0,
        originalBytes: data.originalBytes ?? 0,
        cleanedBytes: data.cleanedBytes ?? 0,
        priceUsd: data.priceUsd ?? 0.002,
      });
    } catch {
      setState({ phase: "error", message: "Couldn't reach the reader — try again" });
    }
  };

  const streaming =
    state.phase === "loading" ||
    (state.phase === "done" && shown.length < state.markdown.length);

  return (
    <>
      <div className="skim-url-wrap">
        <div className="skim-url-inner">
          <input
            aria-label="URL to skim"
            placeholder="Paste URL here..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            disabled={state.phase === "loading"}
          />
          {value.trim() && state.phase !== "loading" ? (
            <button type="button" className="skim-go" onClick={() => void submit()}>
              Skim it
            </button>
          ) : (
            <span className="skim-pulse" />
          )}
        </div>
      </div>
      <div className="skim-output">
        <div className="skim-output-head">
          <span>CLEAN MARKDOWN</span>
          <span className="skim-stream">
            {streaming ? (
              <>
                <i className="skim-pulse" />
                streaming
              </>
            ) : state.phase === "done" ? (
              "done"
            ) : state.phase === "error" ? (
              "error"
            ) : (
              <>
                <i className="skim-pulse" />
                ready
              </>
            )}
          </span>
        </div>
        <div className="skim-markdown" aria-live="polite">
          {state.phase === "done"
            ? shown
            : state.phase === "loading"
              ? "Reading…"
              : state.phase === "error"
                ? state.message
                : (
                  <span className="skim-markdown-idle">
                    {"Skim strips any URL down to clean markdown — no ads, no nav, no noise.\n\n"}
                    {"Paste a URL above and hit Enter to see the output.\n\n"}
                    {"Start with a free API key — 1,000 credits, no wallet required.\n\n"}
                    {"Monthly Free Plan: card on file, never charged → skim402.com/pricing\n"}
                    {"Wallet pay (USDC on Base) is optional → skim402.com/wallet"}
                  </span>
                )}
        </div>
        <noscript>
          <div className="skim-noscript-offer">
            <p>Skim turns any URL into clean markdown — no ads, no nav, no noise. $0.002 per read.</p>
            <p>
              <a href="/pricing">Start free — 1,000 credits, no crypto</a>
              {" · "}
              <a href="/wallet">Wallet pay is optional</a>
            </p>
          </div>
        </noscript>
        <div className="skim-receipt">
          <strong>Read Receipt:</strong>
          {state.phase === "done" && (
            <>
              <span>{state.ms} ms</span>
              <span>
                {formatKb(state.originalBytes)} → {formatKb(state.cleanedBytes)} clean
              </span>
              <span>${state.priceUsd.toFixed(3)}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main className="skim-page">
      <SkimBackground />
      <div className="skim-content">
        <SkimNav />

        <section id="top" className="skim-hero">
          <p className="skim-eyebrow">Just skim it...</p>
          <h1 style={{margin:"0 0 8px",color:"#5e6778",fontSize:"44px",fontWeight:700,lineHeight:1.1,letterSpacing:"-.055em",textAlign:"center"}}>Clean markdown for any URL.</h1>
          <p className="skim-proof" style={{textAlign:"center",marginTop:8}}>Free API key · 1,000 credits · no wallet required</p>
          <TrialKeyBox />
          {/* Static CTA — always in server HTML; visible to crawlers, agents, and humans */}
          <div className="skim-hero-offers">
            <a href="/pricing" className="skim-hero-offer-link skim-hero-offer-primary">
              <span className="skim-hero-offer-label">START FREE</span>
              Monthly Free Plan · 1,000 credits · card never charged
            </a>
          </div>
          <p className="skim-hero-unify">
            Wallet pay with USDC on Base is optional —{" "}
            <a href="/wallet">x402 path if you want it</a>.
          </p>
          <HeroDemo />
        </section>

        <section className="skim-features" id="agent-features">
          <div className="skim-features-head">
            <h2>Three things agents ask for.</h2>
            <p>Same free API key as a single read. Wallet pay works too.</p>
          </div>
          <div className="skim-features-grid">
            <a href="/docs#batch" className="skim-feature">
              <span className="skim-feature-kicker">POST /api/t/read/batch</span>
              <h3>Batch reads</h3>
              <p>Up to 10 URLs, clean markdown back per URL. 1 credit per successful read. Partial success is fine.</p>
            </a>
            <a href="/docs#extract" className="skim-feature">
              <span className="skim-feature-kicker">POST /api/t/extract</span>
              <h3>Extract a table</h3>
              <p>URL + a short intent and a JSON schema. Structured rows come back — from the page, never invented. 8 credits.</p>
            </a>
            <a href="/docs#watch" className="skim-feature">
              <span className="skim-feature-kicker">POST /api/t/watch</span>
              <h3>Watch a page</h3>
              <p>Register 1–20 URLs, then poll /watch/diff. 1 credit per successful fetch. Status is free.</p>
            </a>
          </div>
        </section>

        <section className="skim-connect">
          <div className="skim-connect-row">
            <div className="skim-connect-copy"><h2>Get your agent skimming now.</h2><p>Start with a free API key. Skim reads the web so your agent doesn&apos;t have to parse HTML.</p></div>
          </div>
          <p className="skim-github">See the integration code on GitHub → <a href="https://github.com/JessieJanie/skim-tools" style={{color:"rgba(16,19,26,.42)"}}>github.com/JessieJanie/skim-tools</a></p>
        </section>

        <section className="skim-headline">
          <div className="skim-ctas"><a className="skim-btn skim-primary" href="/pricing"><span>Start free</span><span className="skim-keyless">1,000 CREDITS</span></a><a className="skim-btn skim-outline" href="/wallet"><span>Wallet pay</span><span className="skim-keyless">OPTIONAL</span></a></div>
        </section>

        <SkimFooter />
      </div>
    </main>
  );
}
