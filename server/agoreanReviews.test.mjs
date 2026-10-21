import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSignalCatalog } from "./tokenSignal.mjs";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  PUBLIC_ORIGIN,
  READ_DESCRIPTION,
  REVIEW_WRITE_HEADER,
  USER_QUESTION,
  WRITE_DESCRIPTION,
  agoreanReviewsMiddleware,
  attachAgoreanReviews,
  decodePaymentRequired,
  isPaidX402Request,
  paidEndpointPaths,
  paidEndpointUrls,
  readReviewsBlock,
  writeReviewsBlock,
} from "./agoreanReviews.mjs";

const READ = "https://skim402.com/api/v2/read";

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    removeHeader(name) {
      delete this.headers[name.toLowerCase()];
    },
    end(chunk) {
      this.body = chunk === undefined ? Buffer.alloc(0) : chunk;
    },
  };
}

function bodyText(res) {
  if (res.body == null) return "";
  return Buffer.isBuffer(res.body) ? res.body.toString("utf8") : String(res.body);
}

function dispatch(url, method, respond) {
  const res = mockRes();
  agoreanReviewsMiddleware()(
    { method, url, headers: { host: "localhost:5173" } },
    res,
    () => respond(res),
  );
  return res;
}

function paymentRequiredFor(pageUrl) {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: READ,
      description: "Skim: clean reader",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "2000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x63AE98f3363B346a94Fcc1CBcB621F1C2B1Fcddc",
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
    extensions: {
      bazaar: {
        info: {
          input: { type: "http", method: "GET", queryParams: { url: pageUrl } },
        },
        schema: { type: "object" },
      },
    },
  };
}

function send402(res, pageUrl) {
  const requirement = paymentRequiredFor(pageUrl);
  res.statusCode = 402;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", "2");
  res.setHeader(
    "PAYMENT-REQUIRED",
    Buffer.from(JSON.stringify(requirement), "utf8").toString("base64"),
  );
  res.end("{}");
  return requirement;
}

test("paid endpoint list is the wallet lane buyers actually call", () => {
  const paths = paidEndpointPaths();
  const presets = ["article", "product", "job", "review", "event", "table"];
  for (const version of ["v1", "v2"]) {
    assert.ok(paths.includes(`/api/${version}/read`));
    assert.ok(paths.includes(`/api/${version}/read/js`));
    assert.ok(paths.includes(`/api/${version}/read/batch`));
    assert.ok(paths.includes(`/api/${version}/extract`));
    assert.ok(paths.includes(`/api/${version}/tables`));
    for (const preset of presets) {
      assert.ok(paths.includes(`/api/${version}/extract/${preset}`));
    }
  }
  for (const path of [
    "/api/v2/dataset",
    "/api/v2/watch",
    "/api/v2/watch/diff",
    "/api/v2/feeds/x402/latest",
  ]) {
    assert.ok(paths.includes(path), path);
  }

  const slugs = [
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
  ];
  assert.equal(slugs.length, 17);
  for (const slug of slugs) {
    assert.ok(paths.includes(`/api/v2/signal/${slug}/latest`));
  }
  const catalog = loadSignalCatalog();
  for (const signal of catalog.signals) {
    assert.ok(paths.includes(signal.walletPath), signal.walletPath);
  }
  assert.equal(paths.filter((path) => path.includes("/signal/")).length, 17);

  for (const skipped of [
    "/api/v2/signal/x402/latest",
    "/api/v2/watch/status",
    "/api/v2/dataset/ds_abc",
    "/api/v2/testimonial",
    "/api/v2/read-pdf",
    "/api/v2/crawl",
    "/api/v1/crawl",
    "/api/t/read",
    "/api/t/feeds/x402/latest",
  ]) {
    assert.equal(paths.includes(skipped), false, skipped);
    assert.equal(isPaidX402Request(skipped, "GET"), false, skipped);
    assert.equal(isPaidX402Request(skipped, "POST"), false, skipped);
  }
  assert.equal(isPaidX402Request("/api/v2/dataset", "GET"), false);
  assert.equal(isPaidX402Request("/api/v2/dataset", "POST"), true);
  assert.equal(isPaidX402Request("/api/v2/watch", "GET"), false);
  assert.equal(isPaidX402Request("/api/v2/watch", "POST"), true);
  assert.equal(isPaidX402Request("/api/v2/watch/diff", "GET"), true);

  for (const url of paidEndpointUrls()) {
    assert.ok(url.startsWith(`${PUBLIC_ORIGIN}/api/v`));
    assert.equal(url.includes("?"), false);
  }
});

