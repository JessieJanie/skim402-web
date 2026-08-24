/**
 * Combined Vite / Express middleware for the card-lane token products:
 *   POST /api/t/extract  (honesty layer: empty → 422, no 8-credit success)
 *   POST /api/t/crawl
 *   POST /api/t/watch  (+ webhookUrl, PATCH update, GET /diff fires webhook)
 *   POST /api/t/read-pdf
 *   GET  /api/signals + /signals.json  (unauthenticated machine catalog)
 *   GET  /api/t/signal/sample  (unauthenticated bazaar example, charged: 0)
 *   GET  /api/t/signal/:slug/latest + /api/t/feeds/x402/latest
 *        (since= / If-None-Match → 304 or unchanged + refund when host injects refundCredits)
 *   GET  /.well-known/x402  +  /.well-known/x402.json  +  /.well-known/x402-service.json
 *        (x402scan discovery; same JSON. Extensionless path is what registerFromOrigin fetches.)
 *
 * Extract wraps the existing LLM handler (next()) — it does not replace it
 * and does not double-mount /api/t/watch*. Pass refundCredits so an empty
 * extract that already hit the sk402_ ledger is credited back.
 *
 * Production Express (same host as /api/t/read):
 *   import { tokenProductsMiddleware } from "./tokenProducts.mjs";
 *   app.use(tokenProductsMiddleware({
 *     upstream: "https://skim402.com",
 *     refundCredits: (token, amount) => cardLedger.credit(token, amount),
 *   }));
 */

import { tokenCrawlMiddleware } from "./tokenCrawl.mjs";
import { tokenReadPdfMiddleware } from "./tokenReadPdf.mjs";
import { tokenWatchHooksMiddleware } from "./tokenWatchHooks.mjs";
import { tokenExtractFilterMiddleware } from "./tokenExtract.mjs";
import { tokenSignalMiddleware } from "./tokenSignal.mjs";
import { isDiscoveryPath, x402DiscoveryMiddleware } from "./x402Discovery.mjs";
import { vitePlugin } from "./http.mjs";

export function tokenProductsMiddleware(opts = {}) {
  const discovery = x402DiscoveryMiddleware();
  const extract = tokenExtractFilterMiddleware(opts);
  const crawl = tokenCrawlMiddleware(opts);
  const pdf = tokenReadPdfMiddleware(opts);
  const watch = tokenWatchHooksMiddleware(opts);
  const signal = tokenSignalMiddleware(opts);
  return async function tokenProducts(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (isDiscoveryPath(path)) return discovery(req, res, next);
    if (path === "/api/t/extract") return extract(req, res, next);
    if (path === "/api/t/crawl") return crawl(req, res, next);
    if (path === "/api/t/read-pdf") return pdf(req, res, next);
    if (path.startsWith("/api/t/watch")) return watch(req, res, next);
    if (
      path === "/api/signals" ||
      path === "/signals.json" ||
      path === "/api/t/signal/sample" ||
      path === "/api/t/signals/sample" ||
      path === "/api/t/feeds/x402/latest" ||
      /^\/api\/t\/signal\/[^/]+\/latest$/.test(path)
    ) {
      return signal(req, res, next);
    }
    next();
  };
}

export function tokenProductsVitePlugin(opts = {}) {
  return vitePlugin(
    "skim-token-products",
    tokenProductsMiddleware({ ...opts, proxySignals: true }),
  );
}
