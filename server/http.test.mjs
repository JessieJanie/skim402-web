import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getBearerToken,
  isBlockedUrl,
  isHttpsUrl,
  remainingCredits,
  signBody,
  signaturesMatch,
  sameOrigin,
} from "./http.mjs";

test("SSRF blocks loopback, private, and metadata hosts", () => {
  assert.equal(isBlockedUrl("https://example.com/x"), false);
  assert.equal(isBlockedUrl("http://localhost/secret"), true);
  assert.equal(isBlockedUrl("http://127.0.0.1/"), true);
  assert.equal(isBlockedUrl("http://10.0.0.4/"), true);
  assert.equal(isBlockedUrl("http://192.168.1.9/"), true);
  assert.equal(isBlockedUrl("http://172.16.0.2/"), true);
  assert.equal(isBlockedUrl("http://169.254.169.254/latest/meta-data"), true);
  assert.equal(isBlockedUrl("http://metadata.google.internal/"), true);
  assert.equal(isBlockedUrl("not-a-url"), true);
  assert.equal(isBlockedUrl("ftp://example.com/file"), true);
});

test("Bearer and x-skim-token are accepted", () => {
  assert.equal(getBearerToken({ authorization: "Bearer sk402_abc" }), "sk402_abc");
  assert.equal(getBearerToken({ "x-skim-token": "sk402_abc" }), "sk402_abc");
  assert.equal(getBearerToken({ authorization: "Bearer nope" }), null);
});

test("webhook URLs must be https and public", () => {
  assert.equal(isHttpsUrl("https://hooks.example.com/skim"), true);
  assert.equal(isHttpsUrl("http://hooks.example.com/skim"), false);
  assert.equal(isBlockedUrl("https://127.0.0.1/hook"), true);
});

test("HMAC signatures verify with timing-safe compare", () => {
  const raw = JSON.stringify({ watchId: "w_1", status: "changed" });
  const hex = signBody("whsec_test", raw);
  assert.equal(signaturesMatch("whsec_test", raw, hex), true);
  assert.equal(signaturesMatch("whsec_test", raw, `sha256=${hex}`), true);
  assert.equal(signaturesMatch("whsec_other", raw, hex), false);
});

test("remainingCredits reads common account shapes", () => {
  assert.equal(remainingCredits({ creditsRemaining: 12 }), 12);
  assert.equal(remainingCredits({ monthlyCredits: 10, packCredits: 2 }), 12);
  assert.equal(remainingCredits({ planCredits: 10, packCredits: 2 }), 12);
  assert.equal(remainingCredits({ packCredits: 1000, planCredits: 0 }), 1000);
  assert.equal(remainingCredits({}), null);
});

test("sameOrigin compares protocol + host", () => {
  assert.equal(sameOrigin("https://a.com/x", "https://a.com/y"), true);
  assert.equal(sameOrigin("https://a.com/x", "http://a.com/y"), false);
  assert.equal(sameOrigin("https://a.com/x", "https://b.com/x"), false);
});
