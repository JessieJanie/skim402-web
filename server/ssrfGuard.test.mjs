import assert from "node:assert/strict";
import { test } from "node:test";
import { isDisallowedTarget } from "./mcpHttp.mjs";
import { safeFetch } from "./http.mjs";
import { dispatcherLookup, isBlockedUrl, isPublicAddress, vetPublicUrl } from "./ssrfGuard.mjs";

const BLOCKED = [
  "http://[::1]/",
  "http://[::]/",
  "http://127.0.0.1/",
  "http://127.0.0.2/",
  "http://127.255.255.255/",
  "http://127.1/",
  "http://0177.0.0.1/",
  "http://2130706433/",
  "http://10.0.0.4/",
  "http://192.168.1.9/",
  "http://172.16.0.2/",
  "http://169.254.0.1/",
  "http://169.254.170.2/",
  "http://169.254.169.254/latest/meta-data",
  "http://100.64.0.1/",
  "http://100.100.100.200/",
  "http://100.127.255.255/",
  "http://0.0.0.0/",
  "http://0.0.0.1/",
  "http://0.255.255.255/",
  "http://224.0.0.1/",
  "http://240.0.0.1/",
  "http://255.255.255.255/",
  "http://192.0.2.1/",
  "http://198.18.0.1/",
  "http://[fd00::1]/",
  "http://[fc00::1]/",
  "http://[fe80::1]/",
  "http://[fec0::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://[::ffff:10.0.0.1]/",
  "http://[::ffff:169.254.169.254]/",
  "http://[::127.0.0.1]/",
  "http://[::7f00:1]/",
  "http://[2002:7f00:1::]/",
  "http://[64:ff9b::7f00:1]/",
  "http://[2001:db8::1]/",
  "http://[ff02::1]/",
  "http://localhost/secret",
  "http://app.localhost/",
  "http://printer.local/",
  "http://db.internal/",
  "http://metadata.google.internal/",
  "ftp://example.com/file",
  "not-a-url",
];

const ALLOWED = [
  "https://example.com/x",
  "https://1.1.1.1/",
  "https://8.8.8.8/",
  "http://172.15.255.255/",
  "http://172.32.0.1/",
  "http://192.169.1.1/",
  "http://11.0.0.1/",
  "http://100.63.255.255/",
  "http://100.128.0.1/",
  "http://[2606:4700:4700::1111]/",
  "http://[::ffff:8.8.8.8]/",
];

function records(address, family = address.includes(":") ? 6 : 4) {
  return async () => [{ address, family }];
}

