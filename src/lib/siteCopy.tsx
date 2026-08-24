import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

// --- Editable site copy -------------------------------------------------------
// Each slot below can be overridden from the operator-only /edit page.
// Defaults live here in code; overrides come from GET /api/site-copy.
// Notation inside a slot's text:
//   - blank/new lines render as line breaks
//   - [link text](url) renders as a link
//   - **text** renders in the brand accent color

export type CopySlot = {
  label: string;
  hint?: string;
  text: string;
};

export const COPY_SLOTS: Record<string, CopySlot> = {
  "home.eyebrow": {
    label: "Home — tagline above the headline",
    text: "Just Skim It",
  },
  "home.headline": {
    label: "Home — big headline",
    hint: "Text wrapped in **double asterisks** shows in blue.",
    text: "Clean markdown for any URL. **No wallet required.**",
  },
  "home.yes": {
    label: "Home — the Yes line",
    text: "Start with a free API key — 1,000 credits, no crypto:",
  },
  "home.step1": {
    label: "Home — step 1",
    hint: "Links use [link text](url).",
    text: "1. Create a key on the homepage, or [Start free](/pricing) on the Free Plan (card on file, never charged).",
  },
  "home.step2": {
    label: "Home — step 2",
    text: "2. Paste the sk402_ key into your agent — [curl and snippets in the docs](/docs#quickstart).",
  },
  "home.step3": {
    label: "Home — step 3",
    text: "3. Wallet pay (USDC on Base) is optional — [details here](/wallet) if you want per-call x402.",
  },
  "home.congrats": {
    label: "Home — congratulations line",
    text: "That's it. Your agent can read the web. x402 wallet pay stays available as a second path — browse other x402 tools at [agentic.market](https://agentic.market) if you want them.",
  },
  "home.descriptor": {
    label: "Home — supporting paragraph (what Skim is + prices)",
    text: "Skim is a clean URL-to-markdown reader for agents. $0.002 per read, or typed JSON for $0.015. The card API key (sk402_) is the default path. USDC on Base via x402 is optional. Don't pay LLM rates for non-LLM work.",
  },
  "home.freeNote": {
    label: "Home — note under the buttons",
    text: "Instant API key: 1,000 credits, no signup, no wallet. Monthly Free Plan: card on file, never charged.",
  },
  "faq.question": {
    label: "Q&A — highlighted question",
    text: "Do I need a crypto wallet to use Skim?",
  },
  "faq.yes": {
    label: "Q&A — the Yes line",
    text: "No. Start with a free API key — 1,000 credits, no crypto:",
  },
  "faq.step1": {
    label: "Q&A — step 1 (numbering is automatic)",
    text: "Create a key on the homepage, or [Start free](/pricing) on the Free Plan (card on file, never charged).",
  },
  "faq.step2": {
    label: "Q&A — step 2",
    text: "Paste the sk402_ key into your agent — [curl and snippets in the docs](/docs#quickstart).",
  },
  "faq.step3": {
    label: "Q&A — step 3",
    text: "Wallet pay (USDC on Base) is optional — [details here](/wallet) if you want per-call x402.",
  },
  "faq.congrats": {
    label: "Q&A — congratulations line",
    text: "That's it. Your agent can read the web. x402 wallet pay stays available as a second path — browse other x402 tools at [agentic.market](https://agentic.market) if you want them.",
  },
  "faq.detail": {
    label: "Q&A — closing line of the highlighted block",
    text: "That's the whole product. Everything below is detail.",
  },
  "faq.protip": {
    label: "Q&A — PRO TIP block (after the highlighted question)",
    text: "**PRO TIP:** Most teams share one sk402_ API key (or one per environment) and stay on a card plan. If you later want the optional wallet path for many agents, give a single lead agent its own funded wallet and let it spin up and manage wallets for the rest — you only ever top up the lead agent's wallet.",
  },
};

export type CopyKey = keyof typeof COPY_SLOTS;

const COPY_URL = `${import.meta.env.BASE_URL}api/site-copy`;

async function fetchOverrides(): Promise<Record<string, string>> {
  const res = await fetch(COPY_URL);
  if (!res.ok) throw new Error(`site-copy fetch failed: ${res.status}`);
  const data = (await res.json()) as { copy?: Record<string, string> };
  return data.copy ?? {};
}

export function useSiteCopy(): {
  copy: (key: CopyKey) => string;
  overrides: Record<string, string>;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["site-copy"],
    queryFn: fetchOverrides,
    staleTime: 60_000,
    retry: 1,
  });
  const overrides = data ?? {};
  return {
    copy: (key: CopyKey) => overrides[key] ?? COPY_SLOTS[key].text,
    overrides,
    isLoading,
  };
}

// --- Mini renderer: line breaks, [text](url) links, **accent** spans ----------

const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

// Only plain web links and site-relative paths — blocks javascript:/data: URLs.
export function isSafeLinkUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("#")
  );
}

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const parts = line.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={`${keyPrefix}-${i}`} className="text-primary">
          {part.slice(2, -2)}
        </span>
      );
    }
    const m = part.match(LINK_RE);
    if (m && isSafeLinkUrl(m[2])) {
      const [, text, url] = m;
      const external = /^https?:\/\//i.test(url);
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={url}
          {...(external ? { target: "_blank", rel: "noopener" } : {})}
          className="text-primary underline-offset-4 hover:underline"
        >
          {text}
        </a>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export function renderCopy(text: string): ReactNode {
  const lines = text.split(/\r?\n/);
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line, `l${i}`)}
    </Fragment>
  ));
}
