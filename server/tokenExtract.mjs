/**
 * POST /api/t/extract honesty layer (card-lane token auth).
 *
 * Live Express extract returns HTTP 200 + { data: { tables: [] } } and still
 * deducts 8 credits. Product copy: failed/empty extracts are not a success.
 *
 * This sidecar does not invent a second ledger. It uses the existing sk402_
 * extract (8 credits) and, when an empty result already debited, refunds
 * via opts.refundCredits (the same card ledger the host injects — same pattern
 * as tokenReadPdf's debitCredits).
 *
 * Mount (production Express, same host as /api/t/read):
 *   import { tokenExtractMiddleware } from "./tokenExtract.mjs";
 *   app.use(tokenExtractMiddleware({
 *     refundCredits: (token, amount) => cardLedger.credit(token, amount),
 *   }));
 *   // existing POST /api/t/extract remains the LLM handler (passthrough)
 *
 * Do not also mount a sibling tokenWatch.mjs from another branch for /api/t/watch*.
 */

import {
  EXTRACT_PASSTHROUGH_HEADER,
  connectMiddleware,
  getBearerToken,
  header,
  isBlockedUrl,
  remainingCredits,
  tokenExtract,
  verifyToken,
  vitePlugin,
} from "./http.mjs";

export const EXTRACT_CREDITS = 8;

const COLLECTION_KEYS = ["tables", "rows", "items", "records", "results", "entries"];

export function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** A cell/field that actually contains extracted content. */
export function isUsableValue(value) {
  if (value == null) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return isNonEmptyString(value);
  if (Array.isArray(value)) return value.some(isUsableValue);
  const rec = asRecord(value);
  if (!rec) return false;
  if (Array.isArray(rec.rows) || Array.isArray(rec.headers) || Array.isArray(rec.cells)) {
    const rows = Array.isArray(rec.rows) ? rec.rows : [];
    const headers = Array.isArray(rec.headers) ? rec.headers : [];
    const cells = Array.isArray(rec.cells) ? rec.cells : [];
    return rows.some(isUsableValue) || headers.some(isUsableValue) || cells.some(isUsableValue);
  }
  return Object.values(rec).some(isUsableValue);
}

/**
 * Count usable extracted rows/objects. Empty arrays (tables:[], rows:[], …)
 * and hollow table objects are a miss. A non-empty article/product object counts as 1.
 */
export function countUsableExtractValues(payload) {
  if (payload == null) return 0;
  const rec = asRecord(payload);
  const data = rec && ("data" in rec) ? rec.data : payload;
  if (Array.isArray(data)) return data.filter(isUsableValue).length;
  const inner = asRecord(data);
  if (!inner) return isUsableValue(data) ? 1 : 0;

  let sawCollection = false;
  let count = 0;
  for (const key of COLLECTION_KEYS) {
    if (!Array.isArray(inner[key])) continue;
    sawCollection = true;
    count += inner[key].filter(isUsableValue).length;
  }
  if (sawCollection) return count;
  return isUsableValue(inner) ? 1 : 0;
}

export function emptyExtractMissBody(original) {
  const rec = asRecord(original);
  return {
    error: "unprocessable",
    message: "No usable rows extracted from this page",
    data: rec && "data" in rec ? rec.data : rec ?? original ?? { tables: [] },
    charged: 0,
  };
}

export function isExtractPassthrough(headers) {
  const value = header(headers, EXTRACT_PASSTHROUGH_HEADER);
  return value === "1" || value.toLowerCase() === "true";
}

async function refundIfNeeded(opts, token, amount) {
  if (!(amount > 0)) return { refunded: true, charged: 0 };
  if (typeof opts.refundCredits === "function") {
    await opts.refundCredits(token, amount);
    return { refunded: true, charged: 0 };
  }
  return { refunded: false, charged: amount };
}

