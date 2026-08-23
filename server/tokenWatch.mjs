/**
 * Card-lane watch API used by skim-mcp (JessieJanie/skim402#2):
 *   POST /api/t/watch
 *   GET  /api/t/watch/diff?id=
 *   GET  /api/t/watch/status?id=
 *
 * Auth: Authorization: Bearer sk402_…  (or x-skim-token)
 * Billing: existing /api/t/read ledger — 1 credit per successful fetch.
 * Failed reads are not charged (upstream refunds). Status is free.
 * Register validates the first URL via /t/read (1 credit on success).
 *
 * Vite: tokenWatchVitePlugin() in vite.config.ts (dev + preview).
 * Production Express (same host as /api/t/read):
 *   import { tokenWatchMiddleware } from "./tokenWatch.mjs";
 *   app.use(tokenWatchMiddleware({ upstream: "https://skim402.com" }));
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const MIN_INTERVAL_SECONDS = 60;
const MAX_URLS = 20;
const SAMPLE = 5;

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newWatchId() {
  return `w_${randomBytes(18).toString("base64url")}`;
}

export function getBearerToken(headers) {
  const auth = header(headers, "authorization");
  if (auth) {
    const match = /^Bearer\s+(sk402_\S+)/i.exec(auth.trim());
    if (match) return match[1];
  }
  const alt = header(headers, "x-skim-token");
  if (alt && alt.startsWith("sk402_")) return alt.trim();
  return null;
}

function header(headers, name) {
  if (!headers) return "";
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(value) ? value[0] : String(value ?? "");
    }
  }
  return "";
}

export function isBlockedUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "169.254.169.254" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

export function normalizeWatchUrls(urls) {
  if (!Array.isArray(urls) || urls.length < 1) {
    return { error: "Required" };
  }
  if (urls.length > MAX_URLS) {
    return { error: `Array must contain at most ${MAX_URLS} element(s)` };
  }
  const out = [];
  for (const item of urls) {
    if (typeof item !== "string" || !item.trim()) {
      return { error: "Required" };
    }
    const trimmed = item.trim();
    if (isBlockedUrl(trimmed)) {
      return { error: "Invalid URL", status: 400 };
    }
    out.push(trimmed);
  }
  return { urls: out };
}

export function lineDiff(oldText, newText) {
  const prev = String(oldText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  const next = String(newText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((l) => !prevSet.has(l));
  const removed = prev.filter((l) => !nextSet.has(l));
  const moved = added.length + removed.length;
  const denom = Math.max(prev.length + next.length, 1);
  const stripDigits = (line) => line.replace(/\d+/g, "");
  const addedMarks = added.map(stripDigits).sort();
  const removedMarks = removed.map(stripDigits).sort();
  const numericOnly =
    moved > 0 &&
    addedMarks.length === removedMarks.length &&
    addedMarks.every((m, i) => m === removedMarks[i]);
  return {
    addedCount: added.length,
    removedCount: removed.length,
    changeRatio: Math.round((moved / denom) * 1000) / 1000,
    addedSample: added.slice(0, SAMPLE),
    removedSample: removed.slice(0, SAMPLE),
    numericOnly,
  };
}

export function createFileStore(filePath) {
  const store = { watches: {} };
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.watches) {
      store.watches = parsed.watches;
    }
  } catch {
    // first run or empty store
  }
  function persist() {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2));
    renameSync(tmp, filePath);
  }
  return {
    get(id) {
      return store.watches[id] ?? null;
    },
    set(watch) {
      store.watches[watch.watchId] = watch;
      persist();
    },
  };
}

export function createMemoryStore(seed = {}) {
  const watches = { ...seed };
  return {
    get(id) {
      return watches[id] ?? null;
    },
    set(watch) {
      watches[watch.watchId] = watch;
    },
  };
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function createTokenWatchHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const store =
    opts.store ??
    createFileStore(opts.storePath ?? process.env.SKIM_WATCH_STORE ?? ".data/watches.json");
  const nowFn = opts.now ?? (() => Date.now());

  async function verifyToken(token) {
    const res = await fetchImpl(`${upstream}/api/card/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { ok: false, status: 401, body: { error: "unknown token" } };
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        body: { error: "upstream_error", message: "Could not verify API key" },
      };
    }
    return { ok: true };
  }

  async function tokenRead(token, url) {
    const res = await fetchImpl(`${upstream}/api/t/read?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await readJsonResponse(res);
    return { status: res.status, body };
  }

  function snapshotFromRead(url, body) {
    const text = typeof body.text === "string" ? body.text : "";
    const markdown = typeof body.markdown === "string" ? body.markdown : text;
    const hash =
      body?.receipt?.contentHash ??
      createHash("sha256").update(text || markdown).digest("hex");
    return {
      url,
      contentHash: hash,
      text: text || markdown,
      title: body?.metadata?.title ?? null,
      excerpt: body?.metadata?.excerpt ?? null,
    };
  }

  function statusPayload(watch) {
    return {
      watchId: watch.watchId,
      urls: watch.urls,
      note: watch.note,
      pollCount: watch.pollCount,
      lastPollAt: watch.lastPollAt,
      minIntervalSeconds: MIN_INTERVAL_SECONDS,
    };
  }

  async function register(token, body) {
    const parsed = normalizeWatchUrls(body?.urls);
    if (parsed.error) {
      return { status: parsed.status ?? 400, body: { error: parsed.error } };
    }
    const note =
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null;

    const first = parsed.urls[0];
    const probe = await tokenRead(token, first);
    if (probe.status === 401) {
      return { status: 401, body: { error: "unknown token" } };
    }
    if (probe.status === 402) {
      return { status: 402, body: probe.body?.error ? probe.body : { error: "Out of credits" } };
    }
    if (probe.status !== 200 || (!probe.body?.markdown && !probe.body?.text)) {
      return {
        status: 422,
        body: {
          error: probe.body?.error ?? "unprocessable",
          message: probe.body?.message ?? "First URL could not be read — watch not created",
        },
      };
    }

    const watchId = newWatchId();
    const snap = snapshotFromRead(first, probe.body);
    const watch = {
      watchId,
      tokenHash: hashToken(token),
      urls: parsed.urls,
      note,
      createdAt: new Date(nowFn()).toISOString(),
      pollCount: 0,
      lastPollAt: null,
      lastResult: null,
      pages: { [first]: snap },
    };
    store.set(watch);
    return {
      status: 201,
      body: {
        watchId,
        urls: parsed.urls,
        note,
        pollUrl: `/api/t/watch/diff?id=${watchId}`,
        minIntervalSeconds: MIN_INTERVAL_SECONDS,
        charged: 1,
        message:
          "Watch registered. Poll pollUrl (1 credit per successful URL fetch) to get what changed — the first poll baselines each remaining page. Keep the watchId private.",
      },
    };
  }

  async function diff(token, watch) {
    if (watch.tokenHash !== hashToken(token)) {
      return { status: 404, body: { error: "not_found", message: "Unknown watch id" } };
    }
    const now = nowFn();
    if (
      watch.lastResult &&
      watch.lastPollAt &&
      now - Date.parse(watch.lastPollAt) < MIN_INTERVAL_SECONDS * 1000
    ) {
      return { status: 200, body: { ...watch.lastResult, fresh: true } };
    }

    const pages = { ...watch.pages };
    const items = [];
    let charged = 0;
    let changedCount = 0;

    for (const url of watch.urls) {
      const read = await tokenRead(token, url);
      if (read.status === 401) {
        return { status: 401, body: { error: "unknown token" } };
      }
      if (read.status === 402) {
        return { status: 402, body: read.body?.error ? read.body : { error: "Out of credits" } };
      }
      if (read.status !== 200 || (!read.body?.markdown && !read.body?.text)) {
        items.push({
          url,
          status: "error",
          title: pages[url]?.title ?? null,
          error: {
            status: read.status,
            message: read.body?.message ?? read.body?.error ?? "URL could not be read",
          },
        });
        continue;
      }

      charged += 1;
      const snap = snapshotFromRead(url, read.body);
      const prev = pages[url];
      if (!prev) {
        pages[url] = snap;
        items.push({
          url,
          status: "first_check",
          title: snap.title,
        });
        continue;
      }

      const sameHash = prev.contentHash === snap.contentHash;
      const diffBody = lineDiff(prev.text, snap.text);
      const titleChanged = (prev.title ?? null) !== (snap.title ?? null);
      const changed = !sameHash || titleChanged;
      pages[url] = snap;
      if (changed) {
        changedCount += 1;
        items.push({
          url,
          status: "changed",
          title: snap.title,
          diff: { ...diffBody, titleChanged },
        });
      } else {
        items.push({
          url,
          status: "unchanged",
          title: snap.title,
        });
      }
    }

    const result = {
      watchId: watch.watchId,
      polledAt: new Date(now).toISOString(),
      changedCount,
      charged,
      fresh: false,
      urls: items,
    };
    const next = {
      ...watch,
      pages,
      pollCount: watch.pollCount + 1,
      lastPollAt: result.polledAt,
      lastResult: result,
    };
    store.set(next);
    return { status: 200, body: result };
  }

  return async function handleTokenWatch(request) {
    const token = getBearerToken(request.headers);
    if (!token) {
      return { status: 401, body: { error: "unknown token" } };
    }

    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url, "http://skim.local");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (method === "POST" && path === "/api/t/watch") {
      const verified = await verifyToken(token);
      if (!verified.ok) return verified;
      return register(token, request.body ?? {});
    }

    if (method === "GET" && (path === "/api/t/watch/diff" || path === "/api/t/watch/status")) {
      const id = url.searchParams.get("id") ?? "";
      if (!id) {
        return { status: 400, body: { error: "Required", message: "id is required" } };
      }
      const verified = await verifyToken(token);
      if (!verified.ok) return verified;
      const watch = store.get(id);
      if (!watch || watch.tokenHash !== hashToken(token)) {
        return { status: 404, body: { error: "not_found", message: "Unknown watch id" } };
      }
      if (path.endsWith("/status")) {
        return { status: 200, body: statusPayload(watch) };
      }
      return diff(token, watch);
    }

    return { status: 404, body: { error: "not_found" } };
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(payload);
}

const MAX_BODY_BYTES = 64 * 1024;

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error("payload too large");
      err.code = "PAYLOAD_TOO_LARGE";
      throw err;
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

/** Connect / Vite middleware. */
export function tokenWatchMiddleware(opts = {}) {
  const handle = createTokenWatchHandler(opts);
  return async function tokenWatch(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!path.startsWith("/api/t/watch")) {
      next();
      return;
    }
    try {
      let body = {};
      if ((req.method ?? "").toUpperCase() === "POST") {
        try {
          body = await readBody(req);
        } catch (err) {
          if (err && err.code === "PAYLOAD_TOO_LARGE") {
            sendJson(res, 413, { error: "payload too large" });
            return;
          }
          sendJson(res, 400, { error: "Invalid JSON" });
          return;
        }
      }
      const result = await handle({
        method: req.method,
        url: req.url ?? "/",
        headers: req.headers,
        body,
      });
      if (result.status === 404 && result.body?.error === "not_found" && path === "/api/t/watch") {
        next();
        return;
      }
      sendJson(res, result.status, result.body);
    } catch (err) {
      sendJson(res, 500, { error: "internal_error", message: err instanceof Error ? err.message : "error" });
    }
  };
}

export function tokenWatchVitePlugin(opts = {}) {
  const middleware = tokenWatchMiddleware(opts);
  return {
    name: "skim-token-watch",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
