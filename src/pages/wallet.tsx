import { useState } from "react";
import type { ComponentType } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowRight, ExternalLink, Shield, Coins, AlertTriangle, MousePointer2, Bot, Boxes, Terminal, Sparkles, Copy, Check } from "lucide-react";
import { SiClaude, SiOpenai, SiPython, SiJavascript, SiCurl, SiLangchain } from "react-icons/si";

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 border border-primary/30 text-primary font-bold flex items-center justify-center text-sm">
        {n}
      </div>
      <div className="flex-1 pt-1">
        <h4 className="font-semibold text-foreground mb-2">{title}</h4>
        <div className="text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  );
}

type IconType = ComponentType<{ className?: string }>;

type AgentId = "claude" | "cursor" | "codex" | "devin" | "langchain" | "other";
type IntegrationId = "mcp" | "python" | "javascript" | "curl" | "openai" | "other";

const AGENTS: { id: AgentId; label: string; Icon: IconType }[] = [
  { id: "claude", label: "Claude", Icon: SiClaude },
  { id: "cursor", label: "Cursor", Icon: MousePointer2 },
  { id: "codex", label: "Codex", Icon: SiOpenai },
  { id: "devin", label: "Devin", Icon: Bot },
  { id: "langchain", label: "LangChain", Icon: SiLangchain },
  { id: "other", label: "Other", Icon: Sparkles },
];

const INTEGRATIONS: { id: IntegrationId; label: string; Icon: IconType }[] = [
  { id: "mcp", label: "MCP", Icon: Boxes },
  { id: "python", label: "Python", Icon: SiPython },
  { id: "javascript", label: "JavaScript", Icon: SiJavascript },
  { id: "curl", label: "cURL", Icon: SiCurl },
  { id: "openai", label: "OpenAI SDK", Icon: SiOpenai },
  { id: "other", label: "Other", Icon: Terminal },
];

const MCP_CONFIG = `{
  "mcpServers": {
    "skim": {
      "command": "npx",
      "args": ["-y", "skim-mcp"],
      "env": {
        "SKIM_WALLET_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY",
        "SKIM_MAX_PRICE_USD": "0.01"
      }
    }
  }
}`;

const MCP_LOCATION: Record<AgentId, string> = {
  claude: "Paste this into your claude_desktop_config.json (Claude Desktop → Settings → Developer → Edit Config), then restart Claude.",
  cursor: "Paste this into Cursor's MCP config at ~/.cursor/mcp.json (or Settings → MCP → Add), then reload.",
  codex: "Add this server to your Codex / OpenAI Agents MCP config, then restart the agent.",
  devin: "Add this server in Devin's MCP / integrations settings.",
  langchain: "LangChain can load MCP servers via langchain-mcp-adapters — point it at this config, or use the Python snippet below instead.",
  other: "Add this server wherever your agent loads MCP servers, then restart it.",
};

function generateSnippet(agent: AgentId, integration: IntegrationId): {
  note: string;
  lang: string;
  code: string;
} {
  switch (integration) {
    case "mcp":
      return {
        note: MCP_LOCATION[agent],
        lang: "json",
        code: MCP_CONFIG,
      };
    case "openai":
      return {
        note: "The OpenAI Agents SDK talks to tools over MCP. Register skim-mcp as an MCP server and your agent can read the web, paying from its wallet on each call.",
        lang: "json",
        code: MCP_CONFIG,
      };
    case "javascript":
      return {
        note: "An axios client with the x402 interceptor signs each micropayment from your wallet automatically — the only credential is the private key in an env var.",
        lang: "javascript",
        code: `// npm install x402-axios@1.2.0 viem axios
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

console.log(data.markdown);`,
      };
    case "python":
      return {
        note: "The x402 Python client wraps a requests Session — it answers the 402 challenge and signs the USDC payment with your wallet key, up to your per-call cap.",
        lang: "python",
        code: `# pip install "x402[evm]" requests eth-account
from x402 import x402ClientSync
from x402.client import max_amount
from x402.http.clients.requests import wrapRequestsWithPayment
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.evm.signers import EthAccountSigner
from eth_account import Account
import os, requests

# Your agent's wallet — funded with USDC on Base.
account = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])

client = x402ClientSync()
register_exact_evm_client(
    client,
    EthAccountSigner(account),
    # Per-call cap in USDC atomic units (6 decimals). 20_000 = $0.02
    # covers every Skim endpoint.
    policies=[max_amount(20_000)],
)
skim = wrapRequestsWithPayment(requests.Session(), client)

res = skim.post(
    "https://skim402.com/api/v1/read",
    json={"url": "https://example.com/article"},
)
print(res.json()["markdown"])`,
      };
    case "curl":
      return {
        note: "cURL can't sign an x402 payment on its own — it shows you the 402 challenge, then an x402 client (the MCP server, or the JS/Python snippets here) signs and retries with the X-PAYMENT header.",
        lang: "bash",
        code: `# 1. First call — server replies 402 Payment Required with x402 instructions
curl -i -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/article" }'

# 2. Sign and submit payment with the x402 CLI or any x402 client,
#    then retry the same request with the X-PAYMENT header set.

curl -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://example.com/article" }'`,
      };
    case "other":
    default:
      return {
        note: "This optional path uses the wallet private key as SKIM_WALLET_PRIVATE_KEY. Most people start with a free sk402_ API key instead (see the homepage). If you're staying on x402, the MCP server is the usual setup:",
        lang: "json",
        code: MCP_CONFIG,
      };
  }
}

function PickButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: IconType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  );
}

function SetupPicker() {
  const [agent, setAgent] = useState<AgentId>("claude");
  const [integration, setIntegration] = useState<IntegrationId>("mcp");
  const [copied, setCopied] = useState(false);
  const snippet = generateSnippet(agent, integration);

  function copyCode() {
    void navigator.clipboard.writeText(snippet.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="mb-6">
        <div className="text-sm font-semibold text-foreground mb-3">
          1. What are you coding with?
        </div>
        <div className="flex flex-wrap gap-2.5">
          {AGENTS.map((a) => (
            <PickButton
              key={a.id}
              active={agent === a.id}
              label={a.label}
              Icon={a.Icon}
              onClick={() => setAgent(a.id)}
            />
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-semibold text-foreground mb-3">
          2. How should it connect?
        </div>
        <div className="flex flex-wrap gap-2.5">
          {INTEGRATIONS.map((i) => (
            <PickButton
              key={i.id}
              active={integration === i.id}
              label={i.label}
              Icon={i.Icon}
              onClick={() => setIntegration(i.id)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/60 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {snippet.note}
          </p>
          <button
            type="button"
            onClick={copyCode}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="bg-[#161b22] text-zinc-50 p-4 font-mono text-xs leading-relaxed overflow-x-auto">
          <code>{snippet.code}</code>
        </pre>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Don&apos;t want a wallet?{" "}
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Create a free API key
        </Link>{" "}
        instead. If you&apos;re staying on this path, the five-step setup is
        below — then drop the key into{" "}
        <InlineCode>SKIM_WALLET_PRIVATE_KEY</InlineCode> above.
      </p>
    </div>
  );
}

export default function WalletPage() {
  useDocumentMeta({
    title: "Wallet pay (optional) — USDC on Base | Skim™",
    description:
      "Optional x402 path: pay Skim per call in USDC on Base. Most people start with a free API key instead — 1,000 credits, no wallet required.",
    canonical: "https://skim402.com/wallet",
  });

  return (
    <PublicLayout>
      {/* Headline + setup picker */}
      <section className="relative pt-16 md:pt-20 pb-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
            Wire up your agent's <span className="text-primary">wallet.</span>
          </h1>
          <p className="text-muted-foreground mb-6">
            This is the optional x402 path: pay per call in USDC on Base. Most
            people skip it and start with a free API key instead.
          </p>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-8">
            <h3 className="font-bold text-foreground mb-1">
              Don&apos;t want a wallet?
            </h3>
            <p className="text-muted-foreground text-sm">
              Create a free <code className="font-mono text-xs">sk402_</code>{" "}
              key — 1,000 credits, no crypto.{" "}
              <Link href="/" className="text-primary underline-offset-4 hover:underline">
                Create key
              </Link>
              {" "}on the homepage, or{" "}
              <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                Start free
              </Link>
              {" "}on the monthly Free Plan (card on file, never charged).
            </p>
          </div>
          <p className="text-muted-foreground mb-8">
            Still want wallet pay? Choose your agent and how it should connect,
            and we&apos;ll give you the snippet. The wallet&apos;s private key is
            the credential for this path.
          </p>
          <SetupPicker />
        </div>
      </section>

      {/* Newbie card callout */}
      <section className="pt-8 pb-4">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <h3 className="font-bold text-foreground mb-2">
              Funding this wallet with a card
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Prefer the API-key path?{" "}
              <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                Start free
              </Link>
              {" "}— no USDC required. If you&apos;re staying on wallet pay, you
              still don&apos;t need an exchange account. The Coinbase Wallet
              extension in step 1 has a &quot;Buy&quot; button built right in —
              pay with a{" "}
              <strong className="text-foreground">credit card</strong> (or
              debit), choose USDC (a stablecoin pegged to the US dollar) on{" "}
              <strong>Base</strong>, and you&apos;re funded in a couple of
              minutes. No buying and selling cryptocoins on the spot market, no
              confusing cryptocoin trading pairs — your card converts to USDC
              automatically, and every top-up later works the same way.
            </p>
            <ExtLink href="https://www.coinbase.com/wallet/downloads">
              Get Coinbase Wallet
            </ExtLink>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-16 border-t border-border pt-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            The whole setup
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-10">
            One wallet. Five steps.
          </h2>

          <div className="space-y-8 mb-10">
            <Step n={1} title="Install the Coinbase Wallet browser extension">
              <p>
                Install the{" "}
                <ExtLink href="https://www.coinbase.com/wallet/downloads">
                  Coinbase Wallet browser extension
                </ExtLink>
                . Same brand and team as Base, with the Base network built in —
                no manual network setup, no fiddling with RPC URLs. It also
                lets you export the wallet's private key as a hex string,
                which you'll need in step 5.
              </p>
              <p className="text-sm">
                <em>
                  Why not a passkey wallet like Base Account? Passkey wallets
                  require a human to approve each signature, so they can't be
                  used by an autonomous agent. You need a wallet whose key you
                  can paste into a config file.
                </em>
              </p>
            </Step>

            <Step n={2} title="Create a NEW wallet — don't reuse your personal one">
              <p>
                In your extension, choose "Create new wallet" (not "import").
                This wallet should exist for exactly one purpose: paying for
                agent infrastructure calls. The "Why a dedicated wallet"
                section below covers the three reasons that matter (blast
                radius, budget control, accounting).
              </p>
            </Step>

            <div id="fund" className="scroll-mt-24" />
            <Step n={3} title="Fund it with USDC — on the Base network">
              <p>
                <strong>This is the part where people lose money if they rush.</strong>{" "}
                Buy or send USDC to the wallet, but it MUST arrive on the{" "}
                <strong>Base</strong> network — not Ethereum mainnet, not
                Polygon, not Arbitrum. Skim only settles on Base.
              </p>
              <p>
                Easiest path: in your Coinbase Wallet extension, use the
                built-in "Buy" button with a credit card and pick{" "}
                <strong>USDC on Base</strong>. Sending from an exchange
                (Coinbase, Binance, Kraken)? When you hit "Withdraw USDC,"
                the exchange will ask which network — pick{" "}
                <strong>Base</strong>. $5 funds about 2,500 Skim reads, so
                start small.
              </p>
            </Step>

            <div id="key" className="scroll-mt-24" />
            <Step n={4} title="Export the private key">
              <p>
                In the wallet's settings, find "Show private key" or "Export
                private key." Copy the hex string (it starts with{" "}
                <InlineCode>0x</InlineCode>). Treat it like a password — anyone
                with this string can spend the wallet's balance, which is
                exactly why we keep the balance small.
              </p>
            </Step>

            <Step n={5} title="Use the key — for testing, for your agent, or both">
              <p>
                The same private key works for everything you'd do with Skim:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Try it yourself</strong> from the terminal using the
                  curl, JavaScript, or Python samples in the{" "}
                  <Link href="/docs" className="text-primary underline-offset-4 hover:underline">docs</Link>.
                </li>
                <li>
                  <strong>Wire it into an AI agent</strong> via the{" "}
                  <ExtLink href="https://www.npmjs.com/package/skim-mcp">skim-mcp</ExtLink>
                  {" "}MCP server. The MCP config takes the key directly.
                </li>
              </ul>
              <pre className="bg-[#161b22] text-zinc-50 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto border border-[#21262d] mt-3">
                <code>{`"SKIM_WALLET_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY"
"SKIM_MAX_PRICE_USD": "0.01"`}</code>
              </pre>
              <p>
                The <InlineCode>SKIM_MAX_PRICE_USD</InlineCode> ceiling caps
                what the wallet will sign for in one call — a guardrail
                against a buggy or runaway agent.
              </p>
            </Step>
          </div>

          {/* Behind the scenes */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-6">
            <h3 className="font-bold text-foreground mb-3">
              What happens when your agent calls Skim
            </h3>
            <p className="text-muted-foreground text-sm mb-3">
              You might be wondering: how does my agent know where to send
              the payment? Do I need to put Skim's wallet address somewhere?
              <strong> No.</strong> The x402 protocol carries the routing on
              every call. Here's what happens behind the scenes:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground text-sm">
              <li>
                Your agent sends a request to <InlineCode>/api/v1/read</InlineCode>.
              </li>
              <li>
                Skim responds with <InlineCode>402 Payment Required</InlineCode>,
                including <em>where</em> to pay, <em>how much</em>, and on
                <em> which network</em>.
              </li>
              <li>
                The <InlineCode>skim-mcp</InlineCode> library reads those
                instructions, signs a USDC payment authorization with your
                private key, and retries the request with the signature
                attached.
              </li>
              <li>
                Skim verifies the signature, settles the payment on Base, and
                returns the clean markdown.
              </li>
            </ol>
            <p className="text-muted-foreground text-sm mt-3">
              You never type Skim's wallet address anywhere. The same is true
              for any other x402 service — the same wallet that pays Skim
              today can pay any x402 API tomorrow with zero extra setup.
              That's the point of the protocol.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex gap-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-foreground mb-2">
                One more time, because it's the #1 newbie mistake.
              </h3>
              <p className="text-muted-foreground text-sm">
                USDC on Ethereum is a different token from USDC on Base. If
                you withdraw USDC from an exchange on the wrong network, the
                funds will arrive at the wrong place, and Skim won't see them.
                When in doubt: <strong>Base</strong>. Always Base.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why dedicated */}
      <section className="py-20 border-t border-border bg-card/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-3xl font-bold">
              Can I use my current wallet?
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-6 max-w-3xl">
            Technically yes. Practically — don't. Use a fresh wallet dedicated
            to AI agent calls. Three reasons:
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="font-bold mb-3">Blast radius</h3>
              <p className="text-muted-foreground text-sm">
                Your agent's private key lives in plaintext in a config file.
                If it leaks — accidentally committed to GitHub, machine
                compromised, screen shared — only the agent wallet's balance is
                at risk. Your personal wallet, with your real assets, is
                untouched.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="font-bold mb-3">Budget control</h3>
              <p className="text-muted-foreground text-sm">
                A buggy agent burning through reads can only spend what's in
                the wallet. Keep $5 there, the worst case is losing $5. Pair
                with <InlineCode>SKIM_MAX_PRICE_USD</InlineCode> for a per-call
                ceiling.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h3 className="font-bold mb-3">Accounting</h3>
              <p className="text-muted-foreground text-sm">
                A wallet that only ever pays for agent infrastructure makes a
                clean ledger. Every outgoing transaction is a Skim call (or
                another x402 service). No need to untangle agent spend from
                personal trades, NFT mints, or anything else.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem unlock */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-3xl font-bold">
              The same wallet unlocks the whole x402 ecosystem
            </h2>
          </div>
          <p className="text-lg text-muted-foreground mb-6 max-w-3xl">
            Once your agent has a Base wallet with USDC, Skim is just one of
            many x402-powered APIs it can pay. The same wallet, the same
            protocol, no per-service signup. Browse the growing registry at{" "}
            <ExtLink href="https://x402scan.com">x402scan.com</ExtLink>.
          </p>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <h3 className="font-bold text-foreground mb-2">
              Why this changes the cost math.
            </h3>
            <p className="text-muted-foreground">
              x402 services are priced for agents — fractions of a cent per
              call, not LLM-token rates. That means your agent wallet doesn't
              need to hold much money. $5 funds thousands of Skim reads. Top it
              up only when it runs low. No subscriptions, no quotas, no
              "predict your usage three months out."
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Wallet ready? Make your first call.
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Head to the docs for copy-paste curl, JavaScript, and Python
            samples. Your first paid read is about ten lines of code away.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/docs">
                Read the Docs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
              <Link href="/faq">Read the FAQ</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
