// Contract checks for Workbench mapping — mirrors src/pages/playground.tsx helpers.
// Run: node scripts/verify-workbench.mjs

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function flagOk(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return null;
}

function normalizeBatchItem(value, fallbackUrl) {
  if (typeof value === "string") {
    return { url: value, ok: false, error: "This URL could not be read." };
  }
  const rec = asRecord(value);
  if (!rec) return { url: fallbackUrl, ok: false, error: "This URL could not be read." };
  const dataRec = asRecord(rec.data);
  const markdown =
    (typeof dataRec?.markdown === "string" && dataRec.markdown) ||
    (typeof rec.markdown === "string" && rec.markdown) ||
    "";
  const data = dataRec ?? (markdown ? { markdown } : null);
  const explicitOk = flagOk(rec.ok) ?? flagOk(rec.success);
  const hasError = rec.error != null && rec.error !== "";
  const ok = explicitOk ?? (Boolean(markdown) && !hasError);
  const url = typeof rec.url === "string" && rec.url ? rec.url : fallbackUrl;
  return {
    url,
    ok,
    data: data ?? undefined,
    error: ok
      ? null
      : typeof rec.error === "string" || (rec.error && typeof rec.error === "object")
        ? rec.error
        : "This URL could not be read.",
  };
}

function batchItemsFromBody(body, urls) {
  const rec = asRecord(body);
  const raw = Array.isArray(rec?.items)
    ? rec.items
    : Array.isArray(rec?.results)
      ? rec.results
      : Array.isArray(rec?.pages)
        ? rec.pages
        : Array.isArray(body)
          ? body
          : [];
  if (raw.length === 0) {
    return urls.map((url) => ({ url, ok: false, error: "No per-URL results in this response." }));
  }
  return raw.map((item, index) => normalizeBatchItem(item, urls[index] ?? ""));
}

function normalizeTable(value) {
  const rec = asRecord(value);
  if (!rec) return null;
  const headers = Array.isArray(rec.headers) ? rec.headers.map((cell) => (cell == null ? "" : String(cell))) : [];
  const rows = Array.isArray(rec.rows)
    ? rec.rows.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : []))
    : [];
  if (headers.length === 0 && rows.length === 0) return null;
  return { headers, rows };
}

function tablesFromExtract(body) {
  const rec = asRecord(body);
  const data = rec?.data ?? rec?.tables ?? body;
  const dataRec = asRecord(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(dataRec?.tables)
      ? dataRec.tables
      : Array.isArray(rec?.tables)
        ? rec.tables
        : [];
  return list.map(normalizeTable).filter(Boolean);
}

function extractCredits(tables, charged) {
  return tables.length === 0 ? 0 : (charged ?? 8);
}

function isEmptyExtractMiss(status, body) {
  const rec = asRecord(body);
  if (!rec) return false;
  if (tablesFromExtract(body).length > 0) return false;
  const err = `${typeof rec.error === "string" ? rec.error : ""} ${typeof rec.message === "string" ? rec.message : ""}`;
  if (/resolve|hostname|fetched|timeout|blocked/i.test(err) && !/usable rows/i.test(err)) return false;
  if (status === 200) return true;
  if (status === 422) {
    return rec.error === "unprocessable" || rec.charged === 0 || /usable rows/i.test(err);
  }
  return false;
}

function thinContentMessages(body) {
  const rec = asRecord(body);
  const warnings = Array.isArray(rec?.warnings) ? rec.warnings : [];
  return warnings
    .map((warning) => {
      if (warning === "THIN_CONTENT") return "THIN_CONTENT";
      const row = asRecord(warning);
      return row?.code === "THIN_CONTENT" ? (row.message || "THIN_CONTENT") : null;
    })
    .filter(Boolean);
}

function creditsFromAccount(account) {
  if (!account || typeof account !== "object" || Array.isArray(account)) return null;
  for (const key of ["creditsRemaining", "remainingCredits"]) {
    if (typeof account[key] === "number" && Number.isFinite(account[key])) return Math.max(0, account[key]);
  }
  if (typeof account.packCredits === "number" || typeof account.planCredits === "number") {
    return Math.max(0, (Number(account.packCredits) || 0) + (Number(account.planCredits) || 0));
  }
  if (typeof account.credits === "number" && Number.isFinite(account.credits)) return Math.max(0, account.credits);
  return null;
}

function apiErrorMessage(status, body, fallback) {
  const rec = asRecord(body);
  const code = typeof rec?.error === "string" ? rec.error : "";
  const message = typeof rec?.message === "string" ? rec.message : "";
  if (status === 401) return "Invalid or expired API key.";
  if (code === "empty_pdf") return message || "No extractable text found in this PDF (possibly image-only or encrypted).";
  return message || (code && !/^[a-z0-9_]+$/i.test(code) ? code : "") || fallback;
}

function isEmptyPdfMiss(status, body) {
  const rec = asRecord(body);
  if (!rec) return false;
  if (status !== 422 && status !== 200) return false;
  const code = typeof rec.error === "string" ? rec.error : "";
  const message = typeof rec.message === "string" ? rec.message : "";
  if (code === "empty_pdf") return true;
  return /no extractable text/i.test(message);
}

function assert(name, cond) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  console.log(`ok  ${name}`);
}

