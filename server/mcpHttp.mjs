/**
 * Hosted MCP Streamable HTTP (stateless POST).
 *
 *   POST /mcp
 *   POST /api/mcp
 *
 * initialize + tools/list work without a key (OpenAI Scan Tools).
 * Tool calls require a card API key: Authorization: Bearer sk402_… or x-api-key.
 * Never reads SKIM_WALLET_PRIVATE_KEY. Never stores wallet keys.
 *
 * Tools match skim-mcp and call the existing card-lane API (no second reader):
 *   read_url      → GET  /api/t/read
 *   read_urls     → POST /api/t/read/batch
 *   extract_url   → POST /api/t/extract  (preset table = tables)
 *   crawl_url     → POST /api/t/crawl
 *   read_pdf      → POST /api/t/read-pdf
 *   watch_urls    → POST /api/t/watch
 *   check_watch   → GET  /api/t/watch/diff|status
 *   poll_signal   → GET  /api/t/signal/{slug}/latest  (x402 → /api/t/feeds/x402/latest)
 *
 * Production Express (same host as /api/t/read):
 *   import { mcpHttpMiddleware } from "./mcpHttp.mjs";
 *   app.use(mcpHttpMiddleware({ upstream: "https://skim402.com" }));
 * Mount before any older /api/mcp stub and before the SPA fallback.
 */

import {
  getBearerToken,
  header,
  isBlockedUrl,
  readBody,
  readJsonResponse,
  vitePlugin,
} from "./http.mjs";
import { normalizeStartUrl } from "./tokenCrawl.mjs";

export const MCP_VERSION = "1.0.0";
export const MCP_SERVER_NAME = "skim";
export const MCP_TIMEOUT_MS = 90_000;
export const MCP_PATHS = ["/mcp", "/api/mcp"];
export const OPENAI_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

const SUPPORTED_PROTOCOL = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DEFAULT_PROTOCOL = "2025-03-26";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const WATCH_CREATE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const WATCH_POLL = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Same preset schemas as skim-mcp — sent as `schema` to POST /api/t/extract. */
export const PRESET_SCHEMAS = {
  article: {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      published: { type: "string" },
      summary: { type: "string" },
      key_points: { type: "array", items: { type: "string" } },
      language: { type: "string" },
    },
    required: ["title"],
  },
  product: {
    type: "object",
    properties: {
      name: { type: "string" },
      brand: { type: "string" },
      price: { type: "number" },
      currency: { type: "string" },
      availability: { type: "string" },
      rating: { type: "number" },
      reviewCount: { type: "number" },
      description: { type: "string" },
    },
    required: ["name"],
  },
  job: {
    type: "object",
    properties: {
      title: { type: "string" },
      company: { type: "string" },
      location: { type: "string" },
      remote: { type: "boolean" },
      employmentType: { type: "string" },
      salaryMin: { type: "number" },
      salaryMax: { type: "number" },
      requirements: { type: "array", items: { type: "string" } },
    },
    required: ["title"],
  },
  review: {
    type: "object",
    properties: {
      item: { type: "string" },
      rating: { type: "number" },
      scale: { type: "number" },
      author: { type: "string" },
      verdict: { type: "string" },
      pros: { type: "array", items: { type: "string" } },
      cons: { type: "array", items: { type: "string" } },
    },
    required: ["item"],
  },
  event: {
    type: "object",
    properties: {
      name: { type: "string" },
      startDate: { type: "string" },
      endDate: { type: "string" },
      venue: { type: "string" },
      city: { type: "string" },
      country: { type: "string" },
      organizer: { type: "string" },
      ticketPrice: { type: "string" },
    },
    required: ["name"],
  },
  table: {
    type: "object",
    properties: {
      tables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            caption: { type: "string" },
            headers: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
        },
      },
    },
    required: ["tables"],
  },
};

export const SIGNAL_SLUGS = [
  "ai-news",
  "sec-filings",
  "crypto-news",
  "macro",
  "security",
  "regulations",
  "courts",
  "recalls",
  "deals",
  "launches",
  "trending",
  "research",
  "energy",
  "entertainment",
  "studio-jobs",
  "campaign-finance",
  "film-incentives",
  "x402",
];

export function isMcpPath(path) {
  const clean = (path ?? "").split("?")[0].replace(/\/+$/, "") || "/";
  return MCP_PATHS.includes(clean);
}

