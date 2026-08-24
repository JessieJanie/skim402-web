import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadSignalCatalog } from "./tokenSignal.mjs";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  DISCOVERY_PATHS,
  assertWalletLaneResources,
  isDiscoveryPath,
  loadDiscoveryDocument,
} from "./x402Discovery.mjs";

const WELL_KNOWN = join(dirname(fileURLToPath(import.meta.url)), "../public/.well-known");

const REQUIRED = [
  "https://skim402.com/api/v2/read",
  "https://skim402.com/api/v2/read/js",
  "https://skim402.com/api/v2/read/batch",
  "https://skim402.com/api/v2/extract",
  "https://skim402.com/api/v2/watch",
  "https://skim402.com/api/v2/watch/diff",
  "https://skim402.com/api/v2/feeds/x402/latest",
  "https://skim402.com/api/v2/signal/ai-news/latest",
];

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

async function dispatch(url, method = "GET") {
  const middleware = tokenProductsMiddleware();
  const res = mockRes();
  let nextCalled = false;
  await middleware({ method, url }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("discovery JSON parses and lists only wallet-lane v2 402 routes", () => {
  const doc = loadDiscoveryDocument();
  assert.equal(doc.version, 1);
  assert.equal(doc.x402Version, 2);
  assert.equal(typeof doc.resources, "object");
  assert.ok(Array.isArray(doc.resources));
  assert.ok(doc.resources.length >= REQUIRED.length);
  assertWalletLaneResources(doc);

  for (const url of REQUIRED) {
    assert.ok(doc.resources.includes(url), `missing ${url}`);
  }

  const catalog = loadSignalCatalog();
  for (const signal of catalog.signals) {
    const full = `https://skim402.com${signal.walletPath}`;
    assert.ok(doc.resources.includes(full), `catalog walletPath missing: ${full}`);
  }

  assert.deepEqual(doc.ownershipProofs, [
    "0x63AE98f3363B346a94Fcc1CBcB621F1C2B1Fcddc",
  ]);

  JSON.parse(JSON.stringify(doc));
});

test("extensionless, .json, and legacy x402-service.json files are identical", () => {
  const canonical = readFileSync(join(WELL_KNOWN, "x402.json"), "utf8");
  const noExt = readFileSync(join(WELL_KNOWN, "x402"), "utf8");
  const legacy = readFileSync(join(WELL_KNOWN, "x402-service.json"), "utf8");
  assert.equal(noExt, canonical);
  assert.equal(legacy, canonical);
  JSON.parse(canonical);
});

test("Express/Vite middleware serves discovery JSON at all three well-known paths", async () => {
  for (const path of DISCOVERY_PATHS) {
    assert.equal(isDiscoveryPath(path), true);
    const { res, nextCalled } = await dispatch(path);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /application\/json/);
    const body = JSON.parse(res.body);
    assert.equal(body.version, 1);
    assertWalletLaneResources(body);
  }

  const skipped = await dispatch("/api/t/read");
  assert.equal(skipped.nextCalled, true);

  const head = await dispatch("/.well-known/x402", "HEAD");
  assert.equal(head.res.statusCode, 200);
  assert.equal(head.res.body, "");
});
