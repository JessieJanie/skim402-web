import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SIGNAL_CREDITS,
  SIGNAL_SAMPLE,
  createSignalHandler,
  etagsMatch,
  isSignalPollPath,
  isSignalSamplePath,
  isUnchangedFeed,
  parseSince,
  unchangedBody,
  wrapSignalHonestyResponse,
} from "./tokenSignal.mjs";

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
    const { status = 200, body, headers = {} } = resolved;
    if (status === 304) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(JSON.stringify(body ?? {}), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  };
}

const KEY = "sk402_testkey";
const AUTH = { authorization: `Bearer ${KEY}` };
const FEED = {
  feed: "ai-news",
  asOf: "2026-08-24T04:51:58.573Z",
  ttlSeconds: 600,
  crawl: { status: "ok" },
  count: 1,
  items: [{ id: 1, title: "Example", source: "hackernews", at: "2026-08-24T04:51:58.532Z" }],
};

test("sample and poll path matchers", () => {
  assert.equal(isSignalSamplePath("/api/t/signal/sample"), true);
  assert.equal(isSignalSamplePath("/api/t/signals/sample"), true);
  assert.equal(isSignalPollPath("/api/t/signal/ai-news/latest"), true);
  assert.equal(isSignalPollPath("/api/t/feeds/x402/latest"), true);
  assert.equal(isSignalPollPath("/api/t/signal/sample"), false);
  assert.equal(isSignalPollPath("/api/t/watch/diff"), false);
  assert.equal(isSignalPollPath("/api/t/signal/ai-news"), false);
});

test("since= and If-None-Match detect an unchanged feed", () => {
  assert.equal(parseSince("2026-08-24T04:51:58.573Z"), Date.parse("2026-08-24T04:51:58.573Z"));
  assert.equal(parseSince("not-a-date"), null);
  assert.equal(etagsMatch('W/"abc"', '"abc"'), true);
  assert.equal(
    isUnchangedFeed({
      status: 200,
      body: FEED,
      since: "2026-08-24T04:51:58.573Z",
      ifNoneMatch: "",
      etag: "",
    }),
    true,
  );
  assert.equal(
    isUnchangedFeed({
      status: 200,
      body: FEED,
      since: "2026-08-24T04:00:00.000Z",
      ifNoneMatch: "",
      etag: "",
    }),
    false,
  );
  assert.equal(
    isUnchangedFeed({
      status: 304,
      body: {},
      since: "",
      ifNoneMatch: 'W/"abc"',
      etag: 'W/"abc"',
    }),
    true,
  );
  assert.equal(
    isUnchangedFeed({
      status: 200,
      body: FEED,
      since: "",
      ifNoneMatch: "",
      etag: 'W/"abc"',
    }),
    false,
  );
});

test("sample route is unauthenticated and charged 0", async () => {
  const handle = createSignalHandler({
    fetch: mockFetch({}),
  });
  const result = await handle({
    method: "GET",
    url: "/api/t/signal/sample",
    headers: {},
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.sample, true);
  assert.equal(result.body.charged, 0);
  assert.equal(result.body.items[0].title, SIGNAL_SAMPLE.items[0].title);
});

test("since= matching asOf refunds and returns unchanged", async () => {
  const refunds = [];
  let pack = 1000;
  const handle = createSignalHandler({
    refundCredits: async (token, amount) => {
      refunds.push({ token, amount });
      pack += amount;
    },
    fetch: mockFetch({
      "GET /api/card/account": () => ({ body: { packCredits: pack, planCredits: 0 } }),
      "GET /api/t/signal/ai-news/latest": () => {
        pack -= 2;
        return { body: FEED, headers: { etag: 'W/"abc"' } };
      },
    }),
  });
  const result = await handle({
    method: "GET",
    url: "/api/t/signal/ai-news/latest?since=2026-08-24T04:51:58.573Z",
    headers: AUTH,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.unchanged, true);
  assert.deepEqual(result.body.items, []);
  assert.equal(result.body.charged, 0);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, SIGNAL_CREDITS);
});

test("If-None-Match 304 refunds when the host can credit the ledger", async () => {
  let account = { packCredits: 998, planCredits: 0 };
  const refunds = [];
  const handle = createSignalHandler({
    refundCredits: async (_token, amount) => {
      refunds.push(amount);
      account = { ...account, packCredits: account.packCredits + amount };
    },
    fetch: mockFetch({
      "GET /api/card/account": () => ({ body: account }),
      "GET /api/t/signal/ai-news/latest": (_url, init) => {
        account = { ...account, packCredits: account.packCredits - 2 };
        const inm = init.headers?.["If-None-Match"];
        if (inm) return { status: 304, headers: { etag: 'W/"abc"' } };
        return { body: FEED, headers: { etag: 'W/"abc"' } };
      },
    }),
  });
  const result = await handle({
    method: "GET",
    url: "/api/t/signal/ai-news/latest?limit=1",
    headers: { ...AUTH, "if-none-match": 'W/"abc"' },
  });
  assert.equal(result.status, 304);
  assert.equal(result.body.charged, 0);
  assert.deepEqual(refunds, [SIGNAL_CREDITS]);
});

test("does not claim charged 0 when refundCredits is missing", async () => {
  let pack = 1000;
  const handle = createSignalHandler({
    fetch: mockFetch({
      "GET /api/card/account": () => ({ body: { packCredits: pack, planCredits: 0 } }),
      "GET /api/t/signal/ai-news/latest": () => {
        pack -= 2;
        return { body: FEED };
      },
    }),
  });
  const result = await handle({
    method: "GET",
    url: "/api/t/signal/ai-news/latest?since=2026-08-24T04:51:58.573Z",
    headers: AUTH,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.unchanged, undefined);
  assert.equal(result.body.items.length, 1);
});

test("unknown signal stays 404 and is not refunded", async () => {
  const refunds = [];
  const handle = createSignalHandler({
    refundCredits: async (_token, amount) => refunds.push(amount),
    fetch: mockFetch({
      "GET /api/card/account": { body: { packCredits: 1000, planCredits: 0 } },
      "GET /api/t/signal/not-a-real-slug/latest": {
        status: 404,
        body: { error: "unknown signal" },
      },
    }),
  });
  const result = await handle({
    method: "GET",
    url: "/api/t/signal/not-a-real-slug/latest",
    headers: AUTH,
  });
  assert.equal(result.status, 404);
  assert.deepEqual(refunds, []);
});

test("wrap rewrites a billed 200 into unchanged when refundCredits is set", async () => {
  const refunds = [];
  const chunks = [];
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader() {
      return 'W/"abc"';
    },
    write() {
      return true;
    },
    end(payload) {
      chunks.push(payload);
    },
  };
  wrapSignalHonestyResponse(res, {
    token: KEY,
    since: "2026-08-24T04:51:58.573Z",
    refundCredits: async (_token, amount) => refunds.push(amount),
  });
  await res.end(JSON.stringify(FEED));
  assert.equal(res.statusCode, 200);
  assert.equal(refunds[0], SIGNAL_CREDITS);
  const body = JSON.parse(chunks.at(-1));
  assert.equal(body.unchanged, true);
  assert.deepEqual(body.items, []);
  assert.equal(headers["x-skim-credits"], "0");
});

test("unchanged envelope keeps feed metadata", () => {
  const body = unchangedBody(FEED);
  assert.equal(body.feed, "ai-news");
  assert.equal(body.asOf, FEED.asOf);
  assert.equal(body.charged, 0);
  assert.deepEqual(body.items, []);
});