test("402 read block is fixed, query-independent, and keeps bazaar", () => {
  const firstReq = paymentRequiredFor("https://example.com/a");
  const first = dispatch("/api/v2/read?url=https://example.com/a", "GET", (res) => {
    send402(res, "https://example.com/a");
  });
  const second = dispatch("/api/v2/read?url=https://example.com/b&chunked=true", "GET", (res) => {
    send402(res, "https://example.com/b");
  });

  const firstBody = JSON.parse(bodyText(first));
  const secondBody = JSON.parse(bodyText(second));
  const firstHeader = decodePaymentRequired(first.headers["payment-required"]);
  const secondHeader = decodePaymentRequired(second.headers["payment-required"]);

  assert.deepEqual(firstBody.extensions.reviews, firstHeader.extensions.reviews);
  assert.deepEqual(firstBody.extensions.reviews, secondBody.extensions.reviews);
  assert.deepEqual(firstHeader.extensions.reviews, secondHeader.extensions.reviews);
  assert.equal(
    JSON.stringify(firstBody.extensions.reviews),
    JSON.stringify(secondHeader.extensions.reviews),
  );

  const reviews = firstBody.extensions.reviews;
  assert.deepEqual(reviews, readReviewsBlock(READ));
  assert.equal(reviews.info.providers[0].provider, "agorean.com");
  assert.equal(
    reviews.info.providers[0].read,
    "https://agorean.com/reviews?resource=https%3A%2F%2Fskim402.com%2Fapi%2Fv2%2Fread",
  );
  assert.equal(reviews.info.providers[0].description, READ_DESCRIPTION);
  assert.equal(Object.hasOwn(reviews.info, "userQuestion"), false);
  assert.equal(Object.hasOwn(reviews.info, "rating"), false);
  assert.equal(Object.hasOwn(reviews.info, "count"), false);
  assert.equal(Object.hasOwn(reviews.info, "median_paid"), false);
  assert.equal(JSON.stringify(reviews).includes("example.com"), false);

  assert.deepEqual(firstHeader.extensions.bazaar, firstReq.extensions.bazaar);
  assert.deepEqual(secondHeader.extensions.bazaar, paymentRequiredFor("https://example.com/b").extensions.bazaar);
  assert.deepEqual(firstHeader.accepts, firstReq.accepts);
  assert.deepEqual(firstHeader.resource, firstReq.resource);
  assert.equal(firstHeader.x402Version, 2);
  assert.notDeepEqual(firstHeader.extensions.bazaar, secondHeader.extensions.bazaar);
  assert.equal(first.headers["x-agorean-review-write"], undefined);
});

test("v1 402 with no payment-required header gets the same read block in both places", () => {
  const original = {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "2000",
        resource: "https://skim402.com/api/v1/tables",
        payTo: "0x63AE98f3363B346a94Fcc1CBcB621F1C2B1Fcddc",
      },
    ],
  };
  const res = dispatch("/api/v1/tables?url=https://example.com/a", "POST", (response) => {
    response.statusCode = 402;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(original));
  });
  const body = JSON.parse(bodyText(res));
  const header = decodePaymentRequired(res.headers["payment-required"]);
  assert.deepEqual(body.extensions.reviews, readReviewsBlock("https://skim402.com/api/v1/tables"));
  assert.deepEqual(header, body);
  assert.deepEqual(body.accepts, original.accepts);
  assert.equal(body.error, original.error);
  assert.equal(body.x402Version, 1);
  const again = dispatch("/api/v1/tables?url=https://example.com/b", "POST", (response) => {
    response.statusCode = 402;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(original));
  });
  assert.equal(bodyText(res), bodyText(again));
});

test("a broken payment-required header is left untouched", () => {
  const res = dispatch("/api/v2/tables?url=https://example.com", "GET", (response) => {
    response.statusCode = 402;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("PAYMENT-REQUIRED", "aaaa");
    response.end("{}");
  });
  assert.equal(res.headers["payment-required"], "aaaa");
  const body = JSON.parse(bodyText(res));
  assert.deepEqual(body.extensions.reviews, readReviewsBlock("https://skim402.com/api/v2/tables"));
});

test("paid JSON successes carry the write block and userQuestion", () => {
  const cases = [
    ["GET", "/api/v2/read?url=https://example.com/post", 200, "https://skim402.com/api/v2/read"],
    ["POST", "/api/v2/watch", 201, "https://skim402.com/api/v2/watch"],
    ["POST", "/api/v2/dataset", 202, "https://skim402.com/api/v2/dataset"],
    ["GET", "/api/v2/signal/ai-news/latest?limit=25", 200, "https://skim402.com/api/v2/signal/ai-news/latest"],
    ["GET", "/api/v2/extract/product?url=https://shop.example/p", 200, "https://skim402.com/api/v2/extract/product"],
  ];
  for (const [method, url, status, resource] of cases) {
    const res = dispatch(url, method, (response) => {
      response.statusCode = status;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("PAYMENT-RESPONSE", "settlement-receipt");
      response.write('{"markdown":');
      response.end('"# Hi","metadata":{"title":"T"}}');
    });
    const body = JSON.parse(bodyText(res));
    assert.equal(body.markdown, "# Hi");
    assert.deepEqual(body.metadata, { title: "T" });
    assert.deepEqual(body.extensions.reviews, writeReviewsBlock(resource));
    assert.equal(body.extensions.reviews.info.userQuestion, USER_QUESTION);
    assert.equal(body.extensions.reviews.info.providers[0].description, WRITE_DESCRIPTION);
    assert.equal(
      body.extensions.reviews.info.providers[0].write,
      `https://agorean.com/r?resource=${encodeURIComponent(resource)}`,
    );
    assert.equal(Object.hasOwn(body.extensions.reviews.info, "rating"), false);
    assert.equal(Object.hasOwn(body.extensions.reviews.info, "count"), false);
    assert.equal(Object.hasOwn(body.extensions.reviews.info, "median_paid"), false);
    assert.equal(res.headers["payment-response"], "settlement-receipt");
    assert.equal(res.headers["x-agorean-review-write"], undefined);
    assert.equal(res.headers["payment-required"], undefined);
  }
});