export function isOpenaiChallengePath(path) {
  const clean = (path ?? "").split("?")[0].replace(/\/+$/, "") || "/";
  return clean === OPENAI_CHALLENGE_PATH;
}

export function openaiChallengeToken(env = process.env) {
  const raw = env.OPENAI_APPS_CHALLENGE ?? env.OPENAI_DOMAIN_VERIFICATION ?? "";
  return typeof raw === "string" ? raw : "";
}

export function getMcpApiKey(headers) {
  const bearer = getBearerToken(headers);
  if (bearer) return bearer;
  const apiKey = header(headers, "x-api-key").trim();
  if (apiKey.startsWith("sk402_")) return apiKey;
  return null;
}

function dottedFromInt(n) {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

/** SSRF + file:// gate for OpenAI negative tests. Does not loosen /t/read rules. */
export function isDisallowedTarget(raw) {
  if (typeof raw !== "string" || !raw.trim()) return true;
  const value = raw.trim();
  if (/^file:/i.test(value)) return true;
  if (/^(javascript|data|ftp|ws|wss):/i.test(value)) return true;
  if (isBlockedUrl(value)) return true;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  // Some Node versions keep brackets in hostname ([::1]); strip before comparing.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "169.254.169.254"
  ) {
    return true;
  }
  if (host.includes(":")) {
    if (
      host.startsWith("fe80:") ||
      /^f[cd][0-9a-f]{0,2}:/i.test(host) ||
      host.startsWith("::ffff:") ||
      host === "::" ||
      host === "0:0:0:0:0:0:0:0"
    ) {
      return true;
    }
  }
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) {
      return isBlockedUrl(`http://${dottedFromInt(n)}/`);
    }
  }
  return false;
}

export function publicHttpUrlError(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "url is required";
  const value = raw.trim();
  if (/^file:/i.test(value)) return "file:// URLs are not allowed";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only http(s) URLs are supported";
    }
  } catch {
    return "Invalid URL";
  }
  if (isDisallowedTarget(value)) return "URL resolves to a non-public address";
  return null;
}

function fail(text) {
  return { content: [{ type: "text", text }], isError: true };
}

function ok(text) {
  return { content: [{ type: "text", text }] };
}

function authMissing() {
  return fail(
    "This tool requires a Skim card API key (sk402_…). Pass Authorization: Bearer sk402_… or x-api-key: sk402_…. Get a free key at https://skim402.com",
  );
}

function formatRead(data) {
  const metaLines = data?.metadata
    ? Object.entries(data.metadata)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    : [];
  const frontmatter = metaLines.length > 0 ? `---\n${metaLines.join("\n")}\n---\n\n` : "";
  return frontmatter + (data?.markdown ?? data?.text ?? "");
}

function formatCrawl(data) {
  const meta = {};
  if (data.url) meta.url = data.url;
  if (data.origin) meta.origin = data.origin;
  if (data.pageCount != null) meta.pageCount = data.pageCount;
  if (data.discovered != null) meta.discovered = data.discovered;
  if (data.capped != null) meta.capped = data.capped;
  if (data.maxPages != null) meta.maxPages = data.maxPages;
  if (data.sources?.length) meta.sources = data.sources.join(", ");
  if (data.charged != null) meta.charged = data.charged;
  if (data.fetchedAt) meta.fetchedAt = data.fetchedAt;
  const blocks = (data.pages ?? []).map((page) => {
    if (page.ok !== false && (page.markdown || page.title)) {
      const heading = page.title ? `${page.title} — ${page.url}` : page.url;
      return `## ${heading}\n\n${page.markdown ?? ""}`;
    }
    const err = page.error;
    const detail =
      typeof err === "string"
        ? err
        : err
          ? `${err.status ?? ""} ${err.message ?? ""}`.trim()
          : "unknown error";
    return `## ${page.url}\n\nERROR: ${detail}`;
  });
  return formatRead({ metadata: meta, markdown: blocks.join("\n\n---\n\n") }) || JSON.stringify(data, null, 2);
}

function signalPollPath(slug) {
  return slug === "x402" ? "/api/t/feeds/x402/latest" : `/api/t/signal/${slug}/latest`;
}

