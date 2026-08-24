import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXTRACT_CREDITS,
  countUsableExtractValues,
  createExtractHandler,
  emptyExtractMissBody,
  isUsableValue,
  tokenExtractFilterMiddleware,
  wrapEmptyExtractResponse,
} from "./tokenExtract.mjs";

function mockFetch(routes) {
  return async (url, init = {}) => {
    const parsed = new URL(url);
    const key = `${init.method ?? "GET"} ${parsed.pathname}${parsed.search}`;
    const hit =
      routes[key] ??
      routes[`${init.method ?? "GET"} ${parsed.pathname}`] ??
      routes[parsed.pathname];
    if (!hit) {
      return new Response(JSON.stringify({ error: "mock miss", key }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const resolved = typeof hit === "function" ? hit(parsed, init) : hit;
    const { status = 200, body, headers = {} } = resolved;
    return new Response(JSON.stringify(body ?? {}), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  };
}

const KEY = "sk402_testkey";
const AUTH = { authorization: `Bearer ${KEY}` };
const SCHEMA = {
  type: "object",
  properties: { tables: { type: "array" } },
  required: ["tables"],
};

test("empty tables/rows/items count as zero usable values", () => {
  assert.equal(countUsableExtractValues({ data: { tables: [] } }), 0);
  assert.equal(countUsableExtractValues({ data: { rows: [] } }), 0);
  assert.equal(countUsableExtractValues({ data: { items: [] } }), 0);
  assert.equal(countUsableExtractValues({ data: { records: [] } }), 0);
  assert.equal(countUsableExtractValues({ tables: [] }), 0);
  assert.equal(countUsableExtractValues({ data: { tables: [{ headers: [], rows: [] }] } }), 0);
  assert.equal(countUsableExtractValues({ data: { tables: [{}] } }), 0);
  assert.equal(isUsableValue(null), false);
});

test("at least one usable row or object counts", () => {
  assert.equal(
    countUsableExtractValues({
      data: { tables: [{ headers: ["A"], rows: [["1"]] }] },
    }),
    1,
  );
  assert.equal(
    countUsableExtractValues({
      data: { rows: [{ url: "https://example.com/", title: "Example Domain" }] },
    }),
    1,
  );
  assert.equal(countUsableExtractValues({ data: { name: "Widget", price: 29.99 } }), 1);
  assert.equal(countUsableExtractValues({ data: [{ code: "200", meaning: "OK" }] }), 1);
});

test("empty extract is 422 and does not debit; refunds if already billed", async () => {
  const refunds = [];
  const debits = [];
  const handle = createExtractHandler({
    extractBills: true,
    extractImpl: async () => ({
      status: 200,
      body: { data: { tables: [] }, url: "https://example.com" },
    }),
    refundCredits: async (token, amount) => {
      refunds.push({ token, amount });
    },
    debitCredits: async (token, amount) => {
      debits.push({ token, amount });
    },
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 100 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://example.com", schema: SCHEMA },
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.charged, 0);
  assert.equal(result.body.error, "unprocessable");
  assert.match(result.body.message, /No usable rows/);
  assert.deepEqual(result.body.data, { tables: [] });
  assert.equal(debits.length, 0);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, EXTRACT_CREDITS);
});

test("empty rows array is a miss even when HTTP 200", async () => {
  const refunds = [];
  const handle = createExtractHandler({
    extractBills: true,
    extractImpl: async () => ({ status: 200, body: { data: { rows: [] } } }),
    refundCredits: async (_token, amount) => refunds.push(amount),
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 50 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://example.com", schema: { type: "object", properties: { rows: { type: "array" } } } },
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.charged, 0);
  assert.deepEqual(refunds, [EXTRACT_CREDITS]);
});

test("usable extract still charges 8 and does not refund", async () => {
  const refunds = [];
  const debits = [];
  const handle = createExtractHandler({
    extractBills: false,
    extractImpl: async () => ({
      status: 200,
      body: {
        data: { tables: [{ headers: ["code", "meaning"], rows: [["200", "OK"]] }] },
        url: "https://en.wikipedia.org/wiki/List_of_HTTP_status_codes",
      },
    }),
    refundCredits: async (_t, n) => refunds.push(n),
    debitCredits: async (_t, n) => debits.push(n),
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 50 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://en.wikipedia.org/wiki/List_of_HTTP_status_codes", schema: SCHEMA },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.charged, EXTRACT_CREDITS);
  assert.equal(result.body.data.tables[0].rows.length, 1);
  assert.deepEqual(debits, [EXTRACT_CREDITS]);
  assert.deepEqual(refunds, []);
});

test("failed extract (4xx) is passed through and not billed as 8", async () => {
  const refunds = [];
  const handle = createExtractHandler({
    extractBills: true,
    extractImpl: async () => ({
      status: 422,
      body: { error: "Could not resolve URL hostname" },
    }),
    refundCredits: async (_t, n) => refunds.push(n),
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 50 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://example.com", schema: SCHEMA },
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.error, "Could not resolve URL hostname");
  assert.equal(refunds.length, 0);
});

test("blocked URLs never reach extract", async () => {
  const calls = [];
  const handle = createExtractHandler({
    extractImpl: async () => {
      calls.push("extract");
      return { status: 200, body: { data: { tables: [] } } };
    },
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 50 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "http://127.0.0.1/secret", schema: SCHEMA },
  });
  assert.equal(result.status, 403);
  assert.equal(calls.length, 0);
});

test("missing token / schema / insufficient credits", async () => {
  const handle = createExtractHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 2 } },
    }),
  });
  const noAuth = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: {},
    body: { url: "https://example.com", schema: SCHEMA },
  });
  assert.equal(noAuth.status, 401);

  const noSchema = await handle({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://example.com" },
  });
  assert.equal(noSchema.status, 402);

  const rich = createExtractHandler({
    extractImpl: async () => ({ status: 200, body: { data: { tables: [] } } }),
    refundCredits: async () => {},
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 50 } },
    }),
  });
  const missingSchema = await rich({
    method: "POST",
    url: "/api/t/extract",
    headers: AUTH,
    body: { url: "https://example.com" },
  });
  assert.equal(missingSchema.status, 400);
});

