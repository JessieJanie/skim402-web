/**
 * HTML → markdown for the reader.
 *
 * Mozilla Readability is still used for the article body (that is what keeps
 * ordinary pages smaller than raw HTML). It also drops things agents need:
 * data tables whose class happens to contain "header"/"menu", release lists
 * classed as menus, and doc summary/availability blocks. Those nodes are
 * copied back from the original document. Oversized output is cut with an
 * explicit marker instead of disappearing silently.
 *
 * Production /api/t/read and /api/t/read/js should return htmlToMarkdown(html).
 * JS renders should pass serializeShadowTree(document.body) from
 * server/renderDom.mjs, because outerHTML drops open shadow roots and moving
 * those nodes makes Lit wipe them. Credit amounts are unchanged.
 */

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export const CONTENT_TRUNCATED_MARKER = "\n\n[Content truncated]\n";
/** High enough for large Wikipedia tables; ordinary articles stay far below it. */
export const MAX_MARKDOWN_CHARS = 480_000;

const ROOT_SELECTORS = [
  "#mw-content-text",
  "article",
  "main",
  "[role='main']",
  ".main-content",
  "#content",
  "body",
];

function contentRoot(document) {
  for (const selector of ROOT_SELECTORS) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return document.body || document.documentElement;
}

function classText(el) {
  const cls = el?.className;
  const name = typeof cls === "string" ? cls : cls?.baseVal || "";
  const label = el?.getAttribute?.("aria-label") || "";
  return `${name} ${label}`;
}

function isInside(el, predicate) {
  let node = el;
  while (node) {
    if (predicate(node)) return true;
    node = node.parentElement;
  }
  return false;
}

function isNavbox(el) {
  return isInside(el, (node) => /\bnavbox\b/.test(classText(node)));
}

function isChrome(el) {
  const tag = el.tagName;
  if (tag === "NAV" || tag === "FOOTER" || tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
    return true;
  }
  const role = el.getAttribute?.("role") || "";
  if (role === "navigation" || role === "banner" || role === "contentinfo") return true;
  return false;
}

function plainText(node) {
  if (!node) return "";
  const clone = node.cloneNode(true);
  clone.querySelectorAll?.("style, script, noscript").forEach((child) => child.remove());
  return squash(clone.textContent || "");
}

