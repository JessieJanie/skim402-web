/**
 * Shared primitives for card-lane /api/t/* product routes.
 * Auth and SSRF match the existing token-watch sidecar (unchanged rules).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const MAX_BODY_BYTES = 64 * 1024;
export const PDF_MAX_BYTES = 8 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 5;

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function header(headers, name) {
  if (!headers) return "";
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(value) ? value[0] : String(value ?? "");
    }
  }
  return "";
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

/** Same-origin / SSRF gate used by /t/read. Do not loosen. */
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

export function isHttpsUrl(raw) {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

export async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function verifyToken(fetchImpl, upstream, token) {
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
  const body = await readJsonResponse(res);
  return { ok: true, account: body };
}

export function remainingCredits(account) {
  if (!account || typeof account !== "object") return null;
  const keys = [
    "creditsRemaining",
    "remainingCredits",
    "credits",
    "remaining",
    "monthlyRemaining",
    "monthlyCreditsRemaining",
  ];
  for (const key of keys) {
    const value = account[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  const packs = account.packCredits ?? account.packsRemaining;
  const monthly = account.planCredits ?? account.monthlyCredits ?? account.monthlyRemaining;
  if (typeof packs === "number" || typeof monthly === "number") {
    return (Number(packs) || 0) + (Number(monthly) || 0);
  }
  return null;
}

export async function tokenRead(fetchImpl, upstream, token, url, opts = {}) {
  const params = new URLSearchParams({ url });
  if (opts.stripLinks) params.set("stripLinks", "true");
  if (opts.stripImages) params.set("stripImages", "true");
  const path = opts.js ? "/api/t/read/js" : "/api/t/read";
  const res = await fetchImpl(`${upstream}${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readJsonResponse(res);
  return { status: res.status, body, headers: res.headers };
}

/** Header so a same-host honesty wrapper can reach the existing extract handler. */
export const EXTRACT_PASSTHROUGH_HEADER = "x-skim-extract-passthrough";

export async function tokenExtract(fetchImpl, upstream, token, body, extraHeaders = {}) {
  const res = await fetchImpl(`${upstream}/api/t/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body ?? {}),
  });
  const parsed = await readJsonResponse(res);
  return { status: res.status, body: parsed, headers: res.headers };
}

export async function safeFetch(fetchImpl, rawUrl, opts = {}) {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const method = opts.method ?? "GET";
  const headers = opts.headers ?? { "User-Agent": "Skim/1.0 (+https://skim402.com)" };
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (isBlockedUrl(current)) {
      return { blocked: true, url: current };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(current, {
        method,
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "fetch failed", url: current };
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { status: res.status, error: "redirect without location", url: current };
      try {
        current = new URL(loc, current).href;
      } catch {
        return { status: res.status, error: "invalid redirect", url: current };
      }
      continue;
    }

    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { tooLarge: true, contentLength: declared, status: res.status, url: current };
    }

    const chunks = [];
    let size = 0;
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        size += buf.length;
        if (size > maxBytes) {
          try {
            reader.cancel();
          } catch {
            // ignore cancel errors
          }
          return { tooLarge: true, contentLength: size, status: res.status, url: current };
        }
        chunks.push(buf);
      }
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) {
        return { tooLarge: true, contentLength: buf.length, status: res.status, url: current };
      }
      chunks.push(buf);
    }

    return {
      status: res.status,
      url: current,
      headers: res.headers,
      buffer: Buffer.concat(chunks),
      contentType: res.headers.get("content-type") ?? "",
    };
  }
  return { error: "too many redirects", url: current };
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  if (typeof body?.charged === "number") {
    res.setHeader("X-Skim-Credits", String(body.charged));
    res.setHeader("X-Skim-Credits-Charged", String(body.charged));
  }
  res.end(payload);
}

export async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
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

export function createFileStore(filePath) {
  const store = { records: {} };
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.records) {
      store.records = parsed.records;
    } else if (parsed && typeof parsed === "object" && parsed.watches) {
      store.records = parsed.watches;
    }
  } catch {
    // first run
  }
  function persist() {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2));
    renameSync(tmp, filePath);
  }
  return {
    get(id) {
      return store.records[id] ?? null;
    },
    set(record) {
      const id = record.watchId ?? record.id;
      store.records[id] = record;
      persist();
    },
  };
}

export function createMemoryStore(seed = {}) {
  const records = { ...seed };
  return {
    get(id) {
      return records[id] ?? null;
    },
    set(record) {
      const id = record.watchId ?? record.id;
      records[id] = record;
    },
  };
}

export function newId(prefix) {
  return `${prefix}${randomBytes(18).toString("base64url")}`;
}

export function signBody(secret, rawBody) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signaturesMatch(secret, rawBody, hex) {
  if (!hex || typeof hex !== "string") return false;
  const expected = signBody(secret, rawBody);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hex.replace(/^sha256=/, ""), "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function sameOrigin(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.protocol === right.protocol && left.host === right.host;
  } catch {
    return false;
  }
}

export function originOf(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

export async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export function connectMiddleware(matches, handle, opts = {}) {
  return async function productMiddleware(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!matches(path, req.method)) {
      next();
      return;
    }
    try {
      let body = {};
      const method = (req.method ?? "GET").toUpperCase();
      if (method === "POST" || method === "PATCH" || method === "PUT") {
        try {
          body = await readBody(req, opts.maxBodyBytes);
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
        method,
        url: req.url ?? "/",
        headers: req.headers,
        body,
      });
      sendJson(res, result.status, result.body);
    } catch (err) {
      sendJson(res, 500, {
        error: "internal_error",
        message: err instanceof Error ? err.message : "error",
      });
    }
  };
}

export function vitePlugin(name, middleware) {
  return {
    name,
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
