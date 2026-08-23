/**
 * Watch webhooks for the card lane.
 *
 * Complements poll-only watch (POST /api/t/watch, GET /diff, GET /status).
 * Register an HTTPS webhookUrl on create or update. When GET /diff finds a
 * change, POST a signed JSON payload. No email. No background cron — the
 * first change is detected on GET /diff and the webhook fires then.
 *
 * Does not replace a sibling tokenWatch.mjs on another branch: this handler
 * implements the same poll contract plus webhook fields so this PR ships a
 * complete product. Mount this plugin; if both exist, mount only one for
 * /api/t/watch*.
 */

import { createHash } from "node:crypto";
import {
  connectMiddleware,
  createFileStore,
  createMemoryStore,
  getBearerToken,
  hashToken,
  isBlockedUrl,
  isHttpsUrl,
  newId,
  signBody,
  tokenRead,
  verifyToken,
  vitePlugin,
} from "./http.mjs";

export const MIN_INTERVAL_SECONDS = 60;
const MAX_URLS = 20;
const SAMPLE = 5;
const WEBHOOK_TIMEOUT_MS = 4_000;

export function newWatchId() {
  return newId("w_");
}

export function newWebhookSecret() {
  return `whsec_${newId("")}`;
}

export function normalizeWatchUrls(urls) {
  if (!Array.isArray(urls) || urls.length < 1) return { error: "Required" };
  if (urls.length > MAX_URLS) {
    return { error: `Array must contain at most ${MAX_URLS} element(s)` };
  }
  const out = [];
  for (const item of urls) {
    if (typeof item !== "string" || !item.trim()) return { error: "Required" };
    const trimmed = item.trim();
    if (isBlockedUrl(trimmed)) return { error: "Invalid URL", status: 400 };
    out.push(trimmed);
  }
  return { urls: out };
}

export function normalizeWebhookUrl(raw) {
  if (raw == null || raw === "") return { webhookUrl: null };
  if (typeof raw !== "string") return { error: "webhookUrl must be an https URL" };
  const trimmed = raw.trim();
  if (!trimmed) return { webhookUrl: null };
  if (!isHttpsUrl(trimmed) || isBlockedUrl(trimmed)) {
    return { error: "webhookUrl must be a public https URL", status: 400 };
  }
  return { webhookUrl: trimmed };
}

