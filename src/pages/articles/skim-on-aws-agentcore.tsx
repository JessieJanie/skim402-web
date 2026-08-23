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

const STRANDS_TOOL = `# skim_tool.py — a paid web-read tool for a Strands agent
# pip install strands-agents "x402[evm]" requests eth-account
import os
import requests
from strands import tool
from x402 import x402ClientSync
from x402.client import max_amount
from x402.http.clients.requests import wrapRequestsWithPayment
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.evm.signers import EthAccountSigner
from eth_account import Account

account = Account.from_key(os.environ["SKIM_WALLET_PRIVATE_KEY"])
_client = x402ClientSync()
register_exact_evm_client(
    _client,
    EthAccountSigner(account),
    # Per-call cap in USDC atomic units (6 decimals).
    # 20_000 = $0.02 covers every Skim endpoint.
    policies=[max_amount(20_000)],
)
session = wrapRequestsWithPayment(requests.Session(), _client)


@tool
def skim_read_url(url: str) -> dict:
    """Fetch any web page and return clean Markdown plus metadata.

    Strips ads, navigation, scripts, and trackers. Costs $0.002 in
    USDC, paid automatically over x402. Use whenever you need to
    read, summarize, or analyze a URL.

    Args:
        url: Absolute https URL of the page to read.
    """
    r = session.post(
        "https://skim402.com/api/v1/read",
        json={"url": url},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()`;

const STRANDS_AGENT = `# agent.py — the AgentCore entrypoint
from strands import Agent
from skim_tool import skim_read_url

agent = Agent(
    system_prompt="You are a research assistant that reads the live web.",
    tools=[skim_read_url],
)`;

const CONNECTORS = `# Using LangChain / LangGraph inside AgentCore instead?
pip install langchain-skim        # LangChain / LangGraph
pip install crewai-skim           # CrewAI
pip install llama-index-readers-skim  # LlamaIndex

# Each ships a ready-made tool that reads
# SKIM_WALLET_PRIVATE_KEY from the environment:
from langchain_skim import SkimReader
reader = SkimReader()`;

export default function SkimOnAwsAgentcore() {
  useDocumentMeta({
    title: "Run Skim from AWS AgentCore | Skim™",
    description:
      "A guide to giving an Amazon Bedrock AgentCore agent paid web reads: add a Skim tool with the x402 Python SDK, keep the wallet key in a managed secret, and read any URL for $0.002 in USDC — no API keys.",
    canonical: "https://skim402.com/articles/skim-on-aws-agentcore",
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
              Run Skim from AWS AgentCore
            </h1>
            <p className="mt-3 text-xl md:text-2xl font-medium text-muted-foreground tracking-tight">
              One tool file, one secret, clean web reads from any hosted agent.
            </p>
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground/90 space-y-6 text-lg leading-relaxed">
            <p>
              Amazon Bedrock AgentCore is AWS's managed home for production
              agents: you write agent code in the framework of your choice —
              Strands, LangChain and LangGraph, CrewAI, OpenAI's Agents SDK —
              and AgentCore Runtime hosts it in a serverless container with
              identity, memory, and observability handled for you. AWS is
              also a member of the x402 Foundation, and CloudFront can now
              charge agents for content over x402 — so an agent on AWS that
              pays per call is not exotic; it is where the platform is
              heading.
            </p>

            <p>
              Giving an AgentCore agent clean web reads via Skim takes one
              tool file and one secret. No AgentCore Gateway target, no OAuth
              provider, no API key rotation — Skim has no accounts to
              integrate with. The tool pays $0.002 per read in USDC over
              x402, straight from a wallet you control.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              1. Write the tool
            </h2>
            <p>
              AWS's own tutorials use Strands, so here is the Strands
              version. The payment-aware session comes from the official x402
              Python SDK; everything else is a normal tool definition.
            </p>
            <Snippet>{STRANDS_TOOL}</Snippet>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              2. Hand it to the agent
            </h2>
            <Snippet>{STRANDS_AGENT}</Snippet>
            <p>
              Deploying is unchanged from any AgentCore project: scaffold and
              ship with the AgentCore CLI per AWS's{" "}
              <a
                href="https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                getting-started guide
              </a>
              . The Skim tool adds three pip dependencies and one environment
              variable to that flow.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              3. Keep the key out of the container
            </h2>
            <p>
              The wallet's private key belongs in a managed secret, not in
              your image or your repository. Store it in AWS Secrets Manager
              or Parameter Store and inject it as the{" "}
              <code>SKIM_WALLET_PRIVATE_KEY</code> environment variable at
              deploy time. Two habits keep this boring: use a dedicated
              wallet that exists only to pay for reads, and keep only a small
              float in it — a few dollars of USDC on Base covers thousands of
              pages. The key is only ever used to sign transfer
              authorizations locally inside your container; it is never sent
              to Skim or anyone else.
            </p>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              Already on LangChain, CrewAI, or LlamaIndex?
            </h2>
            <p>
              AgentCore hosts those frameworks too, and Skim publishes
              official connectors for each — the tool above already written,
              tested, and on PyPI:
            </p>
            <Snippet>{CONNECTORS}</Snippet>

            <h2 className="text-2xl font-bold tracking-tight mt-12">
              A note on AgentCore Gateway
            </h2>
            <p>
              If your team routes all tools through AgentCore Gateway, you
              might look for a Skim "target" to configure. There isn't one to
              set up, and that is the point: Gateway targets exist to manage
              the credentials of services that need them — OAuth flows, API
              keys, signed requests. Skim has no credentials to manage. The
              payment is the authentication, and it lives inside the tool
              call itself. Run the tool directly in your agent code and skip
              the ceremony.
            </p>

            <p>
              Full API reference and response shapes are in the{" "}
              <Link href="/docs" className="text-primary hover:underline">
                docs
              </Link>
              , and if the agent's wallet is the last missing piece,{" "}
              <Link
                href="/articles/agent-wallet-setup"
                className="text-primary hover:underline"
              >
                the wallet setup guide
              </Link>{" "}
              covers it in five minutes.
            </p>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
