import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  CATALOG_PATHS,
  MAX_SERVER_CARD_DESCRIPTION_CHARS,
  MCP_DISCOVERY_PATHS,
  SERVER_CARD_MIME,
  SERVER_CARD_PATHS,
  assertServerCardDescriptionLimit,
  isCatalogPath,
  isMcpDiscoveryPath,
  isServerCardPath,
  loadCatalogDocument,
  loadServerCardDocument,
} from "./mcpDiscovery.mjs";
import { LIVE_TOOL_DESCRIPTIONS } from "./mcpLiveStub.mjs";
import { isMcpPath } from "./mcpHttp.mjs";

const WELL_KNOWN = join(dirname(fileURLToPath(import.meta.url)), "../public/.well-known");
const ROBOTS = join(dirname(fileURLToPath(import.meta.url)), "../public/robots.txt");

const EXPECTED_CATALOG = {
  specVersion: "1.0",
  entries: [
    {
      identifier: "urn:air:skim402.com:mcp:skim",
      type: "application/mcp-server-card+json",
      url: "https://skim402.com/mcp/server-card",
    },
  ],
};

const EXPECTED_CARD = {
  $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
  name: "com.skim402/skim",
  version: "0.1.0",
  title: "Skim",
  description: "Turns public URLs into clean markdown. Use instead of fetching HTML.",
  websiteUrl: "https://skim402.com",
  repository: {
    url: "https://github.com/JessieJanie/skim402-web",
    source: "github",
  },
  remotes: [
    {
      type: "streamable-http",
      url: "https://skim402.com/mcp",
      supportedProtocolVersions: ["2025-03-26"],
      headers: [
        {
          name: "X-Skim-Wallet-Key",
          description:
            "Optional Base wallet key for paid tools (extract, signals). Not required for skim_read.",
          isRequired: false,
          isSecret: true,
        },
        {
          name: "Authorization",
          description: "Optional Bearer sk402_ API key. Not required for skim_read on this MCP.",
          isRequired: false,
          isSecret: true,
        },
      ],
    },
  ],
};

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk ?? "";
    },
  };
}

