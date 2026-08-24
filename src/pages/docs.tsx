import { useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type Section = {
  id: string;
  label: string;
};

const sections: Section[] = [
  { id: "auth", label: "Authentication" },
  { id: "quickstart", label: "Quickstart" },
  { id: "fund", label: "Fund your wallet (x402)" },
  { id: "mcp", label: "Use from Claude / Cursor (MCP)" },
  { id: "payment", label: "Payment (x402)" },
  { id: "read", label: "POST /v1/read" },
  { id: "batch", label: "POST /v1/read/batch" },
  { id: "js", label: "POST /v1/read/js" },
  { id: "chunking", label: "RAG chunking" },
  { id: "extract", label: "POST /v1/extract" },
  { id: "presets", label: "Extraction presets" },
  { id: "tables", label: "POST /v1/tables" },
  { id: "dataset", label: "POST /v2/dataset" },
  { id: "crawl", label: "POST /t/crawl" },
  { id: "watch", label: "Custom URL watches" },
  { id: "watch-webhooks", label: "Watch webhooks" },
  { id: "read-pdf", label: "POST /t/read-pdf" },
  { id: "feed", label: "GET /v2/feeds/x402/latest" },
  { id: "signals", label: "Skim Signal series" },
  { id: "card", label: "Pay by card (token auth)" },
  { id: "modes", label: "Reader modes" },
  { id: "errors", label: "Errors" },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-[#161b22] text-zinc-50 rounded-xl p-5 font-mono text-[13px] leading-relaxed overflow-x-auto border border-[#21262d] shadow-sm">
      <code>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-3xl font-bold tracking-tight scroll-mt-24 mt-16 first:mt-0"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xl font-semibold tracking-tight mt-10 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground leading-relaxed">{children}</p>
  );
}

function Field({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-6 py-4 border-b border-border/60 last:border-0">
      <div className="flex items-start gap-2 flex-wrap">
        <code className="font-mono text-sm font-semibold text-foreground">
          {name}
        </code>
        <span className="text-xs text-muted-foreground font-mono">{type}</span>
        {required && (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider"
          >
            required
          </Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// --- API-key (card-plan) quickstart examples ---
function ApiKeyExamples() {
  const [, setActive] = useState("curl");
  return (
    <Tabs defaultValue="curl" className="w-full" onValueChange={setActive}>
      <TabsList>
        <TabsTrigger value="curl">curl</TabsTrigger>
        <TabsTrigger value="js">JavaScript</TabsTrigger>
        <TabsTrigger value="python">Python</TabsTrigger>
      </TabsList>
      <TabsContent value="curl" className="mt-4">
        <Code>
{`# Use your sk402_ key in the Authorization header.
# Token-gated read is a GET — pass the URL as a query parameter.
curl -H "Authorization: Bearer sk402_YOUR_KEY" \\
  "https://skim402.com/api/t/read?url=https://example.com/article"`}
        </Code>
      </TabsContent>
      <TabsContent value="js" className="mt-4">
        <Code>
{`// No extra packages needed — just fetch.
const url = "https://example.com/article";
const res = await fetch(
  \`https://skim402.com/api/t/read?url=\${encodeURIComponent(url)}\`,
  { headers: { Authorization: "Bearer sk402_YOUR_KEY" } },
);
const { markdown } = await res.json();
console.log(markdown);`}
        </Code>
      </TabsContent>
      <TabsContent value="python" className="mt-4">
        <Code>
{`import os, requests

res = requests.get(
    "https://skim402.com/api/t/read",
    headers={"Authorization": f"Bearer {os.environ['SKIM_API_KEY']}"},
    params={"url": "https://example.com/article"},
)
print(res.json()["markdown"])`}
        </Code>
      </TabsContent>
    </Tabs>
  );
}

// --- x402 wallet quickstart examples ---
function WalletExamples() {
  const [, setActive] = useState("curl");
  return (
    <Tabs defaultValue="curl" className="w-full" onValueChange={setActive}>
      <TabsList>
        <TabsTrigger value="curl">curl</TabsTrigger>
        <TabsTrigger value="js">JavaScript</TabsTrigger>
        <TabsTrigger value="python">Python</TabsTrigger>
      </TabsList>
      <TabsContent value="curl" className="mt-4">
        <Code>
{`# 1. First call — server replies 402 Payment Required with x402 instructions.
curl -i -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/article" }'

# 2. Sign and submit payment with the x402 CLI or any x402 client,
#    then retry the same request with the X-PAYMENT header set.
curl -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://example.com/article" }'`}
        </Code>
      </TabsContent>
      <TabsContent value="js" className="mt-4">
        <Code>
{`// npm install x402-axios@1.2.0 viem axios
// (pin 1.2.0 — x402-axios@1.2.1 has a broken dependency and fails to install)
import { withPaymentInterceptor } from "x402-axios";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

// Your agent's wallet — funded with USDC on Base.
const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);

// Axios client that automatically pays 402 responses up to your max.
// Always set a timeout: a stalled payment step can otherwise hang forever.
const skim = withPaymentInterceptor(
  axios.create({ baseURL: "https://skim402.com/api", timeout: 90_000 }),
  wallet,
);

const { data } = await skim.post("/v1/read", {
  url: "https://example.com/article",
});

console.log(data.markdown);`}
        </Code>
      </TabsContent>
      <TabsContent value="python" className="mt-4">
        <Code>
{`# pip install "x402[evm]" requests eth-account
from x402 import x402ClientSync
from x402.client import max_amount
from x402.http.clients.requests import wrapRequestsWithPayment
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.evm.signers import EthAccountSigner
from eth_account import Account
import os, requests

# Your agent's wallet — funded with USDC on Base.
account = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])

# A requests Session that automatically pays 402 responses up to your max.
client = x402ClientSync()
register_exact_evm_client(
    client,
    EthAccountSigner(account),
    # Per-call cap in USDC atomic units (6 decimals). 20_000 = $0.02 covers
    # every Skim endpoint: read $0.002, read/js $0.005, extract $0.015.
    # A lower cap silently filters out pricier endpoints with
    # "All requirements filtered out by policies".
    policies=[max_amount(20_000)],
)
skim = wrapRequestsWithPayment(requests.Session(), client)

res = skim.post(
    "https://skim402.com/api/v1/read",
    json={"url": "https://example.com/article"},
)
print(res.json()["markdown"])`}
        </Code>
      </TabsContent>
    </Tabs>
  );
}


type SignalRow = {
  id: string;
  name: string;
  slug: string;
  sources: string;
  filters: string;
};

const SIGNAL_ROWS: SignalRow[] = [
  { id: "signal-ai-news", name: "AI/tech news", slug: "ai-news", sources: "Hacker News (score-gated), arXiv, vendor announcements", filters: "—" },
  { id: "signal-sec", name: "SEC filings radar", slug: "sec-filings", sources: "SEC EDGAR, with a plain-language meaning tag per form", filters: "forms=" },
  { id: "signal-crypto", name: "Crypto news", slug: "crypto-news", sources: "CoinDesk, Cointelegraph, Decrypt, The Block; asset tags (BTC, ETH, ...)", filters: "—" },
  { id: "signal-macro", name: "Macro & regulators", slug: "macro", sources: "Federal Reserve and SEC press releases", filters: "—" },
  { id: "signal-security", name: "Security advisories", slug: "security", sources: "CISA advisories, CVE ids extracted as entities", filters: "—" },
  { id: "signal-regulations", name: "US regulations", slug: "regulations", sources: "Federal Register: rules, proposed rules, presidential documents", filters: "—" },
  { id: "signal-courts", name: "US courts", slug: "courts", sources: "CourtListener: SCOTUS + 13 federal appellate courts, published opinions", filters: "—" },
  { id: "signal-recalls", name: "Product recalls", slug: "recalls", sources: "CPSC and FDA recalls, hazard/product tags", filters: "—" },
  { id: "signal-deals", name: "Deals", slug: "deals", sources: "Slickdeals frontpage, DealNews; price/retailer/category tags", filters: "categories=" },
  { id: "signal-launches", name: "Product launches", slug: "launches", sources: "Product Hunt: name, tagline, maker", filters: "—" },
  { id: "signal-trending", name: "Trending searches", slug: "trending", sources: "Google Trends (US): query, approx volume, driving stories", filters: "—" },
  { id: "signal-research", name: "Research papers", slug: "research", sources: "arXiv across 8 fields; abstract excerpts, authors, PDF links", filters: "fields=" },
  { id: "signal-energy", name: "Energy", slug: "energy", sources: "EIA Today in Energy + press room; commodity tags", filters: "—" },
  { id: "signal-entertainment", name: "Entertainment", slug: "entertainment", sources: "Deadline, Variety, THR, TheWrap; studio/streamer/guild tags", filters: "—" },
  { id: "signal-studio-jobs", name: "Studio jobs", slug: "studio-jobs", sources: "Studio ATS APIs (Netflix, WBD, Disney, Amazon MGM, NBCU); weekly AI/content-ops posting counts", filters: "—" },
  { id: "signal-campaign-finance", name: "Campaign finance", slug: "campaign-finance", sources: "FEC electronic filings; plain-language meaning per form type", filters: "forms=, committees=" },
  { id: "signal-film-incentives", name: "Film incentives", slug: "film-incentives", sources: "California Film Commission, Texas Governor press, per-state incentive press coverage; state tags", filters: "states=" },
];

export default function Docs() {
  useDocumentMeta({
    title: "Docs — reads, Signals, crawl, PDF, and more | Skim",
    description:
      "Complete Skim API docs: reads, crawl, PDF-to-markdown, watch webhooks, extraction, tables, datasets, and Signals. Pay with a card-plan API key or per-call in USDC over x402.",
    canonical: "https://skim402.com/docs",
  });

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              API Reference
            </p>
            <nav className="flex flex-col gap-1 text-sm">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors py-1.5"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0">
            <div className="mb-12">
              <Badge variant="secondary" className="mb-3">
                v2
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Skim API documentation
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Turn any URL into clean, agent-ready markdown with one HTTP
                request. Two ways to authenticate and pay.
              </p>
            </div>

            {/* ── Authentication ─────────────────────────────────────── */}
            <H2 id="auth">Authentication</H2>
            <P>
              Skim supports two authentication and billing paths. Pick the one
              that matches how you're building.
            </P>

            {/* Auth comparison table */}
            <div className="mt-6 mb-8 overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-foreground w-1/3">Method</th>
                    <th className="text-left px-5 py-3 font-semibold text-foreground w-1/3">Best for</th>
                    <th className="text-left px-5 py-3 font-semibold text-foreground w-1/3">How it works</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="px-5 py-4 font-mono text-foreground font-semibold">API key<br/><span className="font-normal text-muted-foreground text-xs">sk402_…</span></td>
                    <td className="px-5 py-4 text-muted-foreground">Default path. Humans, teams, and agents. Free key or monthly card plan.</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <Link href="/pricing" className="text-primary hover:underline">Get a plan</Link> → receive an <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">sk402_</code> key → send it as <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer sk402_…</code> on <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/t/</code> endpoints. Credits deducted per call.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-mono text-foreground font-semibold">x402 wallet<br/><span className="font-normal text-muted-foreground text-xs">USDC on Base</span></td>
                    <td className="px-5 py-4 text-muted-foreground">Optional. Autonomous agents that already hold USDC on Base.</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <Link href="/wallet" className="text-primary hover:underline">Fund a Base wallet</Link> with USDC → use an x402-aware HTTP client → it pays each 402 response automatically. $0.002 per read, settled on-chain.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <P>
              The token-gated endpoints (<code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/read</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/read/js</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/read/batch</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/extract</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/crawl</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/watch</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/t/read-pdf</code>) require an API key and use credit billing. The x402 endpoints (<code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/v1/read</code>, <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/v1/read/js</code>, etc.) require no key — each call is paid in USDC at the moment it succeeds.
            </P>

            {/* ── Quickstart ─────────────────────────────────────────── */}
            <H2 id="quickstart">Quickstart</H2>

            <H3>API key path — start here</H3>
            <P>
              Create a free key on the <Link href="/" className="text-primary hover:underline">homepage</Link> (1,000 credits, no wallet) or <Link href="/pricing" className="text-primary hover:underline">Start free</Link> on the monthly Free Plan (card on file, never charged). You'll get an <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">sk402_</code> API key. Pass it in the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header on every request to the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/t/</code> endpoints.
            </P>
            <ApiKeyExamples />

            <H3>x402 wallet path — optional, per-call USDC</H3>
            <P>
              Prefer not to hold an API key? Skim is also built on{" "}
              <a
                className="text-primary hover:underline"
                href="https://x402.org"
                target="_blank"
                rel="noreferrer"
              >
                x402
              </a>
              — an open HTTP 402 payment protocol. This path is optional. Fund a
              wallet with USDC on Base and point any x402-aware HTTP client at
              the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/v1/</code> endpoints.
            </P>
            <WalletExamples />

            <P>
              Not writing the code yourself? These docs are written to be read
              by AI agents — hand this page to yours and ask it to create a
              free API key and wire up <InlineCode>/api/t/read</InlineCode>.
              Wallet pay is optional if it already has USDC on Base.
            </P>
            <P>
              Want to see the output first?{" "}
              <a
                className="text-primary hover:underline font-medium"
                href="https://freeskims.skim402.com"
                target="_blank"
                rel="noreferrer"
              >
                Try Skim free in your browser
              </a>{" "}
              — 10 free skims a day, no wallet, no signup.
            </P>

            <H2 id="fund">Fund your wallet (x402 path)</H2>
            <P>
              This section applies to the x402 wallet path. If you're using an
              API key from a card plan, skip ahead — no wallet needed.
            </P>
            <P>
              Your wallet is your identity on the x402 path. Pay $0.002, get
              one clean read. That's the whole contract. To pay, your client
              needs a Base wallet with a little USDC in it — three steps.
            </P>

            <H3>1. Create a fresh wallet</H3>
            <P>
              Use a new wallet, not your personal one. It only ever spends —
              if a key leaks, the worst case is someone burning your read
              budget. Generate one in code:
            </P>
            <Code>
{`import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("Address:    ", account.address);
console.log("Private key:", privateKey); // save this somewhere safe`}
            </Code>
            <P>
              Or open Coinbase Wallet, hit "Create new wallet," save the seed
              phrase, and export the private key. Whichever you prefer.
            </P>

            <H3>2. Send it USDC on Base</H3>
            <P>
              Any source works. Coinbase exchange, a DEX, a bridge from
              another chain. Send to the address you just generated, on the
              Base network. A dollar funds about 500 basic reads.
            </P>
            <P>
              USDC contract on Base:{" "}
              <InlineCode>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</InlineCode>
              .
            </P>

            <H3>3. Paste the key into your env</H3>
            <Code>
{`# .env
AGENT_PRIVATE_KEY=0x...          # for the API code samples above
SKIM_WALLET_PRIVATE_KEY=0x...    # for the MCP server below`}
            </Code>
            <P>
              The key never leaves your machine. Your x402 client uses it
              locally to sign EIP-3009 USDC payment authorizations. Skim's
              facilitator settles each authorization on chain after the read
              succeeds. We never see the key. We never need it.
            </P>
            <P>
              Set a ceiling per call so a buggy agent can't drain the wallet:
              the MCP server exposes <InlineCode>SKIM_MAX_PRICE_USD</InlineCode>
              {" "}(default <InlineCode>0.01</InlineCode>), and most x402
              clients accept a max-payment argument. Skim's current price is
              well under that.
            </P>

            <H2 id="mcp">Use from Claude / Cursor (MCP)</H2>
            <P>
              Don&apos;t want a wallet? Skip this section. Create a free{" "}
              <InlineCode>sk402_</InlineCode> key on the{" "}
              <Link href="/" className="text-primary hover:underline">
                homepage
              </Link>{" "}
              (1,000 credits) and call{" "}
              <InlineCode>GET /api/t/read</InlineCode> with{" "}
              <InlineCode>Authorization: Bearer sk402_…</InlineCode> — see{" "}
              <a href="#quickstart" className="text-primary hover:underline">
                Quickstart
              </a>
              . The hosted remote MCP at{" "}
              <InlineCode>https://skim402.com/api/mcp</InlineCode> also works
              on a shared free tier with no wallet.
            </P>
            <P>
              The local <InlineCode>skim-mcp</InlineCode> server is the optional
              x402 path. It wraps Skim&apos;s <InlineCode>/v1/read</InlineCode>{" "}
              endpoint, signs each payment from a Base wallet, and exposes a
              single <InlineCode>read_url</InlineCode> tool. That path still
              uses <InlineCode>SKIM_WALLET_PRIVATE_KEY</InlineCode> — a fresh
              wallet with a little USDC, not your personal one. A dollar funds
              ~500 reads.
            </P>

            <H3>Remote connector (no install)</H3>
            <P>
              Skim also runs a hosted remote MCP server at{" "}
              <InlineCode>https://skim402.com/api/mcp</InlineCode> (Streamable
              HTTP). Add it as a custom connector in Claude — or any MCP client
              that speaks Streamable HTTP — and you get three tools:{" "}
              <InlineCode>skim_read</InlineCode>,{" "}
              <InlineCode>skim_extract</InlineCode>, and{" "}
              <InlineCode>skim_signals</InlineCode>.
            </P>
            <P>
              With no configuration, <InlineCode>skim_read</InlineCode> works
              on a shared, rate-limited free tier. To unlock unmetered reads
              plus structured extraction and signal feeds, add a request
              header named <InlineCode>X-Skim-Wallet-Key</InlineCode> set to a
              Base wallet private key holding a little USDC — the server signs
              each x402 payment from your wallet, per call, and never stores
              the key. Use a fresh, low-balance wallet dedicated to agent
              spending, not your personal one.
            </P>
            <P>
              Prefer to pay by card instead of a crypto wallet? The same
              reader is available as{" "}
              <a
                href="https://apify.com/jessiejanie/skim-clean-reader"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Skim Clean Reader on Apify
              </a>{" "}
              — card billing on Apify's side, same clean Markdown out.
              Apify's free plan even includes $5 of monthly platform credit,
              which covers up to ~1,250 Skim reads a month at no cost.
            </P>

            <H3>Connect in Grok</H3>
            <P>
              Grok supports remote MCP servers out of the box — no install and
              no approval step. In Grok, open{" "}
              <strong>Settings → Connectors → Add connector → Bring your own
              MCP</strong> (or the equivalent custom-connector option), paste{" "}
              <InlineCode>https://skim402.com/api/mcp</InlineCode> as the server
              URL, and save. <InlineCode>skim_read</InlineCode> works
              immediately on the free tier; add the optional{" "}
              <InlineCode>X-Skim-Wallet-Key</InlineCode> header (as above) to
              unlock unmetered reads, extraction, and signal feeds.
            </P>

            <H3>Install in Claude Desktop</H3>
            <P>
              Edit{" "}
              <InlineCode>
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </InlineCode>{" "}
              on macOS or{" "}
              <InlineCode>%APPDATA%\Claude\claude_desktop_config.json</InlineCode>{" "}
              on Windows:
            </P>
            <Code>
{`{
  "mcpServers": {
    "skim": {
      "command": "npx",
      "args": ["-y", "skim-mcp"],
      "env": {
        "SKIM_WALLET_PRIVATE_KEY": "0xYOUR_BASE_WALLET_PRIVATE_KEY"
      }
    }
  }
}`}
            </Code>
            <P>
              Restart Claude Desktop. You'll see a new{" "}
              <InlineCode>read_url</InlineCode> tool. Ask Claude to read any
              article and it'll fetch it through Skim and pay automatically.
            </P>

            <H3>Install in Cursor</H3>
            <P>
              Edit <InlineCode>~/.cursor/mcp.json</InlineCode> (or use the
              in-app <strong>Settings → MCP</strong> panel) with the same JSON
              block as above.
            </P>

            <H3>Install in Codex</H3>
            <P>
              OpenAI's Codex CLI uses a TOML config instead of JSON. Add this to{" "}
              <InlineCode>~/.codex/config.toml</InlineCode>:
            </P>
            <Code>
{`[mcp_servers.skim]
command = "npx"
args = ["-y", "skim-mcp"]
env = { "SKIM_WALLET_PRIVATE_KEY" = "0xYOUR_BASE_WALLET_PRIVATE_KEY" }`}
            </Code>
            <P>
              Restart Codex. The <InlineCode>read_url</InlineCode> tool becomes
              available and Codex pays per read automatically through your wallet.
            </P>

            <H3>Install in Cline / Continue / Zed / other MCP clients</H3>
            <P>
              All MCP-compatible clients use the same shape. Run the binary as{" "}
              <InlineCode>npx -y skim-mcp</InlineCode> with{" "}
              <InlineCode>SKIM_WALLET_PRIVATE_KEY</InlineCode> set in the
              environment. See your client's MCP server config docs for the
              exact JSON location.
            </P>

            <H3>Environment variables</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="SKIM_WALLET_PRIVATE_KEY" type="string" required>
                Hex private key for the Base wallet that pays for reads. With
                or without <InlineCode>0x</InlineCode> prefix. Never leaves
                your machine — only used locally to sign EIP-3009 payment
                authorizations.
              </Field>
              <Field name="SKIM_MAX_PRICE_USD" type="string">
                Maximum USD per call. Default <InlineCode>0.01</InlineCode>.
                Caps how much the wallet will sign for in a single read. Skim
                is currently $0.002/call, well under this.
              </Field>
              <Field name="SKIM_API_URL" type="string">
                Override the API base URL. Default{" "}
                <InlineCode>https://skim402.com</InlineCode>. Mostly useful
                for local development.
              </Field>
            </div>

            <H3>Links</H3>
            <P>
              <a
                className="text-primary hover:underline"
                href="https://www.npmjs.com/package/skim-mcp"
                target="_blank"
                rel="noreferrer"
              >
                skim-mcp on npm
              </a>{" "}
              ·{" "}
              <a
                className="text-primary hover:underline"
                href="https://github.com/JessieJanie/skim402"
                target="_blank"
                rel="noreferrer"
              >
                Source on GitHub
              </a>{" "}
              ·{" "}
              <a
                className="text-primary hover:underline"
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noreferrer"
              >
                Model Context Protocol
              </a>
            </P>

            <H2 id="payment">Payment (x402)</H2>
            <P>
              The first request from an unpaid client returns{" "}
              <InlineCode>402 Payment Required</InlineCode> with a JSON body
              describing the payment requirement — amount, asset (USDC),
              network (Base), and recipient address. An x402 client signs the
              payment, submits it to a facilitator, and retries the request
              with the <InlineCode>X-PAYMENT</InlineCode> header.
            </P>
            <H3>Example 402 response</H3>
            <Code>
{`HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "2000",
      "resource": "https://skim402.com/api/v1/read",
      "description": "Skim: clean reader — URL to markdown + metadata",
      "mimeType": "application/json",
      "payTo": "0x...",
      "maxTimeoutSeconds": 60,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  ]
}`}
            </Code>
            <H3>Supported clients</H3>
            <P>
              Skim works with any x402-compliant client, including{" "}
              <InlineCode>x402-axios</InlineCode>,{" "}
              <InlineCode>x402-fetch</InlineCode>, the Python{" "}
              <InlineCode>x402</InlineCode> SDK, Coinbase's AgentKit,
              Anthropic's MCP x402 connector, and the Vercel AI SDK x402
              integration.
            </P>
            <H3>Framework integrations</H3>
            <P>
              Ready-made connectors are published for the major agent
              frameworks — each wraps the paid read as a native tool, with the
              wallet key supplied via{" "}
              <InlineCode>SKIM_WALLET_PRIVATE_KEY</InlineCode>:
            </P>
            <P>
              <strong>LangChain</strong> —{" "}
              <InlineCode>pip install langchain-skim</InlineCode>{" "}
              (<InlineCode>from langchain_skim import SkimReader</InlineCode>).{" "}
              <strong>CrewAI</strong> —{" "}
              <InlineCode>pip install crewai-skim</InlineCode>.{" "}
              <strong>LlamaIndex</strong> —{" "}
              <InlineCode>pip install llama-index-readers-skim</InlineCode>.{" "}
              <strong>Haystack</strong> —{" "}
              <InlineCode>pip install skim-haystack</InlineCode>.{" "}
              <strong>Mastra (TypeScript)</strong> —{" "}
              <InlineCode>npm install mastra-skim</InlineCode>. Runnable
              examples for every framework live in the{" "}
              <a
                href="https://github.com/JessieJanie/skim-tools"
                target="_blank"
                rel="noopener"
                className="text-primary hover:underline"
              >
                skim-tools hub
              </a>
              .
            </P>

            <H2 id="read">POST /v1/read</H2>
            <P>Fetches a URL and returns clean markdown plus structured metadata.</P>

            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                The URL to fetch. Must be an absolute{" "}
                <InlineCode>http(s)://</InlineCode> URL. Private, loopback, and
                link-local addresses are rejected (SSRF protection).
              </Field>
              <Field name="mode" type="enum">
                Only <InlineCode>basic</InlineCode> is accepted on this
                endpoint (and it's the default — you can omit the field).
                JavaScript-rendered pages use the separate{" "}
                <a href="#js" className="text-primary hover:underline">
                  /v1/read/js
                </a>{" "}
                endpoint; schema-typed JSON uses{" "}
                <a href="#extract" className="text-primary hover:underline">
                  /v1/extract
                </a>
                . See{" "}
                <a href="#modes" className="text-primary hover:underline">
                  Reader modes
                </a>{" "}
                for the full breakdown.
              </Field>
              <Field name="stripLinks" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. When{" "}
                <InlineCode>true</InlineCode>, link markup is flattened to its
                anchor text — <InlineCode>[label](url)</InlineCode> becomes{" "}
                <InlineCode>label</InlineCode> — so link-heavy pages (wikis,
                reference articles) return far smaller markdown. Headings, lists,
                and code blocks are untouched.
              </Field>
              <Field name="stripImages" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. When{" "}
                <InlineCode>true</InlineCode>, image markup (
                <InlineCode>![alt](url)</InlineCode>) is removed entirely. Set
                both flags for the leanest markdown. The plain{" "}
                <InlineCode>text</InlineCode> field is never affected by either
                flag.
              </Field>
              <Field name="chunked" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. When{" "}
                <InlineCode>true</InlineCode>, the response additionally
                includes a <InlineCode>chunks</InlineCode> array — the markdown
                pre-split into RAG-ready sections along heading boundaries, so
                you can feed them straight into an embedding pipeline without
                writing your own splitter. Free — the price doesn't change. See{" "}
                <a href="#chunking" className="text-primary hover:underline">
                  RAG chunking
                </a>{" "}
                below.
              </Field>
            </div>

            <H3>Response</H3>
            <Code>
{`{
  "url": "https://example.com/article",
  "finalUrl": "https://example.com/article",
  "mode": "basic",
  "markdown": "# How agents read the web\\n\\nThe modern web is a mess...",
  "text": "How agents read the web. The modern web is a mess...",
  "metadata": {
    "title": "How agents read the web",
    "byline": "Jane Doe",
    "siteName": "Example",
    "publishedAt": "2025-08-15T00:00:00Z",
    "excerpt": "Why clean reader APIs matter for autonomous agents.",
    "lang": "en",
    "length": 4821
  },
  "fetchedAt": "2026-05-16T18:42:11Z",
  "receipt": {
    "contentHash": "8a8856e6f88a78fc…",
    "markdownHash": "f2017f4e043054d4…",
    "tokensEst": 1206,
    "redirects": [],
    "cacheHit": false,
    "cacheAgeSeconds": 0
  }
}`}
            </Code>
            <P>
              Skim follows redirects (with re-validation at every hop).{" "}
              <InlineCode>finalUrl</InlineCode> is the URL that was actually
              read after redirects — if it differs from the{" "}
              <InlineCode>url</InlineCode> you requested, you were redirected.
              Agents that cite sources should compare the two and cite{" "}
              <InlineCode>finalUrl</InlineCode>.
            </P>
            <P>
              When a read succeeds but the result looks suspicious, the
              response also carries a <InlineCode>warnings</InlineCode> array
              (omitted otherwise). Each entry has a machine-readable{" "}
              <InlineCode>code</InlineCode> and a human-readable{" "}
              <InlineCode>message</InlineCode>. The only current code is{" "}
              <InlineCode>THIN_CONTENT</InlineCode>: extraction produced fewer
              than 100 words, which usually means a JS app shell, login wall,
              or paywall rather than a real article. Treat flagged results as
              low confidence — for basic reads, retrying with{" "}
              <InlineCode>mode: "js"</InlineCode> may recover pages that need
              JavaScript.
            </P>
            <H3>Read receipt</H3>
            <P>
              Every read carries a <InlineCode>receipt</InlineCode> block so an
              agent can reuse or dedupe reads without re-fetching:
            </P>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="contentHash" type="string">
                SHA-256 of the extracted <InlineCode>text</InlineCode>. Stable
                across <InlineCode>stripLinks</InlineCode> /{" "}
                <InlineCode>stripImages</InlineCode> — compare it across reads
                to know whether a page actually changed, without diffing full
                text.
              </Field>
              <Field name="markdownHash" type="string">
                SHA-256 of the <InlineCode>markdown</InlineCode> returned in
                this response, computed after any lean stripping — it always
                matches the payload you received.
              </Field>
              <Field name="tokensEst" type="integer">
                Rough token estimate of the returned markdown (characters / 4),
                for context budgeting.
              </Field>
              <Field name="redirects" type="string[]">
                Redirect hop URLs followed after the requested URL, in order.
                Empty when the page served directly. JS-rendered reads always
                report an empty array — the browser renderer doesn't expose
                its redirect chain.
              </Field>
              <Field name="cacheHit" type="boolean">
                Whether this response came from Skim's short-TTL cache rather
                than a fresh fetch — the JSON twin of the{" "}
                <InlineCode>X-Cache</InlineCode> header.
              </Field>
              <Field name="cacheAgeSeconds" type="integer">
                Seconds since the underlying fetch when served from cache;{" "}
                <InlineCode>0</InlineCode> on fresh fetches. With the default
                60-second TTL, this never exceeds 60.
              </Field>
            </div>
            <H3>Response headers</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="X-Cache" type="string">
                <InlineCode>HIT</InlineCode> if the response was served from
                Skim's 60-second in-memory cache, <InlineCode>MISS</InlineCode>{" "}
                otherwise. Cache keys include the URL and mode; payment is
                still required on cache hits (caching saves latency and our
                upstream cost, not the wallet).
              </Field>
              <Field name="X-Payment-Response" type="string">
                Base64-encoded settlement receipt from the x402 facilitator,
                emitted on 2xx after payment settles.
              </Field>
              <Field name="X-Skim-Fallback" type="string">
                Set to <InlineCode>js</InlineCode> when a basic{" "}
                <InlineCode>/v1/read</InlineCode> came back empty and Skim
                transparently re-rendered the page in a real browser. You still
                pay only the basic <InlineCode>$0.002</InlineCode> rate — the
                browser render is on us. The response{" "}
                <InlineCode>mode</InlineCode> field also reads{" "}
                <InlineCode>"js"</InlineCode> in that case.
              </Field>
            </div>

            <H2 id="batch">POST /v1/read/batch</H2>
            <P>
              Reads up to 10 URLs in a single paid call. Each URL is fetched
              concurrently (capped at 5 in-flight). One x402 payment covers the
              whole batch — priced at 10x the per-call rate (
              <InlineCode>$0.020</InlineCode>), so it's the same per URL when
              you actually use 10, and saves your agent from signing 10
              separate payments.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="urls" type="string[]" required>
                Array of 1–10 absolute <InlineCode>http(s)://</InlineCode> URLs.
                Same SSRF protections as <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="mode" type="enum">
                Only <InlineCode>basic</InlineCode> is supported on batch in
                v1. For <InlineCode>js</InlineCode> or{" "}
                <InlineCode>structured</InlineCode> reads, call{" "}
                <InlineCode>/v1/read</InlineCode> or{" "}
                <InlineCode>/v1/extract</InlineCode> per URL.
              </Field>
              <Field name="stripLinks" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. Applies to
                every result in the batch — same behavior as on{" "}
                <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="stripImages" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. Applies to
                every result in the batch.
              </Field>
              <Field name="chunked" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. When{" "}
                <InlineCode>true</InlineCode>, every successful item includes a{" "}
                <InlineCode>chunks</InlineCode> array — see{" "}
                <a href="#chunking" className="text-primary hover:underline">
                  RAG chunking
                </a>
                . Free.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/read/batch \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{
    "urls": [
      "https://example.com/article-1",
      "https://example.com/article-2",
      "https://example.com/article-3"
    ]
  }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "results": [
    {
      "url": "https://example.com/article-1",
      "ok": true,
      "data": { /* same shape as /v1/read result */ },
      "error": null
    },
    {
      "url": "https://example.com/article-2",
      "ok": false,
      "data": null,
      "error": { "status": 422, "message": "Upstream responded 404" }
    },
    {
      "url": "https://example.com/article-3",
      "ok": true,
      "data": { /* ... */ },
      "error": null
    }
  ],
  "fetchedAt": "2026-05-22T10:14:02Z"
}`}
            </Code>
            <H3>Partial failures and refunds</H3>
            <P>
              Per-URL failures (bad URL, paywall, JS-only page) are surfaced
              inside the <InlineCode>results</InlineCode> array — they do not
              fail the whole batch, and you still pay for the batch as a
              whole. If <em>every</em> URL in the batch fails, the endpoint
              returns <InlineCode>422</InlineCode> and the x402 facilitator
              skips settlement entirely — your wallet is untouched.
            </P>

            <H2 id="js">POST /v1/read/js</H2>
            <P>
              Same idea as <InlineCode>/v1/read</InlineCode>, but the page is
              rendered with a real headless browser before extraction. Use
              this for SPAs, React/Vue/Svelte apps, and pages whose content
              is injected after initial load.
            </P>
            <P>
              Priced at <InlineCode>$0.005</InlineCode> per render (vs
              <InlineCode>$0.002</InlineCode> for basic) because each call
              uses upstream browser time. Output shape is identical to{" "}
              <InlineCode>/v1/read</InlineCode>, with{" "}
              <InlineCode>mode: "js"</InlineCode> in the response.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                The URL to render. Same{" "}
                <InlineCode>http(s)://</InlineCode> and SSRF rules as{" "}
                <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="stripLinks" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. Same
                behavior as on <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="stripImages" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. Same
                behavior as on <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="chunked" type="boolean">
                Optional, defaults to <InlineCode>false</InlineCode>. Adds a{" "}
                <InlineCode>chunks</InlineCode> array of RAG-ready sections —
                see{" "}
                <a href="#chunking" className="text-primary hover:underline">
                  RAG chunking
                </a>
                . Free.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/read/js \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://my-spa.example.com/dashboard" }'`}
            </Code>
            <H3>When to use it (and when not to)</H3>
            <P>
              Try <InlineCode>/v1/read</InlineCode> first — it's 2.5x cheaper
              and works on the majority of the web (blogs, docs, news, most
              marketing sites). Only fall back to{" "}
              <InlineCode>/v1/read/js</InlineCode> when basic returns{" "}
              <InlineCode>422 No readable content</InlineCode> on a page you
              know is real. Common JS-rendered targets: React/Next.js
              dashboards, Twitter/X profiles, LinkedIn pages, Notion public
              pages.
            </P>

            <H2 id="chunking">RAG chunking</H2>
            <P>
              Every read endpoint (<InlineCode>/v1/read</InlineCode>,{" "}
              <InlineCode>/v1/read/js</InlineCode>,{" "}
              <InlineCode>/v1/read/batch</InlineCode>, and their v2
              counterparts) accepts an optional{" "}
              <InlineCode>chunked: true</InlineCode> flag. When set, the
              response additionally carries a <InlineCode>chunks</InlineCode>{" "}
              array: the markdown pre-split into embedding-ready sections, so
              a RAG ingestion pipeline can skip its own text splitter and go
              straight from one paid call to vectors. It's free — the price of
              the read doesn't change.
            </P>
            <H3>How Skim splits</H3>
            <P>
              Chunks follow the document's own structure: the markdown is
              split at heading boundaries (code-fence aware — a{" "}
              <InlineCode>#</InlineCode> inside a code block is never treated
              as a heading, and a code block is never cut in half). Tiny
              sections are merged into their neighbor so heading-dense pages
              don't produce confetti; very long sections are split at
              paragraph boundaries at roughly 500 words, in which case
              consecutive chunks share the same heading. Concatenating every
              chunk's markdown reproduces the full document up to whitespace
              normalization — no words are ever added, dropped, or reordered.
            </P>
            <H3>Chunk shape</H3>
            <Code>
{`{
  "chunks": [
    {
      "index": 3,
      "heading": "3xx redirection",
      "path": ["Standard codes"],
      "markdown": "### 3xx redirection\\n\\nThis class of status code...",
      "wordCount": 421,
      "approxTokens": 988
    }
  ]
}`}
            </Code>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="index" type="integer">
                Zero-based position in document order.
              </Field>
              <Field name="heading" type="string | null">
                The section's own heading text, or{" "}
                <InlineCode>null</InlineCode> for content before the first
                heading.
              </Field>
              <Field name="path" type="string[]">
                Breadcrumb of ancestor headings, outermost first, not
                including the chunk's own heading. Prepend it to the chunk
                text before embedding — retrieval quality improves when each
                chunk carries its place in the document.
              </Field>
              <Field name="markdown" type="string">
                The chunk's markdown, including its heading line. Reflects any{" "}
                <InlineCode>stripLinks</InlineCode> /{" "}
                <InlineCode>stripImages</InlineCode> flags you set.
              </Field>
              <Field name="wordCount" type="integer">
                Word count of the chunk.
              </Field>
              <Field name="approxTokens" type="integer">
                Rough token estimate (characters / 4) for budgeting embedding
                calls. Approximate by design.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://example.com/long-article", "chunked": true }'`}
            </Code>
            <P>
              The regular <InlineCode>markdown</InlineCode>,{" "}
              <InlineCode>text</InlineCode>, and{" "}
              <InlineCode>metadata</InlineCode> fields are unchanged —{" "}
              <InlineCode>chunks</InlineCode> is purely additive, and omitted
              entirely when the flag is off.
            </P>

            <H2 id="extract">POST /v1/extract</H2>
            <P>
              Takes a URL plus a JSON Schema and returns schema-conforming
              JSON. Skim fetches and cleans the page the same way{" "}
              <InlineCode>/v1/read</InlineCode> does, then sends the markdown
              and your schema to an LLM (Anthropic Haiku 4.5 by default) via
              tool-use, which constrains the output to match your schema.
              No client-side parsing or validation — the returned{" "}
              <InlineCode>data</InlineCode> is guaranteed to conform.
            </P>
            <P>
              The extraction runs only over the cleaned page content — not
              over the model's training data. If a field isn't on the page,
              the model leaves it out (or null) instead of filling in what
              it "knows." That makes the JSON trustworthy as a faithful
              read of the URL you pointed at, which is what you want when
              you're populating a CRM, building a tracker, or feeding a RAG
              index — the source of every value is the page itself.
            </P>
            <P>
              Priced at <InlineCode>$0.015</InlineCode> per call (roughly
              7.5x basic read) because each request pays both the fetch and
              the extraction model. Failures (bad URL, no readable content,
              model refusal) return 4xx and the x402 facilitator skips
              settlement — you don't pay for an empty extract.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                The URL to fetch. Same{" "}
                <InlineCode>http(s)://</InlineCode> and SSRF rules as{" "}
                <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="schema" type="object" required>
                A JSON Schema object describing the output shape. Must
                have <InlineCode>type: "object"</InlineCode> at the top
                level. Nested types, enums, required fields, and{" "}
                <InlineCode>description</InlineCode>s on properties are
                all respected by the model.
              </Field>
              <Field name="instructions" type="string">
                Optional natural-language hint (e.g. "Only quote dollar
                figures from the article body, not the footer"). The
                schema is the primary contract — this is advisory.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/extract \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{
    "url": "https://www.theverge.com/2024/anthropic-funding",
    "schema": {
      "type": "object",
      "properties": {
        "company":      { "type": "string" },
        "amount_usd":   { "type": "number" },
        "round":        { "type": "string", "enum": ["seed","series-a","series-b","series-c","series-d","series-e","other"] },
        "lead_investor":{ "type": "string" },
        "announced_on": { "type": "string", "format": "date" }
      },
      "required": ["company", "amount_usd"]
    }
  }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "url": "https://www.theverge.com/2024/anthropic-funding",
  "finalUrl": "https://www.theverge.com/2024/anthropic-funding",
  "data": {
    "company": "Anthropic",
    "amount_usd": 4000000000,
    "round": "other",
    "lead_investor": "Amazon",
    "announced_on": "2024-03-27"
  },
  "schema": { "...": "echo of the schema you sent" },
  "source": {
    "metadata": { "title": "...", "byline": "...", "publishedAt": "..." },
    "readerCacheHit": false,
    "markdownBytes": 8142,
    "truncated": false
  },
  "model": "claude-haiku-4-5",
  "fetchedAt": "2026-05-22T14:11:03Z"
}`}
            </Code>
            <H3>When to use it (and when not to)</H3>
            <P>
              Use <InlineCode>/v1/extract</InlineCode> when your pipeline
              needs typed data, not prose — populating a CRM, building a
              tracker, indexing for RAG with structured filters. If you
              just need clean markdown for an LLM to read inline, use{" "}
              <InlineCode>/v1/read</InlineCode> — it's 7.5x cheaper and
              gives the LLM the full article. Markdown longer than 20,000
              characters is truncated before extraction; the{" "}
              <InlineCode>source.truncated</InlineCode> flag in the
              response tells you when that happened.
            </P>

            <H2 id="presets">Extraction presets</H2>
            <P>
              Six built-in schemas for the most common extraction shapes, so
              your agent doesn't have to write a JSON Schema at all. Same
              pipeline, price (<InlineCode>$0.015</InlineCode>), and
              no-pay-on-failure contract as{" "}
              <InlineCode>/v1/extract</InlineCode> — the only difference is
              that the schema is baked in and echoed back in the response's{" "}
              <InlineCode>schema</InlineCode> field.
            </P>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="/v1/extract/article" type="POST">
                Title, author, published date, summary, key points, language.
              </Field>
              <Field name="/v1/extract/product" type="POST">
                Name, brand, current price, currency, availability, rating,
                review count.
              </Field>
              <Field name="/v1/extract/job" type="POST">
                Title, company, location, remote flag, employment type, salary
                bounds (only if stated), requirements.
              </Field>
              <Field name="/v1/extract/review" type="POST">
                Item name, rating and scale, author, verdict, pros, cons.
              </Field>
              <Field name="/v1/extract/event" type="POST">
                Name, start/end dates, venue, city, country, organizer, ticket
                price.
              </Field>
              <Field name="/v1/extract/table" type="POST">
                Every data table on the page as headers + rows — CSV-ready.
                Layout tables are skipped.
              </Field>
            </div>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                The URL to fetch. Same{" "}
                <InlineCode>http(s)://</InlineCode> and SSRF rules as{" "}
                <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="instructions" type="string">
                Optional hint to bias the extraction within the preset's
                schema (e.g. "prices are in the comparison table, not the
                hero banner"). Advisory only.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/extract/product \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://example.com/products/field-notebook" }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "url": "https://example.com/products/field-notebook",
  "finalUrl": "https://example.com/products/field-notebook",
  "data": {
    "name": "Field Notebook, A5 Dot Grid",
    "brand": "Example Paper Co",
    "price": 14.5,
    "currency": "USD",
    "availability": "in stock",
    "rating": 4.7,
    "reviewCount": 312,
    "description": "A5 notebook with 120gsm dot-grid paper."
  },
  "schema": { "...": "the preset's JSON Schema, echoed" },
  "source": {
    "metadata": { "title": "...", "siteName": "..." },
    "readerCacheHit": false,
    "markdownBytes": 6210,
    "truncated": false
  },
  "model": "claude-haiku-4-5",
  "fetchedAt": "2026-07-13T10:20:00Z"
}`}
            </Code>
            <P>
              Use a preset when your target fits one of the six shapes; drop
              down to <InlineCode>/v1/extract</InlineCode> with your own
              schema when it doesn't. Values come only from the page — fields
              the page doesn't state come back null or omitted, never
              invented.
            </P>

            <H2 id="tables">POST /v1/tables</H2>
            <P>
              Deterministic table extraction: every genuine HTML table on a
              page, parsed mechanically into structured JSON — no LLM
              involved. <InlineCode>$0.003</InlineCode> per page, one-fifth
              the price of the AI-powered{" "}
              <InlineCode>/v1/extract/table</InlineCode> preset. Don't pay
              LLM rates for non-LLM work: if the data is already in{" "}
              <InlineCode>&lt;table&gt;</InlineCode> markup, this endpoint
              gets it out faster, cheaper, and with zero hallucination risk.
            </P>
            <P>
              Each table comes back four ways at once: a{" "}
              <InlineCode>headers</InlineCode> array, raw{" "}
              <InlineCode>rows</InlineCode> (arrays of cell strings),{" "}
              <InlineCode>records</InlineCode> (objects keyed by header, when
              headers are detected and unique), and a GFM{" "}
              <InlineCode>markdown</InlineCode> rendering ready to paste into
              an LLM context. Merged cells (<InlineCode>colspan</InlineCode>/
              <InlineCode>rowspan</InlineCode>) are expanded so every row has
              the same width; layout tables (
              <InlineCode>role="presentation"</InlineCode>, single-column,
              or wrapper tables around nested ones) are skipped.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                The URL to fetch. Same{" "}
                <InlineCode>http(s)://</InlineCode> and SSRF rules as{" "}
                <InlineCode>/v1/read</InlineCode>. PDFs are rejected with
                415.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v1/tables \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)" }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)",
  "finalUrl": "https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)",
  "tableCount": 6,
  "tables": [
    {
      "index": 0,
      "caption": "GDP forecast or estimate (million US$) by country",
      "headers": ["Country/Territory", "IMF Forecast", "World Bank Estimate"],
      "rows": [
        ["United States", "30,507,217", "29,184,890"],
        ["China", "19,231,705", "18,743,803"]
      ],
      "records": [
        { "Country/Territory": "United States", "IMF Forecast": "30,507,217", "World Bank Estimate": "29,184,890" }
      ],
      "rowCount": 210,
      "columnCount": 3,
      "markdown": "| Country/Territory | IMF Forecast | ..."
    }
  ],
  "fetchedAt": "2026-07-13T10:20:00Z"
}`}
            </Code>
            <P>
              If the page has no data tables at all, you get a{" "}
              <InlineCode>422</InlineCode> and{" "}
              <strong>no payment is taken</strong> — same no-pay-on-failure
              contract as every Skim endpoint. That includes pages whose
              tables are rendered by JavaScript or laid out as styled{" "}
              <InlineCode>&lt;div&gt;</InlineCode>s; for those, use{" "}
              <a href="#presets" className="text-primary hover:underline">
                /v1/extract/table
              </a>{" "}
              — the LLM-powered preset reads tables no matter how they're
              built. Also available as{" "}
              <InlineCode>GET /api/v2/tables?url=…</InlineCode> for x402 v2
              clients. Caps: 20 tables per page, 1,000 rows and 100 columns
              per table; a table that hits a cap carries{" "}
              <InlineCode>"truncated": true</InlineCode> so you know the
              output was clipped.
            </P>

            <H2 id="dataset">POST /v2/dataset</H2>
            <P>
              <strong>You define the columns.</strong> There are no fixed
              schemas or presets here — you hand Skim your own list of fields
              (up to 12, each with a name, a plain-language description, and a
              type), point it at one or more seed pages, and get back
              structured rows shaped exactly the way you asked, each with a
              per-row <InlineCode>sourceUrl</InlineCode> citation. Skim reads
              the seed pages, follows relevant links when the rows live on
              detail pages, extracts with the same constrained LLM as{" "}
              <InlineCode>/v1/extract</InlineCode>, and dedupes the result.{" "}
              <InlineCode>$0.35</InlineCode> per build.
            </P>
            <P>
              This is the endpoint for bespoke research pulls — competitive
              intelligence, market maps, lead lists. Want a table of{" "}
              <InlineCode>competitor</InlineCode>,{" "}
              <InlineCode>pricingTier</InlineCode>,{" "}
              <InlineCode>price</InlineCode>,{" "}
              <InlineCode>featureSet</InlineCode>, and{" "}
              <InlineCode>sourceUrl</InlineCode> across a set of pages? Define
              those five fields and that is the shape you get back, with every
              cell traceable to the page it came from.
            </P>
            <P>
              Payment settles when the build is <em>accepted</em> (a 202
              ticket), not when it finishes. Skim protects that contract two
              ways: your input is fully validated first, and the first seed
              URL is fetched <em>before</em> payment settles — if the seed
              page can't be read, you get a 4xx and no payment is taken.
              Builds typically finish in well under two minutes.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="prompt" type="string" required>
                What the dataset is — 10 to 500 characters. E.g. "Current
                YC companies in the AI batch with their one-line pitch".
              </Field>
              <Field name="fields" type="array" required>
                1–12 column definitions:{" "}
                <InlineCode>{`{ name, description, type? }`}</InlineCode>.
                Names must be identifier-style (letters, digits,
                underscores); <InlineCode>type</InlineCode> is{" "}
                <InlineCode>string</InlineCode> (default),{" "}
                <InlineCode>number</InlineCode>, or{" "}
                <InlineCode>boolean</InlineCode>. The name{" "}
                <InlineCode>sourceUrl</InlineCode> is reserved — Skim adds
                it to every row automatically.
              </Field>
              <Field name="urls" type="array" required>
                1–10 seed URLs to start from. Same{" "}
                <InlineCode>http(s)://</InlineCode> and SSRF rules as{" "}
                <InlineCode>/v1/read</InlineCode>.
              </Field>
              <Field name="rowLimit" type="integer">
                Maximum rows to return, 1–100. Default 50. A cap, not a
                promise — you get what the sources actually contain.
              </Field>
              <Field name="continueFrom" type="string">
                A <InlineCode>datasetId</InlineCode> from an earlier build
                whose poll response said{" "}
                <InlineCode>hasMore: true</InlineCode>. Starts a new paid
                build that resumes exactly where that one stopped —
                inherits its prompt and fields (do not resend them), never
                repeats rows you already have. Optional{" "}
                <InlineCode>rowLimit</InlineCode> still applies.
              </Field>
            </div>
            <H3>Flow</H3>
            <P>
              The paid POST returns a <InlineCode>202</InlineCode> ticket
              immediately; the build runs in the background. Poll the ticket's{" "}
              <InlineCode>pollUrl</InlineCode> — polling is free, no payment
              header needed. The <InlineCode>datasetId</InlineCode> is the
              only key to the result, so treat it like a bearer secret.
            </P>
            <Code>
{`curl -X POST https://skim402.com/api/v2/dataset \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \\
  -d '{
    "prompt": "Top stories on the Hacker News front page",
    "fields": [
      { "name": "title", "description": "Story title" },
      { "name": "points", "description": "Upvote score", "type": "number" }
    ],
    "urls": ["https://news.ycombinator.com/"],
    "rowLimit": 25
  }'