test("response wrapper rewrites empty 200 to 422 and refunds", async () => {
  const refunds = [];
  const headers = {};
  let ended;
  const res = {
    statusCode: 200,
    setHeader(key, value) {
      headers[key] = value;
    },
    write() {},
    end(body) {
      ended = body;
    },
  };
  wrapEmptyExtractResponse(res, {
    token: KEY,
    refundCredits: async (_t, n) => {
      refunds.push(n);
    },
  });
  await res.end(JSON.stringify({ data: { tables: [] } }));
  assert.equal(res.statusCode, 422);
  const parsed = JSON.parse(ended);
  assert.equal(parsed.charged, 0);
  assert.equal(parsed.error, "unprocessable");
  assert.equal(headers["X-Skim-Credits"], "0");
  assert.deepEqual(refunds, [EXTRACT_CREDITS]);
});

test("response wrapper leaves usable extracts as 200", async () => {
  let ended;
  const res = {
    statusCode: 200,
    setHeader() {},
    write() {},
    end(body) {
      ended = body;
    },
  };
  wrapEmptyExtractResponse(res, {});
  const payload = { data: { rows: [{ name: "ok" }] }, charged: 8 };
  res.end(JSON.stringify(payload));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(ended), payload);
});

test("miss body preserves original data", () => {
  const miss = emptyExtractMissBody({ data: { tables: [] }, url: "https://example.com" });
  assert.deepEqual(miss.data, { tables: [] });
  assert.equal(miss.charged, 0);
});

test("filter middleware wraps downstream extract and refunds empty 200", async () => {
  const refunds = [];
  const mw = tokenExtractFilterMiddleware({
    refundCredits: async (_t, n) => refunds.push(n),
  });
  const headers = {};
  let ended;
  const res = {
    statusCode: 200,
    setHeader(key, value) {
      headers[key] = value;
    },
    write() {},
    end(body) {
      ended = body;
    },
  };
  let nextCalled = false;
  mw(
    { method: "POST", url: "/api/t/extract", headers: AUTH },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);
  await res.end(JSON.stringify({ data: { tables: [] } }));
  assert.equal(res.statusCode, 422);
  assert.equal(JSON.parse(ended).charged, 0);
  assert.deepEqual(refunds, [EXTRACT_CREDITS]);
});
