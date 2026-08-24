// Build-time prerender: writes one HTML file per public route with
// (a) route-specific <title>/<meta>/<link rel=canonical>/OG tags and
// (b) the route's actual server-rendered content inside <div id="root">,
// so AI crawlers and no-JS clients see each page's real text.
//
// Requires the SSR bundle built first:
//   vite build --ssr src/entry-server.tsx --outDir dist/server
// (wired up in package.json "build").

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "..", "dist", "public");
const indexPath = join(distDir, "index.html");
const serverEntry = resolve(__dirname, "..", "dist", "server", "entry-server.js");

if (!existsSync(indexPath)) {
  console.error(`[prerender] dist/index.html not found at ${indexPath}`);
  process.exit(1);
}
if (!existsSync(serverEntry)) {
  console.error(
    `[prerender] SSR bundle not found at ${serverEntry} — run the --ssr build first`
  );
  process.exit(1);
}

const { render } = await import(pathToFileURL(serverEntry).href);

const SITE = "https://skim402.com";

// title/description must stay in sync with each page's useDocumentMeta() call —
// the client sets the same values at runtime.
// noSitemap: true  — page is real but should not appear in sitemap.xml
//                    (post-auth screens, redirect stubs, etc.)
// lastmod           — ISO date string; included in sitemap when provided.
const routes = [
  {
    path: "/",
    outFile: "index.html",
    lastmod: "2026-08-17",
    title: "Skim — Web reads and Signals for AI agents",
    description:
      "Clean web reads and structured intelligence feeds for AI agents. Free plan included — 1,000 credits a month, no credit card required. Seventeen vertical Signals plus the x402 ecosystem feed. Pay by card on a monthly plan, or per-call in USDC by crypto wallet.",
    ogTitle: "Skim — Web reads and Signals for AI agents",
    ogDescription:
      "Clean web reads and structured intelligence feeds for AI agents. Free plan included — 1,000 credits a month. Pay by card or by crypto wallet.",
  },
  {
    path: "/playground",
    outFile: "playground/index.html",
    lastmod: "2026-08-23",
    title: "Reader Workbench | Skim",
    description:
      "Try Skim in the browser: one page, several pages, extract a table, crawl a site, read a PDF, watch a page, or poll a Signal. Uses the same free trial key as a single read.",
    ogTitle: "Reader Workbench | Skim",
    ogDescription:
      "Try one page, several pages, extract, crawl, PDF, watch, or a Signal — no curl required.",
  },
  {
    // Alias of /playground so /workbench and /workbench/ are the Workbench, not a 404.
    path: "/workbench",
    outFile: "workbench/index.html",
    noSitemap: true,
    title: "Reader Workbench | Skim",
    description:
      "Try Skim in the browser: one page, several pages, extract a table, crawl a site, read a PDF, watch a page, or poll a Signal. Uses the same free trial key as a single read.",
    ogTitle: "Reader Workbench | Skim",
    ogDescription:
      "Try one page, several pages, extract, crawl, PDF, watch, or a Signal — no curl required.",
  },
  {
    path: "/pricing",
    outFile: "pricing/index.html",
    lastmod: "2026-08-17",
    title: "Plans — free plan included, from $15/mo | Skim",
    description:
      "Sign up for a Skim plan in one Stripe checkout: a Free Plan with 1,000 credits every month, or paid plans from $15/mo. Real invoices, cancel anytime, API key delivered instantly. Every plan key works for reads and Signals.",
    ogTitle: "Skim Plans — free plan included, from $15/mo",
    ogDescription:
      "One Stripe checkout: card in, invoice out, API key delivered instantly. Free Plan with 1,000 credits every month.",
  },
  {
    // Redirect stub — prerender for SSR fallback but exclude from sitemap.
    path: "/card",
    outFile: "card/index.html",
    noSitemap: true,
    title: "Plans — free plan included, from $15/mo | Skim",
    description:
      "Skim's card plans now live on the Plans page: a Free Plan with 1,000 credits every month, or paid plans from $15. Real invoices, cancel anytime.",
    ogTitle: "Skim Plans — free plan included, from $15/mo",
    ogDescription:
      "One Stripe checkout: card in, invoice out, API key delivered instantly. Free Plan with 1,000 credits every month.",
  },
  {
    // Post-payment confirmation screen — not a public landing page.
    path: "/card/success",
    outFile: "card/success/index.html",
    noSitemap: true,
    title: "Payment received | Skim",
    description: "Your Skim API token.",
    ogTitle: "Payment received | Skim",
    ogDescription: "Your Skim API token.",
  },
  {
    // Authenticated account screen — not a useful search result.
    path: "/card/account",
    outFile: "card/account/index.html",
    noSitemap: true,
    title: "Your account | Skim",
    description:
      "Check your Skim balance: credits remaining, plan status, and pending overage. Manage billing or cancel anytime.",
    ogTitle: "Your account | Skim",
    ogDescription:
      "Check your Skim balance and manage billing — your API key is your account.",
  },
  {
    path: "/account",
    outFile: "account/index.html",
    noSitemap: true,
    title: "Your account | Skim",
    description:
      "Check your Skim balance: credits remaining, plan status, and pending overage. Manage billing or cancel anytime.",
    ogTitle: "Your account | Skim",
    ogDescription:
      "Check your Skim balance and manage billing — your API key is your account.",
  },
  {
    path: "/docs",
    outFile: "docs/index.html",
    lastmod: "2026-08-24",
    title: "Docs — reads, Signals, crawl, PDF, and more | Skim",
    description:
      "Complete Skim API docs: reads, crawl, PDF-to-markdown, watch webhooks, extraction, tables, datasets, Signals, and Skim Watch. Pay with a card-plan API key or per-call in USDC over x402. Quickstart in curl, JavaScript, and Python.",
    ogTitle: "Skim Docs — every endpoint, curl to Python",
    ogDescription:
      "Reads, crawl, PDF, watch webhooks, extraction, tables, datasets, 18 Signals. Pay with a plan key or per-call in USDC.",
  },
  {
    path: "/signals",
    outFile: "signals/index.html",
    lastmod: "2026-08-24",
    title: "Signals — intelligence feeds for AI agents | Skim",
    description:
      "Skim Signals: 17 vertical /signal/{slug} feeds plus the x402 ecosystem feed. Poll with a free sk402_ API key (2 credits). Wallet pay is optional.",
    ogTitle: "Skim Signals — intelligence feeds for agents",
    ogDescription:
      "Poll AI, security, research, and SEC feeds with a free sk402_ key. Wallet pay is optional.",
  },
  {
    path: "/signals/request",
    outFile: "signals/request/index.html",
    lastmod: "2026-08-24",
    title: "Request a custom Signal | Skim",
    description:
      "Ask Skim to build a custom intelligence feed for your agent. We aim to reply within two business days — same as the contact page.",
    ogTitle: "Request a custom Signal | Skim",
    ogDescription:
      "Tell us the vertical and example sources. Email goes to hello@skim402.com. We aim to reply within two business days.",
  },
  {
    path: "/contact",
    outFile: "contact/index.html",
    title: "Contact | Skim",
    description:
      "Get in touch with Skim. Email us with questions about the API, integration help, partnerships, or feedback. We read every message.",
    ogTitle: "Contact Skim",
    ogDescription:
      "Email hello@skim402.com with questions about the API, integration help, partnerships, or feedback.",
  },
  {
    path: "/faq",
    outFile: "faq/index.html",
    title: "FAQ — common questions about Skim | Skim",
    description:
      "Frequently asked questions about Skim: what it returns, what it costs, how the free plan works, how card and wallet billing differ, and how to connect it to your AI agent.",
  },
  {
    path: "/privacy",
    outFile: "privacy/index.html",
    title: "Privacy Policy | Skim",
    description:
      "How Skim handles data. The short version: the API requires no account and collects no personal information, the site runs no analytics, and operational telemetry is minimal and transient.",
  },
  {
    path: "/terms",
    outFile: "terms/index.html",
    title: "Terms of Service | Skim",
    description:
      "The terms that govern use of Skim, operated by Angeles Crest LLC. Service is provided as-is; you are responsible for the URLs you submit.",
  },
  {
    path: "/aup",
    outFile: "aup/index.html",
    title: "Acceptable Use Policy | Skim",
    description:
      "The Skim Acceptable Use Policy: the activities and content that are prohibited when using Skim, operated by Angeles Crest LLC.",
  },
  {
    path: "/wallet",
    outFile: "wallet/index.html",
    lastmod: "2026-08-17",
    title: "Pay per read with a crypto wallet | Skim",
    description:
      "How to pay for Skim reads and Signals with a Base wallet instead of a card plan. Set up a wallet in 60 seconds, fund it with USDC, paste the private key into your agent — no signup, no monthly commitment.",
    ogTitle: "Pay per read with a crypto wallet | Skim",
    ogDescription:
      "Set up a Base wallet in 60 seconds. Pay $0.002 per read in USDC — no signup, no monthly plan needed.",
  },
  {
    path: "/articles",
    outFile: "articles/index.html",
    title: "Articles on AI agents, web reads, and the machine economy | Skim",
    description:
      "Essays and guides from the team behind Skim: AI infrastructure, agent payments, x402, and the shape of the next web stack.",
  },
  {
    path: "/articles/saner-way-forward",
    outFile: "articles/saner-way-forward/index.html",
    lastmod: "2026-04-01",
    title: "At AI's Growing Pain Moment: The Saner Way Forward | Skim",
    description:
      "A great deal of what gets billed as AI work is not AI work at all. The right shape for an AI system has three layers, not one — and the predictable layer should cost a small fraction of a cent.",
  },
  {
    path: "/articles/your-agent-is-not-a-user",
    outFile: "articles/your-agent-is-not-a-user/index.html",
    lastmod: "2026-05-01",
    title: "The API Key Is Today's Floppy Disk | Skim",
    description:
      "Up to 30x faster. Up to 30x cheaper. API keys still work — the shelf is full — but a quiet substitution is underway, and the agents that move first get the better tools.",
  },
  {
    path: "/articles/agent-wallet-setup",
    outFile: "articles/agent-wallet-setup/index.html",
    lastmod: "2026-05-15",
    title: "How to Set Up Your AI Agent's Wallet | Skim",
    description:
      "One wallet, one budget, the whole stack. How to set up your agent's wallet for x402 payments: install, fund with USDC on Base, and wire it into your agent's config.",
  },
  {
    path: "/articles/give-your-agent-web-access",
    outFile: "articles/give-your-agent-web-access/index.html",
    lastmod: "2026-06-01",
    title: "How to Give Your AI Agent Clean Web Reads | Skim",
    description:
      "A five-minute quickstart: give your agent a wallet, point an x402 client at Skim, and turn any URL into clean markdown for $0.002 a call — no card, no API key required.",
  },
  {
    path: "/articles/nothing-to-steal",
    outFile: "articles/nothing-to-steal/index.html",
    lastmod: "2026-06-15",
    title: "Nothing to Steal: the case for a least-privilege web reader | Skim",
    description:
      "BioShocking showed AI browsers can be manipulated into handing over credentials. The structural defense is least privilege: read the untrusted web with a reader that carries no credentials and takes no actions.",
  },
  {
    path: "/articles/the-invisible-economy",
    outFile: "articles/the-invisible-economy/index.html",
    lastmod: "2026-06-01",
    title: "The Invisible Economy Is Already Being Built | Skim",
    description:
      "Raoul Pal calls the coming machine-speed 'invisible economy' the native domain of crypto rails. Skim — clean reads for AI agents, paid per call in USDC on Base — is that thesis already working.",
  },
  {
    path: "/articles/the-last-human-in-the-loop",
    outFile: "articles/the-last-human-in-the-loop/index.html",
    lastmod: "2026-07-01",
    title: "The Last Human in the Loop — why agents need wallets, not API keys | Skim",
    description:
      "An API key keeps a human in the loop: someone signed up, entered a card, and holds the billing relationship. A wallet removes that human. Why an autonomous agent needs a wallet, not an API key.",
  },
  {
    path: "/articles/skim-on-cloudflare-agents",
    outFile: "articles/skim-on-cloudflare-agents/index.html",
    lastmod: "2026-07-15",
    title: "Run Skim from a Cloudflare Agent or Worker | Skim",
    description:
      "Step-by-step guide: pay for clean web reads from a Cloudflare Worker or Agents SDK agent. Wrap fetch with an x402 client, store the wallet key as a Worker secret, and read any URL for $0.002 in USDC.",
  },
  {
    path: "/articles/skim-on-aws-agentcore",
    outFile: "articles/skim-on-aws-agentcore/index.html",
    lastmod: "2026-07-15",
    title: "Run Skim from AWS AgentCore (Amazon Bedrock) | Skim",
    description:
      "Step-by-step guide: give an Amazon Bedrock AgentCore agent paid web reads. Add a Skim tool with the x402 Python SDK, keep the wallet key in a managed secret, and read any URL for $0.002 in USDC.",
  },
  {
    path: "/articles/the-elephant-in-the-dashboard",
    outFile: "articles/the-elephant-in-the-dashboard/index.html",
    lastmod: "2026-08-01",
    title: "The Elephant in Your Usage Dashboard | Skim",
    description:
      "A startup's agent-fleet dashboard showed $803 of weekly spend — 99% of it LLM tokens. Most of that is deterministic work billed at model rates. Free savings estimate: email a screenshot, get a breakdown.",
  },
  {
    path: "/audit",
    outFile: "audit/index.html",
    lastmod: "2026-08-01",
    title: "The Skim Audit — free AI agent spend analysis | Skim",
    description:
      "Send a screenshot of your agent usage dashboard, get back a free executive-level savings estimate: how much of your LLM spend is deterministic work billed at model rates, and what routing it to flat-priced infrastructure would save.",
  },
];

