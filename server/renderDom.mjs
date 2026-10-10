/**
 * Headless Chrome's outerHTML omits open shadow roots, and moving those nodes
 * into light DOM makes Lit rebuild the view and wipe the copy. Walk the tree
 * (including open shadow roots) and return HTML instead. Closed shadow roots
 * stay hidden.
 *
 * Production JS read (/api/t/read/js) should use this string as the page HTML
 * passed to htmlToMarkdown. Credit amounts are unchanged.
 */

export const SERIALIZE_SHADOW_TREE_SOURCE = `function serializeShadowTree(node) {
  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function serialize(current) {
    if (!current) return "";
    if (current.nodeType === 3) return esc(current.textContent);
    if (current.nodeType !== 1) return "";
    const tag = current.tagName;
    if (tag === "STYLE" || tag === "SCRIPT" || tag === "NOSCRIPT" || tag === "SVG") return "";
    let inner = "";
    for (const child of current.childNodes) inner += serialize(child);
    if (current.shadowRoot) {
      for (const child of current.shadowRoot.childNodes) inner += serialize(child);
    }
    if (!inner.trim()) return "";
    const kept = ["class", "id", "role", "aria-label", "title", "href"];
    let attrs = "";
    for (const name of kept) {
      const value = current.getAttribute && current.getAttribute(name);
      if (value) attrs += " " + name + '="' + esc(value) + '"';
    }
    const emit = (tag === "A" || tag === "TABLE" || tag === "THEAD" || tag === "TBODY" || tag === "TR" || tag === "TH" || tag === "TD" || tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "LI" || tag === "UL" || tag === "OL" || tag === "ASIDE" || tag === "DETAILS" || tag === "SUMMARY")
      ? tag.toLowerCase()
      : "div";
    return "<" + emit + attrs + ">" + inner + "</" + emit + ">";
  }
  const title = esc(document.title || "");
  return "<!doctype html><html><head><title>" + title + "</title></head><body>" + serialize(node || document.body) + "</body></html>";
}`;

export function serializeShadowTreeExpression() {
  return `${SERIALIZE_SHADOW_TREE_SOURCE}\nserializeShadowTree(document.body);`;
}

function visibleText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * outerHTML is enough for ordinary documents. Shadow serialization is longer
 * when the readable text lives in open shadow roots (Chrome Status). Prefer
 * that copy only when it actually adds text, so a light-DOM page keeps its
 * original markup.
 */
export function selectReaderHtml(outerHtml, shadowHtml) {
  const outer = String(outerHtml || "");
  const shadow = String(shadowHtml || "");
  if (!shadow.trim()) return outer;
  if (!outer.trim()) return shadow;
  const outerText = visibleText(outer);
  const shadowText = visibleText(shadow);
  if (shadowText.length > outerText.length + 400 && shadowText.length > outerText.length * 1.2) {
    return shadow;
  }
  return outer;
}
