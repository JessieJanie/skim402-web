import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  MCP_PATHS,
  OPENAI_CHALLENGE_PATH,
  SIGNAL_SLUGS,
  createMcpHandler,
  getMcpApiKey,
  handleJsonRpc,
  isDisallowedTarget,
  isMcpPath,
  isOpenaiChallengePath,
  listTools,
  publicHttpUrlError,
} from "./mcpHttp.mjs";

const KEY = "sk402_testkey";

function mockFetch(routes) {
  return async (url, init = {}) => {
    const parsed = new URL(url);
    const key = `${init.method ?? "GET"} ${parsed.pathname}`;
    const hit = routes[key] ?? routes[parsed.pathname];
    if (!hit) {
      return new Response(JSON.stringify({ error: "mock miss", key }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const resolved = typeof hit === "function" ? hit(parsed, init) : hit;
    return new Response(JSON.stringify(resolved.body ?? {}), {
      status: resolved.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function handler(routes = {}, env = {}) {
  return createMcpHandler({
    upstream: "https://skim402.com",
    fetchImpl: mockFetch(routes),
    env,
  });
}

async function rpc(handle, message, headers = {}, path = "/mcp") {
  return handle({
    method: "POST",
    url: path,
    headers,
    body: message,
  });
}

test("MCP and OpenAI challenge path matchers", () => {
  assert.equal(isMcpPath("/mcp"), true);
  assert.equal(isMcpPath("/mcp/"), true);
  assert.equal(isMcpPath("/api/mcp"), true);
  assert.equal(isMcpPath("/api/t/read"), false);
  assert.equal(isOpenaiChallengePath(OPENAI_CHALLENGE_PATH), true);
  assert.deepEqual(MCP_PATHS, ["/mcp", "/api/mcp"]);
});

test("SSRF blocks file://, loopback, private, and link-local", () => {
  assert.equal(isDisallowedTarget("https://example.com/x"), false);
  assert.equal(isDisallowedTarget("https://facebook.com/"), false);
  assert.equal(isDisallowedTarget("file:///etc/passwd"), true);
  assert.equal(isDisallowedTarget("http://127.0.0.1/"), true);
  assert.equal(isDisallowedTarget("http://localhost/secret"), true);
  assert.equal(isDisallowedTarget("http://10.0.0.4/"), true);
  assert.equal(isDisallowedTarget("http://192.168.1.9/"), true);
  assert.equal(isDisallowedTarget("http://172.16.0.2/"), true);
  assert.equal(isDisallowedTarget("http://169.254.169.254/latest/meta-data"), true);
  assert.equal(isDisallowedTarget("http://[::1]/"), true);
  assert.equal(isDisallowedTarget("http://[fe80::1]/"), true);
  assert.equal(isDisallowedTarget("javascript:alert(1)"), true);
  assert.equal(publicHttpUrlError("file:///etc/passwd"), "file:// URLs are not allowed");
  assert.equal(publicHttpUrlError("ftp://example.com/a"), "Only http(s) URLs are supported");
  assert.equal(publicHttpUrlError("http://127.0.0.1/"), "URL resolves to a non-public address");
});

test("API key from Bearer, x-api-key, and x-skim-token", () => {
  assert.equal(getMcpApiKey({ authorization: "Bearer sk402_abc" }), "sk402_abc");
  assert.equal(getMcpApiKey({ "x-api-key": "sk402_abc" }), "sk402_abc");
  assert.equal(getMcpApiKey({ "x-skim-token": "sk402_abc" }), "sk402_abc");
  assert.equal(getMcpApiKey({ authorization: "Bearer nope" }), null);
  assert.equal(getMcpApiKey({}), null);
});

test("tools/list matches skim-mcp names and annotations", () => {
  const tools = listTools();
  assert.deepEqual(
    tools.map((t) => t.name),
    [
      "read_url",
      "read_urls",
      "extract_url",
      "crawl_url",
      "read_pdf",
      "watch_urls",
      "check_watch",
      "poll_signal",
    ],
  );
  for (const tool of tools) {
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.openWorldHint, false);
  }
  const reads = ["read_url", "read_urls", "extract_url", "crawl_url", "read_pdf", "poll_signal"];
  for (const name of reads) {
    const tool = tools.find((t) => t.name === name);
    assert.equal(tool.annotations.readOnlyHint, true, name);
  }
  assert.equal(tools.find((t) => t.name === "watch_urls").annotations.readOnlyHint, false);
  assert.equal(tools.find((t) => t.name === "check_watch").annotations.readOnlyHint, false);
  assert.ok(SIGNAL_SLUGS.includes("ai-news"));
  assert.ok(SIGNAL_SLUGS.includes("x402"));
});

test("initialize and tools/list work without a key", async () => {
  const handle = handler();
  const init = await rpc(handle, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "scan", version: "0" } },
  });
  assert.equal(init.status, 200);
  assert.equal(init.body.result.protocolVersion, "2025-03-26");
  assert.equal(init.body.result.serverInfo.name, "skim");
  assert.ok(init.body.result.capabilities.tools);

  const listed = await rpc(handle, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.result.tools.length, 8);
});

test("GET is 405 JSON-RPC; OPTIONS is 204", async () => {
  const handle = handler();
  const get = await handle({ method: "GET", url: "/mcp", headers: {}, body: {} });
  assert.equal(get.status, 405);
  assert.equal(get.body.error.code, -32000);
  const opt = await handle({ method: "OPTIONS", url: "/api/mcp", headers: {}, body: {} });
  assert.equal(opt.status, 204);
});

test("tool calls without a key are rejected", async () => {
  const handle = handler();
  const res = await rpc(handle, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "read_url", arguments: { url: "https://example.com" } },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.result.isError, true);
  assert.match(res.body.result.content[0].text, /sk402_/);
});

test("private and file URLs never hit upstream", async () => {
  let hits = 0;
  const handle = handler({
    "GET /api/t/read": () => {
      hits += 1;
      return { body: { markdown: "nope" } };
    },
  });
  for (const url of ["file:///etc/passwd", "http://127.0.0.1/", "http://10.1.2.3/secret"]) {
    const res = await rpc(
      handle,
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "read_url", arguments: { url } },
      },
      { authorization: `Bearer ${KEY}` },
    );
    assert.equal(res.body.result.isError, true, url);
  }
  assert.equal(hits, 0);
});

