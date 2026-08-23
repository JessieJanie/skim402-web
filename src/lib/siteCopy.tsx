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
    text: '"Can my agent just pay **with money?**"',
  },
  "home.yes": {
    label: "Home — the Yes line",
    text: "Yes. Finally. Just these 3 easy steps (no signups or API keys):",
  },
  "home.step1": {
    label: "Home — step 1",
    hint: "Links use [link text](url).",
    text: "1. Get your agent its own wallet, funded with a credit or debit card — [details here](/wallet#fund).",
  },
  "home.step2": {
    label: "Home — step 2",
    text: "2. Give your agent the wallet's key — [details here](/wallet#key).",
  },
  "home.step3": {
    label: "Home — step 3",
    text: "3. Tell your agent to go to skim402.com to wire itself up.",
  },
  "home.congrats": {
    label: "Home — congratulations line",
    text: "Congratulations! Your agent can now use Skim and all other x402 tools — just send it shopping at a directory such as [agentic.market](https://agentic.market) to find them.",
  },
  "home.descriptor": {
    label: "Home — supporting paragraph (what Skim is + prices)",
    text: "Skim turns any URL into agent-ready markdown for $0.002 per read, or typed JSON for $0.015. Pay by card on a monthly plan, or per-call in USDC by crypto wallet. Don't pay LLM rates for non-LLM work.",
  },
  "home.freeNote": {
    label: "Home — note under the buttons",
    text: "10 free skims a day for humans — no signup, no wallet, no API key.",
  },
  "faq.question": {
    label: "Q&A — highlighted question",
    text: "Can my agent just pay with money?",
  },
  "faq.yes": {
    label: "Q&A — the Yes line",
    text: "Yes. Finally. Just these 3 easy steps (no signups or API keys):",
  },
  "faq.step1": {
    label: "Q&A — step 1 (numbering is automatic)",
    text: "Get your agent its own wallet, funded with a credit or debit card — [details here](/wallet#fund).",
  },
  "faq.step2": {
    label: "Q&A — step 2",
    text: "Give your agent the wallet's key — [details here](/wallet#key).",
  },
  "faq.step3": {
    label: "Q&A — step 3",
    text: "Tell your agent to go to skim402.com to wire itself up.",
  },
  "faq.congrats": {
    label: "Q&A — congratulations line",
    text: "Congratulations! Your agent can now use Skim and all other x402 tools — just send it shopping at a directory such as [agentic.market](https://agentic.market) to find them.",
  },
  "faq.detail": {
    label: "Q&A — closing line of the highlighted block",
    text: "That's the whole product. Everything below is detail.",
  },
  "faq.protip": {
    label: "Q&A — PRO TIP block (after the highlighted question)",
    text: "**PRO TIP:** Running more than one agent? Give a single lead agent its own funded wallet and let it spin up and manage wallets for the rest — issuing each worker agent its own wallet, topping them up as needed, and keeping the books. You only ever top up the lead agent's wallet. One wallet for you to think about, any number of agents at work.",
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
