/**
 * POST /api/t/read-pdf  (also GET /api/t/read-pdf?url=)
 *
 * Accept a public PDF URL, return clean markdown (+ optional outline).
 * Text comes only from the PDF. Huge files are rejected.
 * Credits: 3 (JS-read rate) via the existing token ledger — not extract (8).
 */

import {
  connectMiddleware,
  getBearerToken,
  isBlockedUrl,
  remainingCredits,
  safeFetch,
  tokenRead,
  verifyToken,
  vitePlugin,
} from "./http.mjs";
import { PDF_MAX_BYTES, looksLikePdf, pdfToMarkdown } from "./pdfText.mjs";

export const PDF_CREDITS = 3;

async function debitPdfCredits(fetchImpl, upstream, token, url, customDebit) {
  if (typeof customDebit === "function") {
    return customDebit(token, PDF_CREDITS, url);
  }
  // 3 credits = one /t/read/js settlement on the same URL (or its origin).
  const js = await tokenRead(fetchImpl, upstream, token, url, { js: true });
  if (js.status === 401) return { status: 401, charged: 0, body: { error: "unknown token" } };
  if (js.status === 402) {
    return { status: 402, charged: 0, body: js.body?.error ? js.body : { error: "Out of credits" } };
  }
  if (js.status === 200) return { status: 200, charged: PDF_CREDITS };

  // JS render of a raw PDF often 422s and refunds. Fall back to 3 basic reads
  // of the PDF URL — each successful /t/read is 1 credit on the same ledger.
  let charged = 0;
  for (let i = 0; i < PDF_CREDITS; i += 1) {
    const read = await tokenRead(fetchImpl, upstream, token, url);
    if (read.status === 401) return { status: 401, charged, body: { error: "unknown token" } };
    if (read.status === 402) {
      return { status: 402, charged, body: read.body?.error ? read.body : { error: "Out of credits" } };
    }
    if (read.status === 200) charged += 1;
  }
  return { status: 200, charged };
}

export function createReadPdfHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return async function handleReadPdf(request) {
    const token = getBearerToken(request.headers);
    if (!token) return { status: 401, body: { error: "unknown token" } };

    const method = (request.method ?? "GET").toUpperCase();
    const parsedUrl = new URL(request.url, "http://skim.local");
    const path = parsedUrl.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/api/t/read-pdf") return { status: 404, body: { error: "not_found" } };
    if (method !== "GET" && method !== "POST") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }

    const verified = await verifyToken(fetchImpl, upstream, token);
    if (!verified.ok) return verified;

    const left = remainingCredits(verified.account);
    if (typeof left === "number" && left < PDF_CREDITS) {
      return { status: 402, body: { error: "Out of credits", message: `PDF reads cost ${PDF_CREDITS} credits` } };
    }

    const body = request.body ?? {};
    const raw = method === "GET" ? parsedUrl.searchParams.get("url") : body.url;
    if (typeof raw !== "string" || !raw.trim()) {
      return { status: 400, body: { error: "url is required" } };
    }
    const target = raw.trim();
    if (isBlockedUrl(target)) {
      return { status: 403, body: { error: "Invalid URL", message: "Private, loopback, and link-local addresses are blocked" } };
    }

    const wantOutline = method === "GET"
      ? parsedUrl.searchParams.get("outline") !== "false"
      : body.outline !== false;

    const fetched = await safeFetch(fetchImpl, target, { maxBytes: PDF_MAX_BYTES, timeoutMs: 20_000 });
    if (fetched.blocked) {
      return { status: 403, body: { error: "Invalid URL", message: "URL is blocked by SSRF rules" } };
    }
    if (fetched.tooLarge) {
      return {
        status: 413,
        body: {
          error: "payload too large",
          message: `PDF is larger than ${Math.round(PDF_MAX_BYTES / (1024 * 1024))} MB. Use a smaller file.`,
        },
      };
    }
    if (fetched.error) {
      return { status: 422, body: { error: "unprocessable", message: fetched.error } };
    }
    if (fetched.status >= 400 || !fetched.buffer) {
      return {
        status: 422,
        body: {
          error: "unprocessable",
          message: `Upstream responded ${fetched.status || "without a body"}`,
        },
      };
    }
    if (!looksLikePdf(fetched.buffer, fetched.contentType)) {
      return {
        status: 415,
        body: { error: "unsupported_media_type", message: "URL did not return a PDF" },
      };
    }

    const extracted = pdfToMarkdown(fetched.buffer);
    if (!extracted.text.trim()) {
      return {
        status: 422,
        body: {
          error: "empty_pdf",
          message: "No extractable text found in this PDF (possibly image-only or encrypted)",
          charged: 0,
        },
      };
    }

    const bill = await debitPdfCredits(fetchImpl, upstream, token, target, opts.debitCredits);
    if (bill.status === 401 || bill.status === 402) return { status: bill.status, body: bill.body };

    return {
      status: 200,
      body: {
        url: target,
        finalUrl: fetched.url || target,
        markdown: extracted.markdown,
        text: extracted.text,
        outline: wantOutline ? extracted.outline : undefined,
        pageCount: extracted.pageHint,
        charged: bill.charged || PDF_CREDITS,
        credits: bill.charged || PDF_CREDITS,
        fetchedAt: new Date().toISOString(),
        source: "pdf",
      },
    };
  };
}

export function tokenReadPdfMiddleware(opts = {}) {
  return connectMiddleware((path) => path === "/api/t/read-pdf", createReadPdfHandler(opts));
}

export function tokenReadPdfVitePlugin(opts = {}) {
  return vitePlugin("skim-token-read-pdf", tokenReadPdfMiddleware(opts));
}
