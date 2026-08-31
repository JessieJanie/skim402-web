import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  LIVE_TOOL_ANNOTATIONS,
  LIVE_TOOL_DESCRIPTIONS,
  LIVE_TOOL_NAMES,
  createLiveMcpHandler,
  listLiveTools,
} from "./mcpLiveStub.mjs";

test("live stub tools keep skim_* names and set all three directory hints", () => {
  const tools = listLiveTools();
  assert.deepEqual(
    tools.map((t) => t.name),
    ["skim_read", "skim_extract", "skim_signals"],
  );
  assert.deepEqual(LIVE_TOOL_NAMES, ["skim_read", "skim_extract", "skim_signals"]);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations.openWorldHint, true, tool.name);
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.deepEqual(tool.annotations, LIVE_TOOL_ANNOTATIONS);
    assert.equal(tool.description, LIVE_TOOL_DESCRIPTIONS[tool.name], tool.name);
  }
});

test("GET /mcp tools/list via tokenProducts returns live names with destructiveHint", async () => {
  const middleware = tokenProductsMiddleware();
  const res = {
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
  const names = payload.result.tools.map((t) => t.name);
  assert.deepEqual(names, ["skim_read", "skim_extract", "skim_signals"]);
  for (const tool of payload.result.tools) {
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.equal(tool.annotations.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations.openWorldHint, true, tool.name);
    assert.equal(tool.description, LIVE_TOOL_DESCRIPTIONS[tool.name], tool.name);
  }
});

test("live stub initialize keeps server name skim and does not rename tools", async () => {
  const handle = createLiveMcpHandler();
  const init = await handle({
    method: "POST",
    url: "/mcp",
    headers: {},
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "scan", version: "0" } },
    },
  });
  assert.equal(init.status, 200);
  assert.equal(init.body.result.serverInfo.name, "skim");
  assert.equal(init.body.result.serverInfo.version, "0.1.0");
});