const liveBatch = {
  items: [
    {
      url: "https://example.com",
      ok: true,
      data: {
        markdown: "Example Domain",
        warnings: [{ code: "THIN_CONTENT", message: "Extracted only 16 words" }],
      },
      error: null,
    },
    {
      url: "https://example.org",
      ok: true,
      data: { markdown: "Example Domain" },
      error: null,
    },
  ],
  charged: 2,
};

const urls = ["https://example.com", "https://example.org"];

// Old bug: only reading `results` produced [] and the UI fell back to all-failed.
const oldResults = Array.isArray(liveBatch.results) ? liveBatch.results : [];
assert("old mapper missed items", oldResults.length === 0);

const mapped = batchItemsFromBody(liveBatch, urls);
assert("reads items[]", mapped.length === 2);
assert("item 0 ok", mapped[0].ok === true);
assert("item 1 ok", mapped[1].ok === true);
assert("markdown present", mapped[0].data.markdown.includes("Example Domain"));
assert("credits from charged / okCount", liveBatch.charged === mapped.filter((i) => i.ok).length);
assert("thin content surfaced", thinContentMessages(mapped[0].data)[0].includes("16 words"));

const walletBatch = {
  results: [
    { url: "https://example.com", ok: true, data: { markdown: "ok" } },
    { url: "https://example.org", ok: false, error: { status: 422, message: "Upstream responded 404" } },
  ],
};
const walletMapped = batchItemsFromBody(walletBatch, urls);
assert("wallet results still work", walletMapped[0].ok && !walletMapped[1].ok);
assert("failed keeps message", walletMapped[1].error.message.includes("404"));

const emptyExtract = { data: { tables: [] } };
const tables = tablesFromExtract(emptyExtract);
assert("empty tables is empty", tables.length === 0);
assert("empty extract not billed as 8", extractCredits(tables, undefined) === 0);
assert("usable extract still 8", extractCredits([{ headers: ["A"], rows: [["1"]] }], undefined) === 8);
assert("422 empty is a miss", isEmptyExtractMiss(422, { error: "unprocessable", message: "No usable rows extracted from this page", data: { tables: [] }, charged: 0 }));
assert("422 hostname is not a miss", !isEmptyExtractMiss(422, { error: "Could not resolve URL hostname" }));
assert("200 empty tables is a miss", isEmptyExtractMiss(200, emptyExtract));

assert("account pack+plan is ledger remaining", creditsFromAccount({ packCredits: 966, planCredits: 0 }) === 966);
assert("trial-key credits fallback", creditsFromAccount({ credits: 1000 }) === 1000);
assert("empty_pdf uses message not code", apiErrorMessage(422, { error: "empty_pdf", message: "No extractable text found in this PDF (possibly image-only or encrypted)" }, "fallback").includes("extractable text"));
assert("empty_pdf is a miss", isEmptyPdfMiss(422, { error: "empty_pdf", message: "No extractable text found in this PDF" }));
assert("other 422 pdf fetch is not empty_pdf miss", !isEmptyPdfMiss(422, { error: "unprocessable", message: "Upstream responded 404" }));

console.log("\nAll workbench mapping checks passed.");
