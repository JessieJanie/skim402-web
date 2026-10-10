import assert from "node:assert/strict";
import { test } from "node:test";
import { selectReaderHtml } from "./renderDom.mjs";

test("prefers shadow HTML when it contains the text outerHTML missed", () => {
  const outer = "<html><body><p>Loading...</p></body></html>";
  const shadow = `<html><body><p>${"Shipping in Chrome 140 under Blink DOM. ".repeat(30)}</p></body></html>`;
  assert.equal(selectReaderHtml(outer, shadow), shadow);
});

test("keeps light-DOM HTML when it already holds the article", () => {
  const outer = `<html><body><p>${"Use the api key special-key to test authorization. ".repeat(40)}</p></body></html>`;
  const shadow = "<html><body><p>Authorize</p><p>Pets</p></body></html>";
  assert.equal(selectReaderHtml(outer, shadow), outer);
});
