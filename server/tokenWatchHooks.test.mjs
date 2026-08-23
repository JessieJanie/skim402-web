import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createMemoryStore,
  createWatchHooksHandler,
  deliverWebhook,
  lineDiff,
  normalizeWebhookUrl,
  normalizeWatchUrls,
  webhookPayload,
} from "./tokenWatchHooks.mjs";
import { signaturesMatch as hmacMatch } from "./http.mjs";

test("rejects loopback watch URLs and http webhooks", () => {
  assert.ok(normalizeWatchUrls(["http://localhost/x"]).error);
  assert.deepEqual(normalizeWatchUrls([" https://example.com/a "]).urls, ["https://example.com/a"]);
  assert.ok(normalizeWebhookUrl("http://hooks.example.com/x").error);
  assert.ok(normalizeWebhookUrl("https://127.0.0.1/hook").error);
  assert.equal(normalizeWebhookUrl("https://hooks.example.com/skim").webhookUrl, "https://hooks.example.com/skim");
});

test("lineDiff reports added/removed and numericOnly", () => {
  const d = lineDiff("Pro plan — $39/month\nIntro", "Pro plan — $49/month\nIntro");
  assert.equal(d.addedCount, 1);
  assert.equal(d.removedCount, 1);
  assert.equal(d.numericOnly, true);
  assert.ok(d.addedSample[0].includes("49"));
});

function mockFetch(routes) {
  return async (url, init = {}) => {
    const parsed = new URL(url, "https://skim402.com");
    const key = `${init.method ?? "GET"} ${parsed.pathname}${parsed.search}`;
    const hit =
      routes[key] ??
      routes[`${init.method ?? "GET"} ${parsed.pathname}`] ??
      routes[parsed.pathname] ??
      routes[parsed.href];
    if (!hit) {
      return new Response(JSON.stringify({ error: "mock miss", key }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const resolved = typeof hit === "function" ? hit(parsed, init) : hit;
    const { status = 200, body } = resolved;
    return new Response(JSON.stringify(body ?? {}), {
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

test("register + diff fires a signed webhook once per change", async () => {
  const deliveries = [];
  const pages = {
    "https://example.com/pricing": "Pro plan — $39/month",
  };
  const handle = createWatchHooksHandler({
    store: createMemoryStore(),
    fetchImpl: async (url, init = {}) => {
      const parsed = new URL(url, "https://skim402.com");
      if (parsed.hostname === "hooks.example.com") {
        deliveries.push({
          url: parsed.href,
          headers: init.headers,
          body: JSON.parse(init.body),
        });
        return new Response("ok", { status: 200 });
      }
      if (parsed.pathname === "/api/card/account") {
        return new Response(JSON.stringify({ creditsRemaining: 50 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (parsed.pathname === "/api/t/read") {
        const target = parsed.searchParams.get("url");
        const text = pages[target] ?? "empty";
        return new Response(JSON.stringify(readOk(text, "Pricing").body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "miss", path: parsed.pathname }), { status: 500 });
    },
  });

  const created = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: {
      urls: ["https://example.com/pricing"],
      webhookUrl: "https://hooks.example.com/skim",
    },
  });
  assert.equal(created.status, 201);
  assert.ok(created.body.webhookSecret?.startsWith("whsec_"));
  assert.equal(created.body.webhookConfigured, true);
  const watchId = created.body.watchId;
  const secret = created.body.webhookSecret;

  pages["https://example.com/pricing"] = "Pro plan — $49/month";
  const diff = await handle({
    method: "GET",
    url: `/api/t/watch/diff?id=${watchId}`,
    headers: AUTH,
    body: {},
  });
  assert.equal(diff.status, 200);
  assert.equal(diff.body.changedCount, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].body.event, "watch.changed");
  assert.equal(deliveries[0].body.watchId, watchId);
  assert.equal(deliveries[0].body.status, "changed");
  assert.ok(deliveries[0].body.diff.addedSample[0].includes("49"));
  const sig = deliveries[0].headers["X-Skim-Signature"].replace("sha256=", "");
  assert.equal(hmacMatch(secret, JSON.stringify(deliveries[0].body), sig), true);

  const cached = await handle({
    method: "GET",
    url: `/api/t/watch/diff?id=${watchId}`,
    headers: AUTH,
    body: {},
  });
  assert.equal(cached.body.fresh, true);
  assert.equal(deliveries.length, 1);
});

test("PATCH updates webhook without creating a new watch", async () => {
  const store = createMemoryStore();
  const handle = createWatchHooksHandler({
    store,
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 20 } },
      "GET /api/t/read": readOk("hello", "Hi"),
    }),
  });
  const created = await handle({
    method: "POST",
    url: "/api/t/watch",
    headers: AUTH,
    body: { urls: ["https://example.com/a"] },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.webhookConfigured, false);

  const updated = await handle({
    method: "PATCH",
    url: "/api/t/watch",
    headers: AUTH,
    body: { watchId: created.body.watchId, webhookUrl: "https://hooks.example.com/v2" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.webhookUrl, "https://hooks.example.com/v2");
  assert.ok(updated.body.webhookSecret?.startsWith("whsec_"));
});

test("webhook payload is small and idempotent by content hash", async () => {
  const watch = { watchId: "w_abc", webhookUrl: "https://hooks.example.com/x", webhookSecret: "whsec_z", delivered: {} };
  const item = {
    url: "https://example.com/p",
    status: "changed",
    contentHash: "abc",
    diff: { addedCount: 1, removedCount: 0, addedSample: ["hi"], removedSample: [], numericOnly: false, titleChanged: false },
  };
  const first = webhookPayload(watch, item, "2026-08-23T00:00:00Z");
  const second = webhookPayload(watch, item, "2026-08-23T00:01:00Z");
  assert.equal(first.deliveryId, second.deliveryId);
  assert.ok(!JSON.stringify(first).includes("email"));

  let posts = 0;
  const fetchImpl = async () => {
    posts += 1;
    return new Response("ok", { status: 200 });
  };
  const a = await deliverWebhook(fetchImpl, watch, item, "t1");
  watch.delivered[a.deliveryId] = "t1";
  const b = await deliverWebhook(fetchImpl, watch, item, "t2");
  assert.equal(a.delivered, true);
  assert.equal(b.reason, "duplicate");
  assert.equal(posts, 1);
});