function pinned(dispatcher) {
  return new Promise((resolve, reject) => {
    const lookup = dispatcherLookup(dispatcher);
    lookup("ignored.example", { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

test("literal bypasses are blocked and public addresses are allowed", () => {
  for (const url of BLOCKED) {
    assert.equal(isBlockedUrl(url), true, url);
    assert.equal(isDisallowedTarget(url), true, url);
  }
  for (const url of ALLOWED) {
    assert.equal(isBlockedUrl(url), false, url);
    assert.equal(isDisallowedTarget(url), false, url);
  }
  assert.equal(isPublicAddress("::ffff:7f00:1"), false);
  assert.equal(isPublicAddress("::7f00:1"), false);
  assert.equal(isPublicAddress("::ffff:8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("DNS answers are judged across every A and AAAA record", async () => {
  const blockedAnswers = [
    ["127.0.0.1.nip.io", "127.0.0.1"],
    ["loopback.example", "127.0.0.2"],
    ["ten.example", "10.1.2.3"],
    ["link.example", "169.254.170.2"],
    ["meta.example", "169.254.169.254"],
    ["cgnat.example", "100.100.100.200"],
    ["unspec.example", "0.0.0.1"],
    ["mapped.example", "::ffff:127.0.0.1"],
    ["ula.example", "fd00::1"],
    ["v6loop.example", "::1"],
  ];
  for (const [host, address] of blockedAnswers) {
    let called = 0;
    const fetchImpl = async () => {
      called += 1;
      return new Response("nope");
    };
    const result = await safeFetch(fetchImpl, `http://${host}/secret`, { lookup: records(address) });
    assert.equal(result.blocked, true, host);
    assert.equal(called, 0, host);
  }

  const mixed = await vetPublicUrl("http://mixed.example/", {
    lookup: async () => [
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ],
  });
  assert.equal(mixed.ok, false);

  const v6mixed = await vetPublicUrl("http://mixed6.example/", {
    lookup: async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "fd00::1", family: 6 },
    ],
  });
  assert.equal(v6mixed.ok, false);

  const failed = await vetPublicUrl("http://down.example/", {
    lookup: async () => {
      throw new Error("servfail");
    },
  });
  assert.equal(failed.ok, false);

  const empty = await vetPublicUrl("http://empty.example/", {
    lookup: async () => [],
  });
  assert.equal(empty.ok, false);

  const allowed = await vetPublicUrl("https://public.example/a", { lookup: records("1.1.1.1") });
  assert.equal(allowed.ok, true);
  assert.deepEqual(allowed.addresses, [{ address: "1.1.1.1", family: 4 }]);
});

test("the connection is pinned to the vetted addresses", async () => {
  let lookups = 0;
  const lookup = async (hostname) => {
    lookups += 1;
    assert.equal(hostname, "public.example");
    return lookups === 1
      ? [{ address: "1.1.1.1", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };
  const fetchImpl = async (_url, init) => {
    const addresses = await pinned(init.dispatcher);
    assert.deepEqual(addresses, [{ address: "1.1.1.1", family: 4 }]);
    assert.equal(lookups, 1);
    return new Response("ok", { status: 200 });
  };
  const result = await safeFetch(fetchImpl, "https://public.example/a", { lookup });
  assert.equal(result.status, 200);
  assert.equal(result.buffer.toString(), "ok");
  assert.equal(result.url, "https://public.example/a");
  assert.equal(lookups, 1);
});

test("each redirect hop is vetted and pinned on its own", async () => {
  const lookup = async (hostname) => {
    if (hostname === "a.example") return [{ address: "1.1.1.1", family: 4 }];
    if (hostname === "b.example") return [{ address: "8.8.8.8", family: 4 }];
    if (hostname === "evil.example") return [{ address: "169.254.169.254", family: 4 }];
    throw new Error(hostname);
  };
  const hops = [];
  const fetchImpl = async (url, init) => {
    const addresses = await pinned(init.dispatcher);
    hops.push({ url, address: addresses[0].address });
    if (hops.length === 1) {
      return new Response(null, { status: 302, headers: { location: "https://b.example/next" } });
    }
    return new Response("done", { status: 200 });
  };
  const ok = await safeFetch(fetchImpl, "https://a.example/start", { lookup });
  assert.equal(ok.status, 200);
  assert.equal(ok.buffer.toString(), "done");
  assert.equal(ok.url, "https://b.example/next");
  assert.deepEqual(
    hops.map((hop) => hop.address),
    ["1.1.1.1", "8.8.8.8"],
  );

  let calls = 0;
  const blocked = await safeFetch(
    async (url, init) => {
      calls += 1;
      assert.equal((await pinned(init.dispatcher))[0].address, "1.1.1.1");
      return new Response(null, { status: 302, headers: { location: "http://evil.example/meta" } });
    },
    "https://a.example/start",
    { lookup },
  );
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.url, "http://evil.example/meta");
  assert.equal(calls, 1);
});

test("size limit and timeout still apply to public fetches", async () => {
  const lookup = records("1.1.1.1");
  const huge = await safeFetch(
    async () => new Response("hello", { status: 200, headers: { "content-length": "100" } }),
    "https://public.example/big",
    { lookup, maxBytes: 10 },
  );
  assert.equal(huge.tooLarge, true);
  assert.equal(huge.contentLength, 100);

  const slow = await safeFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    "https://public.example/slow",
    { lookup, timeoutMs: 30 },
  );
  assert.equal(typeof slow.error, "string");
  assert.match(slow.error, /aborted/);
});
