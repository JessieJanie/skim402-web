import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createReadPdfHandler, PDF_CREDITS } from "./tokenReadPdf.mjs";
import {
  cleanPdfText,
  extractPdfPages,
  extractStringsFromContent,
  isPageNumberLine,
  pdfToMarkdown,
} from "./pdfText.mjs";

/**
 * Word, number, and punctuation pieces, plus one token per newline run.
 * Close to cl100k on this prose (spaces ride inside word tokens; blank lines
 * and wrapped lines each cost a break). Deterministic, no tokenizer package.
 */
function countTokens(text) {
  const pieces = String(text).match(/[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:[.,:]\d+)*|[^\s\w]/g) || [];
  const breaks = String(text).match(/\n+/g) || [];
  return pieces.length + breaks.length;
}

const MEMO_URL = new URL("./fixtures/public-domain-memo.pdf", import.meta.url);
const HEADER = "Sample Public Domain Memo - Household Income Notes";
const FOOTER = "U.S. Government Work - public domain sample";
const KEPT_NUMBERS = [
  "6-7",
  "10:30",
  "95,490",
  "2009",
  "131,200",
  "7.1",
  "4.0",
  "2010",
  "96,850",
  "71,200",
  "348",
  "614",
  "2011",
  "88,100",
  "3.2",
  "12.5",
  "2012",
  "90,000",
  "8.8",
  "1,024",
];

test("page-number lines are only bare page markers", () => {
  assert.equal(isPageNumberLine("2"), true);
  assert.equal(isPageNumberLine("Page 12 of 60"), true);
  assert.equal(isPageNumberLine("- 3 -"), true);
  assert.equal(isPageNumberLine("4.0"), false);
  assert.equal(isPageNumberLine("131,200"), false);
  assert.equal(isPageNumberLine("2010"), false);
  assert.equal(isPageNumberLine("cell 614"), false);
});

test("cleanup drops repeated chrome and rejoins wraps without losing numbers", () => {
  const text = cleanPdfText([
    {
      height: 792,
      lines: [
        { text: "Quarterly Table Notes", y: 760 },
        { text: "Revenue was con-", y: 700 },
        { text: "firmed at 95,490 after", y: 684 },
        { text: "the audit.", y: 668 },
        { text: "2009    131,200    7.1", y: 500 },
        { text: "348", y: 480 },
        { text: "See English-", y: 400 },
        { text: "to-German in the notes.", y: 384 },
        { text: "Printed for the archive", y: 36 },
        { text: "1", y: 22 },
      ],
    },
    {
      height: 792,
      lines: [
        { text: "Quarterly Table Notes", y: 760 },
        { text: "The second page keeps 71,200 and 4.0 percent.", y: 700 },
        { text: "2010  96,850  614", y: 500 },
        { text: "Printed for the archive", y: 36 },
        { text: "- 2 -", y: 22 },
      ],
    },
    {
      height: 792,
      lines: [
        { text: "Quarterly Table Notes", y: 760 },
        { text: "A body line that is only a count stays.", y: 700 },
        { text: "614", y: 640 },
        { text: "Printed for the archive", y: 36 },
        { text: "3", y: 22 },
      ],
    },
  ]);

  assert.equal(text.split("Quarterly Table Notes").length - 1, 1);
  assert.equal(text.split("Printed for the archive").length - 1, 1);
  for (const marker of ["1", "- 2 -", "3"]) {
    assert.equal(text.split("\n").some((line) => line.trim() === marker), false, marker);
  }
  assert.match(text, /Revenue was confirmed at 95,490 after the audit\./);
  assert.match(text, /English-to-German/);
  assert.match(text, /2009 131,200 7\.1/);
  assert.match(text, /^348$/m);
  assert.match(text, /^614$/m);
  assert.match(text, /71,200/);
  assert.match(text, /96,850/);
  assert.match(text, /4\.0 percent/);
});

test("a single page keeps its title and a body number", () => {
  const text = cleanPdfText([
    {
      height: 792,
      lines: [
        { text: "Only Title Here Today", y: 760 },
        { text: "Median was 131,200.", y: 700 },
        { text: "1", y: 22 },
      ],
    },
  ]);
  assert.match(text, /Only Title Here Today/);
  assert.match(text, /131,200/);
  assert.equal(text.split("\n").some((line) => line.trim() === "1"), false);
});

test("in-stream hyphenation keeps a real compound hyphen", () => {
  assert.deepEqual(
    extractStringsFromContent("BT (Novem-) Tj 0 -14 Td (ber) Tj ET"),
    ["November"],
  );
  assert.deepEqual(
    extractStringsFromContent("BT (English-) Tj 0 -14 Td (to-German) Tj ET"),
    ["English-to-German"],
  );
});

test("public-domain memo fixture cuts tokens and keeps table numbers", () => {
  const pdf = readFileSync(MEMO_URL);
  const before = extractPdfPages(pdf)
    .flatMap((page) => page.lines.map((line) => line.text))
    .join("\n");
  const parsed = pdfToMarkdown(pdf);
  const beforeTokens = countTokens(before);
  const afterTokens = countTokens(parsed.text);
  const markdownTokens = countTokens(parsed.markdown);

  assert.ok(beforeTokens > afterTokens, `before ${beforeTokens} after ${afterTokens}`);
  assert.ok(
    afterTokens <= Math.floor(beforeTokens * 0.85),
    `expected at least 15% fewer tokens, before ${beforeTokens} after ${afterTokens}`,
  );
  assert.ok(markdownTokens <= beforeTokens, `markdown ${markdownTokens} before ${beforeTokens}`);
  assert.equal(parsed.text.split(HEADER).length - 1, 1);
  assert.equal(parsed.text.split(FOOTER).length - 1, 1);
  assert.equal(parsed.text.split("\n").some((line) => isPageNumberLine(line)), false);
  assert.match(parsed.text, /The appropriation was confirmed/);
  assert.match(parsed.text, /adjourned at 10:30/);
  assert.match(parsed.text, /English-to-German/);
  assert.match(parsed.text, /public-domain sample/);
  for (const number of KEPT_NUMBERS) {
    assert.ok(parsed.text.includes(number), `missing ${number}`);
    assert.ok(parsed.markdown.includes(number), `markdown missing ${number}`);
  }
  assert.match(parsed.text, /^2009 131,200 7\.1 4\.0$/m);
  assert.match(parsed.text, /^2010 96,850 71,200 348$/m);
  assert.equal(parsed.text.includes("    "), false);
});

test("cleaned memo still bills one PDF read", async () => {
  const pdf = readFileSync(MEMO_URL);
  let debits = 0;
  const handle = createReadPdfHandler({
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname === "/api/card/account") {
        return new Response(JSON.stringify({ creditsRemaining: 20 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (parsed.pathname === "/memo.pdf") {
        return new Response(pdf, {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      }
      return new Response("miss", { status: 500 });
    },
    debitCredits: async (_token, amount) => {
      debits += 1;
      assert.equal(amount, PDF_CREDITS);
      return { status: 200, charged: PDF_CREDITS };
    },
  });
  const result = await handle({
    method: "POST",
    url: "/api/t/read-pdf",
    headers: { authorization: "Bearer sk402_testkey" },
    body: { url: "https://example.com/memo.pdf" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.charged, PDF_CREDITS);
  assert.equal(debits, 1);
  assert.match(result.body.markdown, /131,200/);
  assert.equal(result.body.markdown.split(HEADER).length - 1, 1);
});