async function dispatch(url, method = "GET", headers = {}) {
  const middleware = tokenProductsMiddleware();
  const res = mockRes();
  let nextCalled = false;
  await middleware({ method, url, headers }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("catalog and server-card JSON match the published documents", () => {
  const catalog = loadCatalogDocument();
  const card = loadServerCardDocument();
  assert.deepEqual(catalog, EXPECTED_CATALOG);
  assert.deepEqual(card, EXPECTED_CARD);
  assertServerCardDescriptionLimit(card);
  assert.ok(card.description.length <= MAX_SERVER_CARD_DESCRIPTION_CHARS);
  assert.equal(
    readFileSync(join(WELL_KNOWN, "ai-catalog.json"), "utf8"),
    readFileSync(join(WELL_KNOWN, "mcp/catalog.json"), "utf8"),
  );
  assert.equal(
    readFileSync(join(WELL_KNOWN, "mcp.json"), "utf8"),
    readFileSync(join(WELL_KNOWN, "mcp/server-card.json"), "utf8"),
  );
});

test("path matchers cover canonical + aliases and never GET /mcp", () => {
  assert.equal(isMcpDiscoveryPath("/mcp/server-card"), true);
  assert.equal(isMcpDiscoveryPath("/mcp/server-card/"), true);
  assert.equal(isMcpDiscoveryPath("/mcp"), false);
  assert.equal(isMcpDiscoveryPath("/api/mcp"), false);
  assert.equal(isMcpPath("/mcp"), true);
  assert.equal(isMcpPath("/mcp/server-card"), false);
  assert.equal(isCatalogPath("/.well-known/ai-catalog.json"), true);
  assert.equal(isCatalogPath("/.well-known/mcp.json"), false);
  assert.equal(isServerCardPath("/.well-known/mcp.json"), true);
  assert.equal(isServerCardPath("/.well-known/ai-catalog.json"), false);
  assert.deepEqual(CATALOG_PATHS, ["/.well-known/ai-catalog.json", "/.well-known/mcp/catalog.json"]);
  assert.deepEqual(SERVER_CARD_PATHS, [
    "/mcp/server-card",
    "/.well-known/mcp.json",
    "/.well-known/mcp/server-card.json",
  ]);
  assert.equal(MCP_DISCOVERY_PATHS.length, 5);
});

test("Express/Vite middleware serves catalog JSON at canonical and alias paths", async () => {
  for (const path of CATALOG_PATHS) {
    const { res, nextCalled } = await dispatch(path);
    assert.equal(nextCalled, false, path);
    assert.equal(res.statusCode, 200, path);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.equal(res.headers["access-control-allow-methods"], "GET");
    assert.equal(res.headers["access-control-allow-headers"], "Content-Type, If-None-Match");
    assert.equal(res.headers["access-control-expose-headers"], "ETag");
    assert.equal(res.headers["cache-control"], "public, max-age=3600");
    assert.ok(res.headers.etag);
    assert.doesNotMatch(String(res.body), /<!DOCTYPE|<html/i);
    assert.deepEqual(JSON.parse(res.body), EXPECTED_CATALOG);
  }
});

test("Express/Vite middleware serves the server card at canonical and alias paths", async () => {
  for (const path of SERVER_CARD_PATHS) {
    const { res, nextCalled } = await dispatch(path);
    assert.equal(nextCalled, false, path);
    assert.equal(res.statusCode, 200, path);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.doesNotMatch(res.headers["content-type"], /html/);
    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.equal(res.headers["cache-control"], "public, max-age=3600");
    assert.ok(res.headers.etag);
    assert.doesNotMatch(String(res.body), /<!DOCTYPE|<html/i);
    const body = JSON.parse(res.body);
    assert.deepEqual(body, EXPECTED_CARD);
    assert.ok(body.description.length <= MAX_SERVER_CARD_DESCRIPTION_CHARS);
  }
});

test("server-card Content-Type follows Accept; GET /mcp is not the card", async () => {
  const negotiated = await dispatch("/mcp/server-card", "GET", {
    accept: "application/mcp-server-card+json, application/json",
  });
  assert.equal(negotiated.nextCalled, false);
  assert.equal(negotiated.res.statusCode, 200);
  assert.match(negotiated.res.headers["content-type"], new RegExp(SERVER_CARD_MIME.replace(/\+/g, "\\+")));
  assert.deepEqual(JSON.parse(negotiated.res.body), EXPECTED_CARD);

  const jsonDefault = await dispatch("/mcp/server-card", "GET", { accept: "application/json" });
  assert.match(jsonDefault.res.headers["content-type"], /^application\/json\b/);

  const mcpGet = await dispatch("/mcp", "GET");
  assert.equal(mcpGet.nextCalled, false);
  assert.equal(mcpGet.res.statusCode, 405);
  const mcpBody = JSON.parse(mcpGet.res.body);
  assert.equal(mcpBody.error.code, -32000);
  assert.equal(mcpBody.name, undefined);
  assert.equal(mcpBody.$schema, undefined);

  const skipped = await dispatch("/api/t/read");
  assert.equal(skipped.nextCalled, true);
});

test("If-None-Match returns 304; HEAD is empty 200; POST is 405", async () => {
  const first = await dispatch("/.well-known/ai-catalog.json");
  const etag = first.res.headers.etag;
  assert.ok(etag);

  const cached = await dispatch("/.well-known/ai-catalog.json", "GET", {
    "if-none-match": etag,
  });
  assert.equal(cached.res.statusCode, 304);
  assert.equal(cached.res.body, "");

  const head = await dispatch("/mcp/server-card", "HEAD");
  assert.equal(head.res.statusCode, 200);
  assert.equal(head.res.body, "");
  assert.match(head.res.headers["content-type"], /application\/json/);

  const posted = await dispatch("/mcp/server-card", "POST");
  assert.equal(posted.res.statusCode, 405);
});

test("POST /mcp tools/list still returns when-to-use descriptions", async () => {
  const middleware = tokenProductsMiddleware();
  const listed = mockRes();
  let next = false;
  await middleware(
    {
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    },
    listed,
    () => {
      next = true;
    },
  );
  assert.equal(next, false);
  const payload = JSON.parse(listed.body);
  const byName = Object.fromEntries(payload.result.tools.map((t) => [t.name, t.description]));
  assert.equal(byName.skim_read, LIVE_TOOL_DESCRIPTIONS.skim_read);
  assert.equal(byName.skim_extract, LIVE_TOOL_DESCRIPTIONS.skim_extract);
  assert.equal(byName.skim_signals, LIVE_TOOL_DESCRIPTIONS.skim_signals);
});

test("robots.txt allows well-known and /mcp/server-card", () => {
  const robots = readFileSync(ROBOTS, "utf8");
  assert.match(robots, /Allow:\s*\/\.well-known\//);
  assert.match(robots, /Allow:\s*\/mcp\/server-card/);
  assert.doesNotMatch(robots, /Disallow:\s*\/\.well-known/);
  assert.doesNotMatch(robots, /Disallow:\s*\/mcp/);
});
