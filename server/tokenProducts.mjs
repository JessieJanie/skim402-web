/**
 * Combined Vite / Express middleware for the three new token products:
 *   POST /api/t/crawl
 *   POST /api/t/watch  (+ webhookUrl, PATCH update, GET /diff fires webhook)
 *   POST /api/t/read-pdf
 *
 * Production Express (same host as /api/t/read):
 *   import { tokenProductsMiddleware } from "./tokenProducts.mjs";
 *   app.use(tokenProductsMiddleware({ upstream: "https://skim402.com" }));
 */

import { tokenCrawlMiddleware } from "./tokenCrawl.mjs";
import { tokenReadPdfMiddleware } from "./tokenReadPdf.mjs";
import { tokenWatchHooksMiddleware } from "./tokenWatchHooks.mjs";
import { vitePlugin } from "./http.mjs";

export function tokenProductsMiddleware(opts = {}) {
  const crawl = tokenCrawlMiddleware(opts);
  const pdf = tokenReadPdfMiddleware(opts);
  const watch = tokenWatchHooksMiddleware(opts);
  return async function tokenProducts(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (path === "/api/t/crawl") return crawl(req, res, next);
    if (path === "/api/t/read-pdf") return pdf(req, res, next);
    if (path.startsWith("/api/t/watch")) return watch(req, res, next);
    next();
  };
}

export function tokenProductsVitePlugin(opts = {}) {
  return vitePlugin("skim-token-products", tokenProductsMiddleware(opts));
}
