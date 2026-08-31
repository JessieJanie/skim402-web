/**
 * MCP agent-discovery documents (AI Catalog + Server Card).
 *
 * Canonical:
 *   GET /.well-known/ai-catalog.json
 *   GET /mcp/server-card          (MCP URL + /server-card; not GET /mcp)
 *
 * Aliases (same JSON):
 *   GET /.well-known/mcp/catalog.json
 *   GET /.well-known/mcp.json
 *   GET /.well-known/mcp/server-card.json
 *
 * POST /mcp is Streamable HTTP. GET /mcp is reserved for the MCP SSE
 * stream — do not serve the server card from GET /mcp.
 *
 * Production Express JSON-404s unknown paths, so these must be mounted
 * as routes — Vite public/ copies are not enough on Replit.
 * Canonical /mcp/server-card is route-only: a public/mcp/ directory
 * would shadow POST /mcp on some static hosts.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { header, vitePlugin } from "./http.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_FILE = join(ROOT, "public/.well-known/ai-catalog.json");
const CARD_FILE = join(ROOT, "public/.well-known/mcp.json");

export const CATALOG_PATHS = ["/.well-known/ai-catalog.json", "/.well-known/mcp/catalog.json"];

export const SERVER_CARD_PATHS = [
  "/mcp/server-card",
  "/.well-known/mcp.json",
  "/.well-known/mcp/server-card.json",
];

export const MCP_DISCOVERY_PATHS = [...CATALOG_PATHS, ...SERVER_CARD_PATHS];

export const SERVER_CARD_MIME = "application/mcp-server-card+json";
export const MAX_SERVER_CARD_DESCRIPTION_CHARS = 100;

function cleanPath(path) {
  return (path ?? "").split("?")[0].replace(/\/+$/, "") || "/";
}

export function isMcpDiscoveryPath(path) {
  return MCP_DISCOVERY_PATHS.includes(cleanPath(path));
}

export function isServerCardPath(path) {
  return SERVER_CARD_PATHS.includes(cleanPath(path));
}

export function isCatalogPath(path) {
  return CATALOG_PATHS.includes(cleanPath(path));
}

export function loadCatalogDocument() {
  return JSON.parse(readFileSync(CATALOG_FILE, "utf8"));
}

export function loadServerCardDocument() {
  return JSON.parse(readFileSync(CARD_FILE, "utf8"));
}

export function assertServerCardDescriptionLimit(doc) {
  const description = doc?.description ?? "";
  if (typeof description !== "string") {
    throw new Error("server card description must be a string");
  }
  if (description.length > MAX_SERVER_CARD_DESCRIPTION_CHARS) {
    throw new Error(
      `server card description exceeds ${MAX_SERVER_CARD_DESCRIPTION_CHARS} characters (${description.length})`,
    );
  }
  return true;
}

function etagFor(body) {
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 32);
  return `"${hash}"`;
}

function wantsServerCardMime(headers) {
  const accept = header(headers, "accept").toLowerCase();
  return accept.includes(SERVER_CARD_MIME);
}

function etagMatches(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((part) => {
    const token = part.trim();
    return token === etag || token === `W/${etag}` || token === "*";
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Expose-Headers": "ETag",
  };
}

function applyHeaders(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function contentTypeFor(isCard, reqHeaders) {
  if (isCard && wantsServerCardMime(reqHeaders)) {
    return `${SERVER_CARD_MIME}; charset=utf-8`;
  }
  return "application/json; charset=utf-8";
}

export function mcpDiscoveryMiddleware() {
  const catalogDoc = loadCatalogDocument();
  const cardDoc = loadServerCardDocument();
  assertServerCardDescriptionLimit(cardDoc);
  const catalogBody = JSON.stringify(catalogDoc);
  const cardBody = JSON.stringify(cardDoc);
  const catalogEtag = etagFor(catalogBody);
  const cardEtag = etagFor(cardBody);

  return function mcpDiscovery(req, res, next) {
    const path = cleanPath(req.url ?? "/");
    if (!MCP_DISCOVERY_PATHS.includes(path)) {
      next();
      return;
    }

    const method = (req.method ?? "GET").toUpperCase();
    const isCard = SERVER_CARD_PATHS.includes(path);
    const body = isCard ? cardBody : catalogBody;
    const etag = isCard ? cardEtag : catalogEtag;
    const reqHeaders = req.headers ?? {};

    applyHeaders(res, corsHeaders());
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Allow", "GET, HEAD, OPTIONS");
      res.end();
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader("Content-Type", contentTypeFor(isCard, reqHeaders));

    if (etagMatches(header(reqHeaders, "if-none-match"), etag)) {
      res.statusCode = 304;
      res.end();
      return;
    }

    res.statusCode = 200;
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  };
}

export function mcpDiscoveryVitePlugin() {
  return vitePlugin("skim-mcp-discovery", mcpDiscoveryMiddleware());
}
