/**
 * Deterministic PDF → text / outline. No LLM. Text comes only from the file.
 * Handles uncompressed streams and FlateDecode; good enough for digital PDFs.
 *
 * Page content is the only text we keep. Embedded font programs (/Length1,
 * /FontFile), images, metadata, and object/xref streams often contain the
 * bytes "BT" or a quote mark by accident. Treating those as text operators
 * emits long runs of binary. A stream is read only when its own dictionary
 * is a content stream and the bytes contain Tj or TJ. Quote operators
 * outside a text object are ignored. Lines that are mostly control
 * characters are dropped.
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

// Windows-1252 bytes that are not the same Unicode scalar as Latin-1.
// PDF WinAnsi uses these for dashes, quotes, and similar glyphs.
const WIN1252_EXTRA = {
  0x80: "\u20ac",
  0x82: "\u201a",
  0x83: "\u0192",
  0x84: "\u201e",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02c6",
  0x89: "\u2030",
  0x8a: "\u0160",
  0x8b: "\u2039",
  0x8c: "\u0152",
  0x8e: "\u017d",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201c",
  0x94: "\u201d",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02dc",
  0x99: "\u2122",
  0x9a: "\u0161",
  0x9b: "\u203a",
  0x9c: "\u0153",
  0x9e: "\u017e",
  0x9f: "\u0178",
};

function toWinAnsiUnicode(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out += WIN1252_EXTRA[code] ?? text[i];
  }
  return out;
}

function decodeHexString(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const even = clean.length % 2 === 0 ? clean : `${clean}0`;
  let buf;
  try {
    buf = Buffer.from(even, "hex");
  } catch {
    return "";
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const payload = Buffer.from(buf.subarray(2));
    const evenPayload = payload.length % 2 === 0 ? payload : Buffer.concat([payload, Buffer.from([0])]);
    try {
      return Buffer.from(evenPayload).swap16().toString("utf16le");
    } catch {
      return toWinAnsiUnicode(buf.toString("latin1"));
    }
  }
  return toWinAnsiUnicode(buf.toString("latin1"));
}

function tokenizeContent(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "%") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\0") {
      i += 1;
      continue;
    }
    if (c === "(") {
      i += 1;
      let raw = "";
      while (i < src.length) {
        if (src[i] === "\\") {
          raw += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (src[i] === ")") {
          i += 1;
          break;
        }
        raw += src[i];
        i += 1;
      }
      tokens.push({ t: "str", v: toWinAnsiUnicode(decodeLiteral(raw)) });
      continue;
    }
    if (c === "<") {
      if (src[i + 1] === "<") {
        tokens.push({ t: "op", v: "<<" });
        i += 2;
        continue;
      }
      const hex = /^<[0-9A-Fa-f\s]*>/.exec(src.slice(i));
      if (hex) {
        tokens.push({ t: "str", v: decodeHexString(hex[0].slice(1, -1)) });
        i += hex[0].length;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === ">") {
      if (src[i + 1] === ">") {
        tokens.push({ t: "op", v: ">>" });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === "[" || c === "]") {
      tokens.push({ t: "op", v: c });
      i += 1;
      continue;
    }
    const num = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)/.exec(src.slice(i));
    if (num && num[0] !== "+" && num[0] !== "-") {
      tokens.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    if (c === "/") {
      const name = /^\/[^\s[\]<>()/%]+/.exec(src.slice(i));
      if (name) {
        tokens.push({ t: "name", v: name[0] });
        i += name[0].length;
        continue;
      }
    }
    const ident = /^[A-Za-z*'"][A-Za-z0-9*'"]*/.exec(src.slice(i));
    if (ident) {
      tokens.push({ t: "op", v: ident[0] });
      i += ident[0].length;
      continue;
    }
    i += 1;
  }
  return tokens;
}

/**
 * Reading-order lines from a content stream.
 * Text showing operators are kept in stream order and joined on the same
 * baseline, so a word split across TJ kerning runs ("Novem" + "ber") and a
 * number split across Tj runs ("10:" + "3" + "0") stay intact.
 */
export function extractStringsFromContent(content) {
  const src = typeof content === "string" ? content : content.toString("latin1");
  const tokens = tokenizeContent(src);
  const lines = [];
  let buf = "";
  let y = 0;
  let anchorY = null;
  let renderMode = 0;
  let leading = 0;
  let inText = false;
  const nums = [];
  let array = null;
  let pendingArray = null;
  let lastStr = "";

  function flush() {
    const cleaned = buf.replace(/[ \t\f\v]+/g, " ").trim();
    if (cleaned) lines.push(cleaned);
    buf = "";
    anchorY = null;
  }

  function append(text) {
    if (renderMode === 3 || !text) return;
    if (anchorY !== null && Math.abs(y - anchorY) > 0.75) flush();
    if (anchorY === null) anchorY = y;
    buf += text;
  }

  function takeNums(count) {
    const got = nums.splice(Math.max(0, nums.length - count), count);
    while (got.length < count) got.unshift(0);
    return got;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.t === "num") {
      if (array) array.push(tok.v);
      else nums.push(tok.v);
      continue;
    }
    if (tok.t === "str") {
      if (array) array.push(tok.v);
      else lastStr = tok.v;
      continue;
    }
    if (tok.t !== "op") continue;
    if (tok.v === "BT") {
      inText = true;
      continue;
    }
    if (tok.v === "ET") {
      flush();
      inText = false;
      lastStr = "";
      pendingArray = null;
      continue;
    }
    if (tok.v === "[") {
      array = [];
      continue;
    }
    if (tok.v === "]") {
      pendingArray = array;
      array = null;
      continue;
    }
    if (tok.v === "TJ") {
      const items = pendingArray || [];
      pendingArray = null;
      let text = "";
      for (const item of items) {
        if (typeof item === "string") text += item;
        else if (typeof item === "number" && item <= -80) text += " ";
      }
      append(text);
      nums.length = 0;
      continue;
    }
    if (tok.v === "Tj") {
      append(lastStr);
      lastStr = "";
      nums.length = 0;
      continue;
    }
    // Quote operators show a string and move to the next line. Outside a
    // text object they are just bytes inside a font or image stream.
    if (tok.v === "'" || tok.v === '"') {
      if (inText) {
        y -= leading || 1;
        append(lastStr);
      }
      lastStr = "";
      nums.length = 0;
      continue;
    }
    if (tok.v === "Td" || tok.v === "TD") {
      const [tx, ty] = takeNums(2);
      void tx;
      if (Math.abs(ty) > 0.75) y += ty;
      if (tok.v === "TD" && ty) leading = Math.abs(ty);
      nums.length = 0;
      continue;
    }
    if (tok.v === "Tm") {
      const n = takeNums(6);
      y = n[5];
      nums.length = 0;
      continue;
    }
    if (tok.v === "T*") {
      y -= leading || 1;
      continue;
    }
    if (tok.v === "Tr") {
      renderMode = nums.length ? nums[nums.length - 1] : 0;
      nums.length = 0;
      continue;
    }
    if (tok.v === "TL") {
      leading = Math.abs(nums.length ? nums[nums.length - 1] : leading);
      nums.length = 0;
      continue;
    }
    if (/^[A-Za-z]/.test(tok.v)) nums.length = 0;
  }
  flush();
  return rejoinWrappedWords(lines);
}