const baseHtml = readFileSync(indexPath, "utf8");

function escapeAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rewriteHead(html, route) {
  const canonical = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const t = escapeAttr(route.title);
  const d = escapeAttr(route.description);
  const ot = escapeAttr(route.ogTitle ?? route.title);
  const od = escapeAttr(route.ogDescription ?? route.description);

  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/>/,
      `<meta name="description" content="${d}" />`
    )
    .replace(
      /<link rel="canonical" href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${canonical}" />`
    )
    .replace(
      /<meta property="og:title" content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${ot}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${od}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*"\s*\/>/,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*"\s*\/>/,
      `<meta name="twitter:title" content="${ot}" />`
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${od}" />`
    );

  if (route.ogImage) {
    const img = `${SITE}${route.ogImage}`;
    const alt = route.ogImageAlt ? escapeAttr(route.ogImageAlt) : ot;
    const before = out;
    out = out
      .replace(
        /<meta property="og:image" content="[^"]*"\s*\/>/,
        `<meta property="og:image" content="${img}" />`
      )
      .replace(
        /<meta property="og:image:alt" content="[^"]*"\s*\/>/,
        `<meta property="og:image:alt" content="${alt}" />`
      )
      .replace(
        /<meta name="twitter:image" content="[^"]*"\s*\/>/,
        `<meta name="twitter:image" content="${img}" />`
      )
      .replace(
        /<meta name="twitter:image:alt" content="[^"]*"\s*\/>/,
        `<meta name="twitter:image:alt" content="${alt}" />`
      );
    if (!out.includes(`content="${img}"`) || out === before) {
      throw new Error(
        `[prerender] ogImage replacement failed for ${route.path} — check index.html image meta tags`
      );
    }
  }

  return out;
}

