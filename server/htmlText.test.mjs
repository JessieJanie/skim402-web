import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTENT_TRUNCATED_MARKER,
  htmlToMarkdown,
  MAX_MARKDOWN_CHARS,
} from "./htmlText.mjs";

function page(body, title = "Fixture") {
  return `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;
}

test("keeps a large data table readability would drop for a header class", () => {
  const html = page(`
    <p>${"Background on the periodic table. ".repeat(40)}</p>
    <table class="wikitable sortable sticky-header-multi">
      <tr><th>Z</th><th>Symbol</th><th>Name</th><th>Density</th><th>Melt</th></tr>
      <tr><td>1</td><td>H</td><td>Hydrogen</td><td>0.00008988</td><td>14.01</td></tr>
      <tr><td>79</td><td>Au</td><td>Gold</td><td>19.3</td><td>1<span style="margin-left:.25em">337</span>.33<style>.x{}</style></td></tr>
      <tr><td>2</td><td>He</td><td>Helium</td><td>0.0001785</td><td>0.95</td></tr>
    </table>
  `, "List of chemical elements");
  const out = htmlToMarkdown(html, { url: "https://en.wikipedia.org/wiki/List_of_chemical_elements" });
  assert.match(out.markdown, /1337\.33/);
  assert.match(out.markdown, /19\.3/);
  assert.match(out.markdown, /\| 79 \| Au \| Gold \|/);
  assert.equal(out.markdown.includes("1 337"), false);
  assert.equal(out.truncated, false);
});

test("keeps a release list classed as a menu", () => {
  const html = page(`
    <article><p>${"Python downloads page intro. ".repeat(30)}</p></article>
    <ol class="list-row-container menu">
      <li>
        <span class="release-version">3.12</span>
        <span class="release-status">security</span>
        <span class="release-start">2023-10-02</span>
        <span class="release-end">2028-10</span>
        <span class="release-pep">PEP 693</span>
      </li>
      <li>
        <span class="release-version">3.11</span>
        <span class="release-status">security</span>
        <span class="release-start">2022-10-24</span>
        <span class="release-end">2027-10</span>
        <span class="release-pep">PEP 664</span>
      </li>
    </ol>
  `, "Python downloads");
  const out = htmlToMarkdown(html, { url: "https://www.python.org/downloads/" });
  assert.match(out.markdown, /2023-10-02/);
  assert.match(out.markdown, /2028-10/);
  assert.match(out.markdown, /693/);
  assert.match(out.markdown, /security/);
});

test("keeps the first doc summary and availability, not every symbol abstract", () => {
  const html = page(`
    <article>
      <p>${"Array stores elements in order. ".repeat(25)}</p>
    </article>
    <div class="sidebar">
      <div class="abstract"><p>An ordered, random-access collection.</p></div>
      <div class="abstract"><p>Creates a new array.</p></div>
      <aside class="availability" aria-label="Availability">
        <p>iOS 8.0+</p>
        <p>macOS 10.10+</p>
      </aside>
    </div>
  `, "Array");
  const out = htmlToMarkdown(html, { url: "https://developer.apple.com/documentation/swift/array" });
  assert.match(out.markdown, /random-access/);
  assert.match(out.markdown, /10\.10/);
  assert.equal(out.markdown.includes("Creates a new array"), false);
});

test("keeps a short license link and publisher line outside the article", () => {
  const html = page(`
    <article><p>${"Python language support for Visual Studio Code. ".repeat(20)}</p></article>
    <p>Published by open-vsx</p>
    <a title="License type" href="/licenses/MIT">MIT</a>
  `, "Python");
  const out = htmlToMarkdown(html, { url: "https://open-vsx.org/extension/ms-python/python" });
  assert.match(out.markdown, /open-vsx/);
  assert.match(out.markdown, /MIT/);
  assert.match(out.markdown, /Published by/);
});

test("emits a layout-table essay once", () => {
  const lead = "If you collected lists of techniques for doing great work, start at the frontier, notice a gap, and explore it.";
  const html = page(`
    <table>
      <tr><td><img alt="essay"></td><td>
        <p>${lead}</p>
        <p>${"The work continues through careful practice and revision. ".repeat(40)}</p>
      </td></tr>
      <tr><td>July 2023</td><td>Notes</td></tr>
    </table>
  `, "How to Do Great Work");
  const out = htmlToMarkdown(html, { url: "https://paulgraham.com/greatwork.html" });
  const copies = out.markdown.split("If you collected lists of techniques").length - 1;
  assert.equal(copies, 1);
  assert.match(out.markdown, /frontier/);
  const plain = out.markdown.replace(/[#>*_`|]/g, " ").replace(/\s+/g, " ").trim();
  assert.ok(out.markdown.length < plain.length * 2);
});

test("drops navigation chrome", () => {
  const html = page(`
    <nav><ul><li>Login</li><li>Pricing</li><li>Cookie settings</li></ul></nav>
    <article>
      <h1>The Joel Test</h1>
      <p>${"Do you do hallway usability testing? A score of 11 is tolerable. ".repeat(20)}</p>
    </article>
  `, "The Joel Test");
  const out = htmlToMarkdown(html, { url: "https://www.joelonsoftware.com/joel-test" });
  assert.match(out.markdown, /hallway/);
  assert.equal(/\bLogin\b/.test(out.markdown), false);
  assert.equal(out.markdown.includes("Cookie settings"), false);
});

test("expands declarative shadow roots into the markdown", () => {
  const html = page(`
    <article>
      <h1>ToggleEvent source attribute</h1>
      <div>
        <template shadowrootmode="open">
          <p>Ships in Chrome 140. Component: Blink&gt;DOM.</p>
        </template>
      </div>
      <p>${"Feature status details for this Chrome platform change. ".repeat(20)}</p>
    </article>
  `, "ToggleEvent source attribute");
  const out = htmlToMarkdown(html, { url: "https://chromestatus.com/feature/5165304401100800" });
  assert.match(out.markdown, /140/);
  assert.match(out.markdown, /DOM/);
});

test("prepends a title version that is not in the body", () => {
  const html = page(
    `<p>Use the special-key to test authorization filters. Base URL petstore.swagger.io/v2.</p>`,
    "Swagger Petstore 1.0.7 OAS 2.0",
  );
  const out = htmlToMarkdown(html, { url: "https://petstore.swagger.io/" });
  assert.match(out.markdown, /1\.0\.7/);
  assert.match(out.markdown, /special-key/);
});

test("truncates oversized markdown with an explicit marker", () => {
  const paragraph = `<p>HEADMARKER_START ${"word ".repeat(120)}</p>`;
  const html = page(`${paragraph.repeat(1600)}<p>TAILMARKER_END</p>`, "Long");
  const out = htmlToMarkdown(html, { url: "https://example.com/long" });
  assert.equal(out.truncated, true);
  assert.ok(out.markdown.includes(CONTENT_TRUNCATED_MARKER.trim()));
  assert.ok(out.markdown.includes("HEADMARKER_START"));
  assert.equal(out.markdown.includes("TAILMARKER_END"), false);
  assert.ok(out.markdown.length <= MAX_MARKDOWN_CHARS + 8);
});
