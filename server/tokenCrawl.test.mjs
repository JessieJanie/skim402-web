import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CRAWL_MAX_PAGES,
  canonicalizePageUrl,
  createCrawlHandler,
  isSitemapIndex,
  linksFromHtml,
  locsFromXml,
  normalizeStartUrl,
  pageScore,
  pickPages,
  sitemapsFromRobots,
} from "./tokenCrawl.mjs";

test("start URL normalizes origin and rejects SSRF", () => {
  assert.equal(normalizeStartUrl("example.com").origin, "https://example.com");
  assert.equal(normalizeStartUrl("https://docs.example.com/guide").origin, "https://docs.example.com");
  assert.equal(normalizeStartUrl("http://127.0.0.1/").status, 403);
  assert.ok(normalizeStartUrl("").error);
});

test("pageScore prefers docs/about and skips login/assets", () => {
  assert.ok(pageScore("https://example.com/docs/start") > pageScore("https://example.com/random/deep/path"));
  assert.ok(pageScore("https://example.com/") > 50);
  assert.ok(pageScore("https://example.com/login") < 0);
  assert.ok(pageScore("https://example.com/file.pdf") < 0);
});

test("sitemap and robots parsers", () => {
  const xml = `<?xml version="1.0"?><urlset><loc>https://example.com/a</loc><loc>https://example.com/b</loc></urlset>`;
  assert.deepEqual(locsFromXml(xml), ["https://example.com/a", "https://example.com/b"]);
  assert.equal(isSitemapIndex("<sitemapindex><sitemap><loc>https://example.com/s.xml</loc></sitemap></sitemapindex>"), true);
  assert.deepEqual(sitemapsFromRobots("Sitemap: https://example.com/sitemap.xml\n", "https://example.com"), [
    "https://example.com/sitemap.xml",
  ]);
});

test("same-origin links only", () => {
  const html = `
    <a href="/docs">docs</a>
    <a href="https://example.com/about">about</a>
    <a href="https://other.com/x">skip</a>
    <a href="mailto:a@b.com">mail</a>
  `;
  const links = linksFromHtml(html, "https://example.com/");
  assert.ok(links.includes("https://example.com/docs"));
  assert.ok(links.includes("https://example.com/about"));
  assert.ok(!links.some((u) => u.includes("other.com")));
});

test("pickPages caps and filters", () => {
  const origin = "https://example.com";
  const picked = pickPages(
    [
      "https://example.com/",
      "https://example.com/docs",
      "https://example.com/login",
      "https://evil.com/x",
      "https://example.com/docs",
    ],
    origin,
    2,
  );
  assert.equal(picked.length, 2);
  assert.ok(picked.includes("https://example.com/"));
  assert.ok(picked.includes("https://example.com/docs"));
});

test("trailing-slash twins collapse before billing", () => {
  assert.equal(canonicalizePageUrl("https://example.com"), canonicalizePageUrl("https://example.com/"));
  assert.equal(canonicalizePageUrl("https://example.com/docs/"), "https://example.com/docs");
  const origin = "https://example.com";
  const picked = pickPages(
    ["https://example.com", "https://example.com/", "https://example.com/docs", "https://example.com/docs/"],
    origin,
    2,
  );
  assert.equal(picked.length, 2);
  const canon = new Set(picked.map((url) => canonicalizePageUrl(url)));
  assert.equal(canon.size, 2);
  assert.ok(canon.has("https://example.com/"));
  assert.ok(canon.has("https://example.com/docs"));
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
    const resolved = typeof hit === "function" ? hit(parsed, init) : hit;
    const { status = 200, body, text, headers = {} } = resolved;
    if (text != null) {
      return new Response(text, { status, headers: { "content-type": "text/html", ...headers } });
    }
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  };
}

const KEY = "sk402_testkey";
const AUTH = { authorization: `Bearer ${KEY}` };

test("crawl reads sitemap pages through /t/read and charges 1 each", async () => {
  const handle = createCrawlHandler({
    upstream: "https://skim402.com",
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 100 } },
      "GET /robots.txt": { text: "User-agent: *\n" },
      "GET /sitemap.xml": {
        text: `<?xml version="1.0"?><urlset>
          <loc>https://example.com/</loc>
          <loc>https://example.com/docs</loc>
          <loc>https://example.com/login</loc>
        </urlset>`,
        headers: { "content-type": "application/xml" },
      },
      "GET /sitemap_index.xml": { status: 404, text: "no" },
      "GET /": { text: `<html><a href="/docs">docs</a><a href="/about">about</a></html>` },
      "GET /api/t/read": (parsed) => {
        const target = parsed.searchParams.get("url");
        return {
          body: {
            markdown: `# ${target}`,
            text: target,
            finalUrl: target,
            metadata: { title: target },
            wordCount: 3,
          },
        };
      },
    }),
  });

  const result = await handle({
    method: "POST",
    url: "/api/t/crawl",
    headers: AUTH,
    body: { url: "https://example.com", maxPages: 3 },
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.charged >= 1);
  assert.ok(result.body.charged <= CRAWL_MAX_PAGES);
  assert.ok(result.body.pages.every((p) => p.ok));
  assert.ok(result.body.pages.some((p) => p.url.includes("/docs") || p.markdown.includes("docs")));
  assert.ok(result.body.sources.includes("sitemap") || result.body.sources.includes("links"));
});

test("crawl rejects unknown tokens", async () => {
  const handle = createCrawlHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { status: 401, body: { error: "unknown token" } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/crawl",
    headers: AUTH,
    body: { url: "https://example.com" },
  });
  assert.equal(result.status, 401);
});

test("crawl does not bill example.com and example.com/ as two pages", async () => {
  const reads = [];
  const handle = createCrawlHandler({
    upstream: "https://skim402.com",
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { packCredits: 100, planCredits: 0 } },
      "GET /robots.txt": { status: 404, text: "no" },
      "GET /sitemap.xml": { status: 404, text: "no" },
      "GET /sitemap_index.xml": { status: 404, text: "no" },
      "GET /": { text: "<html><body>Example Domain</body></html>" },
      "GET /api/t/read": (parsed) => {
        const target = parsed.searchParams.get("url");
        reads.push(target);
        return {
          body: {
            markdown: "Example Domain",
            text: "Example Domain",
            finalUrl: target,
            metadata: { title: "Example Domain" },
            wordCount: 2,
          },
        };
      },
    }),
  });

  const result = await handle({
    method: "POST",
    url: "/api/t/crawl",
    headers: AUTH,
    body: { url: "https://example.com", maxPages: 2 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.charged, 1);
  assert.equal(result.body.pageCount, 1);
  assert.equal(reads.length, 1);
  assert.equal(new Set(reads.map((url) => canonicalizePageUrl(url))).size, 1);
});
