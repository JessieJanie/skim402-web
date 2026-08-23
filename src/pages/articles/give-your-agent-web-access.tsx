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

export default function GiveYourAgentWebAccess() {
  useDocumentMeta({
    title: "How to Give Your AI Agent Clean Web Reads | Skim™",
    description:
      "A five-minute quickstart: start with a free API key (1,000 credits, no wallet), or optionally pay per call from a Base wallet. Turn any URL into clean markdown for $0.002 a call.",
    canonical: "https://skim402.com/articles/give-your-agent-web-access",
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

          <figure className="not-prose mb-14 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-slate-800 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-slate-500">
                agent.ts
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 text-sm font-mono leading-relaxed text-slate-300">
              <code>{`// your agent needs to read a page
const { data } = await skim.post("/v1/read", {
  url: "https://example.com/article",
});

// 402 Payment Required  ->  pays $0.002 from its wallet
// clean markdown back in about 1.5 seconds
console.log(data.markdown);`}</code>
            </pre>
          </figure>

          <header className="mb-12">
            <time
              dateTime="2026-06-06"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              June 6, 2026
            </time>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              How to Give Your AI Agent Clean Web Reads
            </h1>
            <p className="mt-3 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              A working setup in about five minutes.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              Reading the web is the most common thing a modern agent does. To
              research, to decide, to act, an agent has to pull in a page and
              make sense of it. The trouble is the way most of us do it first:
              fetch the raw HTML, hand the whole mess to a flagship language
              model, and ask it to clean up. That works, but it is the slow,
              expensive way — six to ten seconds per page, and a bill that runs
              into the tens of dollars per thousand reads, for what is really
              clerical work.
            </p>

            <p>
              There is a faster way, and you can have it running in about five
              minutes. The default path is a free{" "}
              <code className="font-mono text-sm">sk402_</code> API key — 1,000
              credits, no wallet, no crypto.{" "}
              <Link href="/" className="text-primary hover:underline">
                Create a key
              </Link>{" "}
              on the homepage or{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                Start free
              </Link>{" "}
              on the monthly Free Plan, then send{" "}
              <code className="font-mono text-sm">Authorization: Bearer sk402_…</code>{" "}
              to <code className="font-mono text-sm">/api/t/read</code>. The
              walkthrough below is the optional x402 path: your agent pays a
              fraction of a cent per page from its own wallet.
            </p>

            <p>
              Not writing the code yourself? You don't have to. If you're
              building with an AI agent — vibe coding, as it's often called — you
              can point your agent at the{" "}
              <Link href="/docs" className="text-primary hover:underline">
                docs
              </Link>{" "}
              and ask it to set up clean web reads with Skim for you. The docs
              are written to be read by agents, so yours can do the wiring while
              you watch. You can even ask it to create and fund a wallet for
              itself to use. The walkthrough below is here for anyone who wants to
              see exactly what's happening — but you can absolutely let your agent
              drive. Keep reading either way; you'll still pick up useful context,
              including tips for setting up your agent's wallet.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              What you'll need
            </h2>

            <ul className="list-disc pl-6 space-y-2">
              <li>Node.js or Python — whichever your agent already runs on.</li>
              <li>
                A wallet for your agent, funded with a few dollars of USDC on
                Base. At $0.002 a read, even $5 buys you 2,500 pages.
              </li>
              <li>
                That's it. There is nothing to sign up for on Skim's side — the
                wallet is the only credential.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Step 1 — Give your agent a wallet
            </h2>

            <p>
              A wallet is just a key pair your agent holds itself. You can make
              one in two lines, then fund it with a small amount of USDC on Base
              from any exchange or wallet app. Keep this a <em>hot</em> wallet —
              top it up with a little at a time, not your savings — so the most
              it can ever lose is what's in it.
            </p>

            <Snippet>{`import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("Address:", account.address); // fund this with USDC on Base
console.log("Private key:", privateKey);   // save this somewhere safe`}</Snippet>

            <p>
              If you want the longer version of why one wallet (not one per
              service) is the right call, see{" "}
              <Link
                href="/articles/agent-wallet-setup"
                className="text-primary hover:underline"
              >
                How to Set Up Your Agent's Wallet
              </Link>
              .
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Step 2 — Point an x402 client at Skim
            </h2>

            <p>
              Skim speaks{" "}
              <a
                href="https://x402.org"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                x402
              </a>
              , the open protocol that lets any HTTP service ask for payment with
              a standard <code>402 Payment Required</code> response. You don't
              have to handle that handshake yourself — an x402 client wraps your
              normal HTTP calls and pays automatically when a service asks,
              signing with your agent's wallet. Here it is with{" "}
              <code>x402-axios</code> in JavaScript:
            </p>

            <Snippet>{`// npm install x402-axios@1.2.0 viem axios
// (pin 1.2.0 — x402-axios@1.2.1 has a broken dependency and fails to install)
import { withPaymentInterceptor } from "x402-axios";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

// Your agent's wallet — funded with USDC on Base.
const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);

// Axios client that automatically pays 402 responses up to your max.
const skim = withPaymentInterceptor(
  axios.create({ baseURL: "https://skim402.com/api" }),
  wallet,
);`}</Snippet>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Step 3 — Read a page
            </h2>

            <p>
              Now the part you came for. Ask Skim to read a URL, and the client
              takes care of the rest: the first request comes back{" "}
              <code>402</code>, the client signs a $0.002 payment from the
              wallet, retries, and hands you the result.
            </p>

            <Snippet>{`const { data } = await skim.post("/v1/read", {
  url: "https://example.com/article",
});

console.log(data.markdown);`}</Snippet>

            <p>What comes back is clean, structured, and ready to use:</p>

            <Snippet>{`{
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
  "fetchedAt": "2026-05-16T18:42:11Z"
}`}</Snippet>

            <p>
              That round trip takes about a second and a half, and it cost two
              tenths of a cent. The same read handed to a flagship model takes
              six to ten seconds and costs roughly thirty times as much — for an
              answer that's often messier, because the model is guessing at page
              structure instead of parsing it.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              What just happened
            </h2>

            <p>
              No account. No key in a config file. No dashboard. Your agent
              showed up at the door, the door said "that'll be $0.002," your
              agent paid from its own wallet, and the door opened. The wallet is
              the identity, and the receipt is the transaction — there is nothing
              to reconcile later. That is the whole idea: a credential and a
              payment method built for a machine, not borrowed from a human.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              The same thing in Python or curl
            </h2>

            <p>Python, using the x402 SDK:</p>

            <Snippet>{`from x402 import x402ClientSync
from x402.client import max_amount
from x402.http.clients.requests import wrapRequestsWithPayment
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.evm.signers import EthAccountSigner
from eth_account import Account
import os, requests

account = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])
client = x402ClientSync()
register_exact_evm_client(client, EthAccountSigner(account), policies=[max_amount(10_000)])
skim = wrapRequestsWithPayment(requests.Session(), client)

res = skim.post(
    "https://skim402.com/api/v1/read",
    json={"url": "https://example.com/article"},
)
print(res.json()["markdown"])`}</Snippet>

            <p>
              Or raw curl, if you just want to see the handshake with your own
              eyes:
            </p>

            <Snippet>{`# 1. First call — server replies 402 Payment Required with x402 instructions
curl -i -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/article" }'

# 2. Sign and submit payment with any x402 client, then retry the same
#    request with the X-PAYMENT header set.
curl -X POST https://skim402.com/api/v1/read \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-payment-payload>" \\
  -d '{ "url": "https://example.com/article" }'`}</Snippet>

            <p>
              Skim works with any x402-compliant client — <code>x402-axios</code>
              , <code>x402-fetch</code>, the Python <code>x402</code> SDK,
              Coinbase's AgentKit, Anthropic's MCP x402 connector, and the Vercel
              AI SDK x402 middleware among them.
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground !mt-12">
              Where to go from here
            </h2>

            <p>
              That basic read covers the large majority of pages. When you need
              more, the same wallet and the same pattern carry over:
            </p>

            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>JavaScript-heavy pages</strong> that render client-side —
                use <code>POST /v1/read/js</code>, which loads the page in a real
                headless browser first.
              </li>
              <li>
                <strong>Many URLs at once</strong> — <code>POST /v1/read/batch</code>{" "}
                reads up to ten in a single paid call.
              </li>
              <li>
                <strong>Typed JSON instead of markdown</strong> — <code>POST /v1/extract</code>{" "}
                returns data shaped to a schema you provide.
              </li>
            </ul>

            <p>
              The full reference, with every field and error code, lives in the{" "}
              <Link href="/docs" className="text-primary hover:underline">
                docs
              </Link>
              .
            </p>

            <p>
              And that's the whole thing. In about five minutes you gave your
              agent the ability to read the web — cleanly, in a second and a
              half, for a fifth of a cent — without opening a single signup form.
            </p>
          </div>

          <footer className="mt-16 pt-8 border-t border-border/60">
            <p className="text-base text-foreground font-medium">
              Karilyn Colegrove
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Founder, Skim &middot;{" "}
              <a
                href="https://skim402.com"
                className="text-primary hover:underline"
              >
                skim402.com
              </a>
            </p>
          </footer>

          <div className="mt-12 pt-8 border-t border-border/60 flex items-center justify-between">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All articles
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-primary hover:underline"
            >
              Read the docs &rarr;
            </Link>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