# -> 202
{
  "datasetId": "ds_LviVNQtobY0pSEfxpRqB7K0O",
  "status": "running",
  "pollUrl": "/api/v2/dataset/ds_LviVNQtobY0pSEfxpRqB7K0O",
  "estimatedSeconds": 60
}

# then poll (free):
curl https://skim402.com/api/v2/dataset/ds_LviVNQtobY0pSEfxpRqB7K0O`}
            </Code>
            <H3>Poll response (complete)</H3>
            <Code>
{`{
  "datasetId": "ds_LviVNQtobY0pSEfxpRqB7K0O",
  "status": "ready",
  "rowCount": 25,
  "rows": [
    {
      "title": "Tiny Emulators",
      "points": 207,
      "sourceUrl": "https://news.ycombinator.com/"
    }
  ],
  "stats": {
    "seedPages": 1,
    "followedPages": 12,
    "pagesFailed": 0,
    "llmCalls": 13,
    "durationMs": 48210
  },
  "hasMore": true,
  "continuation": {
    "continueFrom": "ds_LviVNQtobY0pSEfxpRqB7K0O",
    "pendingPages": 9,
    "bufferedRows": 4
  },
  "completedAt": "2026-07-13T10:21:00Z"
}`}
            </Code>
            <P>
              <InlineCode>status</InlineCode> is{" "}
              <InlineCode>running</InlineCode>,{" "}
              <InlineCode>ready</InlineCode>,{" "}
              <InlineCode>partial</InlineCode> (some source pages failed or
              the page budget ran out before full coverage — rows are still
              returned, with the details in{" "}
              <InlineCode>stats</InlineCode>), or{" "}
              <InlineCode>error</InlineCode> (no rows could be built;{" "}
              <InlineCode>error</InlineCode> says why). Values come only
              from the pages Skim read — every row cites the page it came
              from, and fields a source doesn't state come back null, never
              invented.
            </P>
            <H3>Continuation (pagination)</H3>
            <P>
              A single build is bounded — by your{" "}
              <InlineCode>rowLimit</InlineCode> and by an internal page
              budget — so large sources may not be fully drained in one
              pass. Nothing is lost silently:{" "}
              <InlineCode>hasMore: true</InlineCode> on the poll response
              means Skim is holding unread pages and/or already-extracted
              rows past your cap (<InlineCode>pendingPages</InlineCode> and{" "}
              <InlineCode>bufferedRows</InlineCode> in{" "}
              <InlineCode>continuation</InlineCode> tell you which). To get
              the next batch, POST a new paid build with just the token:
            </P>
            <Code>
{`curl -X POST https://skim402.com/api/v2/dataset \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \\
  -d '{ "continueFrom": "ds_LviVNQtobY0pSEfxpRqB7K0O" }'`}
            </Code>
            <P>
              The continuation inherits the original prompt and fields,
              starts from any buffered rows (no extra page cost), reads the
              unread frontier, and never repeats a row an earlier build in
              the chain already returned. Chain{" "}
              <InlineCode>continueFrom</InlineCode> through each new{" "}
              <InlineCode>datasetId</InlineCode> until{" "}
              <InlineCode>hasMore</InlineCode> comes back{" "}
              <InlineCode>false</InlineCode>. Each continuation is a
              regular <InlineCode>$0.35</InlineCode> build with the same
              honesty contract: an invalid or fully-drained token is
              rejected before payment settles.
            </P>

            <H2 id="crawl">POST /t/crawl</H2>
            <P>
              Give Skim a site — an origin or a start URL — and get the
              important pages back as clean markdown. Discovery uses{" "}
              <InlineCode>sitemap.xml</InlineCode> (and{" "}
              <InlineCode>robots.txt</InlineCode> sitemap lines) plus
              same-origin links on the start page. Private, loopback, and
              link-local hosts are rejected with the same SSRF rules as{" "}
              <InlineCode>/t/read</InlineCode>. Capped at 25 pages. Each
              successful page is billed through the existing{" "}
              <InlineCode>/t/read</InlineCode> ledger — 1 credit per page
              that actually returns markdown. Failed pages are not charged.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                Site origin or start URL.{" "}
                <InlineCode>example.com</InlineCode> is treated as{" "}
                <InlineCode>https://example.com</InlineCode>.
              </Field>
              <Field name="maxPages" type="integer">
                Optional cap, 1–25. Default 25.
              </Field>
              <Field name="stripLinks" type="boolean">
                Passed through to each page read.
              </Field>
              <Field name="stripImages" type="boolean">
                Passed through to each page read.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/t/crawl \\
  -H "Authorization: Bearer sk402_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com", "maxPages": 10 }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "url": "https://example.com",
  "origin": "https://example.com",
  "pageCount": 8,
  "discovered": 24,
  "capped": true,
  "maxPages": 10,
  "sources": ["sitemap", "links"],
  "charged": 8,
  "pages": [
    {
      "url": "https://example.com/docs",
      "ok": true,
      "title": "Docs",
      "markdown": "# Docs\\n\\n..."
    }
  ],
  "fetchedAt": "2026-08-23T22:00:00Z"
}`}
            </Code>
            <P>
              Try it in the{" "}
              <Link href="/playground?mode=crawl" className="text-primary hover:underline">
                Workbench — Crawl a site
              </Link>
              . Same key auth as every other{" "}
              <InlineCode>/t/</InlineCode> route.
            </P>

            <H2 id="watch">Custom URL watches</H2>
            <P>
              Watch the pages <em>you</em> care about. Register a list of 1
              to 20 URLs once (<InlineCode>POST /v2/watch</InlineCode>,{" "}
              <InlineCode>$0.01</InlineCode>), then poll on your own
              schedule (<InlineCode>GET /v2/watch/diff?id=</InlineCode>,{" "}
              <InlineCode>$0.005</InlineCode> per poll). Each poll re-reads
              every URL and answers one question: what changed since your
              last check? Diffs are computed against the <em>clean</em>{" "}
              extracted text, so a rotated ad or a new tracking script never
              shows up as a change — only content does.
            </P>
            <P>
              The watch id is a private capability token — anyone who has
              it can poll (and pay for) your watch, so treat it like a
              bearer secret. The first poll baselines each page; changes
              are reported from the second poll on. Polls within 60 seconds
              of the previous one return the cached result with{" "}
              <InlineCode>"fresh": true</InlineCode> instead of re-reading.
            </P>
            <H3>Register</H3>
            <Code>
{`curl -X POST https://skim402.com/api/v2/watch \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \\
  -d '{
    "urls": [
      "https://competitor.com/pricing",
      "https://competitor.com/changelog"
    ],
    "note": "competitor pricing + changelog"
  }'