function billedFromExtract(result) {
  if (!result || result.status !== 200) return 0;
  const rec = asRecord(result.body);
  for (const key of ["charged", "creditsCharged", "creditsUsed", "credits"]) {
    const value = rec?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  const headerVal =
    result.headers?.get?.("x-skim-credits") ??
    result.headers?.get?.("X-Skim-Credits") ??
    result.headers?.get?.("x-skim-credits-charged");
  if (headerVal && Number.isFinite(Number(headerVal)) && Number(headerVal) > 0) {
    return Number(headerVal);
  }
  // Live card-lane extract deducts 8 on any HTTP 200, including empty arrays.
  return EXTRACT_CREDITS;
}

export function createExtractHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const extractBills = opts.extractBills ?? !opts.extractImpl;

  return async function handleExtract(request) {
    const token = getBearerToken(request.headers);
    if (!token) return { status: 401, body: { error: "unknown token" } };

    const method = (request.method ?? "GET").toUpperCase();
    const parsedUrl = new URL(request.url, "http://skim.local");
    const path = parsedUrl.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/api/t/extract") return { status: 404, body: { error: "not_found" } };
    if (method !== "POST") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }

    if (isExtractPassthrough(request.headers)) {
      return { status: 404, body: { error: "passthrough" } };
    }

    const verified = await verifyToken(fetchImpl, upstream, token);
    if (!verified.ok) return verified;

    const left = remainingCredits(verified.account);
    if (typeof left === "number" && left < EXTRACT_CREDITS) {
      return {
        status: 402,
        body: { error: "Out of credits", message: `Extracts cost ${EXTRACT_CREDITS} credits` },
      };
    }

    const body = request.body ?? {};
    const rawUrl = body.url;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return { status: 400, body: { error: "url is required" } };
    }
    const target = rawUrl.trim();
    if (isBlockedUrl(target)) {
      return {
        status: 403,
        body: {
          error: "Invalid URL",
          message: "Private, loopback, and link-local addresses are blocked",
        },
      };
    }
    if (!body.schema || typeof body.schema !== "object" || Array.isArray(body.schema)) {
      return { status: 400, body: { error: "schema is required" } };
    }

    const payload = {
      url: target,
      schema: body.schema,
      ...(typeof body.instructions === "string" && body.instructions.trim()
        ? { instructions: body.instructions.trim() }
        : {}),
    };

    const creditsBefore = remainingCredits(verified.account);

    let result;
    if (typeof opts.extractImpl === "function") {
      result = await opts.extractImpl({ token, body: payload, headers: request.headers });
    } else {
      result = await tokenExtract(fetchImpl, upstream, token, payload, {
        [EXTRACT_PASSTHROUGH_HEADER]: "1",
      });
    }

    if (result.status === 401) return { status: 401, body: result.body?.error ? result.body : { error: "unknown token" } };
    if (result.status === 402) {
      return { status: 402, body: result.body?.error ? result.body : { error: "Out of credits" } };
    }
    if (result.status !== 200) {
      return { status: result.status, body: result.body ?? { error: "unprocessable" } };
    }

    const usable = countUsableExtractValues(result.body);
    if (usable > 0) {
      if (!extractBills && typeof opts.debitCredits === "function") {
        await opts.debitCredits(token, EXTRACT_CREDITS, target);
      }
      const rec = asRecord(result.body) ?? {};
      return {
        status: 200,
        body: { ...rec, charged: EXTRACT_CREDITS },
      };
    }

    let billed = extractBills ? billedFromExtract(result) : 0;
    if (extractBills && billed === 0) billed = EXTRACT_CREDITS;
    if (extractBills && typeof creditsBefore === "number") {
      const afterAccount = await verifyToken(fetchImpl, upstream, token);
      const creditsAfter = afterAccount.ok ? remainingCredits(afterAccount.account) : null;
      if (typeof creditsAfter === "number" && creditsAfter < creditsBefore) {
        billed = creditsBefore - creditsAfter;
      }
    }

    await refundIfNeeded(opts, token, billed);
    return { status: 422, body: emptyExtractMissBody(result.body) };
  };
}

/**
 * Wrap an already-running extract handler's response. Empty 200 → 422 + refund.
 * Call next() so the existing LLM extract still runs (no second watch mount,
 * no replacing /api/t/extract with a stub).
 */
export function wrapEmptyExtractResponse(res, ctx = {}) {
  const origEnd = res.end.bind(res);
  const origWrite = typeof res.write === "function" ? res.write.bind(res) : null;
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
    let payload = raw;
    let miss = false;
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if ((res.statusCode === 200 || res.statusCode === undefined) && countUsableExtractValues(parsed) === 0) {
        miss = true;
        payload = JSON.stringify(emptyExtractMissBody(parsed));
        res.statusCode = 422;
      }
    } catch {
      // not JSON — leave as-is
    }

    const finish = () => {
      if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Length", Buffer.byteLength(payload));
        if (miss) {
          res.setHeader("X-Skim-Credits", "0");
          res.setHeader("X-Skim-Credits-Charged", "0");
        }
      }
      return origEnd(payload, "utf8", cb);
    };

    if (miss && typeof ctx.refundCredits === "function" && ctx.token) {
      return Promise.resolve(ctx.refundCredits(ctx.token, EXTRACT_CREDITS)).then(finish, finish);
    }
    return finish();
  };

  // Keep a reference so linters don't think origWrite is unused; some hosts
  // send the body only via end(), others via write()+end().
  void origWrite;
}

export function tokenExtractFilterMiddleware(opts = {}) {
  return function extractFilter(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (path !== "/api/t/extract") {
      next();
      return;
    }
    if (isExtractPassthrough(req.headers)) {
      next();
      return;
    }
    wrapEmptyExtractResponse(res, {
      refundCredits: opts.refundCredits,
      token: getBearerToken(req.headers),
    });
    next();
  };
}

export function tokenExtractMiddleware(opts = {}) {
  const filter = tokenExtractFilterMiddleware(opts);
  const handle = createExtractHandler(opts);
  const proxy = connectMiddleware(
    (path) => path === "/api/t/extract",
    handle,
  );
  // Default: wrap the existing extract (production Express). Set
  // opts.proxyExtract=true to fully handle via upstream proxy (Vite / tests).
  if (opts.proxyExtract) return proxy;
  return filter;
}

export function tokenExtractVitePlugin(opts = {}) {
  return vitePlugin(
    "skim-token-extract",
    tokenExtractMiddleware({ ...opts, proxyExtract: true }),
  );
}
