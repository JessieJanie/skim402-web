import { useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ArrowLeft, Check, Copy } from "lucide-react";

function Snippet({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  return (
    <div className="not-prose group relative my-6">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-5 pr-20 text-sm font-mono leading-relaxed text-slate-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const WORKER_TOOL = `// src/skim.ts — a paid web-read helper for any Worker or Agent
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

export function makeSkimReader(privateKey: \`0x\${string}\`) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, transport: http(), chain: base });
  const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);

  return async function skimRead(url: string) {
    const res = await fetchWithPayment("https://skim402.com/api/v1/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(\`Skim \${res.status}: \${await res.text()}\`);
    return (await res.json()) as {
      markdown: string;
      text: string;
      metadata: { title?: string; byline?: string; publishedAt?: string };
    };
  };
}`;

const AGENT_USAGE = `// src/agent.ts — inside a Cloudflare Agent
import { Agent } from "agents";
import { makeSkimReader } from "./skim";

export class ResearchAgent extends Agent<Env> {
  async readPage(url: string) {
    const skimRead = makeSkimReader(
      this.env.SKIM_WALLET_PRIVATE_KEY as \`0x\${string}\`,
    );
    const page = await skimRead(url);
    // page.markdown is clean, agent-ready — hand it to your model.
    return page;
  }
}`;

const SECRETS = `# Local development — .dev.vars (gitignored)
SKIM_WALLET_PRIVATE_KEY="0x..."

# Production
npx wrangler secret put SKIM_WALLET_PRIVATE_KEY`;

const INSTALL = `npm install x402-fetch viem`;

export default function SkimOnCloudflareAgents() {
  useDocumentMeta({
    title: "Run Skim from a Cloudflare Agent | Skim™",
    description:
      "A guide to paying for clean web reads from a Cloudflare Worker or Agents SDK agent: wrap fetch with an x402 client, store the wallet key as a Worker secret, and read any URL for $0.002 in USDC on Base.",
    canonical: "https://skim402.com/articles/skim-on-cloudflare-agents",
  });

  return (
    <PublicLayout>
      <article className="pt-20 pb-24 md:pt-28">
        <div className="container mx-auto px-4 max-w-2xl">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>

          <header className="mb-12">
            <time
              dateTime="2026-07-12"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              July 12, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Run Skim from a Cloudflare Agent
            </h1>
            <p className="mt-3 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              Ten lines of Worker code, no API key, $0.002 a read.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              Cloudflare has gone further than any other platform in making
              agent payments a first-class feature. The Agents SDK ships with
              built-in x402 support: servers can charge for tools, clients can
              pay for them, and the docs assume your agent has a wallet the
              same way older docs assumed it had an API key. If you are
              building on Workers or the Agents SDK, your agent is already
              running in the most x402-friendly environment there is.
            </p>

            <p>
              Skim fits into that environment with less machinery than you
              might expect, because Skim is not an MCP server you have to
              connect to — it is a plain x402 HTTP endpoint. One POST, one 402
              handshake, clean markdown back. Here is the whole setup.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              1. Install the x402 client
            </h2>
            <p>
              Two packages: an x402-aware fetch wrapper and{" "}
              <code>viem</code> for wallet signing. Both run on Workers without
              polyfills.
            </p>
            <Snippet>{INSTALL}</Snippet>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              2. Store the wallet key as a secret
            </h2>
            <p>
              Your agent pays from its own wallet — a dedicated one, funded
              with a few dollars of USDC on Base, never your personal wallet.
              Store the private key the way Cloudflare stores any secret:
            </p>
            <Snippet>{SECRETS}</Snippet>
            <p>
              The key never leaves your Worker. It is only used to sign a USDC
              transfer authorization locally; the signed payload travels, the
              key does not.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              3. Wrap fetch, point it at Skim
            </h2>
            <p>
              <code>wrapFetchWithPayment</code> gives you a fetch that handles
              the 402 handshake automatically: first call gets the price quote,
              the wallet signs, the retry carries the payment, and Skim returns
              the page.
            </p>
            <Snippet>{WORKER_TOOL}</Snippet>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              4. Call it from your Agent
            </h2>
            <Snippet>{AGENT_USAGE}</Snippet>
            <p>
              That is the entire integration. No account with Skim, no key
              rotation, no billing dashboard. Each read settles $0.002 in USDC
              on Base at call time, and the settlement receipt comes back in
              the <code>X-PAYMENT-RESPONSE</code> header (base64-encoded JSON
              with the transaction hash) if you want to log it — the JSON body
              itself is just the clean content.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              What about withX402Client?
            </h2>
            <p>
              The Agents SDK also ships <code>withX402Client</code>, which
              wraps an MCP client connection so your agent can pay for
              x402-protected MCP tools, with an optional human-in-the-loop
              confirmation callback before each payment. That is the right
              tool when the paid service only exists as a remote MCP server.
              Skim does not require it — the plain HTTP endpoint above is
              fewer moving parts — but the two coexist fine: use{" "}
              <code>withX402Client</code> for paid MCP tools, and the wrapped
              fetch for paid HTTP APIs like Skim.
            </p>
            <p>
              If you want a spending guardrail either way, the fetch wrapper
              accepts a maximum payment amount, and Skim's prices are fixed
              and published: $0.002 for a basic read, $0.005 with JavaScript
              rendering, $0.015 for schema-typed extraction.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              Why this pairing makes sense
            </h2>
            <p>
              Cloudflare is building the paid-web rails — its Monetization
              Gateway lets any site behind Cloudflare charge agents over x402.
              As more of the web starts answering agents with 402, the agents
              that thrive will be the ones whose reading layer already speaks
              payment natively. A Cloudflare agent with a funded wallet and a
              Skim tool reads the open web today and is positioned for the
              tolled web tomorrow.
            </p>

            <p>
              Full API reference, response shapes, and error semantics are in
              the{" "}
              <Link href="/docs" className="text-primary hover:underline">
                docs
              </Link>
              . Wallet setup, if you have not done it before, is a five-minute
              job —{" "}
              <Link
                href="/articles/agent-wallet-setup"
                className="text-primary hover:underline"
              >
                here is the walkthrough
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
