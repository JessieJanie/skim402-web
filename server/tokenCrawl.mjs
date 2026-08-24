/**
 * POST /api/t/crawl  (also GET /api/t/crawl?url=)
 *
 * Developer gives a site origin or start URL. Skim discovers important
 * same-origin pages via sitemap.xml and/or links on the start page, then
 * returns clean markdown for each. Cap 25. 1 credit per successful page
 * via the existing /api/t/read ledger.
 */

import {
  connectMiddleware,
  getBearerToken,
  isBlockedUrl,
  mapPool,
  sameOrigin,
  decodeXml,
  safeFetch,
  tokenRead,
  verifyToken,
  vitePlugin,
} from "./http.mjs";

export const CRAWL_MAX_PAGES = 25;
export const CRAWL_CONCURRENCY = 5;
const DISCOVERY_CAP = 200;
const SITEMAP_MAX_BYTES = 2 * 1024 * 1024;
const HTML_MAX_BYTES = 1_500_000;

const IMPORTANT = [
  { re: /^\/?$/, score: 120 },
  { re: /\/(docs?|documentation|developer|developers|reference|api|guide|learn|handbook)\b/, score: 90 },
  { re: /\/(about|pricing|product|products|changelog|blog|news|help|support|faq)\b/, score: 70 },
  { re: /\/(security|status|customers|use-cases|integrations?)\b/, score: 50 },
];
const SKIP = /\/(login|signin|sign-up|signup|register|cart|checkout|account|privacy|terms|cookie|legal|wp-admin|tag\/|tags\/|author\/)/i;

export function normalizeStartUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { error: "url is required" };
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "url must be http(s)" };
    }
    if (isBlockedUrl(parsed.href)) return { error: "Invalid URL", status: 403 };
    return { url: parsed.href, origin: `${parsed.protocol}//${parsed.host}` };
  } catch {
    return { error: "Invalid URL", status: 400 };
  }
}

/** Collapse trailing-slash twins so example.com and example.com/ bill once. */
export function canonicalizePageUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    let path = parsed.pathname || "/";
    if (path.length > 1) {
      path = path.replace(/\/+$/, "") || "/";
      if (!path.startsWith("/")) path = `/${path}`;
    } else {
      path = "/";
    }
    parsed.pathname = path;
    return parsed.href;
  } catch {
    return null;
  }
}

export function pageScore(url) {
  let path;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return -100;
  }
  if (SKIP.test(path)) return -80;
  let score = 10;
  for (const rule of IMPORTANT) {
    if (rule.re.test(path)) score += rule.score;
  }
  score -= Math.min(40, path.split("/").filter(Boolean).length * 4);
  score -= Math.min(20, path.length / 25);
  if (url.includes("?")) score -= 25;
  if (/\.(pdf|zip|png|jpe?g|gif|webp|svg|mp4|mp3|css|js)$/i.test(path)) score -= 100;
  return score;
}

export function locsFromXml(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml))) {
    const loc = decodeXml(match[1].trim());
    if (loc) locs.push(loc);
  }
  return locs;
}

export function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

export function linksFromHtml(html, baseUrl) {
  const found = new Set();
  const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1].trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:") || href.startsWith("tel:")) {
      continue;
    }
    try {
      const abs = new URL(href, baseUrl);
      const canon = canonicalizePageUrl(abs.href);
      if (!canon) continue;
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (!sameOrigin(canon, baseUrl)) continue;
      found.add(canon);
    } catch {
      // skip
    }
  }
  return [...found];
}

export function sitemapsFromRobots(text, origin) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^\s*sitemap:\s*(\S+)/i.exec(line);
    if (!match) continue;
    try {
      out.push(new URL(match[1], origin).href);
    } catch {
      // skip
    }
  }
  return out;
}

export function pickPages(candidates, origin, maxPages) {
  const seen = new Set();
  const ranked = [];
  for (const raw of candidates) {
    const url = canonicalizePageUrl(raw);
    if (!url || seen.has(url)) continue;
    if (!sameOrigin(url, origin)) continue;
    if (isBlockedUrl(url)) continue;
    if (pageScore(url) < 0) continue;
    seen.add(url);
    ranked.push(url);
  }
  ranked.sort((a, b) => pageScore(b) - pageScore(a) || a.length - b.length);
  return ranked.slice(0, maxPages);
}

function pushCandidate(candidates, raw) {
  const url = canonicalizePageUrl(raw);
  if (!url || candidates.length >= DISCOVERY_CAP) return;
  candidates.push(url);
}

