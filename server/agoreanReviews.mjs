/**
 * Agorean review links for paid x402 replies.
 *
 * This process does not import @x402/core and has no x402ResourceServer, so
 * the blocks are written by hand (the same { info, schema } shape as
 * https://agorean.com/docs/show-your-reviews). reviewsServer() is not
 * registered: nothing here settles a payment or writes PAYMENT-RESPONSE.
 * The optional live rating is left off, so 402s never gain rating, count,
 * or median_paid.
 *
 * Mount agoreanReviewsMiddleware before the x402 handler. tokenProductsMiddleware
 * also attaches it, which covers an x402 handler reached via next().
 *
 * Resource URLs are https://skim402.com plus the pathname. Query strings are
 * ignored so the 402 read block is identical on every request and a client
 * echo cannot fail with extension_echo_mismatch.
 */

import { loadSignalCatalog } from "./tokenSignal.mjs";
import { vitePlugin } from "./http.mjs";

export const PUBLIC_ORIGIN = "https://skim402.com";
export const REVIEW_PROVIDER = "agorean.com";
export const REVIEW_WRITE_HEADER = "X-Agorean-Review-Write";

export const WRITE_DESCRIPTION =
  "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.";

export const USER_QUESTION =
  "Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.";

export const READ_DESCRIPTION =
  "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.";

const WRITE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    providers: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          provider: { type: "string", minLength: 1, maxLength: 128 },
          write: { type: "string", format: "uri", pattern: "^https://" },
          description: { type: "string", maxLength: 500 },
        },
        required: ["provider", "write"],
      },
    },
    userQuestion: { type: "string", maxLength: 300 },
  },
  required: ["providers"],
};

const READ_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    providers: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          provider: { type: "string", minLength: 1, maxLength: 128 },
          read: { type: "string", format: "uri", pattern: "^https://" },
          description: { type: "string", maxLength: 500 },
        },
        required: ["provider", "read"],
      },
    },
  },
  required: ["providers"],
};

const EXTRACT_PRESETS = ["article", "product", "job", "review", "event", "table"];

function versionPaths(version) {
  const root = `/api/${version}`;
  return [
    `${root}/read`,
    `${root}/read/js`,
    `${root}/read/batch`,
    `${root}/extract`,
    ...EXTRACT_PRESETS.map((preset) => `${root}/extract/${preset}`),
    `${root}/tables`,
  ];
}

/** Paths whose paid method is POST only. GET on these is a different product or a free poll. */
const POST_ONLY = new Set(["/api/v2/dataset", "/api/v2/watch"]);

const EXACT_PAID = new Set([
  ...versionPaths("v1"),
  ...versionPaths("v2"),
  "/api/v2/dataset",
  "/api/v2/watch",
  "/api/v2/watch/diff",
  "/api/v2/feeds/x402/latest",
]);

const SIGNAL_PATH = /^\/api\/v2\/signal\/([^/]+)\/latest$/;
const PATCHED = Symbol("agoreanReviews");

export function requestPath(req) {
  const raw = req?.originalUrl || req?.url || "/";
  const pathOnly = String(raw).split("?")[0];
  if (pathOnly.length > 1) return pathOnly.replace(/\/+$/, "");
  return pathOnly || "/";
}

export function isPaidX402Request(path, method) {
  const verb = String(method || "GET").toUpperCase();
  if (verb !== "GET" && verb !== "POST") return false;
  if (typeof path !== "string" || path.startsWith("/api/t/")) return false;
  if (POST_ONLY.has(path)) return verb === "POST";
  if (EXACT_PAID.has(path)) return true;
  const signal = SIGNAL_PATH.exec(path);
  return Boolean(signal && signal[1] !== "x402");
}

export function endpointResourceUrl(path, origin = PUBLIC_ORIGIN) {
  return `${String(origin).replace(/\/$/, "")}${path}`;
}