# -> 201
{
  "watchId": "w_kF3nW8pQx2LmT9rYb6JcHd0V",
  "urls": ["https://competitor.com/pricing", "https://competitor.com/changelog"],
  "pollUrl": "/api/v2/watch/diff?id=w_kF3nW8pQx2LmT9rYb6JcHd0V",
  "minIntervalSeconds": 60
}`}
            </Code>
            <P>
              Input is validated and the first URL is fetched{" "}
              <em>before</em> payment settles — an unreadable first URL or
              a bad list means a 4xx and no charge, same contract as the
              dataset builder.
            </P>
            <H3>Poll for changes</H3>
            <Code>
{`curl "https://skim402.com/api/v2/watch/diff?id=w_kF3nW8pQx2LmT9rYb6JcHd0V" \\
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>"

# -> 200
{
  "watchId": "w_kF3nW8pQx2LmT9rYb6JcHd0V",
  "polledAt": "2026-07-14T12:00:00Z",
  "changedCount": 1,
  "urls": [
    {
      "url": "https://competitor.com/pricing",
      "status": "changed",
      "title": "Pricing — Competitor",
      "diff": {
        "addedCount": 1,
        "removedCount": 1,
        "changeRatio": 0.021,
        "addedSample": ["Pro plan — $49/month"],
        "removedSample": ["Pro plan — $39/month"],
        "numericOnly": true,
        "titleChanged": false
      }
    },
    {
      "url": "https://competitor.com/changelog",
      "status": "unchanged",
      "title": "Changelog — Competitor"
    }
  ]
}`}
            </Code>
            <P>
              Per-URL <InlineCode>status</InlineCode> is{" "}
              <InlineCode>changed</InlineCode>,{" "}
              <InlineCode>unchanged</InlineCode>,{" "}
              <InlineCode>first_check</InlineCode> (baseline stored on this
              poll), or <InlineCode>error</InlineCode> (the page could not
              be read this time; the old baseline is kept). For changed
              pages you get up to five added and five removed line samples,
              a <InlineCode>changeRatio</InlineCode> (share of lines that
              moved), and <InlineCode>numericOnly</InlineCode> —{" "}
              <InlineCode>true</InlineCode> when every changed line differs
              only in digits, which lets an agent tell a price tick or view
              counter from a real content change without an LLM call.
            </P>
            <P>
              <InlineCode>GET /v2/watch/status?id=</InlineCode> is free: the
              registered URLs, note, poll count, and last-poll time — no
              diff, no payment header needed.
            </P>

            <H2 id="watch-webhooks">Watch webhooks</H2>
            <P>
              Watch is still poll-driven — there is no background cron. Pass
              an HTTPS <InlineCode>webhookUrl</InlineCode> when you create or
              update a watch. The first time <InlineCode>GET /t/watch/diff</InlineCode>{" "}
              sees a page <InlineCode>status: "changed"</InlineCode>, Skim
              POSTs a signed JSON payload to that URL. Unchanged pages,
              first-check baselines, errors, and cached polls (
              <InlineCode>fresh: true</InlineCode>) do not fire. Same change
              (same content hash) is not delivered twice.
            </P>
            <P>
              No email. You get a <InlineCode>webhookSecret</InlineCode> once
              — store it and verify <InlineCode>X-Skim-Signature</InlineCode>.
            </P>
            <H3>Register with a webhook</H3>
            <Code>
{`curl -X POST https://skim402.com/api/t/watch \\
  -H "Authorization: Bearer sk402_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": ["https://competitor.com/pricing"],
    "webhookUrl": "https://example.com/hooks/skim"
  }'

