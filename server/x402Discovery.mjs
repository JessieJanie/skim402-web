/**
 * x402scan discovery documents at:
 *   GET /.well-known/x402
 *   GET /.well-known/x402.json
 *   GET /.well-known/x402-service.json  (same body — old crawlers 404'd here)
 *
 * registerFromOrigin fetches /.well-known/x402 (no extension) first.
 * Production Express returns JSON 404 for unknown paths, so these must be
 * mounted as routes — Vite public/ copies are not enough on Replit.
 *
 * payTo in ownershipProofs was read from a live 402 Payment-Required
 * (GET /api/v2/read, 2026-08-24): 0x63AE98f3363B346a94Fcc1CBcB621F1C2B1Fcddc
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vitePlugin } from "./http.mjs";

const DISCOVERY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/.well-known/x402.json",
);

export const DISCOVERY_PATHS = [
  "/.well-known/x402",
  "/.well-known/x402.json",
  "/.well-known/x402-service.json",
];

const CARD_LANE = "/api/t/";
const FORBIDDEN_SUBSTRINGS = ["crawl", "read-pdf"];

export function loadDiscoveryDocument() {
  return JSON.parse(readFileSync(DISCOVERY_FILE, "utf8"));
}

export function isDiscoveryPath(path) {
  const clean = (path ?? "").split("?")[0].replace(/\/+$/, "") || "/";
  return DISCOVERY_PATHS.includes(clean);
}

export function assertWalletLaneResources(doc) {
  if (!doc || !Array.isArray(doc.resources)) {
    throw new Error("discovery document missing resources[]");
  }
  for (const resource of doc.resources) {
    if (typeof resource !== "string") {
      throw new Error("resource is not a string");
    }
    let url;
    try {
      url = new URL(resource);
    } catch {
      throw new Error(`resource is not a URL: ${resource}`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`resource is not https: ${resource}`);
    }
    if (url.pathname.includes(CARD_LANE) || resource.includes(CARD_LANE)) {
      throw new Error(`card-lane resource listed: ${resource}`);
    }
    const lower = url.pathname.toLowerCase();
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      if (lower.includes(forbidden)) {
        throw new Error(`non-402 twin listed: ${resource}`);
      }
    }
    if (!url.pathname.startsWith("/api/v2/")) {
      throw new Error(`not a v2 wallet-lane route: ${resource}`);
    }
  }
  return true;
}

export function discoveryBody() {
  const doc = loadDiscoveryDocument();
  assertWalletLaneResources(doc);
  return doc;
}

export function x402DiscoveryMiddleware() {
  const payload = JSON.stringify(discoveryBody());
  return function discovery(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!DISCOVERY_PATHS.includes(path)) {
      next();
      return;
    }
    const method = (req.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(payload);
  };
}

export function x402DiscoveryVitePlugin() {
  return vitePlugin("skim-x402-discovery", x402DiscoveryMiddleware());
}