test("read_url with a key calls GET /api/t/read", async () => {
  const handle = handler({
    "GET /api/t/read": (parsed) => {
      assert.equal(parsed.searchParams.get("url"), "https://example.com/");
      return {
        body: {
          markdown: "Hello",
          metadata: { title: "Example" },
        },
      };
    },
  });
  const res = await rpc(
    handle,
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "read_url", arguments: { url: "https://example.com/" } },
    },
    { "x-api-key": KEY },
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.result.isError, undefined);
  assert.match(res.body.result.content[0].text, /Example/);
  assert.match(res.body.result.content[0].text, /Hello/);
});

test("read_urls, extract, crawl, pdf, watch, signal call existing /api/t routes", async () => {
  const seen = [];
  const handle = handler({
    "POST /api/t/read/batch": () => {
      seen.push("batch");
      return { body: { results: [{ url: "https://example.com", ok: true, data: { markdown: "A" } }] } };
    },
    "POST /api/t/extract": () => {
      seen.push("extract");
      return { body: { data: { tables: [{ headers: ["H"], rows: [["1"]] }] } } };
    },
    "POST /api/t/crawl": () => {
      seen.push("crawl");
      return { body: { url: "https://example.com/", pages: [{ url: "https://example.com/", ok: true, markdown: "Home" }] } };
    },
    "POST /api/t/read-pdf": () => {
      seen.push("pdf");
      return { body: { markdown: "# Paper", pageCount: 2 } };
    },
    "POST /api/t/watch": () => {
      seen.push("watch");
      return { status: 201, body: { watchId: "w_test" } };
    },
    "GET /api/t/watch/diff": () => {
      seen.push("diff");
      return { body: { status: "unchanged" } };
    },
    "GET /api/t/signal/ai-news/latest": () => {
      seen.push("signal");
      return { body: { items: [] } };
    },
  });

  const calls = [
    ["read_urls", { urls: ["https://example.com"] }],
    ["extract_url", { url: "https://example.com", preset: "table" }],
    ["crawl_url", { url: "example.com", maxPages: 3 }],
    ["read_pdf", { url: "https://example.com/a.pdf" }],
    ["watch_urls", { urls: ["https://example.com"] }],
    ["check_watch", { watch_id: "w_test" }],
    ["poll_signal", { slug: "ai-news", limit: 5 }],
  ];
  for (const [name, args] of calls) {
    const res = await rpc(
      handle,
      { jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: args } },
      { authorization: `Bearer ${KEY}` },
    );
    assert.equal(res.status, 200, name);
    assert.equal(res.body.result.isError, undefined, name);
  }
  assert.deepEqual(seen, ["batch", "extract", "crawl", "pdf", "watch", "diff", "signal"]);
});

test("OpenAI apps challenge uses committed token when env is unset", async () => {
  const empty = handler({}, {});
  const missing = await empty({ method: "GET", url: OPENAI_CHALLENGE_PATH, headers: {}, body: {} });
  assert.equal(missing.status, 200);
  assert.equal(String(missing.body).trim(), "uOZcCcu1AJm20BTr-hGGVBOYqEKu4ZRyrsjCORAnwDA");
  assert.equal(missing.raw, true);

  const set = handler({}, { OPENAI_APPS_CHALLENGE: "openai-challenge-token" });
  const found = await set({ method: "GET", url: OPENAI_CHALLENGE_PATH, headers: {}, body: {} });
  assert.equal(found.status, 200);
  assert.equal(String(found.body).trim(), "openai-challenge-token");
  assert.equal(found.raw, true);
});

test("tokenProducts middleware mounts /mcp and skips /api/t/read", async () => {
  const middleware = tokenProductsMiddleware();
  const captured = { statusCode: 0, headers: {}, body: undefined };
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk ?? "";
    },
  };
  Object.assign(captured, res);
  let nextCalled = false;
  await middleware(
    {
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.result.tools.length, 8);

  const skipped = { next: false };
  await middleware({ method: "GET", url: "/api/t/read", headers: {} }, { setHeader() {}, end() {} }, () => {
    skipped.next = true;
  });
  assert.equal(skipped.next, true);
});

test("handleJsonRpc ping and unknown method", async () => {
  const ping = await handleJsonRpc({ jsonrpc: "2.0", id: 9, method: "ping" }, { token: null });
  assert.deepEqual(ping.response.result, {});
  const unknown = await handleJsonRpc({ jsonrpc: "2.0", id: 10, method: "foo/bar" }, { token: null });
  assert.equal(unknown.response.error.code, -32601);
});
