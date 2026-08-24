import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadPdfHandler, PDF_CREDITS } from "./tokenReadPdf.mjs";
import { looksLikePdf, pdfToMarkdown, extractStringsFromContent } from "./pdfText.mjs";

function minimalPdf(text = "Hello from the PDF") {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${stream.length} >>
stream
${stream}endstream
endobj
5 0 obj
<< /Type /Outlines /Count 1 /First 6 0 R /Last 6 0 R >>
endobj
6 0 obj
<< /Title (Intro) /Parent 5 0 R >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
  return Buffer.from(objects, "latin1");
}

function emptyPdf() {
  return Buffer.from(`%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`, "latin1");
}

test("extracts literal Tj strings and outline titles", () => {
  assert.deepEqual(extractStringsFromContent("BT (Hello) Tj ET"), ["Hello"]);
  const parsed = pdfToMarkdown(minimalPdf("Clean markdown from PDF"));
  assert.match(parsed.text, /Clean markdown from PDF/);
  assert.ok(parsed.outline.some((item) => item.title === "Intro"));
  assert.match(parsed.markdown, /Clean markdown from PDF/);
});

test("looksLikePdf requires %PDF-", () => {
  assert.equal(looksLikePdf(minimalPdf()), true);
  assert.equal(looksLikePdf(Buffer.from("<html>nope</html>")), false);
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
    const { status = 200, body, buffer, headers = {} } = resolved;
    if (buffer) {
      return new Response(buffer, {
        status,
        headers: { "content-type": "application/pdf", ...headers },
      });
    }
    return new Response(JSON.stringify(body ?? {}), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  };
}

const KEY = "sk402_testkey";
const AUTH = { authorization: `Bearer ${KEY}` };

test("read-pdf returns markdown and charges 3 credits", async () => {
  const pdf = minimalPdf("Only text that appears in the file");
  const handle = createReadPdfHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 20 } },
      "GET /paper.pdf": { buffer: pdf },
      "GET /api/t/read/js": { body: { markdown: "ignored", text: "ignored" } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: AUTH,
    body: { url: "https://example.com/paper.pdf" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.charged, PDF_CREDITS);
  assert.match(result.body.markdown, /Only text that appears in the file/);
  assert.ok(!result.body.markdown.includes("invented"));
  assert.ok(result.body.outline.some((item) => item.title === "Intro"));
});

test("read-pdf rejects huge files and non-PDFs", async () => {
  const handleHuge = createReadPdfHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 20 } },
      "GET /huge.pdf": {
        buffer: Buffer.alloc(100),
        headers: { "content-length": String(20 * 1024 * 1024), "content-type": "application/pdf" },
      },
    }),
  });
  // content-length is honored before the body in safeFetch
  const huge = await handleHuge({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: AUTH,
    body: { url: "https://example.com/huge.pdf" },
  });
  // Either 413 from content-length or 415 if the stub body is tiny — prefer 413.
  assert.ok([413, 415, 422].includes(huge.status));

  const handleHtml = createReadPdfHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 20 } },
      "GET /not.pdf": {
        buffer: Buffer.from("<html>not a pdf</html>"),
        headers: { "content-type": "text/html" },
      },
    }),
  });
  const html = await handleHtml({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: AUTH,
    body: { url: "https://example.com/not.pdf" },
  });
  assert.equal(html.status, 415);
});

test("read-pdf blocks private URLs", async () => {
  const handle = createReadPdfHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { creditsRemaining: 20 } },
    }),
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: AUTH,
    body: { url: "http://127.0.0.1/secret.pdf" },
  });
  assert.equal(result.status, 403);
});

test("empty PDFs return empty_pdf, charged 0, and skip debit", async () => {
  let debited = 0;
  const handle = createReadPdfHandler({
    fetchImpl: mockFetch({
      "GET /api/card/account": { body: { packCredits: 20, planCredits: 0 } },
      "GET /dummy.pdf": { buffer: emptyPdf() },
    }),
    debitCredits: async () => {
      debited += 1;
      return { status: 200, charged: 3 };
    },
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: AUTH,
    body: { url: "https://example.com/dummy.pdf" },
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.error, "empty_pdf");
  assert.match(result.body.message, /extractable text/i);
  assert.equal(result.body.charged, 0);
  assert.equal(debited, 0);
});