function squash(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function markdownPlain(markdown) {
  return squash(
    String(markdown || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`|]/g, " "),
  );
}

/** Rows that belong to this table, not to a table nested in a cell. */
function rowsOf(table) {
  return [...table.querySelectorAll("tr")].filter((row) => row.closest("table") === table);
}

function cellPlain(cell) {
  return plainText(cell);
}

function isDataTable(table) {
  if (!table || table.tagName !== "TABLE") return false;
  if (isNavbox(table) || isInside(table, isChrome)) return false;
  if (table.getAttribute("role") === "presentation") return false;
  const rows = rowsOf(table);
  if (rows.length < 2) return false;
  const cellTexts = rows.flatMap((row) =>
    [...row.children]
      .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
      .map((cell) => cellPlain(cell)),
  );
  const total = cellTexts.reduce((sum, text) => sum + text.length, 0);
  const longest = cellTexts.reduce((max, text) => Math.max(max, text.length), 0);
  // Layout tables (essay pages) put the whole article in one cell.
  if (longest > 400 && total > 0 && longest / total > 0.45) return false;
  const headerCells = rows.reduce(
    (count, row) => count + [...row.children].filter((cell) => cell.tagName === "TH").length,
    0,
  );
  const cols = Math.max(
    ...rows.map(
      (row) => [...row.children].filter((cell) => cell.tagName === "TD" || cell.tagName === "TH").length,
    ),
    0,
  );
  if (headerCells > 0 && cols >= 2) return true;
  return cols >= 2 && rows.length >= 3;
}

function isDataList(list) {
  if (!list || (list.tagName !== "OL" && list.tagName !== "UL")) return false;
  if (isNavbox(list) || isInside(list, isChrome)) return false;
  if (list.querySelector(".release-version, .release-status, .release-start, .release-end")) return true;
  return /\blist-row-container\b/.test(classText(list));
}

function isLicenseLink(el) {
  if (el.tagName !== "A") return false;
  const title = el.getAttribute("title") || "";
  const text = plainText(el);
  return /license/i.test(title) && text.length > 0 && text.length < 40;
}

function isFactBlock(el) {
  if (!el || el.nodeType !== 1) return false;
  if (isInside(el, isChrome)) return false;
  const label = classText(el);
  if (/\bavailability\b/i.test(label) || /^availability$/i.test(el.getAttribute?.("aria-label") || "")) {
    return true;
  }
  if (isLicenseLink(el)) return true;
  const text = plainText(el);
  if (!text || text.length > 500) return false;
  if (/\bpublished by\b/i.test(text)) return true;
  return false;
}

function smallestFacts(root) {
  const found = [];
  const abstracts = [...root.querySelectorAll(".abstract")]
    .filter((el) => {
      const text = plainText(el);
      return text.length > 0 && text.length < 280 && !isInside(el, isChrome);
    });
  if (abstracts[0]) found.push(abstracts[0]);
  root.querySelectorAll("*").forEach((el) => {
    if (!isFactBlock(el)) return;
    if ([...el.children].some((child) => isFactBlock(child))) return;
    found.push(el);
  });
  return found;
}

function covered(node, articleText) {
  const sample = plainText(node);
  const article = markdownPlain(articleText);
  if (!sample) return true;
  if (sample.length < 80) return article.includes(sample);
  const windows = [0, 0.35, 0.7, 1].map((pos) => {
    const start = Math.max(0, Math.min(sample.length - 48, Math.floor((sample.length - 48) * pos)));
    return sample.slice(start, start + 48);
  }).filter((part) => part.trim().length > 16);
  if (!windows.length) return article.includes(sample.slice(0, 24));
  return windows.every((part) => article.includes(part));
}

function escapeCell(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function tableToMarkdown(table) {
  const rows = rowsOf(table)
    .map((row) => [...row.children]
      .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
      .map((cell) => escapeCell(cellPlain(cell.cloneNode(true)))))
    .filter((row) => row.some(Boolean));
  if (rows.length < 2) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const norm = rows.map((row) => {
    const copy = row.slice();
    while (copy.length < width) copy.push("");
    return copy;
  });
  const header = norm[0];
  const sep = header.map(() => "---");
  return [header, sep, ...norm.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function inlineToMarkdown(node, baseUrl) {
  if (!node) return "";
  if (node.nodeType === 3) return node.textContent || "";
  if (node.nodeType !== 1) return "";
  const tag = node.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG") return "";
  if (tag === "BR") return "\n";
  const inner = [...node.childNodes].map((child) => inlineToMarkdown(child, baseUrl)).join("");
  if (tag === "A") {
    const text = inner.replace(/\s+/g, " ").trim();
    const href = node.getAttribute("href");
    if (!text || !href || href.startsWith("#") || href.startsWith("javascript:")) return text;
    let absolute = href;
    try {
      absolute = new URL(href, baseUrl || undefined).href;
    } catch {
      absolute = href;
    }
    const title = node.getAttribute("title");
    const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
    return `[${text}](${absolute}${titlePart})`;
  }
  if (tag === "STRONG" || tag === "B") return `**${inner.trim()}**`;
  if (tag === "EM" || tag === "I") return `*${inner.trim()}*`;
  if (tag === "CODE" && node.parentElement?.tagName !== "PRE") return `\`${inner.trim()}\``;
  return inner;
}

function listToMarkdown(list, baseUrl) {
  const items = [...list.children].filter((el) => el.tagName === "LI");
  const spanRows = items.map((item) => [...item.children]
    .filter((child) => child.tagName === "SPAN")
    .map((span) => (span.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean));
  const structured = spanRows.length >= 2 && spanRows.every((row) => row.length >= 3);
  if (structured) {
    const header = [...items[0].querySelectorAll("span")]
      .map((span) => String(span.className || "value").split(/\s+/).pop().replace(/^release-/, "") || "value");
    const width = header.length;
    const lines = [
      `| ${header.map(escapeCell).join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...spanRows.map((row) => {
        const copy = row.slice(0, width);
        while (copy.length < width) copy.push("");
        return `| ${copy.map(escapeCell).join(" | ")} |`;
      }),
    ];
    return lines.join("\n");
  }
  const ordered = list.tagName === "OL";
  return items
    .map((item, index) => {
      const text = inlineToMarkdown(item, baseUrl).replace(/\s+/g, " ").trim();
      return `${ordered ? `${index + 1}.` : "-"} ${text}`;
    })
    .filter((line) => line.trim().length > 2)
    .join("\n");
}

function blockToMarkdown(node, baseUrl) {
  if (!node || node.nodeType !== 1) return "";
  const tag = node.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG") return "";
  if (isChrome(node)) return "";
  if (tag === "TABLE") return tableToMarkdown(node);
  if (tag === "UL" || tag === "OL") return listToMarkdown(node, baseUrl);
  if (tag === "PRE") {
    const code = (node.textContent || "").replace(/\n$/, "");
    return code.trim() ? `\`\`\`\n${code}\n\`\`\`` : "";
  }
  if (/^H[1-6]$/.test(tag)) {
    const text = inlineToMarkdown(node, baseUrl).replace(/\s+/g, " ").trim();
    if (!text) return "";
    const level = Number(tag[1]);
    return `${"#".repeat(level)} ${text}`;
  }
  if (tag === "DETAILS") {
    const summary = node.querySelector("summary");
    const summaryText = summary
      ? inlineToMarkdown(summary, baseUrl).replace(/\s+/g, " ").trim()
      : "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll("summary").forEach((el) => el.remove());
    const body = blockChildrenToMarkdown(clone, baseUrl);
    return [summaryText ? `**${summaryText}**` : "", body].filter(Boolean).join("\n\n");
  }
  if (tag === "P" || tag === "BLOCKQUOTE" || tag === "FIGCAPTION" || tag === "DD" || tag === "DT") {
    const text = inlineToMarkdown(node, baseUrl).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text;
  }
  return blockChildrenToMarkdown(node, baseUrl);
}

function blockChildrenToMarkdown(node, baseUrl) {
  const parts = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = child.textContent.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
      continue;
    }
    if (child.nodeType === 1) {
      const md = blockToMarkdown(child, baseUrl);
      if (md && md.trim()) parts.push(md.trim());
    }
  }
  return parts.join("\n\n");
}

function rescueNodes(root) {
  const nodes = [];
  const push = (node) => {
    if (!node || nodes.some((existing) => existing === node || existing.contains(node))) return;
    if (nodes.some((existing) => node.contains(existing))) {
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        if (node.contains(nodes[i])) nodes.splice(i, 1);
      }
    }
    nodes.push(node);
  };
  root.querySelectorAll("table").forEach((table) => {
    if (isDataTable(table)) push(table);
  });
  root.querySelectorAll("ol, ul").forEach((list) => {
    if (isDataList(list)) push(list);
  });
  root.querySelectorAll("details").forEach((details) => {
    if (!isInside(details, isChrome)) push(details);
  });
  smallestFacts(root).forEach((fact) => push(fact));
  return nodes;
}

function truncateMarkdown(markdown) {
  if (markdown.length <= MAX_MARKDOWN_CHARS) {
    return { markdown, truncated: false };
  }
  const budget = MAX_MARKDOWN_CHARS - CONTENT_TRUNCATED_MARKER.length;
  let cut = markdown.lastIndexOf("\n", budget);
  if (cut < budget * 0.5) cut = budget;
  return {
    markdown: `${markdown.slice(0, cut).trimEnd()}${CONTENT_TRUNCATED_MARKER}`,
    truncated: true,
  };
}

function metaContent(document, name) {
  const node = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return squash(node?.getAttribute("content") || "");
}

function expandDeclarativeShadowRoots(document) {
  const templates = [...document.querySelectorAll("template[shadowrootmode], template[shadowroot]")];
  for (const tpl of templates) {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-skim-shadow", "");
    wrap.innerHTML = tpl.innerHTML;
    tpl.replaceWith(wrap);
  }
}

function headerLine(tableMarkdown) {
  const line = String(tableMarkdown || "")
    .split("\n")
    .find((row) => row.trim().startsWith("|"));
  return squash(line || "");
}

/** Drop a shorter copy of the same table so a rescued full table is not repeated. */
function stripOverlappingTable(markdown, rescued) {
  const header = headerLine(rescued);
  if (!header.startsWith("|") || header.length < 8) return markdown;
  const parts = String(markdown || "").split(/\n{2,}/);
  return parts.filter((part) => headerLine(part) !== header).join("\n\n");
}

/**
 * @param {string} html
 * @param {{ url?: string }} [opts]
 * @returns {{ markdown: string, text: string, title: string, excerpt: string, byline: string|null, siteName: string|null, publishedAt: string|null, lang: string|null, truncated: boolean }}
 */
export function htmlToMarkdown(html, opts = {}) {
  const source = String(html || "");
  const baseUrl = opts.url;
  const { document: readabilityDoc } = parseHTML(source);
  expandDeclarativeShadowRoots(readabilityDoc);
  let article = null;
  try {
    article = new Readability(readabilityDoc).parse();
  } catch {
    article = null;
  }
  const { document } = parseHTML(source);
  expandDeclarativeShadowRoots(document);
  const root = contentRoot(document);
  const articleHtml = article?.content || "";
  const { document: articleDoc } = parseHTML("<!doctype html><html><body><div id=\"skim-article\"></div></body></html>");
  const articleHost = articleDoc.getElementById("skim-article");
  if (articleHtml) articleHost.innerHTML = articleHtml;
  const articleMarkdown = articleHtml
    ? blockToMarkdown(articleHost, baseUrl)
    : blockToMarkdown(root, baseUrl);

  const title = squash(article?.title || document.querySelector("title")?.textContent || "");
  const excerpt = squash(article?.excerpt || metaContent(document, "description") || "");
  const pieces = [];
  const seen = [];
  const pushPiece = (value) => {
    const text = (value || "").trim();
    if (!text) return;
    const plain = markdownPlain(text);
    if (!plain) return;
    if (seen.some((existing) => existing === plain || existing.includes(plain))) return;
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const existing = seen[i];
      if (plain.includes(existing) && existing.length < plain.length) {
        pieces.splice(i, 1);
        seen.splice(i, 1);
      }
    }
    seen.push(plain);
    pieces.push(text);
  };

  const articlePlain = markdownPlain(articleMarkdown);
  if (title && !articlePlain.includes(title)) pushPiece(`# ${title}`);
  if (excerpt && !articlePlain.includes(excerpt) && !markdownPlain(pieces.join("\n")).includes(excerpt)) {
    pushPiece(excerpt);
  }

  // Rescue from the whole body. A narrow <article> often omits the data
  // table or the doc sidebar that readability already dropped.
  const rescued = rescueNodes(document.body || root).filter(
    (node) => !covered(node, `${articleMarkdown}\n${pieces.join("\n\n")}`),
  );
  const facts = rescued.filter((node) => isFactBlock(node) || node.tagName === "DETAILS");
  const tablesAndLists = rescued.filter((node) => !facts.includes(node));
  for (const node of facts) pushPiece(blockToMarkdown(node, baseUrl));
  let body = articleMarkdown;
  const tablePieces = [];
  for (const node of tablesAndLists) {
    const md = blockToMarkdown(node, baseUrl);
    body = stripOverlappingTable(body, md);
    tablePieces.push(md);
  }
  pushPiece(body);
  for (const md of tablePieces) pushPiece(md);

  let markdown = pieces.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  const limited = truncateMarkdown(markdown);
  markdown = limited.markdown;
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    markdown,
    text,
    title: title || "",
    excerpt: excerpt || "",
    byline: article?.byline || null,
    siteName: article?.siteName || null,
    publishedAt: article?.publishedTime || null,
    lang: document.documentElement?.getAttribute("lang") || article?.lang || null,
    truncated: limited.truncated,
  };
}
