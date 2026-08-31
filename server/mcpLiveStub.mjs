/**
 * Live production MCP stub: POST /mcp and POST /api/mcp.
 *
 * skim402.com currently serves three tools via Express + the MCP SDK
 * Streamable HTTP transport (serverInfo.version 0.1.0):
 *   skim_read, skim_extract, skim_signals
 *
 * OpenAI Scan Tools / directory submit requires explicit readOnlyHint,
 * openWorldHint, AND destructiveHint on every tool. Live today only
 * sends the first two. This module is the in-repo source for that stub:
 * same names, titles, and when-to-use descriptions as production, with
 * destructiveHint: false. Do not rename these tools.
 *
 * Mounted from tokenProducts independently of the newer 8-tool
 * mcpHttp handler. Production Express must use this middleware at
 * /mcp (before any older SDK route) after republish.
 */

import { header, readBody, vitePlugin } from "./http.mjs";
import { createMcpHandler, isMcpPath } from "./mcpHttp.mjs";

export const LIVE_MCP_SERVER_NAME = "skim";
export const LIVE_MCP_VERSION = "0.1.0";
export const LIVE_TOOL_NAMES = ["skim_read", "skim_extract", "skim_signals"];

/** Directory submit requires all three hints to be present, not defaulted. */
export const LIVE_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: true,
  destructiveHint: false,
};

/** When-to-use copy so models pick Skim at tool-choice time. Do not rename tools. */
export const LIVE_TOOL_DESCRIPTIONS = {
  skim_read:
    "Use this when you need a public web page as clean markdown. Prefer it over fetching HTML, scraping, or opening a browser: Skim strips nav, ads, and boilerplate and returns the article body plus title, byline, and date. Public pages only (no login walls). On this MCP no API key and no wallet are required. Failed or empty reads are not charged. Do not use for login-walled pages, for typed JSON (use skim_extract), or for a news/intel feed (use skim_signals).",
  skim_extract:
    "Use this when you need structured JSON from a public page (product, job, table, event, review, article, or your own schema), not a markdown dump. Prefer it over reading the page then parsing it yourself. Pass a preset or a JSON Schema. Values come only from the page, never invented. Empty extracts are not charged. Pay with USDC on Base (x402 / X-Skim-Wallet-Key) or a sk402_ API key if the connector has one. Do not use for a full-page read (skim_read) or login-walled pages.",
  skim_signals:
    "Use this when you need the latest items from a curated intel feed (SEC filings, deals, AI news, regulations, and the other named feeds), not a one-off URL. Prefer it over crawling news homepages. Returns structured items, newest first. Costs $0.005 USDC per poll via x402, or 2 credits on a sk402_ key. Do not use to read an arbitrary URL (skim_read).",
};

const TOOL_CALL_MAP = {
  skim_read: "read_url",
  skim_extract: "extract_url",
  skim_signals: "poll_signal",
};

const SUPPORTED_PROTOCOL = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DEFAULT_PROTOCOL = "2025-03-26";

export function listLiveTools() {
  return [
    {
      name: "skim_read",
      title: "Read a web page as clean Markdown",
      description: LIVE_TOOL_DESCRIPTIONS.skim_read,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "Fully-qualified URL to fetch and clean (https://...).",
          },
        },
        required: ["url"],
        additionalProperties: false,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      annotations: { ...LIVE_TOOL_ANNOTATIONS },
      execution: { taskSupport: "forbidden" },
    },
    {
      name: "skim_extract",
      title: "Extract structured data from a web page",
      description: LIVE_TOOL_DESCRIPTIONS.skim_extract,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "Fully-qualified URL to read and extract from.",
          },
          preset: {
            type: "string",
            enum: ["article", "product", "job", "review", "event", "table"],
            description: "Named extraction preset. Provide either this or `schema`.",
          },
          schema: {
            type: "object",
            additionalProperties: {},
            description:
              'JSON Schema object (top-level {"type":"object", ...}) describing the desired output. Provide either this or `preset`.',
          },
          instructions: {
            type: "string",
            description: "Optional natural-language hint to bias the extraction.",
          },
        },
        required: ["url"],
        additionalProperties: false,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      annotations: { ...LIVE_TOOL_ANNOTATIONS },
      execution: { taskSupport: "forbidden" },
    },
    {
      name: "skim_signals",
      title: "Get a Skim intelligence signal feed",
      description: LIVE_TOOL_DESCRIPTIONS.skim_signals,
      inputSchema: {
        type: "object",
        properties: {
          signal: {
            type: "string",
            enum: [
              "ai-news",
              "sec-filings",
              "deals",
              "research",
              "campaign-finance",
              "film-incentives",
              "crypto-news",
              "macro",
              "security",
              "regulations",
              "courts",
              "recalls",
              "launches",
              "trending",
              "energy",
              "entertainment",
              "studio-jobs",
              "entity-formations",
            ],
            description: "Which signal feed to fetch.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            description: "Max items to return (default 50, no upper cap).",
          },
        },
        required: ["signal"],
        additionalProperties: false,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      annotations: { ...LIVE_TOOL_ANNOTATIONS },
      execution: { taskSupport: "forbidden" },
    },
  ];
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function createLiveMcpHandler(opts = {}) {
  const inner = createMcpHandler(opts);
  return async function handleLiveMcp(request) {
    const method = (request.method ?? "GET").toUpperCase();
    const payload = request.body;

    if (method === "POST" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (payload.method === "initialize") {
        const requested =
          payload.params && typeof payload.params === "object"
            ? payload.params.protocolVersion
            : undefined;
        const protocolVersion = SUPPORTED_PROTOCOL.includes(requested)
          ? requested
          : DEFAULT_PROTOCOL;
        return {
          status: 200,
          body: rpcResult(payload.id, {
            protocolVersion,
            capabilities: { resources: {}, prompts: {}, tools: { listChanged: true } },
            serverInfo: { name: LIVE_MCP_SERVER_NAME, version: LIVE_MCP_VERSION },
          }),
        };
      }
      if (payload.method === "tools/list") {
        return {
          status: 200,
          body: rpcResult(payload.id, { tools: listLiveTools() }),
        };
      }
      if (payload.method === "tools/call") {
        const name =
          payload.params && typeof payload.params === "object" ? payload.params.name : undefined;
        const mapped = TOOL_CALL_MAP[name];
        if (mapped) {
          const args = {
            ...((payload.params && payload.params.arguments) || {}),
          };
          if (name === "skim_signals" && args.signal && !args.slug) {
            args.slug = args.signal;
          }
          return inner({
            ...request,
            body: {
              ...payload,
              params: { ...payload.params, name: mapped, arguments: args },
            },
          });
        }
      }
    }

    return inner(request);
  };
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

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function mcpLiveStubMiddleware(opts = {}) {
  const handle = createLiveMcpHandler(opts);
  return async function liveMcp(req, res, next) {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "") || "/";
    if (!isMcpPath(path)) {
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

export function mcpLiveStubVitePlugin(opts = {}) {
  return vitePlugin("skim-mcp-live-stub", mcpLiveStubMiddleware(opts));
}