export function paidEndpointPaths() {
  const paths = new Set(EXACT_PAID);
  for (const signal of loadSignalCatalog().signals ?? []) {
    const walletPath = signal?.walletPath;
    if (typeof walletPath === "string" && isPaidX402Request(walletPath, "GET")) {
      paths.add(walletPath);
    }
  }
  return [...paths].sort();
}

export function paidEndpointUrls(origin = PUBLIC_ORIGIN) {
  return paidEndpointPaths().map((path) => endpointResourceUrl(path, origin));
}

export function writeReviewsBlock(resourceUrl) {
  return {
    info: {
      providers: [
        {
          provider: REVIEW_PROVIDER,
          write: `https://agorean.com/r?resource=${encodeURIComponent(resourceUrl)}`,
          description: WRITE_DESCRIPTION,
        },
      ],
      userQuestion: USER_QUESTION,
    },
    schema: WRITE_SCHEMA,
  };
}

export function readReviewsBlock(resourceUrl) {
  return {
    info: {
      providers: [
        {
          provider: REVIEW_PROVIDER,
          read: `https://agorean.com/reviews?resource=${encodeURIComponent(resourceUrl)}`,
          description: READ_DESCRIPTION,
        },
      ],
    },
    schema: READ_SCHEMA,
  };
}

export function decodePaymentRequired(value) {
  const compact = String(value ?? "").replace(/\s+/g, "");
  if (!compact) throw new Error("empty payment-required");
  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payment-required is not an object");
  }
  return parsed;
}

export function encodePaymentRequired(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function assignReviews(payload, block) {
  if (!payload.extensions || typeof payload.extensions !== "object" || Array.isArray(payload.extensions)) {
    payload.extensions = {};
  }
  payload.extensions.reviews = block;
  return payload;
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value == null ? "" : String(value);
}

function readHeader(res, captured, name) {
  const lower = name.toLowerCase();
  if (captured.has(lower)) return headerValue(captured.get(lower));
  if (typeof res.getHeader === "function") {
    const value = res.getHeader(name);
    if (value != null) return headerValue(value);
  }
  if (res.headers && res.headers[lower] != null) return headerValue(res.headers[lower]);
  return "";
}

function asBuffer(chunk, encoding) {
  if (chunk == null) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  if (typeof chunk === "string") return Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8");
  return Buffer.from(String(chunk));
}

function splitMessageArgs(args) {
  let cb;
  const rest = [];
  for (const arg of args) {
    if (typeof arg === "function") cb = arg;
    else rest.push(arg);
  }
  return {
    chunk: rest[0],
    encoding: typeof rest[1] === "string" ? rest[1] : undefined,
    cb,
  };
}

function explicitNonJson(contentType) {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("application/pdf") ||
    ct.includes("text/markdown") ||
    ct.includes("text/html") ||
    ct.includes("application/octet-stream")
  );
}

function treatAsJson(contentType, text, status) {
  if (explicitNonJson(contentType)) return false;
  if (contentType.toLowerCase().includes("json")) return true;
  const trimmed = text.trim();
  if (!trimmed) return status === 402;
  if (trimmed.startsWith("{") && (contentType === "" || contentType.toLowerCase().startsWith("text/plain"))) {
    return true;
  }
  return false;
}