// Replace the SPA shell (noscript fallback) inside <div id="root"> with the
// route's actual server-rendered markup. The base index.html root div contains
// no nested </div>, so a non-greedy match anchored to </body> is safe.
const rootRe = /<div id="root">[\s\S]*?<\/div>(\s*<\/body>)/;

function injectBody(html, appHtml) {
  if (!rootRe.test(html)) {
    throw new Error("[prerender] <div id=\"root\"> not found in index.html");
  }
  return html.replace(rootRe, `<div id="root">${appHtml}</div>$1`);
}

let written = 0;
for (const route of routes) {
  const appHtml = render(route.path);
  const textLen = appHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  // /card/success is a short confirmation page by design.
  // /card is a redirect stub — plans were consolidated into /pricing.
  // The redesigned site chrome is much leaner (minimal footer), so static
  // text counts dropped across the board.
  const minTextLen = ["/card/success", "/card"].includes(route.path) ? 100 : 300;
  if (textLen < minTextLen) {
    throw new Error(
      `[prerender] route ${route.path} rendered only ${textLen} chars of text — refusing to write a near-empty page`
    );
  }
  const outPath = join(distDir, route.outFile);
  mkdirSync(dirname(outPath), { recursive: true });
  const html = injectBody(rewriteHead(baseHtml, route), appHtml);
  writeFileSync(outPath, html, "utf8");
  written++;
  console.log(`[prerender] wrote ${route.outFile} (${route.path}, ${textLen} text chars)`);
}
console.log(`[prerender] done — ${written} routes`);

