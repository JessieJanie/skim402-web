/**
 * Signals sidecar (card-lane):
 *   GET /api/signals                  unauthenticated machine catalog
 *   GET /signals.json                 same catalog (static twin in public/)
 *   GET /api/t/signal/sample          unauthenticated bazaar example, charged: 0
 *   GET /api/t/signal/:slug/latest    honesty wrap when since= or If-None-Match
 *   GET /api/t/feeds/x402/latest      same honesty wrap (x402 is not /signal/{slug})
 *
 * Live Express already bills 2 credits on a successful poll, including when
 * Express then answers 304 for If-None-Match. since= is ignored upstream.
 * This wrapper refunds on the same sk402_ ledger (opts.refundCredits) and
 * returns 304 or { items: [], unchanged: true, charged: 0 }.
 *
 * No feed store lives in this repo — the sample is the 402 bazaar example.
 * Do not mount a sibling tokenWatch.mjs from another branch for /api/t/watch*.
 *
 * Production Express (same host as /api/t/read):
 *   import { tokenSignalMiddleware } from "./tokenSignal.mjs";
 *   app.use(tokenSignalMiddleware({
 *     refundCredits: (token, amount) => cardLedger.credit(token, amount),
 *   }));
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectMiddleware,
  getBearerToken,
  header,
  readJsonResponse,
  remainingCredits,
  sendJson,
  verifyToken,
  vitePlugin,
} from "./http.mjs";

export const SIGNAL_CREDITS = 2;

const CATALOG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../public/signals.json");

export function loadSignalCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

/** Exact bazaar output.example from GET /api/v2/signal/ai-news/latest payment-required. */
export const SIGNAL_BAZAAR_EXAMPLE = {
  feed: "ai-news",
  asOf: "2026-07-13T12:00:00Z",
  ttlSeconds: 600,
  crawl: {
    status: "ok",
    lastCrawlAt: "2026-07-13T12:00:00Z",
    durationMs: 1800,
  },
  count: 2,
  items: [
    {
      id: 101,
      kind: "story",
      title: "New open-weights model tops reasoning benchmarks",
      summary: "Hacker News front page: 412 points, 187 comments.",
      source: "hackernews",
      url: "https://example.com/model-announcement",
      payload: {
        hnId: 48880000,
        score: 412,
        comments: 187,
        discussionUrl: "https://news.ycombinator.com/item?id=48880000",
      },
      at: "2026-07-13T11:40:00Z",
    },
    {
      id: 100,
      kind: "vendor_news",
      title: "Introducing our next-generation API",
      summary:
        "Official OpenAI announcement: a faster, cheaper flagship model tier for production agents.",
      source: "openai",
      url: "https://openai.com/news/example",
      payload: {
        vendor: "OpenAI",
        publishedAt: "2026-07-13T10:00:00Z",
      },
      at: "2026-07-13T11:40:00Z",
    },
  ],
};

export const SIGNAL_SAMPLE = {
  sample: true,
  charged: 0,
  label:
    "Bazaar example from GET /api/v2/signal/ai-news/latest payment-required header (asOf 2026-07-13). Not billed.",
  ...SIGNAL_BAZAAR_EXAMPLE,
};

export function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function isSignalCatalogPath(path) {
  return path === "/api/signals" || path === "/signals.json";
}

export function isSignalSamplePath(path) {
  return path === "/api/t/signal/sample" || path === "/api/t/signals/sample";
}

export function isSignalPollPath(path) {
  if (path === "/api/t/feeds/x402/latest") return true;
  return /^\/api\/t\/signal\/(?!sample$)[^/]+\/latest$/.test(path);
}

export function isSignalSidecarPath(path) {
  return isSignalCatalogPath(path) || isSignalSamplePath(path) || isSignalPollPath(path);
}