# -> 201 includes watchId and webhookSecret (shown once)`}
            </Code>
            <H3>Update an existing watch</H3>
            <Code>
{`curl -X PATCH https://skim402.com/api/t/watch \\
  -H "Authorization: Bearer sk402_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "watchId": "w_kF3nW8pQx2LmT9rYb6JcHd0V",
    "webhookUrl": "https://example.com/hooks/skim"
  }'`}
            </Code>
            <H3>Payload posted to your URL</H3>
            <Code>
{`POST https://example.com/hooks/skim
Content-Type: application/json
X-Skim-Signature: sha256=<hex>
X-Skim-Delivery: whd_…

{
  "event": "watch.changed",
  "watchId": "w_kF3nW8pQx2LmT9rYb6JcHd0V",
  "url": "https://competitor.com/pricing",
  "status": "changed",
  "polledAt": "2026-08-23T22:00:00Z",
  "deliveryId": "whd_…",
  "diff": {
    "addedCount": 1,
    "removedCount": 1,
    "changeRatio": 0.021,
    "addedSample": ["Pro plan — $49/month"],
    "removedSample": ["Pro plan — $39/month"],
    "numericOnly": true,
    "titleChanged": false
  }
}`}
            </Code>
            <H3>Verify the signature</H3>
            <Code>
{`import crypto from "node:crypto";

function valid(secret, rawBody, header) {
  const hex = header.replace(/^sha256=/, "");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hex, "hex"));
}`}
            </Code>
            <P>
              Webhook URLs must be public <InlineCode>https://</InlineCode> —
              the same SSRF rules as reads (no localhost, no private ranges).
              Delivery failures do not fail the diff response. Poll{" "}
              <InlineCode>GET /t/watch/diff?id=</InlineCode> on your schedule;
              that is when changes are detected and the webhook fires.
            </P>

            <H2 id="read-pdf">POST /t/read-pdf</H2>
            <P>
              Fetch a public PDF URL and return clean markdown plus an
              optional outline. Text comes only from the file — nothing is
              invented. Image-only scans are rejected (no OCR). Files larger
              than 8 MB return <InlineCode>413</InlineCode> with a clear
              error. Same key auth as other <InlineCode>/t/</InlineCode>{" "}
              routes.
            </P>
            <P>
              Credits: <strong>3</strong> (JS-read rate), not extract (8).
              Failed conversions are not charged.
            </P>
            <H3>Request body</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="url" type="string" required>
                Absolute <InlineCode>http(s)://</InlineCode> PDF URL. Same
                SSRF rules as <InlineCode>/t/read</InlineCode>.
              </Field>
              <Field name="outline" type="boolean">
                Optional, default <InlineCode>true</InlineCode>. Include the
                PDF bookmark outline when present.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`curl -X POST https://skim402.com/api/t/read-pdf \\
  -H "Authorization: Bearer sk402_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/paper.pdf" }'`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "url": "https://example.com/paper.pdf",
  "finalUrl": "https://example.com/paper.pdf",
  "markdown": "# Intro\\n\\nHello from the PDF",
  "text": "Hello from the PDF",
  "outline": [{ "title": "Intro", "level": 1, "index": 0 }],
  "pageCount": 1,
  "charged": 3,
  "fetchedAt": "2026-08-23T22:00:00Z"
}`}
            </Code>
            <P>
              Try it in the{" "}
              <Link href="/playground?mode=pdf" className="text-primary hover:underline">
                Workbench — PDF
              </Link>
              .
            </P>

            <H2 id="feed">GET /v2/feeds/x402/latest</H2>
            <P>
              The x402 ecosystem feed: new services and price changes across
              the public x402 registries, as structured items your agent can
              act on. <InlineCode>$0.005</InlineCode> per poll. The feed
              refreshes on a 15-minute cycle — the first poll past that
              window triggers a fresh crawl of the registries; every poll
              inside it is served from storage. If a registry is down, the
              last good data is served instead (see{" "}
              <InlineCode>crawl.status</InlineCode> below).
            </P>
            <P>
              This is a v2 endpoint (a plain <InlineCode>GET</InlineCode>{" "}
              with query parameters) — any x402 v2 client handles the payment
              handshake automatically.
            </P>
            <H3>Query parameters</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="limit" type="integer">
                Maximum number of items to return. Default 50, capped at
                100. Items are newest-first.
              </Field>
            </div>
            <H3>Example</H3>
            <Code>
{`import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(toClientEvmSigner(account)));
const paidFetch = wrapFetchWithPayment(fetch, client);