// --- sitemap.xml ---
// Generated from the same route list above so it can never drift out of sync.
// Routes flagged noSitemap:true are excluded (post-auth screens, redirect stubs).
// AI crawlers lean on sitemaps to discover content — every public, indexable
// route must appear here with accurate changefreq, priority, and lastmod.
function sitemapMeta(path) {
  if (path === "/") return { changefreq: "weekly", priority: "1.0" };
  if (["/pricing", "/docs", "/signals", "/wallet"].includes(path))
    return { changefreq: "weekly", priority: "0.9" };
  if (path === "/signals/request") return { changefreq: "monthly", priority: "0.7" };
  if (["/faq", "/audit"].includes(path))
    return { changefreq: "monthly", priority: "0.85" };
  if (path.startsWith("/articles"))
    return { changefreq: "monthly", priority: "0.75" };
  if (["/privacy", "/terms", "/aup", "/contact"].includes(path))
    return { changefreq: "yearly", priority: "0.4" };
  return { changefreq: "monthly", priority: "0.8" };
}

const sitemapBody = routes
  .filter((route) => !route.noSitemap)
  .map((route) => {
    const loc = `${SITE}${route.path === "/" ? "/" : route.path}`;
    const { changefreq, priority } = sitemapMeta(route.path);
    const lastmodLine = route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : "";
    return `  <url>\n    <loc>${loc}</loc>${lastmodLine}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join("\n");

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapBody}\n</urlset>\n`;
writeFileSync(join(distDir, "sitemap.xml"), sitemapXml, "utf8");
console.log(`[prerender] wrote sitemap.xml (${routes.length} urls)`);