test("markdown and PDF bodies stay intact and carry the write link header", () => {
  const markdown = "# Kept\n\nNot JSON.";
  const md = dispatch("/api/v2/read?url=https://example.com", "GET", (res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("PAYMENT-RESPONSE", "receipt");
    res.end(markdown);
  });
  assert.equal(bodyText(md), markdown);
  assert.equal(
    md.headers[REVIEW_WRITE_HEADER.toLowerCase()],
    "https://agorean.com/r?resource=https%3A%2F%2Fskim402.com%2Fapi%2Fv2%2Fread",
  );
  assert.equal(md.headers["payment-response"], "receipt");

  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0xff]);
  const pdfRes = dispatch("/api/v2/read?url=https://example.com/file.pdf", "GET", (res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.end(pdf);
  });
  assert.deepEqual(pdfRes.body, pdf);
  assert.equal(
    pdfRes.headers[REVIEW_WRITE_HEADER.toLowerCase()],
    "https://agorean.com/r?resource=https%3A%2F%2Fskim402.com%2Fapi%2Fv2%2Fread",
  );
});

test("free, failed, and card-lane replies are not decorated", () => {
  const cases = [
    ["GET", "/api/t/read?url=https://example.com", 402, { error: "out of credits" }],
    ["GET", "/api/v2/watch/status?id=w_x", 404, { error: "not_found" }],
    ["GET", "/api/v2/dataset/ds_abc", 200, { status: "ready", rows: [] }],
    ["POST", "/api/v2/testimonial", 200, { ok: true }],
    ["GET", "/api/v2/read-pdf?url=https://example.com/a.pdf", 200, { markdown: "pdf" }],
    ["POST", "/api/v2/crawl", 402, { error: "Payment required" }],
    ["GET", "/api/v2/tables?url=https://example.com", 422, { error: "no_tables" }],
    ["GET", "/api/v2/read?url=https://example.com", 500, { error: "upstream" }],
    ["GET", "/api/v2/signal/x402/latest", 402, { error: "use feeds" }],
    ["OPTIONS", "/api/v2/read", 204, ""],
  ];
  for (const [method, url, status, payload] of cases) {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const res = dispatch(url, method, (response) => {
      response.statusCode = status;
      response.setHeader("Content-Type", "application/json");
      response.setHeader("PAYMENT-REQUIRED", "leave-me");
      response.end(raw);
    });
    assert.equal(bodyText(res), raw, url);
    assert.equal(res.headers["payment-required"], "leave-me", url);
    assert.equal(res.headers["x-agorean-review-write"], undefined, url);
  }
});

test("descriptions are the Agorean sentences, word for word", () => {
  const write = writeReviewsBlock(READ);
  const read = readReviewsBlock(READ);
  assert.equal(
    write.info.providers[0].description,
    "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.",
  );
  assert.equal(
    write.info.userQuestion,
    "Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.",
  );
  assert.equal(
    read.info.providers[0].description,
    "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.",
  );
  assert.equal(write.info.providers[0].description.length <= 500, true);
  assert.equal(write.info.userQuestion.length <= 300, true);
  assert.equal(read.schema.properties.providers.items.required.includes("read"), true);
  assert.equal(write.schema.properties.providers.items.required.includes("write"), true);
  assert.equal(Object.hasOwn(read.schema.properties, "userQuestion"), false);
});

test("tokenProducts fallthrough decorates once", async () => {
  const res = mockRes();
  const middleware = tokenProductsMiddleware();
  await middleware({ method: "GET", url: "/api/v2/feeds/x402/latest?limit=1" }, res, () => {
    attachAgoreanReviews({ method: "GET", url: "/api/v2/feeds/x402/latest?limit=1" }, res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ items: [{ id: 1 }], extensions: { bazaar: { info: { ok: true } } } }));
  });
  const body = JSON.parse(bodyText(res));
  assert.equal(body.items[0].id, 1);
  assert.deepEqual(body.extensions.bazaar, { info: { ok: true } });
  assert.equal(body.extensions.reviews.info.providers.length, 1);
  assert.deepEqual(
    body.extensions.reviews,
    writeReviewsBlock("https://skim402.com/api/v2/feeds/x402/latest"),
  );
});