// Always pass a timeout signal — a stalled payment step can otherwise
// hang your process indefinitely. Unsettled calls are never charged,
// so aborting and retrying is safe.
const res = await paidFetch(
  "https://skim402.com/api/v2/feeds/x402/latest?limit=25",
  { signal: AbortSignal.timeout(90_000) }
);
const feed = await res.json();`}
            </Code>
            <H3>Response</H3>
            <Code>
{`{
  "feed": "x402",
  "asOf": "2026-07-13T12:00:00Z",
  "ttlSeconds": 900,
  "crawl": { "status": "ok", "lastCrawlAt": "2026-07-13T12:00:00Z", "durationMs": 2100 },
  "count": 2,
  "items": [
    {
      "id": 42,
      "kind": "new_service",
      "title": "New x402 service: Example API",
      "summary": "Example API appeared on x402-list.com (category: Data), priced from $0.005.",
      "source": "x402list",
      "url": "https://example-api.com",
      "payload": { "serviceKey": "example-api", "name": "Example API", "priceUsd": "0.005", "category": "Data" },
      "at": "2026-07-13T11:45:00Z"
    },
    {
      "id": 41,
      "kind": "price_change",
      "title": "Price change: Example API",
      "summary": "Example API on x402-list.com moved from $0.01 to $0.005.",
      "source": "x402list",
      "url": "https://example-api.com",
      "payload": { "serviceKey": "example-api", "oldPriceUsd": "0.01", "newPriceUsd": "0.005" },
      "at": "2026-07-12T09:30:00Z"
    }
  ]
}`}
            </Code>
            <P>
              Two item kinds today: <InlineCode>new_service</InlineCode> (a
              service appeared on a registry) and{" "}
              <InlineCode>price_change</InlineCode> (a listed price moved).
              <InlineCode> at</InlineCode> is when Skim first observed the
              change; where the registry publishes its own registration date,
              it is preserved in <InlineCode>payload.registeredAt</InlineCode>.
              If an upstream registry is down, you still get the stored
              items — <InlineCode>crawl.status</InlineCode> reports the last
              crawl attempt (<InlineCode>ok</InlineCode>,{" "}
              <InlineCode>partial</InlineCode>, or{" "}
              <InlineCode>error</InlineCode>) instead of the request
              failing. A paid poll never errors just because a registry
              hiccuped.
            </P>

            <H2 id="signals">The Skim Signal series</H2>
            <P>
              Fifteen vertical intelligence feeds, one pattern:{" "}
              <InlineCode>GET /v2/signal/&lt;slug&gt;/latest</InlineCode> —{" "}
              <InlineCode>$0.005</InlineCode> per poll, refreshed on a
              10-minute cycle, with the same stale-serve guarantee as the
              ecosystem feed: if an upstream source is down you still get the
              last good items, and <InlineCode>crawl.status</InlineCode>{" "}
              reports <InlineCode>ok</InlineCode>,{" "}
              <InlineCode>partial</InlineCode>, or{" "}
              <InlineCode>error</InlineCode>. Plain-language descriptions of
              every feed live on the{" "}
              <a href="/signals" className="text-primary hover:underline">
                Signals page
              </a>
              .
            </P>
            <P>
              Items carry a title, a short excerpt, the source, entity tags,
              a timestamp, and a link — the signal, not the full text. When
              your agent wants the whole page behind an item, that is one
              Skim <InlineCode>/read</InlineCode> call away.
            </P>
            <H3>Query parameters</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="limit" type="integer">
                Maximum number of items to return. Default 50, capped at
                100. Items are newest-first.
              </Field>
            </div>
            <P>
              A few feeds accept extra filters — see the table and the filter
              details below.
            </P>
            <H3>The fifteen feeds</H3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold">Signal</th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 font-semibold">Sources</th>
                    <th className="px-4 py-3 font-semibold">Filters</th>
                  </tr>
                </thead>
                <tbody>
                  {SIGNAL_ROWS.map((row) => (
                    <tr
                      key={row.id}
                      id={row.id}
                      className="border-b border-border last:border-b-0 scroll-mt-24"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs">{row.slug}</code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.sources}
                      </td>
                      <td className="px-4 py-3">
                        {row.filters === "—" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <code className="font-mono text-xs">
                            {row.filters}
                          </code>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <H3>Example</H3>
            <Code>
{`const res = await paidFetch(
  "https://skim402.com/api/v2/signal/ai-news/latest?limit=25",
  { signal: AbortSignal.timeout(90_000) }
);
const feed = await res.json();`}
            </Code>
            <H3>Response items</H3>
            <Code>
{`{
  "feed": "ai-news",
  "asOf": "2026-07-13T12:00:00Z",
  "crawl": { "status": "ok", "lastCrawlAt": "2026-07-13T12:00:00Z" },
  "items": [
    {
      "kind": "story",
      "title": "New open-weights model tops reasoning benchmarks",
      "summary": "Hacker News front page: 412 points, 187 comments.",
      "source": "hackernews",
      "url": "https://example.com/model-announcement",
      "payload": { "score": 412, "comments": 187 },
      "at": "2026-07-13T11:40:00Z"
    }
  ]
}`}
            </Code>
            <P>
              The <InlineCode>kind</InlineCode>, <InlineCode>source</InlineCode>
              , and <InlineCode>payload</InlineCode> fields vary per feed —
              SEC items carry the form type and its plain-language meaning,
              deal items carry price and retailer, paper items carry authors
              and an abstract excerpt, and so on. The envelope is identical
              across all fifteen. (The sixteenth feed in the
              Signal series is the x402 ecosystem feed, documented above —
              it lives at its own path.)
            </P>
            <H3>Filter details</H3>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="forms (sec-filings)" type="string">
                Optional comma-separated filter. Tracked forms: 8-K, S-1,
                10-K, 10-Q, SC 13D, SC 13G, 4.
              </Field>
              <Field name="categories (deals)" type="string">
                Optional comma-separated category terms (1-8, each 2-40
                characters), matched case-insensitively as substrings and
                OR-combined, e.g.{" "}
                <InlineCode>categories=laptop,gpu</InlineCode>.
              </Field>
              <Field name="fields (research)" type="string">
                Optional comma-separated arXiv field filter. Tracked fields:{" "}
                <InlineCode>ai</InlineCode>, <InlineCode>ml</InlineCode>,{" "}
                <InlineCode>nlp</InlineCode>, <InlineCode>vision</InlineCode>,{" "}
                <InlineCode>robotics</InlineCode>,{" "}
                <InlineCode>agents</InlineCode>,{" "}
                <InlineCode>security</InlineCode>,{" "}
                <InlineCode>quantum</InlineCode>.
              </Field>
              <Field name="states (film-incentives)" type="string">
                Optional comma-separated two-letter state filter, e.g.{" "}
                <InlineCode>states=CA,GA</InlineCode>. Tracked states: CA,
                NY, GA, NM, TX — each item carries{" "}
                <InlineCode>state</InlineCode>,{" "}
                <InlineCode>stateName</InlineCode>, and an{" "}
                <InlineCode>official</InlineCode> flag (state-source
                announcement vs. press coverage).
              </Field>
              <Field name="forms (campaign-finance)" type="string">
                Optional comma-separated FEC form-type filter, e.g.{" "}
                <InlineCode>forms=F3X,F24</InlineCode>. Tracked forms: F1,
                F2, F3, F3P, F3X, F3L, F24, F5, F6, F9, F13, F99 — each item
                carries a plain-language <InlineCode>meaning</InlineCode>{" "}
                tag. Amendments and terminations collapse onto their base
                form.
              </Field>
              <Field name="committees (campaign-finance)" type="string">
                Optional comma-separated committee-name terms (1-8, each
                2-60 characters), matched case-insensitively as substrings
                and OR-combined, e.g.{" "}
                <InlineCode>committees=turning point,dnc</InlineCode>.
              </Field>
            </div>

            <H2 id="card">Pay by card (token auth)</H2>
            <p className="text-muted-foreground mb-4">
              The default path is an API key on token-authenticated endpoints
              under <InlineCode>/t/</InlineCode>. Create a free key on the{" "}
              <Link href="/" className="text-primary hover:underline">
                homepage
              </Link>{" "}
              or pick a{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                card plan
              </Link>
              . Try read, batch, extract, crawl, PDF, and watch in the{" "}
              <Link href="/playground" className="text-primary hover:underline">
                Workbench
              </Link>{" "}
              without writing curl. Checkout returns an API token (shown once — store it like a
              password), and every call authenticates with it:
            </p>
            <Code>{`Authorization: Bearer sk402_...     # or the x-skim-token header`}</Code>
            <div className="space-y-3 mt-6 mb-6">
              <Field name="GET /t/read?url=..." type="1 credit">
                Same clean-markdown response as{" "}
                <a href="#read" className="text-primary hover:underline">
                  /v1/read
                </a>
                . If a page needs a browser render, the fallback happens
                automatically and the call costs 2 credits total. Optional
                query params: <InlineCode>stripLinks=true</InlineCode>,{" "}
                <InlineCode>stripImages=true</InlineCode>.
              </Field>
              <Field name="GET /t/read/js?url=..." type="3 credits">
                Forced headless-browser render, same response shape. Optional
                query params: <InlineCode>stripLinks=true</InlineCode>,{" "}
                <InlineCode>stripImages=true</InlineCode>.
              </Field>
              <Field name="POST /t/read/batch" type="1 credit per successful URL">
                Body{" "}
                <InlineCode>{`{ "urls": [...], "stripLinks"?: bool, "stripImages"?: bool }`}</InlineCode>
                , up to 10 URLs. Response is{" "}
                <InlineCode>{`{ items, charged }`}</InlineCode> — per-URL{" "}
                <InlineCode>ok</InlineCode>/<InlineCode>data</InlineCode>/
                <InlineCode>error</InlineCode>. Failed URLs are not charged.
              </Field>
              <Field name="POST /t/extract" type="8 credits on usable rows">
                Body{" "}
                <InlineCode>{`{ "url", "schema", "instructions?" }`}</InlineCode>{" "}
                — same schema-constrained extraction as{" "}
                <a href="#extract" className="text-primary hover:underline">
                  /v1/extract
                </a>
                . Failed extracts are refunded. An empty{" "}
                <InlineCode>{`{ tables: [] }`}</InlineCode> is not a successful
                extract — do not treat it as an 8-credit success.
              </Field>
              <Field name="POST /t/crawl" type="1 credit per page">
                Body{" "}
                <InlineCode>{`{ "url", "maxPages"?: 1-25 }`}</InlineCode>.
                Discovers sitemap + same-origin links, returns markdown per
                page. Failed pages are not charged.{" "}
                <a href="#crawl" className="text-primary hover:underline">
                  Docs
                </a>
                .
              </Field>
              <Field name="POST /t/watch" type="1 credit to register">
                Body{" "}
                <InlineCode>{`{ "urls": [1-20], "webhookUrl"?: "https://…" }`}</InlineCode>
                . Optional HTTPS webhook; signed POST on{" "}
                <InlineCode>GET /t/watch/diff</InlineCode> when a page
                changes.{" "}
                <a href="#watch-webhooks" className="text-primary hover:underline">
                  Webhooks
                </a>
                .
              </Field>
              <Field name="GET /t/watch/diff?id=" type="1 credit per URL">
                Re-reads the watch list and fires webhooks for{" "}
                <InlineCode>changed</InlineCode> pages. Cached polls within
                60s do not re-fire.
              </Field>
              <Field name="POST /t/read-pdf" type="3 credits">
                Body <InlineCode>{`{ "url", "outline"?: bool }`}</InlineCode>.
                PDF URL → markdown. Rejects files over 8 MB.{" "}
                <a href="#read-pdf" className="text-primary hover:underline">
                  Docs
                </a>
                .
              </Field>
              <H3>Signal polling</H3>
              <P>
                API-key polling uses the same{" "}
                <InlineCode>Authorization: Bearer sk402_...</InlineCode> header
                as reads. Each successful Signal or feed poll costs 2 credits;
                failed polls are refunded automatically.
              </P>
              <Code>
                {`# Poll a Signal (2 credits)
curl "https://skim402.com/api/t/signal/ai-news/latest?limit=25" \\
  -H "Authorization: Bearer sk402_YOUR_KEY"

# Poll the x402 ecosystem feed (2 credits)
curl "https://skim402.com/api/t/feeds/x402/latest?limit=25" \\
  -H "Authorization: Bearer sk402_YOUR_KEY"`}
              </Code>
              <Field name="GET /t/signal/:slug/latest" type="2 credits">
                Token-gated access to any{" "}
                <a href="#signals" className="text-primary hover:underline">
                  Skim Signal
                </a>{" "}
                feed. Replace <InlineCode>:slug</InlineCode> with the signal
                slug (e.g. <InlineCode>ai-news</InlineCode>,{" "}
                <InlineCode>sec-filings</InlineCode>). Supports the per-signal
                query filters <InlineCode>forms=</InlineCode>,{" "}
                <InlineCode>fields=</InlineCode>,{" "}
                <InlineCode>states=</InlineCode>,{" "}
                <InlineCode>categories=</InlineCode>, and{" "}
                <InlineCode>committees=</InlineCode>, and{" "}
                <InlineCode>jurisdictions=</InlineCode> (where supported), as
                well as <InlineCode>limit=</InlineCode>. Failed polls are
                refunded.
              </Field>
              <Field name="GET /t/feeds/x402/latest" type="2 credits">
                Token-gated access to the{" "}
                <a href="#feed" className="text-primary hover:underline">
                  x402 ecosystem feed
                </a>
                . Same response shape as <InlineCode>GET /v2/feeds/x402/latest</InlineCode>.
                Failed polls are refunded.
              </Field>
              <Field name="GET /card/account" type="free">
                Your plan, remaining monthly and pack credits, and the current
                credit-cost table. Token-authenticated.
              </Field>
              <Field name="POST /card/portal" type="free">
                Returns a Stripe billing-portal link for invoices, card
                changes, and cancellation. Token-authenticated.
              </Field>
            </div>
            <p className="text-muted-foreground mb-4">
              Credits come from your plan's monthly allowance — the Free Plan
              includes 1,000 reads a month, and paid plans keep working past
              the cap with metered overage on the next invoice. (Credits from
              the old one-time packs never expire and still spend normally.)
              Failed reads are always
              refunded — on either rail, Skim never charges for a page it
              couldn't read. Out of credits? The API answers{" "}
              <InlineCode>402</InlineCode>, same as the x402 rail.
            </p>

            <H2 id="modes">Reader modes</H2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <code className="font-mono text-sm font-semibold">basic</code>
                  <Badge>$0.002</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Static fetch + Readability. Fast, cheap, perfect for blogs,
                  docs, and articles.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <code className="font-mono text-sm font-semibold">js</code>
                  <Badge>$0.005</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full headless-browser render for SPAs and JS-gated content.
                  Use the separate{" "}
                  <a href="#js" className="text-primary hover:underline">
                    /v1/read/js
                  </a>{" "}
                  endpoint.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <code className="font-mono text-sm font-semibold">
                    extract
                  </code>
                  <Badge>$0.015</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pass a JSON Schema, get back typed JSON. Powered by an
                  LLM constrained to your schema. See the separate{" "}
                  <a href="#extract" className="text-primary hover:underline">
                    /v1/extract
                  </a>{" "}
                  endpoint.
                </p>
              </div>
            </div>

            <H2 id="errors">Errors</H2>
            <P>
              Every error tells you two things: what went wrong, and whether
              your wallet got charged. Skim only settles payment on 2xx. If
              you didn't get markdown back, you didn't pay.
            </P>
            <P>
              This isn't a refund mechanism. It's how x402 works. The
              facilitator settles after the route handler returns. If the
              handler returns an error, settlement is skipped. Failed reads
              cost zero.
            </P>
            <div className="rounded-xl border border-border bg-card px-6">
              <Field name="400" type="bad request">
                Malformed body, missing required field, or invalid URL. Fix
                the request before retrying.{" "}
                <strong className="text-foreground">Wallet not charged.</strong>
              </Field>
              <Field name="402" type="payment required">
                First-call response. Body contains the x402 payment
                requirement. Sign it with your client, retry with{" "}
                <InlineCode>X-PAYMENT</InlineCode> set.{" "}
                <strong className="text-foreground">
                  Wallet not charged — this is the prompt to pay, not a
                  failed payment.
                </strong>
              </Field>
              <Field name="403" type="forbidden">
                Target URL resolves to a blocked address (private, loopback,
                link-local, AWS metadata). SSRF protection.{" "}
                <strong className="text-foreground">Wallet not charged.</strong>
              </Field>
              <Field name="422" type="unprocessable">
                Fetched the page but couldn't extract readable content.
                Usually a JS-only SPA, an empty body, or aggressive
                paywall/bot-block. Try <InlineCode>/v1/read/js</InlineCode>{" "}
                for SPAs.{" "}
                <strong className="text-foreground">Wallet not charged.</strong>
              </Field>
              <Field name="5xx" type="server error">
                Transient on Skim's side. Retry with exponential backoff (1s,
                2s, 4s, give up after ~30s).{" "}
                <strong className="text-foreground">Wallet not charged.</strong>
              </Field>
            </div>
            <P>
              The pattern: only 2xx costs USDC. Everything else is free to
              hit, free to retry, free to throw away. Build your agent loop
              accordingly.
            </P>
          </article>
        </div>
      </div>
    </PublicLayout>
  );
}