async function discover(fetchImpl, start, origin) {
  const sources = [];
  const candidates = [];
  pushCandidate(candidates, start);
  pushCandidate(candidates, origin);
  pushCandidate(candidates, `${origin}/`);
  const sitemapSeeds = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];

  const robots = await safeFetch(fetchImpl, `${origin}/robots.txt`, {
    maxBytes: 64 * 1024,
    timeoutMs: 8_000,
  });
  if (robots.status === 200 && robots.buffer) {
    const listed = sitemapsFromRobots(robots.buffer.toString("utf8"), origin);
    sitemapSeeds.push(...listed);
    if (listed.length) sources.push("robots");
  }

  const seenSitemaps = new Set();
  async function ingestSitemap(url, depth) {
    if (depth > 2 || seenSitemaps.has(url) || seenSitemaps.size > 8) return;
    if (!sameOrigin(url, origin) || isBlockedUrl(url)) return;
    seenSitemaps.add(url);
    const fetched = await safeFetch(fetchImpl, url, { maxBytes: SITEMAP_MAX_BYTES, timeoutMs: 10_000 });
    if (fetched.status !== 200 || !fetched.buffer) return;
    const xml = fetched.buffer.toString("utf8");
    const locs = locsFromXml(xml);
    if (isSitemapIndex(xml)) {
      sources.push("sitemap-index");
      for (const loc of locs.slice(0, 8)) {
        await ingestSitemap(loc, depth + 1);
      }
      return;
    }
    if (locs.length) sources.push("sitemap");
    for (const loc of locs) {
      if (candidates.length >= DISCOVERY_CAP) break;
      pushCandidate(candidates, loc);
    }
  }

  for (const seed of sitemapSeeds) {
    await ingestSitemap(seed, 0);
    if (candidates.length >= DISCOVERY_CAP) break;
  }

  const startPage = await safeFetch(fetchImpl, start, { maxBytes: HTML_MAX_BYTES, timeoutMs: 12_000 });
  if (startPage.status === 200 && startPage.buffer) {
    const html = startPage.buffer.toString("utf8");
    const links = linksFromHtml(html, startPage.url || start);
    if (links.length) sources.push("links");
    for (const link of links) {
      if (candidates.length >= DISCOVERY_CAP) break;
      pushCandidate(candidates, link);
    }
  }

  return { candidates, sources: [...new Set(sources)] };
}

export function createCrawlHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return async function handleCrawl(request) {
    const token = getBearerToken(request.headers);
    if (!token) return { status: 401, body: { error: "unknown token" } };

    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url, "http://skim.local");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/api/t/crawl") return { status: 404, body: { error: "not_found" } };
    if (method !== "GET" && method !== "POST") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }

    const verified = await verifyToken(fetchImpl, upstream, token);
    if (!verified.ok) return verified;

    const body = request.body ?? {};
    const startRaw = method === "GET" ? url.searchParams.get("url") : body.url ?? body.start ?? body.origin;
    const start = normalizeStartUrl(startRaw);
    if (start.error) return { status: start.status ?? 400, body: { error: start.error } };

    let maxPages = Number(method === "GET" ? url.searchParams.get("maxPages") : body.maxPages);
    if (!Number.isFinite(maxPages) || maxPages <= 0) maxPages = CRAWL_MAX_PAGES;
    maxPages = Math.min(CRAWL_MAX_PAGES, Math.max(1, Math.floor(maxPages)));

    const stripLinks = method === "GET"
      ? url.searchParams.get("stripLinks") === "true"
      : Boolean(body.stripLinks);
    const stripImages = method === "GET"
      ? url.searchParams.get("stripImages") === "true"
      : Boolean(body.stripImages);

    const { candidates, sources } = await discover(fetchImpl, start.url, start.origin);
    const pages = pickPages(candidates, start.origin, maxPages);
    if (pages.length === 0) {
      pages.push(canonicalizePageUrl(start.url) || start.url);
    }

    const results = await mapPool(pages, CRAWL_CONCURRENCY, async (pageUrl) => {
      const read = await tokenRead(fetchImpl, upstream, token, pageUrl, { stripLinks, stripImages });
      if (read.status === 401) return { halt: 401, body: { error: "unknown token" } };
      if (read.status === 402) {
        return { halt: 402, body: read.body?.error ? read.body : { error: "Out of credits" } };
      }
      if (read.status !== 200 || (!read.body?.markdown && !read.body?.text)) {
        return {
          url: pageUrl,
          ok: false,
          error: {
            status: read.status,
            message: read.body?.message ?? read.body?.error ?? "URL could not be read",
          },
        };
      }
      return {
        url: pageUrl,
        finalUrl: read.body.finalUrl ?? pageUrl,
        ok: true,
        title: read.body.metadata?.title ?? null,
        markdown: read.body.markdown ?? read.body.text ?? "",
        text: read.body.text ?? "",
        wordCount: read.body.wordCount ?? read.body.metadata?.length ?? null,
        metadata: read.body.metadata ?? null,
      };
    });

    const halted = results.find((row) => row && row.halt);
    if (halted) return { status: halted.halt, body: halted.body };

    const ok = results.filter((row) => row.ok);
    if (ok.length === 0) {
      return {
        status: 422,
        body: {
          error: "unprocessable",
          message: "No readable pages found on this site",
          pages: results,
          charged: 0,
        },
      };
    }

    return {
      status: 200,
      body: {
        url: start.url,
        origin: start.origin,
        pageCount: ok.length,
        discovered: candidates.length,
        capped: candidates.length > pages.length || pages.length >= maxPages,
        maxPages,
        sources,
        charged: ok.length,
        pages: results,
        fetchedAt: new Date().toISOString(),
      },
    };
  };
}

export function tokenCrawlMiddleware(opts = {}) {
  const handle = createCrawlHandler(opts);
  return connectMiddleware(
    (path) => path === "/api/t/crawl",
    handle,
  );
}

export function tokenCrawlVitePlugin(opts = {}) {
  return vitePlugin("skim-token-crawl", tokenCrawlMiddleware(opts));
}
