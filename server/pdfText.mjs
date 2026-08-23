/**
 * Deterministic PDF → text / outline. No LLM. Text comes only from the file.
 * Handles uncompressed streams and FlateDecode; good enough for digital PDFs.
 */

import { inflateRawSync, inflateSync } from "node:zlib";

export const PDF_MAX_BYTES = 8 * 1024 * 1024;

export function looksLikePdf(buffer, contentType = "") {
  if (!buffer || buffer.length < 5) return false;
  const head = buffer.subarray(0, 8).toString("latin1");
  if (head.startsWith("%PDF-")) return true;
  const type = contentType.toLowerCase();
  return type.includes("application/pdf") && buffer.includes(Buffer.from("%PDF-"));
}

function inflateStream(bytes) {
  try {
    return inflateSync(bytes);
  } catch {
    try {
      return inflateRawSync(bytes);
    } catch {
      return null;
    }
  }
}

function pdfUnescape(text) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function decodeLiteral(raw) {
  const bytes = Buffer.from(raw, "latin1");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const payload = Buffer.from(bytes.subarray(2));
    const even = payload.length % 2 === 0 ? payload : Buffer.concat([payload, Buffer.from([0])]);
    try {
      return Buffer.from(even).swap16().toString("utf16le");
    } catch {
      return pdfUnescape(raw);
    }
  }
  return pdfUnescape(raw);
}

function decodeHexString(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const even = clean.length % 2 === 0 ? clean : `${clean}0`;
  try {
    return Buffer.from(even, "hex").toString("utf8");
  } catch {
    return "";
  }
}

export function extractStringsFromContent(content) {
  const out = [];
  const src = typeof content === "string" ? content : content.toString("latin1");
  const tj = /\((?:\\.|[^\\)])*\)\s*T[jJ]/g;
  let match;
  while ((match = tj.exec(src))) {
    const inner = match[0].replace(/\s*T[jJ]$/, "");
    out.push(decodeLiteral(inner.slice(1, -1)));
  }
  const arr = /\[(.*?)\]\s*TJ/gs;
  while ((match = arr.exec(src))) {
    const body = match[1];
    const parts = [];
    const piece = /\((?:\\.|[^\\)])*\)|<([0-9a-fA-F]+)>/g;
    let p;
    while ((p = piece.exec(body))) {
      if (p[0].startsWith("(")) parts.push(decodeLiteral(p[0].slice(1, -1)));
      else parts.push(decodeHexString(p[1]));
    }
    if (parts.length) out.push(parts.join(""));
  }
  return out;
}

function collectStreams(buffer) {
  const src = buffer.toString("latin1");
  const streams = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let match;
  while ((match = re.exec(src))) {
    const before = src.slice(Math.max(0, match.index - 400), match.index);
    const flate = /\/Filter\s*\/FlateDecode/.test(before) || /\/FlateDecode/.test(before);
    const raw = Buffer.from(match[1].replace(/\r\n$/, "").replace(/\n$/, ""), "latin1");
    streams.push({ flate, raw, before });
  }
  return streams;
}

export function extractOutline(buffer) {
  const src = buffer.toString("latin1");
  const titles = [];
  const re = /\/Title\s*\((?:\\.|[^\\)])*\)/g;
  let match;
  while ((match = re.exec(src))) {
    const inner = match[0].replace(/^\/Title\s*\(/, "").replace(/\)$/, "");
    const title = decodeLiteral(inner).trim();
    if (title && title !== "Untitled" && !titles.includes(title)) titles.push(title);
  }
  return titles.slice(0, 80).map((title, i) => ({ title, level: 1, index: i }));
}

export function pdfToMarkdown(buffer) {
  const streams = collectStreams(buffer);
  const lines = [];
  for (const stream of streams) {
    let bytes = stream.raw;
    if (stream.flate) {
      const inflated = inflateStream(bytes);
      if (!inflated) continue;
      bytes = inflated;
    }
    const latin = bytes.toString("latin1");
    if (!/[Tt][jJ]/.test(latin) && !/BT/.test(latin)) continue;
    const strings = extractStringsFromContent(latin);
    for (const s of strings) {
      const cleaned = s.replace(/\s+/g, " ").trim();
      if (cleaned) lines.push(cleaned);
    }
  }

  if (lines.length === 0) {
    const whole = buffer.toString("latin1");
    const fallback = extractStringsFromContent(whole);
    for (const s of fallback) {
      const cleaned = s.replace(/\s+/g, " ").trim();
      if (cleaned) lines.push(cleaned);
    }
  }

  const outline = extractOutline(buffer);
  const text = lines.join("\n");
  const markdown = outlineToMarkdown(text, outline);
  return { text, markdown, outline, pageHint: countPages(buffer) };
}

function countPages(buffer) {
  const src = buffer.toString("latin1");
  const count = /\/Count\s+(\d+)/.exec(src);
  if (count) return Number(count[1]);
  const pages = src.match(/\/Type\s*\/Page[^s]/g);
  return pages ? pages.length : null;
}

function outlineToMarkdown(text, outline) {
  if (!text.trim()) return "";
  const paragraphs = text.split(/\n+/).filter(Boolean);
  if (outline.length === 0) {
    return paragraphs.map((p) => p).join("\n\n");
  }
  const used = new Set();
  const parts = [];
  for (const item of outline) {
    const heading = item.title.trim();
    if (!heading || used.has(heading.toLowerCase())) continue;
    used.add(heading.toLowerCase());
    const level = Math.min(3, Math.max(1, item.level || 1));
    parts.push(`${"#".repeat(level)} ${heading}`);
  }
  parts.push(paragraphs.join("\n\n"));
  return parts.join("\n\n");
}