export function lineDiff(oldText, newText) {
  const prev = String(oldText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  const next = String(newText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((l) => !prevSet.has(l));
  const removed = prev.filter((l) => !nextSet.has(l));
  const moved = added.length + removed.length;
  const denom = Math.max(prev.length + next.length, 1);
  const stripDigits = (line) => line.replace(/\d+/g, "");
  const addedMarks = added.map(stripDigits).sort();
  const removedMarks = removed.map(stripDigits).sort();
  const numericOnly =
    moved > 0 &&
    addedMarks.length === removedMarks.length &&
    addedMarks.every((m, i) => m === removedMarks[i]);
  return {
    addedCount: added.length,
    removedCount: removed.length,
    changeRatio: Math.round((moved / denom) * 1000) / 1000,
    addedSample: added.slice(0, SAMPLE),
    removedSample: removed.slice(0, SAMPLE),
    numericOnly,
  };
}

export function deliveryIdFor(watchId, url, contentHash) {
  const hex = createHash("sha256").update(`${watchId}\n${url}\n${contentHash}`).digest("hex").slice(0, 24);
  return `whd_${hex}`;
}

export function webhookPayload(watch, item, polledAt) {
  const deliveryId = deliveryIdFor(watch.watchId, item.url, item.contentHash || item.url);
  return {
    event: "watch.changed",
    watchId: watch.watchId,
    url: item.url,
    status: item.status,
    polledAt,
    deliveryId,
    diff: item.diff
      ? {
          addedCount: item.diff.addedCount,
          removedCount: item.diff.removedCount,
          changeRatio: item.diff.changeRatio,
          addedSample: item.diff.addedSample,
          removedSample: item.diff.removedSample,
          numericOnly: item.diff.numericOnly,
          titleChanged: item.diff.titleChanged,
        }
      : undefined,
  };
}

export async function deliverWebhook(fetchImpl, watch, item, polledAt) {
  if (!watch.webhookUrl || !watch.webhookSecret) {
    return { delivered: false, reason: "not_configured" };
  }
  if (item.status !== "changed") return { delivered: false, reason: "no_change" };
  const payload = webhookPayload(watch, item, polledAt);
  if (watch.delivered && watch.delivered[payload.deliveryId]) {
    return { delivered: false, reason: "duplicate", deliveryId: payload.deliveryId };
  }
  const raw = JSON.stringify(payload);
  const signature = signBody(watch.webhookSecret, raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetchImpl(watch.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Skim-Signature": `sha256=${signature}`,
        "X-Skim-Delivery": payload.deliveryId,
        "User-Agent": "Skim-Watch/1.0",
      },
      body: raw,
      signal: controller.signal,
      redirect: "error",
    });
    return {
      delivered: res.ok,
      status: res.status,
      deliveryId: payload.deliveryId,
    };
  } catch (err) {
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : "delivery_failed",
      deliveryId: payload.deliveryId,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function createWatchHooksHandler(opts = {}) {
  const upstream = (opts.upstream ?? process.env.SKIM_API_UPSTREAM ?? "https://skim402.com").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const store =
    opts.store ??
    createFileStore(opts.storePath ?? process.env.SKIM_WATCH_STORE ?? ".data/watches.json");
  const nowFn = opts.now ?? (() => Date.now());

  function snapshotFromRead(url, body) {
    const text = typeof body.text === "string" ? body.text : "";
    const markdown = typeof body.markdown === "string" ? body.markdown : text;
    const hash =
      body?.receipt?.contentHash ??
      createHash("sha256").update(text || markdown).digest("hex");
    return {
      url,
      contentHash: hash,
      text: text || markdown,
      title: body?.metadata?.title ?? null,
      excerpt: body?.metadata?.excerpt ?? null,
    };
  }

  function publicWatch(watch, extra = {}) {
    return {
      watchId: watch.watchId,
      urls: watch.urls,
      note: watch.note,
      pollUrl: `/api/t/watch/diff?id=${watch.watchId}`,
      minIntervalSeconds: MIN_INTERVAL_SECONDS,
      webhookUrl: watch.webhookUrl ?? null,
      webhookConfigured: Boolean(watch.webhookUrl && watch.webhookSecret),
      ...extra,
    };
  }

  function statusPayload(watch) {
    return {
      ...publicWatch(watch),
      pollCount: watch.pollCount,
      lastPollAt: watch.lastPollAt,
    };
  }

  async function register(token, body) {
    const parsed = normalizeWatchUrls(body?.urls);
    if (parsed.error) return { status: parsed.status ?? 400, body: { error: parsed.error } };
    const hook = normalizeWebhookUrl(body?.webhookUrl);
    if (hook.error) return { status: hook.status ?? 400, body: { error: hook.error } };
    const note =
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null;

    const first = parsed.urls[0];
    const probe = await tokenRead(fetchImpl, upstream, token, first);
    if (probe.status === 401) return { status: 401, body: { error: "unknown token" } };
    if (probe.status === 402) {
      return { status: 402, body: probe.body?.error ? probe.body : { error: "Out of credits" } };
    }
    if (probe.status !== 200 || (!probe.body?.markdown && !probe.body?.text)) {
      return {
        status: 422,
        body: {
          error: probe.body?.error ?? "unprocessable",
          message: probe.body?.message ?? "First URL could not be read — watch not created",
        },
      };
    }

    const watchId = newWatchId();
    const snap = snapshotFromRead(first, probe.body);
    const webhookSecret = hook.webhookUrl ? newWebhookSecret() : null;
    const watch = {
      watchId,
      tokenHash: hashToken(token),
      urls: parsed.urls,
      note,
      webhookUrl: hook.webhookUrl,
      webhookSecret,
      createdAt: new Date(nowFn()).toISOString(),
      pollCount: 0,
      lastPollAt: null,
      lastResult: null,
      pages: { [first]: snap },
      delivered: {},
    };
    store.set(watch);
    return {
      status: 201,
      body: {
        ...publicWatch(watch),
        charged: 1,
        webhookSecret: webhookSecret || undefined,
        message:
          "Watch registered. Poll pollUrl (1 credit per successful URL fetch) to get what changed. " +
          (webhookSecret
            ? "When a poll finds a change, Skim POSTs a signed payload to webhookUrl. Store webhookSecret — it is shown once. There is no background cron: the webhook fires on GET /diff."
            : "Optional: PATCH with webhookUrl to get a signed POST when content changes (fires on GET /diff — no cron)."),
      },
    };
  }

  async function update(token, body) {
    const id = typeof body?.watchId === "string" ? body.watchId : "";
    if (!id) return { status: 400, body: { error: "watchId is required" } };
    const watch = store.get(id);
    if (!watch || watch.tokenHash !== hashToken(token)) {
      return { status: 404, body: { error: "not_found", message: "Unknown watch id" } };
    }
    const hook = normalizeWebhookUrl(body.webhookUrl === undefined ? watch.webhookUrl : body.webhookUrl);
    if (hook.error) return { status: hook.status ?? 400, body: { error: hook.error } };
    const rotate = Boolean(body.rotateSecret) || (hook.webhookUrl && hook.webhookUrl !== watch.webhookUrl);
    const webhookSecret = hook.webhookUrl
      ? rotate || !watch.webhookSecret
        ? newWebhookSecret()
        : watch.webhookSecret
      : null;
    const next = {
      ...watch,
      webhookUrl: hook.webhookUrl,
      webhookSecret,
    };
    store.set(next);
    return {
      status: 200,
      body: {
        ...publicWatch(next),
        webhookSecret: rotate && webhookSecret ? webhookSecret : undefined,
        message: hook.webhookUrl
          ? "Webhook updated. It fires on GET /diff when a page status is changed — not on first_check or cached polls."
          : "Webhook removed.",
      },
    };
  }

  async function diff(token, watch) {
    if (watch.tokenHash !== hashToken(token)) {
      return { status: 404, body: { error: "not_found", message: "Unknown watch id" } };
    }
    const now = nowFn();
    if (
      watch.lastResult &&
      watch.lastPollAt &&
      now - Date.parse(watch.lastPollAt) < MIN_INTERVAL_SECONDS * 1000
    ) {
      return { status: 200, body: { ...watch.lastResult, fresh: true, webhookDeliveries: [] } };
    }

    const pages = { ...watch.pages };
    const items = [];
    let charged = 0;
    let changedCount = 0;

    for (const url of watch.urls) {
      const read = await tokenRead(fetchImpl, upstream, token, url);
      if (read.status === 401) return { status: 401, body: { error: "unknown token" } };
      if (read.status === 402) {
        return { status: 402, body: read.body?.error ? read.body : { error: "Out of credits" } };
      }
      if (read.status !== 200 || (!read.body?.markdown && !read.body?.text)) {
        items.push({
          url,
          status: "error",
          title: pages[url]?.title ?? null,
          error: {
            status: read.status,
            message: read.body?.message ?? read.body?.error ?? "URL could not be read",
          },
        });
        continue;
      }

      charged += 1;
      const snap = snapshotFromRead(url, read.body);
      const prev = pages[url];
      if (!prev) {
        pages[url] = snap;
        items.push({ url, status: "first_check", title: snap.title, contentHash: snap.contentHash });
        continue;
      }

      const sameHash = prev.contentHash === snap.contentHash;
      const diffBody = lineDiff(prev.text, snap.text);
      const titleChanged = (prev.title ?? null) !== (snap.title ?? null);
      const changed = !sameHash || titleChanged;
      pages[url] = snap;
      if (changed) {
        changedCount += 1;
        items.push({
          url,
          status: "changed",
          title: snap.title,
          contentHash: snap.contentHash,
          diff: { ...diffBody, titleChanged },
        });
      } else {
        items.push({ url, status: "unchanged", title: snap.title, contentHash: snap.contentHash });
      }
    }

    const polledAt = new Date(now).toISOString();
    const webhookDeliveries = [];
    const delivered = { ...(watch.delivered || {}) };
    if (watch.webhookUrl && changedCount > 0) {
      for (const item of items) {
        if (item.status !== "changed") continue;
        const result = await deliverWebhook(fetchImpl, { ...watch, delivered }, item, polledAt);
        webhookDeliveries.push({
          url: item.url,
          deliveryId: result.deliveryId ?? null,
          delivered: Boolean(result.delivered),
          reason: result.reason,
        });
        if (result.deliveryId && result.delivered) delivered[result.deliveryId] = polledAt;
      }
    }

    const result = {
      watchId: watch.watchId,
      polledAt,
      changedCount,
      charged,
      fresh: false,
      webhookConfigured: Boolean(watch.webhookUrl),
      webhookDeliveries,
      urls: items.map(({ contentHash: _c, ...rest }) => rest),
    };
    store.set({
      ...watch,
      pages,
      delivered,
      pollCount: watch.pollCount + 1,
      lastPollAt: polledAt,
      lastResult: result,
    });
    return { status: 200, body: result };
  }

  return async function handleWatchHooks(request) {
    const token = getBearerToken(request.headers);
    if (!token) return { status: 401, body: { error: "unknown token" } };

    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url, "http://skim.local");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if ((method === "POST" || method === "PATCH") && path === "/api/t/watch") {
      const verified = await verifyToken(fetchImpl, upstream, token);
      if (!verified.ok) return verified;
      if (request.body?.watchId && !request.body?.urls) {
        return update(token, request.body);
      }
      if (method === "PATCH") return update(token, request.body ?? {});
      return register(token, request.body ?? {});
    }

    if (method === "GET" && (path === "/api/t/watch/diff" || path === "/api/t/watch/status")) {
      const id = url.searchParams.get("id") ?? "";
      if (!id) return { status: 400, body: { error: "Required", message: "id is required" } };
      const verified = await verifyToken(fetchImpl, upstream, token);
      if (!verified.ok) return verified;
      const watch = store.get(id);
      if (!watch || watch.tokenHash !== hashToken(token)) {
        return { status: 404, body: { error: "not_found", message: "Unknown watch id" } };
      }
      if (path.endsWith("/status")) return { status: 200, body: statusPayload(watch) };
      return diff(token, watch);
    }

    return { status: 404, body: { error: "not_found" } };
  };
}

export function tokenWatchHooksMiddleware(opts = {}) {
  const handle = createWatchHooksHandler(opts);
  return connectMiddleware((path) => path.startsWith("/api/t/watch"), handle);
}

export function tokenWatchHooksVitePlugin(opts = {}) {
  return vitePlugin("skim-token-watch-hooks", tokenWatchHooksMiddleware(opts));
}

export { createMemoryStore };