function rejoinWrappedWords(lines) {
  const out = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && /[A-Za-z]-$/.test(prev) && /^[a-z]/.test(line)) {
      out[out.length - 1] = `${prev.slice(0, -1)}${line}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

/** C0 except tab/LF/CR, C1 controls, and U+FFFD. */
export function controlCharCount(text) {
  let count = 0;
  for (const ch of String(text || "")) {
    const code = ch.codePointAt(0);
    if (code === 0xfffd) count += 1;
    else if (code < 32 && code !== 9 && code !== 10 && code !== 13) count += 1;
    else if (code >= 0x7f && code <= 0x9f) count += 1;
  }
  return count;
}

export function junkRatio(text) {
  const value = String(text || "");
  if (!value.length) return 0;
  return controlCharCount(value) / value.length;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/g;

/**
 * Font and image bytes that leak into a text line are mostly controls.
 * A bullet or one bad byte on a real sentence is not. Strip the rare
 * controls; drop the line when they dominate it.
 */
function sanitizeLine(text) {
  const junk = controlCharCount(text);
  if (!junk) return text;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const ratio = junk / text.length;
  if (ratio > 0.15) return "";
  if (junk >= 8 && letters / text.length < 0.4) return "";
  if (letters === 0) return "";
  return text.replace(CONTROL_CHARS, "");
}

/** Font programs, images, metadata, and compressed object streams are not page text. */
function isNonTextStream(dict) {
  const header = dict || "";
  if (/\/Length1\b/.test(header)) return true;
  if (/\/FontFile\d?\b/.test(header)) return true;
  if (/\/Subtype\s*\/Image\b/.test(header)) return true;
  if (/\/Subtype\s*\/XML\b/.test(header)) return true;
  if (/\/Type\s*\/Metadata\b/.test(header)) return true;
  if (/\/Type\s*\/XRef\b/.test(header)) return true;
  if (/\/Type\s*\/ObjStm\b/.test(header)) return true;
  return false;
}

function looksLikePageContent(latin) {
  // TJ/Tj are the text-showing operators. Some page streams omit BT and
  // still contain TJ. A bare "BT" or a quote byte is not enough: font
  // programs contain those by accident.
  return /\bTj\b/.test(latin) || /\bTJ\b/.test(latin);
}

/** Dictionary that belongs to this stream, not the previous object. */
function streamDict(src, streamIndex) {
  let end = streamIndex - 1;
  while (end >= 0 && /\s/.test(src[end])) end -= 1;
  if (end < 1 || src[end] !== ">" || src[end - 1] !== ">") {
    return src.slice(Math.max(0, streamIndex - 400), streamIndex);
  }
  let depth = 0;
  for (let i = end; i >= 1; i -= 1) {
    if (src[i] === ">" && src[i - 1] === ">") {
      depth += 1;
      i -= 1;
      continue;
    }
    if (src[i] === "<" && src[i - 1] === "<") {
      depth -= 1;
      if (depth === 0) return src.slice(i - 1, end + 1);
      i -= 1;
    }
  }
  return src.slice(Math.max(0, streamIndex - 400), streamIndex);
}

function collectStreams(buffer) {
  const src = buffer.toString("latin1");
  const streams = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let match;
  while ((match = re.exec(src))) {
    const before = streamDict(src, match.index);
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
    if (isNonTextStream(stream.before)) continue;
    let bytes = stream.raw;
    if (stream.flate) {
      const inflated = inflateStream(bytes);
      if (!inflated) continue;
      bytes = inflated;
    }
    const latin = bytes.toString("latin1");
    if (!looksLikePageContent(latin)) continue;
    const strings = extractStringsFromContent(latin);
    for (const s of strings) {
      const cleaned = sanitizeLine(s.replace(/\s+/g, " ").trim());
      if (cleaned) lines.push(cleaned);
    }
  }

  if (lines.length === 0) {
    const whole = buffer.toString("latin1");
    if (looksLikePageContent(whole)) {
      const fallback = extractStringsFromContent(whole);
      for (const s of fallback) {
        const cleaned = sanitizeLine(s.replace(/\s+/g, " ").trim());
        if (cleaned) lines.push(cleaned);
      }
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