function decorate(status, contentType, raw, resourceUrl, paymentRequired) {
  const text = raw.toString("utf8");
  const json = treatAsJson(contentType, text, status);
  if (status === 402) {
    let bodyObject = null;
    let bodyOut = raw;
    if (json) {
      const trimmed = text.trim();
      const parsed = trimmed ? JSON.parse(trimmed) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bodyObject = assignReviews(parsed, readReviewsBlock(resourceUrl));
        bodyOut = Buffer.from(JSON.stringify(bodyObject), "utf8");
      }
    }
    let headerOut;
    if (paymentRequired) {
      try {
        const decoded = decodePaymentRequired(paymentRequired);
        assignReviews(decoded, readReviewsBlock(resourceUrl));
        headerOut = encodePaymentRequired(decoded);
      } catch {
        headerOut = undefined;
      }
    } else if (bodyObject) {
      headerOut = encodePaymentRequired(bodyObject);
    }
    return { body: bodyOut, paymentRequired: headerOut, writeHeader: undefined };
  }
  if (status >= 200 && status < 300 && status !== 204 && status !== 205) {
    const write = writeReviewsBlock(resourceUrl);
    if (json) {
      const trimmed = text.trim();
      const parsed = trimmed ? JSON.parse(trimmed) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        assignReviews(parsed, write);
        return {
          body: Buffer.from(JSON.stringify(parsed), "utf8"),
          paymentRequired: undefined,
          writeHeader: undefined,
        };
      }
    }
    return {
      body: raw,
      paymentRequired: undefined,
      writeHeader: write.info.providers[0].write,
    };
  }
  return { body: raw, paymentRequired: undefined, writeHeader: undefined };
}

export function attachAgoreanReviews(req, res, opts = {}) {
  if (!res || res[PATCHED]) return;
  const path = requestPath(req);
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS" || method === "HEAD") return;
  if (!isPaidX402Request(path, method)) return;

  const resourceUrl = endpointResourceUrl(path, opts.origin || PUBLIC_ORIGIN);
  const captured = new Map();
  const origSetHeader = res.setHeader?.bind(res);
  const origRemoveHeader = res.removeHeader?.bind(res);
  const origEnd = res.end.bind(res);
  const origWriteHead = res.writeHead?.bind(res);
  const chunks = [];
  let ended = false;
  res[PATCHED] = true;

  res.setHeader = function setHeader(name, value) {
    captured.set(String(name).toLowerCase(), value);
    if (origSetHeader) return origSetHeader(name, value);
    return res;
  };
  if (origRemoveHeader || res.headers) {
    res.removeHeader = function removeHeader(name) {
      captured.delete(String(name).toLowerCase());
      if (origRemoveHeader) return origRemoveHeader(name);
      if (res.headers) delete res.headers[String(name).toLowerCase()];
    };
  }
  if (origWriteHead) {
    res.writeHead = function writeHead(status, reason, headers) {
      res.statusCode = status;
      const hdrs = reason && typeof reason === "object" ? reason : headers;
      if (hdrs && typeof hdrs === "object") {
        for (const [key, value] of Object.entries(hdrs)) res.setHeader(key, value);
      }
      return res;
    };
  }
  res.write = function write(...args) {
    const { chunk, encoding, cb } = splitMessageArgs(args);
    const buf = asBuffer(chunk, encoding);
    if (buf) chunks.push(buf);
    if (cb) cb();
    return true;
  };
  res.end = function end(...args) {
    if (ended) return origEnd(...args);
    ended = true;
    const { chunk, encoding, cb } = splitMessageArgs(args);
    const buf = asBuffer(chunk, encoding);
    if (buf) chunks.push(buf);
    const raw = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
    const status = res.statusCode || 200;
    try {
      const contentType = readHeader(res, captured, "content-type");
      const paymentRequired = readHeader(res, captured, "payment-required");
      const result = decorate(status, contentType, raw, resourceUrl, paymentRequired);
      if (result.paymentRequired) res.setHeader("PAYMENT-REQUIRED", result.paymentRequired);
      if (result.writeHeader) res.setHeader(REVIEW_WRITE_HEADER, result.writeHeader);
      if (!result.body.equals(raw)) {
        if (typeof res.removeHeader === "function") res.removeHeader("Content-Length");
        res.setHeader("Content-Length", String(result.body.length));
      }
      return origEnd(result.body, cb);
    } catch {
      return origEnd(raw, cb);
    }
  };
}

export function agoreanReviewsMiddleware(opts = {}) {
  return function agoreanReviews(req, res, next) {
    attachAgoreanReviews(req, res, opts);
    next();
  };
}

export function agoreanReviewsVitePlugin(opts = {}) {
  return vitePlugin("skim-agorean-reviews", agoreanReviewsMiddleware(opts));
}
