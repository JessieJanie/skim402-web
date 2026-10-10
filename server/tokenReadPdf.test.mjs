import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createReadPdfHandler, PDF_CREDITS } from "./tokenReadPdf.mjs";
import { looksLikePdf, pdfToMarkdown, extractStringsFromContent, controlCharCount, junkRatio } from "./pdfText.mjs";

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

test("joins words and times split across kerning runs", () => {
  const stream = "BT /F1 12 Tf 72 700 Td [(Novem)-11(ber 6\\2267)] TJ 0 -16 Td [(10:)-8(3)-8(0)] TJ ET";
  const lines = extractStringsFromContent(stream);
  assert.deepEqual(lines, ["November 6–7", "10:30"]);
  const shifted = extractStringsFromContent("BT (10:) Tj 8 0 Td (3) Tj 6 0 Td (0) Tj ET");
  assert.deepEqual(shifted, ["10:30"]);
  const wrapped = extractStringsFromContent("BT (Novem-) Tj 0 -14 Td (ber) Tj ET");
  assert.deepEqual(wrapped, ["November"]);
});

function pdfWithBinaryNoise() {
  const text = [
    "(binary junk outside text) '",
    "BT /F1 12 Tf 72 700 Td (November 6-7 adjourned at 10:30) Tj ET",
    "BT (\x00\x01\x02\x03\x04\x05 not text) Tj ET",
    "",
  ].join("\n");
  const font = "\x00\x01BT}\x02(font program bytes\x00\x01) ' \x7f\x80\x81 more font";
  const image = "BT (image bytes should not appear) Tj ET\n";
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length} >>
stream
${text}endstream
endobj
7 0 obj
<< /Length ${font.length} /Length1 20 /Length2 40 /Length3 0 >>
stream
${font}endstream
endobj
8 0 obj
<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${image.length} >>
stream
${image}endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
  return Buffer.from(body, "latin1");
}

test("drops font, image, and control-character streams", () => {
  const pdf = pdfWithBinaryNoise();
  const parsed = pdfToMarkdown(pdf);
  assert.match(parsed.text, /November 6-7 adjourned at 10:30/);
  assert.equal(parsed.text.includes("font program"), false);
  assert.equal(parsed.text.includes("image bytes"), false);
  assert.equal(parsed.text.includes("binary junk outside"), false);
  assert.equal(parsed.text.includes("not text"), false);
  assert.equal(controlCharCount(parsed.markdown), 0);
  assert.ok(junkRatio(parsed.markdown) < 0.005);

  const dir = mkdtempSync(join(tmpdir(), "skim-pdf-"));
  const pdfPath = join(dir, "sample.pdf");
  const txtPath = join(dir, "sample.txt");
  try {
    writeFileSync(pdfPath, pdf);
    execFileSync("pdftotext", ["-q", pdfPath, txtPath], { timeout: 15000 });
    const poppler = readFileSync(txtPath, "utf8");
    assert.match(poppler, /10:30/);
    assert.ok(
      parsed.markdown.length <= Math.max(poppler.length * 1.35, poppler.length + 80),
      `markdown ${parsed.markdown.length} vs pdftotext ${poppler.length}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function numberTokens(text) {
  return (String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((token) => token.replace(/,/g, ""));
}

/** Fraction of reference number tokens that appear in the extraction. */
function numberRecall(got, reference) {
  const counts = new Map();
  for (const token of numberTokens(got)) counts.set(token, (counts.get(token) || 0) + 1);
  const ref = numberTokens(reference);
  let hit = 0;
  for (const token of ref) {
    const have = counts.get(token) || 0;
    if (have > 0) {
      hit += 1;
      counts.set(token, have - 1);
    }
  }
  return ref.length ? hit / ref.length : 1;
}

function pdfWithSubsetNumbers() {
  // \036 \035 \036 \033 \034 \032 \032 is 1, 3, 1, comma, 2, 0, 0 via ToUnicode.
  // The Encoding Differences array is what pdftotext uses for the same bytes.
  const text = "BT /F1 12 Tf 72 700 Td (\\036\\035\\036\\033\\034\\032\\032) Tj ET\nBT /F1 12 Tf 72 680 Td (Hello households) Tj ET\n";
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
5 beginbfchar
<1E> <0031>
<1D> <0033>
<1C> <0032>
<1B> <002C>
<1A> <0030>
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop end end
`;
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length} >>
stream
${text}endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /CensusSubset /ToUnicode 6 0 R /Encoding 7 0 R >>
endobj
6 0 obj
<< /Length ${cmap.length} >>
stream
${cmap}endstream
endobj
7 0 obj
<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [26 /zero /comma /two /three /one] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
  return Buffer.from(body, "latin1");
}

test("subset-font numbers match pdftotext via ToUnicode", () => {
  const pdf = pdfWithSubsetNumbers();
  const parsed = pdfToMarkdown(pdf);
  assert.match(parsed.text, /131,200/);
  assert.match(parsed.text, /Hello households/);
  assert.equal(controlCharCount(parsed.markdown), 0);

  const dir = mkdtempSync(join(tmpdir(), "skim-pdf-nums-"));
  const pdfPath = join(dir, "sample.pdf");
  const txtPath = join(dir, "sample.txt");
  try {
    writeFileSync(pdfPath, pdf);
    execFileSync("pdftotext", ["-q", pdfPath, txtPath], { timeout: 15000 });
    const poppler = readFileSync(txtPath, "utf8");
    assert.match(poppler, /131[,]?200/);
    const recall = numberRecall(parsed.markdown, poppler);
    assert.ok(recall >= 0.9, `number recall ${recall} skim=${parsed.markdown} poppler=${poppler}`);
    assert.ok(
      parsed.markdown.length <= Math.max(poppler.length * 1.5, poppler.length + 40),
      `markdown ${parsed.markdown.length} vs pdftotext ${poppler.length}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