export function parseSince(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function normalizeEtag(value) {
  if (value == null) return "";
  return String(value)
    .trim()
    .replace(/^W\//i, "")
    .replace(/"/g, "");
}

export function etagsMatch(a, b) {
  const left = normalizeEtag(a);
  const right = normalizeEtag(b);
  return Boolean(left && right && left === right);
}

export function feedAsOfMs(body) {
  const rec = asRecord(body);
  if (!rec || typeof rec.asOf !== "string") return null;
  const ms = Date.parse(rec.asOf);
  return Number.isFinite(ms) ? ms : null;
}

export function isUnchangedFeed({ status, body, since, ifNoneMatch, etag }) {
  const hasSince = Boolean(since);
  const hasInm = Boolean(ifNoneMatch);
  if (!hasSince && !hasInm) return false;
  if (status === 304) return true;
  if (hasInm && etagsMatch(ifNoneMatch, etag)) return true;
  const sinceMs = parseSince(since);
  const asOf = feedAsOfMs(body);
  if (sinceMs != null && asOf != null && asOf <= sinceMs) return true;
  return false;
}

export function unchangedBody(original) {
  const rec = asRecord(original) ?? {};
  return {
    feed: rec.feed ?? null,
    asOf: rec.asOf ?? null,
    ttlSeconds: rec.ttlSeconds,
    crawl: rec.crawl,
    count: 0,
    items: [],
    unchanged: true,
    charged: 0,
  };
}

function queryParam(url, name) {
  try {
    const parsed = new URL(url, "https://skim402.com");
    return parsed.searchParams.get(name);
  } catch {
    return null;
  }
}

function responseEtag(res, extra) {
  if (extra) return extra;
  if (!res) return "";
  if (typeof res.getHeader === "function") {
    const value = res.getHeader("etag") ?? res.getHeader("ETag");
    return Array.isArray(value) ? value[0] : value ?? "";
  }
  return "";
}

export function createSignalHandler(opts = {}) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );

  async function refundIfNeeded(token, amount) {
    if (!(amount > 0)) return false;
    if (typeof opts.refundCredits === "function") {
      await opts.refundCredits(token, amount);
      return true;
    }
    return false;
  }

  return async function handleSignal(request) {
    const path = (request.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (isSignalCatalogPath(path)) {
      return { status: 200, body: loadSignalCatalog() };
    }
    if (isSignalSamplePath(path)) {
      return { status: 200, body: { ...SIGNAL_SAMPLE } };
    }
    if (!isSignalPollPath(path)) {
      return { status: 404, body: { error: "not_found" } };
    }

    const token = getBearerToken(request.headers);
    if (!token) {
      return { status: 401, body: { error: "missing token — send Authorization: Bearer sk402_..." } };
    }

    const since = queryParam(request.url, "since");
    const ifNoneMatch = header(request.headers, "if-none-match");
    const wantsHonesty = Boolean(since || ifNoneMatch);

    const verified = await verifyToken(fetchImpl, upstream, token);
    if (!verified.ok) return { status: verified.status, body: verified.body };
    const creditsBefore = remainingCredits(verified.account);

    const target = `${upstream}${request.url?.startsWith("/api/") ? request.url : `/api${request.url}`}`;
    const headers = { Authorization: `Bearer ${token}` };
    if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;

    const res = await fetchImpl(target, { headers });
    const etag = res.headers?.get?.("etag") ?? res.headers?.get?.("ETag") ?? "";
    let body = {};
    if (res.status !== 304) {
      body = await readJsonResponse(res);
    }

    if (res.status === 401) {
      return { status: 401, body: body?.error ? body : { error: "unknown token" } };
    }
    if (res.status === 402) {
      return { status: 402, body: body?.error ? body : { error: "Out of credits" } };
    }
    if (res.status !== 200 && res.status !== 304) {
      return { status: res.status, body: body?.error ? body : { error: "unprocessable" } };
    }

    const unchanged = isUnchangedFeed({
      status: res.status,
      body,
      since,
      ifNoneMatch,
      etag,
    });

    if (wantsHonesty && unchanged) {
      let billed = SIGNAL_CREDITS;
      if (typeof creditsBefore === "number") {
        const after = await verifyToken(fetchImpl, upstream, token);
        const creditsAfter = after.ok ? remainingCredits(after.account) : null;
        if (typeof creditsAfter === "number") {
          billed = Math.max(0, creditsBefore - creditsAfter);
        }
      }
      if (billed > 0) {
        const refunded = await refundIfNeeded(token, billed);
        if (!refunded) {
          return { status: res.status, body: res.status === 304 ? { unchanged: true } : body, etag };
        }
      }
      if (ifNoneMatch) {
        return { status: 304, body: { items: [], unchanged: true, charged: 0 }, etag, charged: 0 };
      }
      return { status: 200, body: unchangedBody(body), charged: 0 };
    }

    return { status: res.status, body: res.status === 304 ? { unchanged: true } : body, etag };
  };
}

export function wrapSignalHonestyResponse(res, ctx = {}) {
  const origEnd = res.end.bind(res);
  const chunks = [];

  function pushChunk(chunk, encoding) {
    if (chunk == null) return;
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === "string") chunks.push(Buffer.from(chunk, encoding || "utf8"));
    else chunks.push(Buffer.from(String(chunk)));
  }

  res.write = function wrappedWrite(chunk, encoding, cb) {
    pushChunk(chunk, typeof encoding === "string" ? encoding : undefined);
    const done = typeof encoding === "function" ? encoding : cb;
    if (typeof done === "function") done();
    return true;
  };

  res.end = function wrappedEnd(chunk, encoding, cb) {
    if (typeof chunk === "function") {
      cb = chunk;
      chunk = undefined;
      encoding = undefined;
    } else if (typeof encoding === "function") {
      cb = encoding;
      encoding = undefined;
    }
    pushChunk(chunk, encoding);
    const raw = Buffer.concat(chunks).toString("utf8");
    const status = res.statusCode === undefined ? 200 : res.statusCode;
    let parsed = {};
    if (raw.trim() && status !== 304) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return origEnd(raw, "utf8", cb);
      }
    }

    const unchanged = isUnchangedFeed({
      status,
      body: parsed,
      since: ctx.since,
      ifNoneMatch: ctx.ifNoneMatch,
      etag: responseEtag(res, ctx.etag),
    });

    const finishOriginal = () => origEnd(raw, "utf8", cb);

    if (!unchanged) return finishOriginal();
    if (typeof ctx.refundCredits !== "function" || !ctx.token) return finishOriginal();

    const prefer304 = Boolean(ctx.ifNoneMatch);
    const nextBody = prefer304 ? "" : JSON.stringify(unchangedBody(parsed));
    const nextStatus = prefer304 ? 304 : 200;

    const finish = () => {
      res.statusCode = nextStatus;
      if (typeof res.setHeader === "function") {
        res.setHeader("X-Skim-Credits", "0");
        res.setHeader("X-Skim-Credits-Charged", "0");
        if (prefer304) {
          res.setHeader("Content-Length", "0");
        } else {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Content-Length", Buffer.byteLength(nextBody));
        }
      }
      return origEnd(nextBody, "utf8", cb);
    };

    return Promise.resolve(ctx.refundCredits(ctx.token, SIGNAL_CREDITS)).then(finish, finish);
  };
}

