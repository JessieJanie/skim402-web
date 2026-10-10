#!/usr/bin/env node
/**
 * Reader fidelity check for the Oct 9, 2026 benchmark set.
 *
 *   node scripts/reader-fidelity.mjs
 *     Offline. Confirms the URL list loads and scores built-in fixtures.
 *
 *   node scripts/reader-fidelity.mjs --network
 *     Fetch each benchmark URL, run the local reader, and compare answer
 *     presence and size with server/fixtures/reader-benchmark-baseline.csv.
 *
 *   node scripts/reader-fidelity.mjs --network --ids e1,t2,p4
 *   node scripts/reader-fidelity.mjs --network --render
 *     Render category=js pages in headless Chrome and serialize open shadow
 *     roots before extraction. Requires google-chrome. Does not call the
 *     live Skim API and does not spend credits.
 */

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isBlockedUrl } from "../server/http.mjs";
import { htmlToMarkdown } from "../server/htmlText.mjs";
import { pdfToMarkdown } from "../server/pdfText.mjs";
import { selectReaderHtml, serializeShadowTreeExpression } from "../server/renderDom.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const urlsPath = join(root, "../server/fixtures/reader-benchmark.csv");
const baselinePath = join(root, "../server/fixtures/reader-benchmark-baseline.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((value) => value !== ""));
  return body.map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

export function answerScore(text, keywords) {
  const groups = String(keywords || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!groups.length) return 1;
  const hay = String(text || "").toLowerCase();
  const hits = groups.filter((group) =>
    group.split("|").some((alt) => hay.includes(alt.trim().toLowerCase())),
  );
  return hits.length / groups.length;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function offlineFixtures() {
  const table = htmlToMarkdown(
    `<!doctype html><html><head><title>Elements</title></head><body>
      <p>${"Intro. ".repeat(40)}</p>
      <table class="wikitable sticky-header-multi">
        <tr><th>Z</th><th>Name</th><th>Density</th><th>Melt</th></tr>
        <tr><td>79</td><td>Gold</td><td>19.3</td><td>1<span>337</span>.33</td></tr>
        <tr><td>1</td><td>Hydrogen</td><td>0.09</td><td>14</td></tr>
      </table></body></html>`,
    { url: "https://example.com/elements" },
  );
  const pdf = pdfToMarkdown(
    Buffer.from(
      "BT /F1 12 Tf 72 700 Td [(Novem)-11(ber 6\\2267)] TJ 0 -16 Td [(10:)-8(3)-8(0)] TJ ET",
      "latin1",
    ),
  );
  return [
    { id: "fixture-table", chars: table.markdown.length, score: answerScore(table.markdown, "1337.33;19.3") },
    { id: "fixture-pdf", chars: pdf.markdown.length, score: answerScore(pdf.markdown, "November 6;10:30") },
  ];
}

async function fetchBytes(url) {
  if (isBlockedUrl(url)) throw new Error("blocked url");
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Skim/1.0 (+https://skim402.com)", Accept: "*/*" },
    signal: AbortSignal.timeout(45000),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, type: res.headers.get("content-type") || "", finalUrl: res.url };
}

function cdpSocket(wsUrl) {
  let next = 1;
  const waiters = new Map();
  const ws = new WebSocket(wsUrl);
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("chrome websocket failed")));
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) {
      const done = waiters.get(msg.id);
      waiters.delete(msg.id);
      done(msg);
    }
  });
  return {
    ready: opened,
    send(method, params = {}, sessionId) {
      const id = next;
      next += 1;
      return new Promise((resolve) => {
        waiters.set(id, resolve);
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function withChrome(run) {
  const dir = `/tmp/chrome-skim-fidelity-${process.pid}`;
  const port = 9333 + (process.pid % 1000);
  const proc = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    let version = null;
    for (let i = 0; i < 40; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          version = await res.json();
          break;
        }
      } catch {
        // Chrome is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!version?.webSocketDebuggerUrl) throw new Error("Chrome did not open a debugging port");
    const browser = cdpSocket(version.webSocketDebuggerUrl);
    await browser.ready;
    try {
      return await run(browser);
    } finally {
      browser.close();
    }
  } finally {
    proc.kill("SIGKILL");
  }
}

async function renderHtml(browser, url) {
  if (isBlockedUrl(url)) throw new Error("blocked url");
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const targetId = created.result?.targetId;
  if (!targetId) throw new Error("Chrome did not create a tab");
  const attached = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = attached.result?.sessionId;
  const send = (method, params) => browser.send(method, params, sessionId);
  await send("Page.enable");
  await send("Page.navigate", { url });
  // Client routers paint a shell first. Give the feature request time to fill
  // open shadow roots before we snapshot them.
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const outer = await send("Runtime.evaluate", {
    expression: "document.documentElement ? document.documentElement.outerHTML : ''",
    returnByValue: true,
  });
  const serialized = await send("Runtime.evaluate", {
    expression: serializeShadowTreeExpression(),
    returnByValue: true,
  });
  await browser.send("Target.closeTarget", { targetId });
  return selectReaderHtml(outer.result?.result?.value || "", serialized.result?.result?.value || "");
}

function extract(buf, type, url, category) {
  const head = buf.subarray(0, 8).toString("latin1");
  if (category === "pdf" || type.includes("pdf") || head.startsWith("%PDF-")) {
    const parsed = pdfToMarkdown(buf);
    return { markdown: parsed.markdown, kind: "pdf" };
  }
  let html = buf.toString("utf8");
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    html = "";
  }
  const parsed = htmlToMarkdown(html, { url });
  return { markdown: parsed.markdown, kind: "html", truncated: parsed.truncated };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function printRow(row) {
  const ratio = row.beforeChars ? (row.chars / row.beforeChars).toFixed(2) : "";
  console.log(
    [
      row.id.padEnd(14),
      `answer ${row.score.toFixed(3)}`,
      `(was ${row.beforeScore})`,
      `chars ${row.chars}`,
      `(was ${row.beforeChars})`,
      ratio ? `ratio ${ratio}` : "",
      row.note || "",
    ].filter(Boolean).join("  "),
  );
}

async function main() {
  const network = process.argv.includes("--network");
  const render = process.argv.includes("--render");
  const ids = new Set(
    argValue("--ids")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const cases = parseCsv(readFileSync(urlsPath, "utf8"));
  const baseline = new Map(parseCsv(readFileSync(baselinePath, "utf8")).map((row) => [row.id, row]));
  if (cases.length < 30) {
    console.error(`expected 30 benchmark URLs, found ${cases.length}`);
    process.exit(1);
  }

  const fixtures = offlineFixtures();
  let failed = fixtures.some((row) => row.score < 1);
  console.log("offline fixtures");
  for (const row of fixtures) printRow({ ...row, beforeScore: "n/a", beforeChars: 0 });

  if (!network) {
    console.log(`\n${cases.length} benchmark URLs loaded. Re-run with --network to fetch them.`);
    process.exit(failed ? 1 : 0);
  }

  const selected = cases.filter((row) => ids.size === 0 || ids.has(row.id));
  console.log(`\nnetwork ${selected.length} url(s)${render ? " with js render" : ""}`);
  const rendered = new Map();
  if (render) {
    const jsRows = selected.filter((row) => row.category === "js");
    if (jsRows.length) {
      await withChrome(async (browser) => {
        for (const row of jsRows) {
          try {
            const html = await renderHtml(browser, row.url);
            rendered.set(row.id, html);
            console.log(`rendered ${row.id} ${html.length} bytes`);
          } catch (error) {
            console.log(`render failed ${row.id}: ${error.message}`);
          }
        }
      });
    }
  }

  const results = await mapPool(selected, 4, async (row) => {
    const before = baseline.get(row.id) || {};
    try {
      let markdown = "";
      let note = "";
      if (rendered.has(row.id)) {
        const html = rendered.get(row.id);
        markdown = htmlToMarkdown(html, { url: row.url }).markdown;
        note = `rendered ${html.length}b`;
      } else {
        const fetched = await fetchBytes(row.url);
        if (fetched.status >= 400) note = `http ${fetched.status}`;
        const extracted = extract(fetched.buf, fetched.type, row.url, row.category);
        markdown = extracted.markdown;
        if (extracted.truncated) note = `${note} truncated`.trim();
        if (row.category === "js" && markdown.length < 1500) note = `${note} static-shell`.trim();
      }
      return {
        id: row.id,
        score: answerScore(markdown, row.keywords),
        chars: markdown.length,
        beforeScore: before.answer_in_skim ?? "",
        beforeChars: Number(before.skim_chars || 0),
        note,
      };
    } catch (error) {
      return {
        id: row.id,
        score: 0,
        chars: 0,
        beforeScore: before.answer_in_skim ?? "",
        beforeChars: Number(before.skim_chars || 0),
        note: error.message,
      };
    }
  });

  console.log("\nid              answer      chars");
  for (const row of results) printRow(row);
  const dropped = results.filter((row) => {
    const before = Number(row.beforeScore);
    return Number.isFinite(before) && before >= 0.99 && row.score + 0.001 < before;
  });
  if (dropped.length) {
    console.log(`\npreviously complete answers now missing on ${dropped.map((row) => row.id).join(",")}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