function toolDef(name, description, inputSchema, annotations) {
  return { name, description, inputSchema, annotations };
}

export function listTools() {
  return [
    toolDef(
      "read_url",
      "Fetch any public URL and return clean, agent-ready Markdown via Skim (skim402.com). Strips nav, ads, and boilerplate; preserves the article body plus structured metadata. Calls GET /api/t/read.",
      {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Fully-qualified http(s) URL to fetch and clean.",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
    toolDef(
      "read_urls",
      "Read 1–10 public URLs in one Skim call and return per-URL clean Markdown. Calls POST /api/t/read/batch.",
      {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10,
            description: "1–10 fully-qualified http(s) URLs.",
          },
          stripLinks: { type: "boolean", description: "Flatten markdown links to anchor text." },
          stripImages: { type: "boolean", description: "Drop image markup from the markdown." },
        },
        required: ["urls"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
    toolDef(
      "extract_url",
      "Extract structured JSON (or HTML tables) from a public URL. Pass a JSON Schema, or a preset: article, product, job, review, event, table. Values come only from the page. Calls POST /api/t/extract.",
      {
        type: "object",
        properties: {
          url: { type: "string", description: "Fully-qualified http(s) URL to extract from." },
          schema: {
            type: "object",
            additionalProperties: true,
            description: "JSON Schema (type: object). Required unless preset is set. Wins if both are set.",
          },
          preset: {
            type: "string",
            enum: ["article", "product", "job", "review", "event", "table"],
            description: "Built-in extraction shape. Use table for data tables on the page.",
          },
          instructions: { type: "string", description: "Optional natural-language hint." },
        },
        required: ["url"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
    toolDef(
      "crawl_url",
      "Crawl a public site (origin or start URL) and return clean Markdown for important same-origin pages. Discovers sitemap.xml and start-page links. Cap 25. Calls POST /api/t/crawl. Does not create a persistent watch.",
      {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Site origin or start URL. Bare hosts like example.com become https://example.com.",
          },
          maxPages: { type: "integer", minimum: 1, maximum: 25, description: "Page cap, 1–25. Default 25." },
          stripLinks: { type: "boolean" },
          stripImages: { type: "boolean" },
        },
        required: ["url"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
    toolDef(
      "read_pdf",
      "Fetch a public PDF URL and return clean Markdown plus an optional bookmark outline. Text comes only from the file. Calls POST /api/t/read-pdf.",
      {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute http(s) PDF URL." },
          outline: { type: "boolean", description: "Include bookmark outline when present (default true)." },
        },
        required: ["url"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
    toolDef(
      "watch_urls",
      "Register a private Skim Watch on 1–20 public URLs. Creates server-side watch state and returns a watch_id (treat as a secret) for check_watch. Calls POST /api/t/watch.",
      {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 20,
            description: "1–20 fully-qualified http(s) URLs to watch.",
          },
          note: { type: "string", description: "Optional label for this watch." },
        },
        required: ["urls"],
        additionalProperties: false,
      },
      WATCH_CREATE,
    ),
    toolDef(
      "check_watch",
      "Poll a Skim Watch for content changes (or fetch registration status). Pass watch_id from watch_urls. Calls GET /api/t/watch/diff?id= or /status.",
      {
        type: "object",
        properties: {
          watch_id: { type: "string", description: "Watch id returned by watch_urls." },
          status_only: { type: "boolean", description: "If true, return registration status only (no diff)." },
        },
        required: ["watch_id"],
        additionalProperties: false,
      },
      WATCH_POLL,
    ),
    toolDef(
      "poll_signal",
      "Poll a Skim Signal feed and return the latest structured items. Calls GET /api/t/signal/{slug}/latest (x402 uses GET /api/t/feeds/x402/latest).",
      {
        type: "object",
        properties: {
          slug: {
            type: "string",
            enum: SIGNAL_SLUGS,
            description: "Signal slug from skim402.com/signals. Use x402 for the ecosystem feed.",
          },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Max items, newest-first. Default 50." },
          forms: { type: "string", description: "Comma-separated form filter (sec-filings, campaign-finance)." },
          categories: { type: "string", description: "deals only." },
          fields: { type: "string", description: "research only." },
          states: { type: "string", description: "film-incentives only." },
          committees: { type: "string", description: "campaign-finance only." },
        },
        required: ["slug"],
        additionalProperties: false,
      },
      READ_ONLY,
    ),
  ];
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

async function apiRequest(fetchImpl, upstream, token, method, path, opts = {}) {
  const url = new URL(path, `${upstream}/`);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value != null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const res = await fetchImpl(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
    signal: AbortSignal.timeout(opts.timeoutMs ?? MCP_TIMEOUT_MS),
  });
  const body = await readJsonResponse(res);
  return { status: res.status, body };
}

function upstreamError(status, body) {
  const detail =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    JSON.stringify(body ?? {});
  if (status === 401) {
    return fail("Unknown or invalid API key (401). Use a sk402_ key from https://skim402.com");
  }
  if (status === 402) {
    return fail(`Out of credits (402): ${detail}`);
  }
  return fail(`Skim could not complete that call (${status}): ${detail}`);
}

async function callTool(name, args, ctx) {
  const token = ctx.token;
  if (!token) return authMissing();
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};

  if (name === "read_url") {
    const blocked = publicHttpUrlError(input.url);
    if (blocked) return fail(blocked);
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "GET", "/api/t/read", {
      query: { url: String(input.url).trim() },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(formatRead(res.body));
  }

  if (name === "read_urls") {
    const urls = input.urls;
    if (!Array.isArray(urls) || urls.length < 1) return fail("urls must be a non-empty array");
    if (urls.length > 10) return fail("urls is capped at 10");
    for (const url of urls) {
      const blocked = publicHttpUrlError(url);
      if (blocked) return fail(blocked);
    }
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "POST", "/api/t/read/batch", {
      body: {
        urls,
        ...(input.stripLinks !== undefined ? { stripLinks: Boolean(input.stripLinks) } : {}),
        ...(input.stripImages !== undefined ? { stripImages: Boolean(input.stripImages) } : {}),
      },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    const blocks = (res.body.results ?? []).map((item) => {
      if (item.ok && item.data) return `## ${item.url}\n\n${formatRead(item.data)}`;
      const err = item.error;
      const detail = err ? `${err.status ?? ""} ${err.message ?? ""}`.trim() : "unknown error";
      return `## ${item.url}\n\nERROR: ${detail}`;
    });
    return ok(blocks.join("\n\n---\n\n") || JSON.stringify(res.body, null, 2));
  }

  if (name === "extract_url") {
    const blocked = publicHttpUrlError(input.url);
    if (blocked) return fail(blocked);
    const schema =
      input.schema && typeof input.schema === "object" && !Array.isArray(input.schema)
        ? input.schema
        : input.preset
          ? PRESET_SCHEMAS[input.preset]
          : undefined;
    if (!schema) {
      return fail(
        "extract_url needs a JSON Schema (`schema`) or a `preset` (article, product, job, review, event, table).",
      );
    }
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "POST", "/api/t/extract", {
      body: {
        url: String(input.url).trim(),
        schema,
        ...(typeof input.instructions === "string" && input.instructions
          ? { instructions: input.instructions }
          : {}),
      },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(JSON.stringify(res.body, null, 2));
  }

  if (name === "crawl_url") {
    const start = normalizeStartUrl(input.url);
    if (start.error) return fail(start.error);
    if (isDisallowedTarget(start.url)) return fail("URL resolves to a non-public address");
    let maxPages = Number(input.maxPages);
    if (!Number.isFinite(maxPages) || maxPages <= 0) maxPages = undefined;
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "POST", "/api/t/crawl", {
      body: {
        url: start.url,
        ...(maxPages != null ? { maxPages: Math.min(25, Math.max(1, Math.floor(maxPages))) } : {}),
        ...(input.stripLinks !== undefined ? { stripLinks: Boolean(input.stripLinks) } : {}),
        ...(input.stripImages !== undefined ? { stripImages: Boolean(input.stripImages) } : {}),
      },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(formatCrawl(res.body));
  }

  if (name === "read_pdf") {
    const blocked = publicHttpUrlError(input.url);
    if (blocked) return fail(blocked);
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "POST", "/api/t/read-pdf", {
      body: {
        url: String(input.url).trim(),
        ...(input.outline !== undefined ? { outline: Boolean(input.outline) } : {}),
      },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(
      formatRead({
        markdown: res.body.markdown,
        text: res.body.text,
        metadata: {
          ...(res.body.url ? { url: res.body.url } : {}),
          ...(res.body.finalUrl ? { finalUrl: res.body.finalUrl } : {}),
          ...(res.body.pageCount != null ? { pageCount: res.body.pageCount } : {}),
          ...(res.body.charged != null ? { charged: res.body.charged } : {}),
          ...(res.body.fetchedAt ? { fetchedAt: res.body.fetchedAt } : {}),
          ...(res.body.outline != null ? { outline: res.body.outline } : {}),
        },
      }),
    );
  }

  if (name === "watch_urls") {
    const urls = input.urls;
    if (!Array.isArray(urls) || urls.length < 1) return fail("urls must be a non-empty array");
    if (urls.length > 20) return fail("urls is capped at 20");
    for (const url of urls) {
      const blocked = publicHttpUrlError(url);
      if (blocked) return fail(blocked);
    }
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "POST", "/api/t/watch", {
      body: {
        urls,
        ...(typeof input.note === "string" && input.note ? { note: input.note } : {}),
      },
    });
    if (res.status !== 200 && res.status !== 201) return upstreamError(res.status, res.body);
    return ok(JSON.stringify(res.body, null, 2));
  }

  if (name === "check_watch") {
    const watchId = typeof input.watch_id === "string" ? input.watch_id.trim() : "";
    if (!watchId) return fail("watch_id is required");
    const kind = input.status_only ? "status" : "diff";
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "GET", `/api/t/watch/${kind}`, {
      query: { id: watchId },
    });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(JSON.stringify(res.body, null, 2));
  }

  if (name === "poll_signal") {
    const slug = input.slug;
    if (!SIGNAL_SLUGS.includes(slug)) {
      return fail(`Unknown signal slug. Use one of: ${SIGNAL_SLUGS.join(", ")}`);
    }
    const query = {};
    if (input.limit != null) query.limit = String(input.limit);
    if (input.forms) query.forms = String(input.forms);
    if (input.categories) query.categories = String(input.categories);
    if (input.fields) query.fields = String(input.fields);
    if (input.states) query.states = String(input.states);
    if (input.committees) query.committees = String(input.committees);
    const res = await apiRequest(ctx.fetchImpl, ctx.upstream, token, "GET", signalPollPath(slug), { query });
    if (res.status !== 200) return upstreamError(res.status, res.body);
    return ok(JSON.stringify(res.body, null, 2));
  }

  return fail(`Unknown tool: ${name}`);
}

export async function handleJsonRpc(message, ctx) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { response: rpcError(null, -32600, "Invalid Request") };
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return { response: rpcError(message.id ?? null, -32600, "Invalid Request") };
  }
  const { method, params, id } = message;
  const isNotification = id === undefined;

  if (method === "initialize") {
    const requested = params && typeof params === "object" ? params.protocolVersion : undefined;
    const protocolVersion = SUPPORTED_PROTOCOL.includes(requested) ? requested : DEFAULT_PROTOCOL;
    return {
      response: rpcResult(id ?? null, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_VERSION },
        instructions:
          "Skim hosted MCP. Scan Tools (initialize, tools/list) need no key. Tool calls need a sk402_ API key in Authorization: Bearer or x-api-key. Public http(s) URLs only.",
      }),
    };
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return isNotification ? { empty: true, status: 202 } : { response: rpcResult(id, {}) };
  }

  if (method === "ping") {
    return isNotification ? { empty: true, status: 202 } : { response: rpcResult(id ?? null, {}) };
  }

  if (method === "tools/list") {
    return { response: rpcResult(id ?? null, { tools: listTools() }) };
  }

  if (method === "tools/call") {
    const name = params && typeof params === "object" ? params.name : undefined;
    const args = params && typeof params === "object" ? params.arguments : {};
    if (typeof name !== "string" || !name) {
      return { response: rpcError(id ?? null, -32602, "tools/call requires params.name") };
    }
    try {
      const result = await callTool(name, args, ctx);
      return { response: rpcResult(id ?? null, result) };
    } catch (err) {
      const text = err instanceof Error ? err.message : "tool call failed";
      return { response: rpcResult(id ?? null, fail(`Skim request failed: ${text}`)) };
    }
  }

  if (isNotification) return { empty: true, status: 202 };
  return { response: rpcError(id ?? null, -32601, `Method not found: ${method}`) };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization, x-api-key, x-skim-token, mcp-protocol-version, mcp-session-id",
    "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
  };
}

function applyHeaders(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function wantsSseOnly(headers) {
  const accept = header(headers, "accept").toLowerCase();
  return accept.includes("text/event-stream") && !accept.includes("application/json");
}

function sendRpcHttp(res, status, payload, reqHeaders) {
  applyHeaders(res, corsHeaders());
  res.setHeader("Cache-Control", "private, no-store");
  const body = JSON.stringify(payload);
  if (wantsSseOnly(reqHeaders)) {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/event-stream");
    res.end(`event: message\ndata: ${body}\n\n`);
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(body);
}

export function createMcpHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const env = opts.env ?? process.env;

  return async function handleMcp(request) {
    const method = (request.method ?? "GET").toUpperCase();
    const parsed = new URL(request.url ?? "/", "http://skim.local");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";

    if (isOpenaiChallengePath(path)) {
      if (method !== "GET" && method !== "HEAD") {
        return { status: 405, headers: { Allow: "GET, HEAD" }, body: { error: "method_not_allowed" } };
      }
      const token = openaiChallengeToken(env);
      if (!token) {
        return { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "" };
      }
      return {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        body: token,
        raw: true,
      };
    }

    if (!isMcpPath(path)) return { status: 404, body: { error: "not_found" } };

    if (method === "OPTIONS") {
      return { status: 204, headers: { ...corsHeaders(), Allow: "GET, POST, OPTIONS" }, body: "" };
    }

    if (method === "GET" || method === "HEAD") {
      return {
        status: 405,
        headers: { ...corsHeaders(), Allow: "POST, OPTIONS" },
        body: {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed. This MCP endpoint is stateless — use POST." },
          id: null,
        },
      };
    }

    if (method !== "POST") {
      return {
        status: 405,
        headers: { ...corsHeaders(), Allow: "POST, OPTIONS" },
        body: { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
      };
    }

    const token = getMcpApiKey(request.headers);
    const ctx = { token, fetchImpl, upstream };
    const payload = request.body;

    if (Array.isArray(payload)) {
      const responses = [];
      for (const item of payload) {
        const handled = await handleJsonRpc(item, ctx);
        if (handled.response) responses.push(handled.response);
      }
      return { status: 200, headers: corsHeaders(), body: responses };
    }

    const handled = await handleJsonRpc(payload, ctx);
    if (handled.empty) {
      return { status: handled.status ?? 202, headers: corsHeaders(), body: "" };
    }
    return { status: 200, headers: corsHeaders(), body: handled.response };
  };
}

export function mcpHttpMiddleware(opts = {}) {
  const handle = createMcpHandler(opts);
  return async function mcp(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!isMcpPath(path) && !isOpenaiChallengePath(path)) {
      next();
      return;
    }
    try {
      let body = req.body;
      const method = (req.method ?? "GET").toUpperCase();
      if (method === "POST" && (body == null || typeof body !== "object")) {
        try {
          body = await readBody(req);
        } catch (err) {
          if (err && err.code === "PAYLOAD_TOO_LARGE") {
            sendRpcHttp(res, 413, rpcError(null, -32700, "payload too large"), req.headers);
            return;
          }
          sendRpcHttp(res, 400, rpcError(null, -32700, "Parse error"), req.headers);
          return;
        }
      }
      const result = await handle({
        method,
        url: req.url ?? "/",
        headers: req.headers,
        body,
      });
      applyHeaders(res, result.headers ?? {});
      if (result.body === "" || result.raw) {
        res.statusCode = result.status;
        if (!result.raw && result.status === 204) {
          res.end();
          return;
        }
        if (!res.getHeader("Content-Type") && typeof result.body === "string") {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        res.end(typeof result.body === "string" ? result.body : "");
        return;
      }
      sendRpcHttp(res, result.status, result.body, req.headers);
    } catch (err) {
      sendRpcHttp(
        res,
        500,
        rpcError(null, -32603, err instanceof Error ? err.message : "internal error"),
        req.headers,
      );
    }
  };
}

export function mcpHttpVitePlugin(opts = {}) {
  return vitePlugin("skim-mcp-http", mcpHttpMiddleware(opts));
}
