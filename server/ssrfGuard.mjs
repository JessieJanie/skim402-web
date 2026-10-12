/**
 * Shared SSRF guard for every server-side fetch of a user-supplied URL.
 *
 * A hostname string is not evidence. The guard resolves every A and AAAA
 * record, rejects the target if any address is non-public, and returns a
 * dispatcher whose connect lookup answers with those vetted addresses only.
 * The TCP connection therefore cannot be swung onto a different IP by DNS
 * rebinding between the check and the connect.
 */

import { lookup as dnsLookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent } from "undici";

const pinnedLookups = new WeakMap();

const BLOCKED_NAMES = new Set(["localhost", "metadata.google.internal"]);

function canonicalHostname(hostname) {
  let host = String(hostname ?? "").trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".")) host = host.slice(0, -1);
  const zone = host.indexOf("%");
  if (zone !== -1) host = host.slice(0, zone);
  return host;
}

function decimalToDotted(hostname) {
  if (!/^\d+$/.test(hostname)) return null;
  const value = Number(hostname);
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null;
  return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`;
}

/** IPv4-compatible form (::x.x.x.x), excluding :: and ::1. */
function ipv4FromCompatible(addr) {
  if (addr.kind() !== "ipv6" || addr.isIPv4MappedAddress()) return null;
  const parts = addr.parts;
  for (let i = 0; i < 6; i += 1) {
    if (parts[i] !== 0) return null;
  }
  if (parts[6] === 0 && (parts[7] === 0 || parts[7] === 1)) return null;
  const hi = parts[6];
  const lo = parts[7];
  return ipaddr.fromByteArray([(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255]);
}

function unwrapAddress(addr) {
  if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) return addr.toIPv4Address();
  const compatible = addr.kind() === "ipv6" ? ipv4FromCompatible(addr) : null;
  return compatible ?? addr;
}

function parseAddress(ip) {
  try {
    return ipaddr.parse(String(ip));
  } catch {
    return null;
  }
}

/** True when the address is global unicast. Mapped and compatible forms are judged as the embedded IPv4. */
export function isPublicAddress(ip) {
  const parsed = parseAddress(ip);
  if (!parsed) return false;
  return unwrapAddress(parsed).range() === "unicast";
}

function isIpLiteral(hostname) {
  return parseAddress(hostname) !== null;
}

function isBlockedName(hostname) {
  if (!hostname) return true;
  if (BLOCKED_NAMES.has(hostname)) return true;
  if (hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname.endsWith(".internal")) return true;
  return false;
}

/** Sync literal check: scheme, blocked names, and IP literals. Hostnames are resolved by vetPublicUrl. */
export function isBlockedUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) return true;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  return isBlockedHostname(parsed.hostname);
}

export function isBlockedHostname(hostname) {
  const host = canonicalHostname(hostname);
  if (isBlockedName(host)) return true;
  const dotted = decimalToDotted(host);
  const candidate = dotted ?? host;
  if (!isIpLiteral(candidate)) return false;
  return !isPublicAddress(candidate);
}

function literalAddresses(hostname) {
  const dotted = decimalToDotted(hostname);
  const candidate = dotted ?? hostname;
  const parsed = parseAddress(candidate);
  if (!parsed) return null;
  const addr = unwrapAddress(parsed);
  if (addr.range() !== "unicast") return { blocked: true };
  const family = addr.kind() === "ipv6" ? 6 : 4;
  return { blocked: false, addresses: [{ address: addr.toString(), family }] };
}

function normalizeRecords(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  for (const item of list) {
    if (typeof item === "string") {
      const family = item.includes(":") ? 6 : 4;
      out.push({ address: item, family });
      continue;
    }
    if (item && typeof item.address === "string") {
      const address = item.address;
      const family = item.family === 6 || item.family === 4 ? item.family : address.includes(":") ? 6 : 4;
      out.push({ address, family });
    }
  }
  return out;
}

function resolveAll(hostname, lookup = dnsLookup) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(normalizeRecords(value));
    };
    let returned;
    try {
      returned = lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
        if (err) finish(err);
        else finish(null, addresses);
      });
    } catch (err) {
      finish(err);
      return;
    }
    if (returned && typeof returned.then === "function") {
      returned.then((addresses) => finish(null, addresses), finish);
    }
  });
}

function withTimeout(promise, ms) {
  if (!ms || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dns timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function vettedRecord(record) {
  const parsed = parseAddress(record.address);
  if (!parsed || unwrapAddress(parsed).range() !== "unicast") return null;
  const addr = unwrapAddress(parsed);
  return { address: addr.toString(), family: addr.kind() === "ipv6" ? 6 : 4 };
}

/**
 * Resolve and classify a URL. Fails closed: a lookup error, an empty answer,
 * or any non-public record rejects the whole target.
 */
export async function vetPublicUrl(raw, opts = {}) {
  if (isBlockedUrl(raw)) return { ok: false, blocked: true };
  const parsed = new URL(String(raw).trim());
  const hostname = canonicalHostname(parsed.hostname);
  const literal = literalAddresses(hostname);
  if (literal) {
    if (literal.blocked) return { ok: false, blocked: true };
    return { ok: true, url: parsed.href, hostname, addresses: literal.addresses };
  }
  let records;
  try {
    records = await withTimeout(resolveAll(hostname, opts.lookup), opts.timeoutMs ?? 5_000);
  } catch {
    return { ok: false, blocked: true };
  }
  if (records.length === 0) return { ok: false, blocked: true };
  const addresses = [];
  for (const record of records) {
    const vetted = vettedRecord(record);
    if (!vetted) return { ok: false, blocked: true };
    addresses.push(vetted);
  }
  return { ok: true, url: parsed.href, hostname, addresses };
}

/** dns.lookup-shaped function that never queries DNS. It returns the addresses already vetted. */
export function pinnedLookup(addresses) {
  const records = addresses.map((entry) => ({ address: entry.address, family: entry.family }));
  return function lookup(_hostname, options, callback) {
    let opts = options;
    let done = callback;
    if (typeof options === "function") {
      done = options;
      opts = {};
    }
    if (opts && opts.all) {
      done(null, records.map((entry) => ({ address: entry.address, family: entry.family })));
      return;
    }
    const first = records[0];
    done(null, first.address, first.family);
  };
}

export function createPinnedDispatcher(addresses) {
  const lookup = pinnedLookup(addresses);
  const agent = new Agent({ connect: { lookup } });
  pinnedLookups.set(agent, lookup);
  return agent;
}

export function dispatcherLookup(dispatcher) {
  return pinnedLookups.get(dispatcher) ?? null;
}

export async function closeDispatcher(dispatcher) {
  if (!dispatcher || typeof dispatcher.close !== "function") return;
  try {
    await dispatcher.close();
  } catch {
    // already closed
  }
}

async function drainResponse(response) {
  if (!response) return;
  try {
    if (response.body && typeof response.body.cancel === "function") {
      await response.body.cancel();
      return;
    }
    if (typeof response.arrayBuffer === "function") await response.arrayBuffer();
  } catch {
    // ignore cancel errors
  }
}

/**
 * One HTTP request to a user URL. The dispatcher pins the socket to the
 * addresses vetPublicUrl just accepted.
 */
export async function connectPublic(fetchImpl, rawUrl, init = {}, opts = {}) {
  const verdict = await vetPublicUrl(rawUrl, opts);
  if (!verdict.ok) return { blocked: true, url: rawUrl };
  const dispatcher = createPinnedDispatcher(verdict.addresses);
  try {
    const response = await fetchImpl(verdict.url, { ...init, dispatcher });
    return {
      blocked: false,
      response,
      url: verdict.url,
      addresses: verdict.addresses,
      dispatcher,
    };
  } catch (err) {
    await closeDispatcher(dispatcher);
    return {
      error: err instanceof Error ? err.message : "fetch failed",
      url: rawUrl,
    };
  }
}

export async function releaseConnection(connected) {
  if (!connected) return;
  await drainResponse(connected.response);
  await closeDispatcher(connected.dispatcher);
}
