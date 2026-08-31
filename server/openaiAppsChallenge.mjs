/**
 * OpenAI Apps domain verification.
 *
 *   GET /.well-known/openai-apps-challenge
 *
 * Production Express JSON-404s unknown /.well-known/* paths (Vite public/
 * copies are not enough on Replit). Same mount pattern as x402Discovery:
 * an explicit Express/Vite route so the URL wins as text/plain, not
 * {"error":"not_found"} and not the SPA HTML fallback.
 *
 * Token: OPENAI_APPS_CHALLENGE (or OPENAI_DOMAIN_VERIFICATION) if set,
 * otherwise the committed public verification token. No Replit secret
 * required after republish. This token is meant to be public.
 *
 * Mount independently of POST /mcp — live production still serves the
 * older 3-tool MCP stub, and this route must not depend on replacing it.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vitePlugin } from "./http.mjs";

export const OPENAI_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

/** Public OpenAI Apps domain-verification token (meant to be published). */
export const OPENAI_APPS_CHALLENGE_FALLBACK =
  "uOZcCcu1AJm20BTr-hGGVBOYqEKu4ZRyrsjCORAnwDA";

const CHALLENGE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/.well-known/openai-apps-challenge",
);

export function loadCommittedChallengeToken() {
  try {
    const raw = readFileSync(CHALLENGE_FILE, "utf8").trim();
    if (raw) return raw;
  } catch {
    // file missing in some test/bundle layouts
  }
  return OPENAI_APPS_CHALLENGE_FALLBACK;
}

export function isOpenaiChallengePath(path) {
  const clean = (path ?? "").split("?")[0].replace(/\/+$/, "") || "/";
  return clean === OPENAI_CHALLENGE_PATH;
}

export function openaiChallengeToken(env = process.env) {
  const fromEnv = env.OPENAI_APPS_CHALLENGE ?? env.OPENAI_DOMAIN_VERIFICATION;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return loadCommittedChallengeToken();
}

function applyChallengeHeaders(res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

export function openaiAppsChallengeMiddleware(opts = {}) {
  const env = opts.env ?? process.env;
  return function openaiAppsChallenge(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!isOpenaiChallengePath(path)) {
      next();
      return;
    }
    const method = (req.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      applyChallengeHeaders(res);
      res.end("method_not_allowed\n");
      return;
    }
    const token = openaiChallengeToken(env);
    res.statusCode = 200;
    applyChallengeHeaders(res);
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(`${token}\n`);
  };
}

export function openaiAppsChallengeVitePlugin(opts = {}) {
  return vitePlugin("skim-openai-apps-challenge", openaiAppsChallengeMiddleware(opts));
}
