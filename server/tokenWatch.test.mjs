import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createMemoryStore,
  createTokenWatchHandler,
  getBearerToken,
  isBlockedUrl,
  lineDiff,
  normalizeWatchUrls,
} from "./tokenWatch.mjs";

test("rejects loopback and private URLs", () => {
  assert.equal(isBlockedUrl("https://example.com/x"), false);
  assert.equal(isBlockedUrl("http://localhost/secret"), true);
  assert.equal(isBlockedUrl("http://127.0.0.1/"), true);
  assert.equal(isBlockedUrl("http://10.0.0.4/"), true);
  assert.equal(isBlockedUrl("not-a-url"), true);
});

test("normalizes 1–20 URLs", () => {
  assert.equal(normalizeWatchUrls([]).error, "Required");
  assert.ok(normalizeWatchUrls(Array.from({ length: 21 }, () => "https://example.com")).error);
  assert.deepEqual(normalizeWatchUrls([" https://example.com/a "]).urls, [
    "https://example.com/a",
  ]);
});

test("lineDiff reports added/removed and numericOnly", () => {
  const d = lineDiff("Pro plan — $39/month\nIntro", "Pro plan — $49/month\nIntro");
  assert.equal(d.addedCount, 1);
  assert.equal(d.removedCount, 1);
  assert.equal(d.numericOnly, true);
  assert.ok(d.addedSample[0].includes("49"));
});

test("Bearer and x-skim-token are accepted", () => {
  assert.equal(getBearerToken({ authorization: "Bearer sk402_abc" }), "sk402_abc");
  assert.equal(getBearerToken({ "x-skim-token": "sk402_abc" }), "sk402_abc");
  assert.equal(getBearerToken({ authorization: "Bearer nope" }), null);
});

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
    const { status = 200, body } = typeof hit === "function" ? hit(parsed, init) : hit;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
}

const KEY = "sk402_testkey";
const AUTH = { authorization: `Bearer ${KEY}` };

function readOk(text, title = "Page") {
  return {
    status: 200,
    body: {
      markdown: text,
      text,
      metadata: { title, excerpt: text.slice(0, 40) },
      receipt: { contentHash: createHash("sha256").update(text).digest("hex") },
    },
  };
}

test("MCP watch register / diff / status", async () => {
  let pricing = "Pro plan — $39/month";
  let now = 1_700_000_000_000;
  const fetchImpl = mockFetch({
    "GET /api/card/account": { status: 200, body: { plan: "trial", packCredits: 1000 } },
    "GET /api/t/read": (url) => {
      const target = url.searchParams.get("url");
      if (target?.includes("pricing")) return readOk(pricing, "Pricing");
      if (target?.includes("changelog")) return readOk("Nothing yet", "Changelog");
      return { status: 422, body: { error: "no content", target } };
    },
  });
  const handle = createTokenWatchHandler({
    fetchImpl,
    store: createMemoryStore(),
    now: () => now,
  });

  const created = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: {
      urls: ["https://example.com/pricing", "https://example.com/changelog"],
      note: "competitor",
    },
  });
  assert.equal(created.status, 201);
  assert.ok(created.body.watchId.startsWith("w_"));
  assert.equal(created.body.pollUrl, `/api/t/watch/diff?id=${created.body.watchId}`);
  assert.equal(created.body.minIntervalSeconds, 60);
  assert.equal(created.body.charged, 1);

  const id = created.body.watchId;
  const first = await handle({
    method: "GET",
    url: `/api/t/watch/diff?id=${id}`,
    headers: AUTH,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.watchId, id);
  const statuses = Object.fromEntries(first.body.urls.map((u) => [u.url, u.status]));
  assert.equal(statuses["https://example.com/pricing"], "unchanged");
  assert.equal(statuses["https://example.com/changelog"], "first_check");
  assert.equal(first.body.charged, 2);

  const cached = await handle({
    method: "GET",
    url: `/api/t/watch/diff?id=${id}`,
    headers: AUTH,
  });
  assert.equal(cached.body.fresh, true);

  pricing = "Pro plan — $49/month";
  now += 61_000;
  const second = await handle({
    method: "GET",
    url: `/api/t/watch/diff?id=${id}`,
    headers: AUTH,
  });
  assert.equal(second.body.fresh, false);
  const after = Object.fromEntries(second.body.urls.map((u) => [u.url, u.status]));
  assert.equal(after["https://example.com/pricing"], "changed");
  assert.equal(after["https://example.com/changelog"], "unchanged");
  assert.equal(second.body.changedCount, 1);
  assert.equal(second.body.urls[0].diff.numericOnly, true);
});

test("unknown token is 401; unknown watch is 404", async () => {
  const handle = createTokenWatchHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { status: 401, body: { error: "unknown token" } },
    }),
    store: createMemoryStore(),
  });
  const res = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: { urls: ["https://example.com"] },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "unknown token");

  const okHandle = createTokenWatchHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { status: 200, body: {} },
    }),
    store: createMemoryStore(),
  });
  const missing = await okHandle({
    method: "GET",
    url: "/api/t/watch/diff?id=w_nope",
    headers: AUTH,
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "not_found");
});

test("first-URL 422 does not create a watch", async () => {
  const store = createMemoryStore();
  const handle = createTokenWatchHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { status: 200, body: {} },
      "GET /api/t/read": { status: 422, body: { message: "Upstream responded 404" } },
    }),
    store,
  });
  const res = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: { urls: ["https://example.com/missing"] },
  });
  assert.equal(res.status, 422);
});

test("status is free and does not fetch pages", async () => {
  let reads = 0;
  const store = createMemoryStore();
  const fetchImpl = mockFetch({
    "GET /api/card/account": { status: 200, body: {} },
    "GET /api/t/read": () => {
      reads += 1;
      return readOk("hello", "Hi");
    },
  });
  const handle = createTokenWatchHandler({ fetchImpl, store });
  const created = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: { urls: ["https://example.com"] },
  });
  const before = reads;
  const status = await handle({
    method: "GET",
    url: `/api/t/watch/status?id=${created.body.watchId}`,
    headers: AUTH,
  });
  assert.equal(status.status, 200);
  assert.deepEqual(status.body.urls, ["https://example.com"]);
  assert.equal(status.body.pollCount, 0);
  assert.equal(reads, before);
});
