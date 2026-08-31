import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { tokenProductsMiddleware } from "./tokenProducts.mjs";
import {
  OPENAI_APPS_CHALLENGE_FALLBACK,
  OPENAI_CHALLENGE_PATH,
  isOpenaiChallengePath,
  loadCommittedChallengeToken,
  openaiAppsChallengeMiddleware,
  openaiChallengeToken,
} from "./openaiAppsChallenge.mjs";

const WELL_KNOWN = join(dirname(fileURLToPath(import.meta.url)), "../public/.well-known");
const TOKEN = "uOZcCcu1AJm20BTr-hGGVBOYqEKu4ZRyrsjCORAnwDA";

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk ?? "";
    },
  };
}

async function dispatch(url, method = "GET", opts = {}) {
  const middleware = tokenProductsMiddleware(opts);
  const res = mockRes();
  let nextCalled = false;
  await middleware({ method, url }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("committed well-known file is the public verification token", () => {
  const file = readFileSync(join(WELL_KNOWN, "openai-apps-challenge"), "utf8").trim();
  assert.equal(file, TOKEN);
  assert.equal(OPENAI_APPS_CHALLENGE_FALLBACK, TOKEN);
  assert.equal(loadCommittedChallengeToken(), TOKEN);
  assert.equal(isOpenaiChallengePath(OPENAI_CHALLENGE_PATH), true);
  assert.equal(isOpenaiChallengePath("/.well-known/openai-apps-challenge/"), true);
  assert.equal(isOpenaiChallengePath("/.well-known/x402"), false);
});

test("GET /.well-known/openai-apps-challenge is 200 text/plain with fallback when env is unset", async () => {
  assert.equal(openaiChallengeToken({}), TOKEN);

  const { res, nextCalled } = await dispatch(OPENAI_CHALLENGE_PATH, "GET", { env: {} });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /^text\/plain\b/);
  assert.equal(String(res.body).trim(), TOKEN);
  assert.equal(String(res.body), `${TOKEN}\n`);
});

test("GET /.well-known/openai-apps-challenge returns the env value when set", async () => {
  const custom = "env-override-token";
  assert.equal(openaiChallengeToken({ OPENAI_APPS_CHALLENGE: custom }), custom);
  assert.equal(openaiChallengeToken({ OPENAI_DOMAIN_VERIFICATION: custom }), custom);
  assert.equal(openaiChallengeToken({ OPENAI_APPS_CHALLENGE: "  padded  " }), "padded");

  const { res, nextCalled } = await dispatch(OPENAI_CHALLENGE_PATH, "GET", {
    env: { OPENAI_APPS_CHALLENGE: custom },
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /^text\/plain\b/);
  assert.equal(String(res.body).trim(), custom);
});

test("POST /mcp is unchanged when the challenge route is mounted", async () => {
  const middleware = tokenProductsMiddleware({ env: {} });
  const res = mockRes();
  let nextCalled = false;
  await middleware(
    {
      method: "POST",
      url: "/mcp",
      headers: { "content-type": "application/json" },
      body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.result.tools.length, 3);
  assert.deepEqual(
    payload.result.tools.map((t) => t.name),
    ["skim_read", "skim_extract", "skim_signals"],
  );
});

test("standalone challenge middleware skips other paths and answers HEAD", async () => {
  const middleware = openaiAppsChallengeMiddleware({ env: {} });
  const skipped = mockRes();
  let nextCalled = false;
  await middleware({ method: "GET", url: "/mcp" }, skipped, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  const withQuery = await dispatch(`${OPENAI_CHALLENGE_PATH}?x=1`, "GET", { env: {} });
  assert.equal(withQuery.nextCalled, false);
  assert.equal(withQuery.res.statusCode, 200);
  assert.equal(String(withQuery.res.body).trim(), TOKEN);

  const head = mockRes();
  await middleware({ method: "HEAD", url: OPENAI_CHALLENGE_PATH }, head, () => {
    throw new Error("HEAD should not fall through");
  });
  assert.equal(head.statusCode, 200);
  assert.match(head.headers["content-type"], /^text\/plain\b/);
  assert.equal(head.body, "");
});