export function tokenSignalFilterMiddleware(opts = {}) {
  return function signalFilter(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (isSignalCatalogPath(path)) {
      sendJson(res, 200, loadSignalCatalog());
      return;
    }
    if (isSignalSamplePath(path)) {
      sendJson(res, 200, { ...SIGNAL_SAMPLE });
      return;
    }
    if (!isSignalPollPath(path)) {
      next();
      return;
    }
    const since = queryParam(req.url, "since");
    const ifNoneMatch = header(req.headers, "if-none-match");
    if (!since && !ifNoneMatch) {
      next();
      return;
    }
    wrapSignalHonestyResponse(res, {
      refundCredits: opts.refundCredits,
      token: getBearerToken(req.headers),
      since,
      ifNoneMatch,
    });
    next();
  };
}

export function tokenSignalMiddleware(opts = {}) {
  const filter = tokenSignalFilterMiddleware(opts);
  const handle = createSignalHandler(opts);
  const proxy = connectMiddleware(isSignalSidecarPath, handle, {
    onResult(res, result) {
      if (result.status === 304) {
        res.statusCode = 304;
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Skim-Credits", "0");
        res.setHeader("X-Skim-Credits-Charged", "0");
        if (result.etag) res.setHeader("ETag", result.etag);
        res.end();
        return true;
      }
      return false;
    },
  });
  if (opts.proxySignals) return proxy;
  return filter;
}

export function tokenSignalVitePlugin(opts = {}) {
  return vitePlugin(
    "skim-token-signal",
    tokenSignalMiddleware({ ...opts, proxySignals: true }),
  );
}
