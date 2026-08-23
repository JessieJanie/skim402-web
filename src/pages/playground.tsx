import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const API_BASE = `${import.meta.env.BASE_URL}api`;
const SESSION_KEY_STORAGE = "skim-workbench-trial-key";
const WATCH_STORAGE = "skim-workbench-watch";

type WorkbenchMode = "read" | "batch" | "extract" | "crawl" | "pdf" | "watch";

const MODES: { id: WorkbenchMode; label: string; hint: string; cost: string }[] = [
  {
    id: "read",
    label: "One page",
    hint: "Read one URL as clean markdown.",
    cost: "Usually 1 credit. 2 credits if the page needs a browser.",
  },
  {
    id: "batch",
    label: "Several pages",
    hint: "Read up to 10 URLs in one call.",
    cost: "1 credit per URL that succeeds. Failed URLs are refunded.",
  },
  {
    id: "extract",
    label: "Extract a table",
    hint: "Pull structured rows from a page.",
    cost: "8 credits when the extract succeeds.",
  },
  {
    id: "crawl",
    label: "Crawl a site",
    hint: "Give a site origin. Skim returns the important pages as markdown.",
    cost: "1 credit per page that succeeds. Cap 25.",
  },
  {
    id: "pdf",
    label: "PDF",
    hint: "Turn a public PDF URL into clean markdown.",
    cost: "3 credits when the PDF has extractable text.",
  },
  {
    id: "watch",
    label: "Watch a page",
    hint: "Register URL(s), then check whether the content changed. Optional HTTPS webhook.",
    cost: "1 credit per successful fetch. Status is free.",
  },
];

/** Default schema for POST /api/t/extract — matches the docs table preset. */
const TABLE_SCHEMA = {
  type: "object",
  properties: {
    tables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caption: { type: "string" },
          headers: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
  required: ["tables"],
} as const;

type SessionKey = {
  token: string;
  credits: number;
};

type ReadReceipt = {
  tokensEst?: number;
  cacheHit?: boolean;
  cacheAgeSeconds?: number;
};

type ReaderResponse = {
  markdown?: string;
  wordCount?: number;
  receipt?: ReadReceipt;
  error?: string;
  [key: string]: unknown;
};

type HistoryItem = {
  id: string;
  url: string;
  stripLinks: boolean;
  stripImages: boolean;
  markdown: string;
  jsonRaw: ReaderResponse;
  wordCount: number;
  credits: number;
  ms: number;
  timestamp: number;
};

type BatchItem = {
  url: string;
  ok: boolean;
  data?: ReaderResponse | null;
  error?: { status?: number; message?: string } | string | null;
};

type BatchResult = {
  urls: string[];
  stripLinks: boolean;
  stripImages: boolean;
  results: BatchItem[];
  jsonRaw: unknown;
  credits: number;
  ms: number;
};

type ExtractedTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};

type ExtractResult = {
  url: string;
  intent: string;
  tables: ExtractedTable[];
  data: unknown;
  jsonRaw: unknown;
  credits: number;
  ms: number;
};

type WatchDiffUrl = {
  url: string;
  status?: string;
  title?: string;
  diff?: {
    addedCount?: number;
    removedCount?: number;
    changeRatio?: number;
    addedSample?: string[];
    removedSample?: string[];
    numericOnly?: boolean;
    titleChanged?: boolean;
  };
};

type CrawlPage = {
  url: string;
  ok: boolean;
  title?: string | null;
  markdown?: string;
  error?: { status?: number; message?: string } | string | null;
};

type CrawlResult = {
  startUrl: string;
  origin?: string;
  pages: CrawlPage[];
  sources: string[];
  charged: number;
  jsonRaw: unknown;
  ms: number;
};

type PdfResult = {
  url: string;
  markdown: string;
  outline: { title: string; level?: number }[];
  pageCount?: number | null;
  charged: number;
  jsonRaw: unknown;
  ms: number;
};

type WatchSession = {
  watchId: string;
  urls: string[];
  webhookUrl?: string;
  webhookSecret?: string;
};

type WatchCheckResult = {
  watchId: string;
  kind: "diff" | "status";
  changedCount?: number;
  fresh?: boolean;
  urls: WatchDiffUrl[];
  jsonRaw: unknown;
  credits: number;
  ms: number;
};

function isValidUrl(s: string) {
  try {
    const parsed = new URL(s);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseUrlList(text: string, max: number): { urls: string[]; error?: string } {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const line of text.split(/[\n,]+/)) {
    const value = line.trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }
  if (urls.length === 0) return { urls: [], error: "Add at least one URL (including http:// or https://)." };
  if (urls.length > max) {
    return { urls, error: `Use at most ${max} URLs. You entered ${urls.length}.` };
  }
  const invalid = urls.find((url) => !isValidUrl(url));
  if (invalid) return { urls, error: `Not a valid URL: ${invalid}` };
  return { urls };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function creditsFromResponse(res: Response, body: unknown, fallback: number): number {
  const header =
    res.headers.get("X-Skim-Credits") ??
    res.headers.get("X-Skim-Credits-Charged") ??
    res.headers.get("X-Skim-Credits-Used");
  if (header && Number.isFinite(Number(header))) return Math.max(0, Number(header));
  const rec = asRecord(body);
  if (rec) {
    for (const key of ["creditsCharged", "creditsUsed", "charged"]) {
      if (typeof rec[key] === "number" && Number.isFinite(rec[key])) {
        return Math.max(0, rec[key] as number);
      }
    }
  }
  return fallback;
}

function apiErrorMessage(status: number, body: unknown, fallback: string): string {
  const rec = asRecord(body);
  const fromBody = typeof rec?.error === "string" ? rec.error : undefined;
  if (status === 401) return "Invalid or expired API key.";
  if (status === 402) return "Insufficient credits. Add a card for the Free Plan or use wallet pay.";
  if (status === 429) return "Rate limit exceeded. Try again in a minute.";
  if (status === 404) return fromBody || "That endpoint was not found. Try again in a moment.";
  return fromBody || fallback;
}

function creditLabel(n: number, extra = ""): string {
  const base = `${n} credit${n === 1 ? "" : "s"}`;
  return extra ? `${base} ${extra}` : base;
}

function stringCells(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((cell) => (cell == null ? "" : String(cell)));
}

function normalizeTable(value: unknown): ExtractedTable | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const headers = stringCells(rec.headers);
  const rawRows = Array.isArray(rec.rows) ? rec.rows : [];
  const rows = rawRows.map((row) => stringCells(row));
  if (headers.length === 0 && rows.length === 0) return null;
  return {
    caption: typeof rec.caption === "string" ? rec.caption : undefined,
    headers,
    rows,
  };
}

function tablesFromExtract(body: unknown): ExtractedTable[] {
  const rec = asRecord(body);
  const data = rec?.data ?? rec?.tables ?? body;
  const dataRec = asRecord(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(dataRec?.tables)
      ? dataRec.tables
      : Array.isArray(rec?.tables)
        ? rec.tables
        : [];
  return list.map(normalizeTable).filter((table): table is ExtractedTable => table !== null);
}

function watchUrlsFromBody(body: unknown): WatchDiffUrl[] {
  const rec = asRecord(body);
  const list = Array.isArray(rec?.urls) ? rec.urls : [];
  return list.map((item) => {
    if (typeof item === "string") return { url: item };
    const row = asRecord(item);
    if (!row) return { url: "" };
    return {
      url: typeof row.url === "string" ? row.url : "",
      status: typeof row.status === "string" ? row.status : undefined,
      title: typeof row.title === "string" ? row.title : undefined,
      diff: asRecord(row.diff) as WatchDiffUrl["diff"],
    };
  });
}

function statusLabel(status?: string): string {
  switch (status) {
    case "changed":
      return "Changed";
    case "unchanged":
      return "Unchanged";
    case "first_check":
      return "Baseline saved";
    case "error":
      return "Could not read";
    default:
      return status ? status.replaceAll("_", " ") : "Unknown";
  }
}

function CodeSnippet({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <button type="button" onClick={handleCopy} data-testid={`button-copy-${title.toLowerCase()}`} className="text-xs text-[#236CFF] hover:underline font-medium">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-[#161b22] text-zinc-50 rounded-xl p-4 font-mono text-[13px] leading-relaxed overflow-x-auto border border-[#21262d] shadow-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: WorkbenchMode;
  onChange: (next: WorkbenchMode) => void;
}) {
  return (
    <div className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        What do you want to try?
      </p>
      <div
        role="tablist"
        aria-label="Workbench mode"
        className="flex flex-wrap gap-2"
      >
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`mode-${item.id}`}
              onClick={() => onChange(item.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold border transition-all ${
                active
                  ? "bg-[#10131a] text-white border-[#10131a] shadow-sm"
                  : "bg-card text-foreground/80 border-border/70 hover:border-border hover:bg-muted/40"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtractedTables({ tables, fallback }: { tables: ExtractedTable[]; fallback: unknown }) {
  if (tables.length === 0) {
    return (
      <pre className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
        {JSON.stringify(fallback, null, 2)}
      </pre>
    );
  }
  return (
    <div className="space-y-8">
      {tables.map((table, index) => (
        <div key={`${table.caption ?? "table"}-${index}`} className="overflow-auto">
          <p className="text-sm font-semibold text-foreground mb-3">
            {table.caption || `Table ${index + 1}`}
          </p>
          <table className="w-full text-[13px] border-collapse">
            {table.headers.length > 0 && (
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th
                      key={header}
                      className="text-left font-semibold border-b border-border/60 px-3 py-2 text-foreground/80 whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/30">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top text-foreground/80">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function WatchUrlList({ urls }: { urls: WatchDiffUrl[] }) {
  if (urls.length === 0) {
    return <p className="text-sm text-muted-foreground">No per-URL details in this response.</p>;
  }
  return (
    <div className="space-y-4">
      {urls.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className="rounded-xl border border-border/50 p-4 bg-muted/10"
        >
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="font-medium text-sm text-foreground/90 break-all">{item.url || "URL missing"}</p>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                item.status === "changed"
                  ? "bg-[#fde68a] text-[#5a4500]"
                  : item.status === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {statusLabel(item.status)}
            </span>
          </div>
          {item.title && <p className="text-xs text-muted-foreground mt-1">{item.title}</p>}
          {item.diff && (
            <div className="mt-3 text-[13px] text-foreground/80 space-y-2">
              <p>
                {item.diff.addedCount ?? 0} lines added · {item.diff.removedCount ?? 0} lines removed
                {item.diff.numericOnly ? " · numbers only" : ""}
              </p>
              {item.diff.addedSample && item.diff.addedSample.length > 0 && (
                <p><span className="font-semibold">Added:</span> {item.diff.addedSample.join(" · ")}</p>
              )}
              {item.diff.removedSample && item.diff.removedSample.length > 0 && (
                <p><span className="font-semibold">Removed:</span> {item.diff.removedSample.join(" · ")}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Playground() {
  useDocumentMeta({
    title: "Reader Workbench | Skim",
    description:
      "Try Skim in the browser: one page, several pages, extract a table, crawl a site, read a PDF, or watch a page for changes. Uses the same free trial key as a single read.",
    canonical: "https://skim402.com/playground",
  });

  const [mode, setMode] = useState<WorkbenchMode>("read");
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  const [key, setKey] = useState<SessionKey | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  const [url, setUrl] = useState("");
  const [stripLinks, setStripLinks] = useState(false);
  const [stripImages, setStripImages] = useState(false);

  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [currentResult, setCurrentResult] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const [batchText, setBatchText] = useState("");
  const [batchStripLinks, setBatchStripLinks] = useState(false);
  const [batchStripImages, setBatchStripImages] = useState(false);
  const [isBatching, setIsBatching] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const [extractUrl, setExtractUrl] = useState("");
  const [extractIntent, setExtractIntent] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);

  const [watchText, setWatchText] = useState("");
  const [watchWebhook, setWatchWebhook] = useState("");
  const [watchSession, setWatchSession] = useState<WatchSession | null>(null);
  const [isRegisteringWatch, setIsRegisteringWatch] = useState(false);
  const [isCheckingWatch, setIsCheckingWatch] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [watchResult, setWatchResult] = useState<WatchCheckResult | null>(null);

  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlMax, setCrawlMax] = useState("10");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState("");
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);

  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfOutline, setPdfOutline] = useState(true);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);

  const busy = isReading || isBatching || isExtracting || isRegisteringWatch || isCheckingWatch || isCrawling || isReadingPdf;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY_STORAGE);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SessionKey;
      if (typeof parsed.token === "string" && parsed.token.startsWith("sk402_")) {
        setKey({ token: parsed.token, credits: Number(parsed.credits) || 0 });
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY_STORAGE);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WATCH_STORAGE);
      if (!stored) return;
      const parsed = JSON.parse(stored) as WatchSession;
      if (typeof parsed.watchId === "string" && Array.isArray(parsed.urls)) {
        setWatchSession(parsed);
        setWatchText((current) => current.trim() ? current : parsed.urls.join("\n"));
        if (parsed.webhookUrl) setWatchWebhook(parsed.webhookUrl);
      }
    } catch {
      window.localStorage.removeItem(WATCH_STORAGE);
    }
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = (params.get("mode") || window.location.hash.replace("#", "")).toLowerCase();
      if (raw === "batch" || raw === "several") setMode("batch");
      else if (raw === "extract" || raw === "table") setMode("extract");
      else if (raw === "crawl" || raw === "site") setMode("crawl");
      else if (raw === "pdf" || raw === "read-pdf") setMode("pdf");
      else if (raw === "watch") setMode("watch");
      else if (raw === "read" || raw === "one") setMode("read");
    } catch {
      // Ignore malformed URLs; default mode is one page.
    }
  }, []);

  const debitCredits = (used: number) => {
    if (used <= 0) return;
    setKey((prev) => {
      if (!prev) return prev;
      const next = { ...prev, credits: Math.max(0, prev.credits - used) };
      window.localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(next));
      return next;
    });
  };

  const clearKeyOn401 = (status: number) => {
    if (status !== 401) return;
    setKey(null);
    window.localStorage.removeItem(SESSION_KEY_STORAGE);
  };

  const createKey = async () => {
    setIsCreatingKey(true);
    setKeyError("");
    try {
      const res = await fetch(`${API_BASE}/card/trial-key`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.token) {
        setKeyError(body?.error || "Could not create key. Please try again.");
        return;
      }
      const nextKey = { token: body.token, credits: body.credits ?? 1000 };
      setKey(nextKey);
      window.localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(nextKey));
    } catch {
      setKeyError("Network error. Could not reach Skim servers.");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const copyKey = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key.token);
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      setCopiedKey(false);
    }
  };

  const requestUrl = (item: Pick<HistoryItem, "url" | "stripLinks" | "stripImages">) => {
    const params = new URLSearchParams({ url: item.url });
    if (item.stripLinks) params.set("stripLinks", "true");
    if (item.stripImages) params.set("stripImages", "true");
    return `https://skim402.com/api/t/read?${params.toString()}`;
  };

  const curlSnippet = (item: Pick<HistoryItem, "url" | "stripLinks" | "stripImages">) =>
    `curl -H "Authorization: Bearer ${key?.token ?? "YOUR_API_KEY"}" \\\n  "${requestUrl(item)}"`;

  const copyRequest = async (item: Pick<HistoryItem, "url" | "stripLinks" | "stripImages">) => {
    try {
      await navigator.clipboard.writeText(curlSnippet(item));
    } catch {
      // Browsers can deny clipboard access; the Integration tab remains available.
    }
  };

  const runRead = async (overrideUrl?: string, overrideLinks?: boolean, overrideImages?: boolean) => {
    const targetUrl = overrideUrl ?? url;
    const targetLinks = overrideLinks ?? stripLinks;
    const targetImages = overrideImages ?? stripImages;

    if (!key || !targetUrl.trim() || isReading) return;
    if (!isValidUrl(targetUrl.trim())) {
      setReadError("Please enter a valid URL (including http:// or https://).");
      return;
    }

    setIsReading(true);
    setReadError("");
    setCurrentResult(null);

    const startTime = Date.now();
    try {
      let endpoint = `${API_BASE}/t/read?url=${encodeURIComponent(targetUrl.trim())}`;
      if (targetLinks) endpoint += `&stripLinks=true`;
      if (targetImages) endpoint += `&stripImages=true`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${key.token}` }
      });

      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null) as ReaderResponse | null;

      if (!res.ok || !body) {
        setReadError(apiErrorMessage(res.status, body, "Read failed. Please try another URL."));
        clearKeyOn401(res.status);
        setIsReading(false);
        return;
      }

      const creditsUsed = res.headers.get("X-Skim-Fallback") === "js"
        ? 2
        : creditsFromResponse(res, body, 1);
      const wordCount = body.wordCount ?? 0;

      debitCredits(creditsUsed);

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: targetUrl.trim(),
        stripLinks: targetLinks,
        stripImages: targetImages,
        markdown: body.markdown || "",
        jsonRaw: body,
        wordCount,
        credits: creditsUsed,
        ms,
        timestamp: Date.now()
      };

      setCurrentResult(newItem);
      setHistory(prev => [newItem, ...prev.filter(i => i.url !== newItem.url)].slice(0, 10));
    } catch {
      setReadError("Network error. Could not reach the reader.");
    } finally {
      setIsReading(false);
    }
  };

  const runBatch = async () => {
    if (!key || isBatching) return;
    const parsed = parseUrlList(batchText, 10);
    if (parsed.error) {
      setBatchError(parsed.error);
      return;
    }

    setIsBatching(true);
    setBatchError("");
    setBatchResult(null);
    const startTime = Date.now();
    try {
      const res = await fetch(`${API_BASE}/t/read/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: parsed.urls,
          stripLinks: batchStripLinks,
          stripImages: batchStripImages,
        }),
      });
      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setBatchError(apiErrorMessage(res.status, body, "Batch read failed. Check the URLs and try again."));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const results = (Array.isArray(rec?.results) ? rec.results : []) as BatchItem[];
      const okCount = results.filter((item) => item.ok).length;
      const credits = creditsFromResponse(res, body, okCount || parsed.urls.length);
      debitCredits(credits);
      setBatchResult({
        urls: parsed.urls,
        stripLinks: batchStripLinks,
        stripImages: batchStripImages,
        results,
        jsonRaw: body,
        credits,
        ms,
      });
    } catch {
      setBatchError("Network error. Could not reach the reader.");
    } finally {
      setIsBatching(false);
    }
  };

  const runExtract = async () => {
    if (!key || isExtracting) return;
    const target = extractUrl.trim();
    if (!isValidUrl(target)) {
      setExtractError("Please enter a valid URL (including http:// or https://).");
      return;
    }

    setIsExtracting(true);
    setExtractError("");
    setExtractResult(null);
    const startTime = Date.now();
    try {
      const intent = extractIntent.trim();
      const res = await fetch(`${API_BASE}/t/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: target,
          schema: TABLE_SCHEMA,
          ...(intent ? { instructions: intent } : {}),
        }),
      });
      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setExtractError(apiErrorMessage(res.status, body, "Extract failed. Try a page that has a table."));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const credits = creditsFromResponse(res, body, 8);
      debitCredits(credits);
      setExtractResult({
        url: target,
        intent,
        tables: tablesFromExtract(body),
        data: rec?.data ?? body,
        jsonRaw: body,
        credits,
        ms,
      });
    } catch {
      setExtractError("Network error. Could not reach the extractor.");
    } finally {
      setIsExtracting(false);
    }
  };

  const persistWatch = (session: WatchSession) => {
    setWatchSession(session);
    window.localStorage.setItem(WATCH_STORAGE, JSON.stringify(session));
  };

  const registerWatch = async () => {
    if (!key || isRegisteringWatch) return;
    const parsed = parseUrlList(watchText, 20);
    if (parsed.error) {
      setWatchError(parsed.error);
      return;
    }

    setIsRegisteringWatch(true);
    setWatchError("");
    setWatchResult(null);
    try {
      const res = await fetch(`${API_BASE}/t/watch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: parsed.urls,
          ...(watchWebhook.trim() ? { webhookUrl: watchWebhook.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setWatchError(apiErrorMessage(res.status, body, "Could not register this watch. Try another URL."));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const watchId = typeof rec?.watchId === "string"
        ? rec.watchId
        : typeof rec?.watch_id === "string"
          ? rec.watch_id
          : "";
      if (!watchId) {
        setWatchError("The API did not return a watch id. Try again.");
        return;
      }
      const urls = Array.isArray(rec?.urls)
        ? rec.urls.filter((item): item is string => typeof item === "string")
        : parsed.urls;
      const credits = creditsFromResponse(res, body, urls.length || 1);
      debitCredits(credits);
      persistWatch({
        watchId,
        urls,
        webhookUrl: typeof rec?.webhookUrl === "string" ? rec.webhookUrl : watchWebhook.trim() || undefined,
        webhookSecret: typeof rec?.webhookSecret === "string" ? rec.webhookSecret : undefined,
      });
      setWatchResult({
        watchId,
        kind: "status",
        urls: urls.map((item) => ({ url: item, status: "first_check" })),
        jsonRaw: body,
        credits,
        ms: 0,
      });
    } catch {
      setWatchError("Network error. Could not reach the watch API.");
    } finally {
      setIsRegisteringWatch(false);
    }
  };

  const checkWatch = async (kind: "diff" | "status") => {
    if (!key || !watchSession || isCheckingWatch) return;
    setIsCheckingWatch(true);
    setWatchError("");
    const startTime = Date.now();
    try {
      const res = await fetch(
        `${API_BASE}/t/watch/${kind}?id=${encodeURIComponent(watchSession.watchId)}`,
        { headers: { Authorization: `Bearer ${key.token}` } },
      );
      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setWatchError(apiErrorMessage(
          res.status,
          body,
          kind === "diff" ? "Could not check for changes." : "Could not load watch status.",
        ));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const fallbackCredits = kind === "status" ? 0 : (Array.isArray(rec?.urls) ? rec.urls.length : 1);
      const credits = kind === "status" ? 0 : creditsFromResponse(res, body, fallbackCredits);
      debitCredits(credits);
      setWatchResult({
        watchId: watchSession.watchId,
        kind,
        changedCount: typeof rec?.changedCount === "number" ? rec.changedCount : undefined,
        fresh: rec?.fresh === true,
        urls: watchUrlsFromBody(body),
        jsonRaw: body,
        credits,
        ms,
      });
    } catch {
      setWatchError("Network error. Could not reach the watch API.");
    } finally {
      setIsCheckingWatch(false);
    }
  };

  const runCrawl = async () => {
    if (!key || isCrawling) return;
    const target = crawlUrl.trim();
    if (!target) {
      setCrawlError("Enter a site origin or start URL.");
      return;
    }
    const maxPages = Math.min(25, Math.max(1, Number(crawlMax) || 10));
    setIsCrawling(true);
    setCrawlError("");
    setCrawlResult(null);
    const startTime = Date.now();
    try {
      const res = await fetch(`${API_BASE}/t/crawl`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: target, maxPages }),
      });
      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setCrawlError(apiErrorMessage(res.status, body, "Crawl failed. Try another site."));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const pages = (Array.isArray(rec?.pages) ? rec.pages : []) as CrawlPage[];
      const charged = creditsFromResponse(res, body, pages.filter((p) => p.ok).length);
      debitCredits(charged);
      setCrawlResult({
        startUrl: target,
        origin: typeof rec?.origin === "string" ? rec.origin : undefined,
        pages,
        sources: Array.isArray(rec?.sources) ? rec.sources.filter((s): s is string => typeof s === "string") : [],
        charged,
        jsonRaw: body,
        ms,
      });
    } catch {
      setCrawlError("Network error. Could not reach the crawler.");
    } finally {
      setIsCrawling(false);
    }
  };

  const runPdf = async () => {
    if (!key || isReadingPdf) return;
    const target = pdfUrl.trim();
    if (!isValidUrl(target)) {
      setPdfError("Please enter a valid PDF URL (including http:// or https://).");
      return;
    }
    setIsReadingPdf(true);
    setPdfError("");
    setPdfResult(null);
    const startTime = Date.now();
    try {
      const res = await fetch(`${API_BASE}/t/read-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: target, outline: pdfOutline }),
      });
      const ms = Date.now() - startTime;
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setPdfError(apiErrorMessage(res.status, body, "PDF read failed. Try a smaller text PDF."));
        clearKeyOn401(res.status);
        return;
      }
      const rec = asRecord(body);
      const charged = creditsFromResponse(res, body, 3);
      debitCredits(charged);
      const outline = Array.isArray(rec?.outline)
        ? rec.outline
            .map((item) => {
              const row = asRecord(item);
              return row && typeof row.title === "string"
                ? { title: row.title, level: typeof row.level === "number" ? row.level : 1 }
                : null;
            })
            .filter((item): item is { title: string; level?: number } => item !== null)
        : [];
      setPdfResult({
        url: target,
        markdown: typeof rec?.markdown === "string" ? rec.markdown : "",
        outline,
        pageCount: typeof rec?.pageCount === "number" ? rec.pageCount : null,
        charged,
        jsonRaw: body,
        ms,
      });
    } catch {
      setPdfError("Network error. Could not reach the PDF reader.");
    } finally {
      setIsReadingPdf(false);
    }
  };

  const copyMarkdown = () => {
    if (!currentResult) return;
    void navigator.clipboard.writeText(currentResult.markdown).then(() => {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    }).catch(() => setCopiedMarkdown(false));
  };

  const loadHistory = (item: HistoryItem) => {
    setMode("read");
    setUrl(item.url);
    setStripLinks(item.stripLinks);
    setStripImages(item.stripImages);
    setCurrentResult(item);
    setReadError("");
  };

  const batchUrlCount = useMemo(() => parseUrlList(batchText, 99).urls.length, [batchText]);
  const watchUrlCount = useMemo(() => parseUrlList(watchText, 99).urls.length, [watchText]);

  const token = key?.token ?? "YOUR_API_KEY";
  const isBusy = busy;

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 md:py-16">

        <div className="mb-10">
          <Badge variant="secondary" className="mb-3 bg-[#fde68a] text-[#5a4500] hover:bg-[#fde68a]">
            Developer Tools
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#10131a]">
            Reader Workbench
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Try the same free API key on one page, several pages, a table extract, a site crawl, a PDF, or a page watch — no curl required.
          </p>
        </div>

        <ModeSwitcher mode={mode} onChange={setMode} />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">1. API Key</h2>
                {key && <Badge variant="outline" data-testid="status-session-credits" className="font-mono text-xs">{key.credits} est. credits</Badge>}
              </div>

              {key ? (
                <div className="space-y-3">
                   <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border border-border/50">
                     <code className="min-w-0 flex-1 text-xs text-foreground font-mono break-all truncate" title={key.token}>{key.token}</code>
                     <button
                       type="button"
                       onClick={() => void copyKey()}
                       data-testid="button-copy-api-key"
                       aria-label="Copy API key"
                       className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
                     >
                       {copiedKey ? "Copied" : "Copy key"}
                     </button>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                     Active session key. Used automatically for requests below. <Link href="/pricing" data-testid="link-get-permanent-key" className="text-[#236CFF] hover:underline">Get a permanent key</Link>.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={createKey}
                    disabled={isCreatingKey}
                    data-testid="button-create-trial-key"
                    className="w-full bg-[#10131a] text-white font-medium py-2.5 rounded-xl hover:bg-[#10131a]/90 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isCreatingKey ? "Creating..." : "Create free trial key"}
                  </button>
                  <p className="text-[13px] text-muted-foreground text-center">
                    No signup required. 1,000 free credits.
                  </p>
                  {keyError && <p className="text-xs text-destructive text-center font-medium">{keyError}</p>}
                  <div className="pt-2 border-t border-border/40 text-center mt-2">
                    <p className="text-xs text-muted-foreground mt-2">
                      Building agent-native? <Link href="/wallet" data-testid="link-wallet-pay" className="text-[#236CFF] hover:underline">Use x402 wallet pay</Link>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm flex flex-col">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                2. {activeMode.label}
              </h2>
              <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
                {activeMode.hint} {activeMode.cost}
              </p>

              {mode === "read" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runRead();
                }}
              >
                <div>
                  <label htmlFor="workbench-url" className="sr-only">URL to read</label>
                  <input
                    id="workbench-url"
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    data-testid="input-reader-url"
                    placeholder="https://..."
                    className="w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isReading}
                  />
                </div>

                <div className="flex flex-col gap-3">
                   <label className="flex items-center gap-3 text-sm cursor-pointer group w-fit">
                     <input
                       type="checkbox"
                       checked={stripLinks}
                       onChange={e => setStripLinks(e.target.checked)}
                        data-testid="checkbox-strip-links"
                       className="w-4 h-4 rounded border-border/80 text-[#236CFF] focus:ring-[#236CFF]/50"
                       disabled={isReading}
                     />
                     <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">Strip links</span>
                   </label>
                   <label className="flex items-center gap-3 text-sm cursor-pointer group w-fit">
                     <input
                       type="checkbox"
                       checked={stripImages}
                       onChange={e => setStripImages(e.target.checked)}
                        data-testid="checkbox-strip-images"
                       className="w-4 h-4 rounded border-border/80 text-[#236CFF] focus:ring-[#236CFF]/50"
                       disabled={isReading}
                     />
                     <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">Strip images</span>
                   </label>
                </div>

                <button
                  type="submit"
                  disabled={!key || !url.trim() || isReading || !isValidUrl(url.trim())}
                  data-testid="button-run-reader"
                  className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isReading ? "Reading..." : "Skim it"}
                </button>
                {readError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {readError}
                  </p>
                )}
              </form>
              )}

              {mode === "batch" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runBatch();
                }}
              >
                <div>
                  <label htmlFor="workbench-batch-urls" className="text-sm font-medium text-foreground/80">
                    URLs — one per line, up to 10
                  </label>
                  <textarea
                    id="workbench-batch-urls"
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    data-testid="input-batch-urls"
                    placeholder={"https://example.com/one\nhttps://example.com/two"}
                    rows={6}
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all font-mono"
                    disabled={isBatching}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{Math.min(batchUrlCount, 10)} / 10 URLs</p>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 text-sm cursor-pointer group w-fit">
                    <input
                      type="checkbox"
                      checked={batchStripLinks}
                      onChange={(e) => setBatchStripLinks(e.target.checked)}
                      data-testid="checkbox-batch-strip-links"
                      className="w-4 h-4 rounded border-border/80 text-[#236CFF] focus:ring-[#236CFF]/50"
                      disabled={isBatching}
                    />
                    <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">Strip links</span>
                  </label>
                  <label className="flex items-center gap-3 text-sm cursor-pointer group w-fit">
                    <input
                      type="checkbox"
                      checked={batchStripImages}
                      onChange={(e) => setBatchStripImages(e.target.checked)}
                      data-testid="checkbox-batch-strip-images"
                      className="w-4 h-4 rounded border-border/80 text-[#236CFF] focus:ring-[#236CFF]/50"
                      disabled={isBatching}
                    />
                    <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">Strip images</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={!key || batchUrlCount === 0 || isBatching}
                  data-testid="button-run-batch"
                  className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isBatching ? "Reading pages..." : "Read these pages"}
                </button>
                {batchError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {batchError}
                  </p>
                )}
              </form>
              )}

              {mode === "extract" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runExtract();
                }}
              >
                <div>
                  <label htmlFor="workbench-extract-url" className="text-sm font-medium text-foreground/80">
                    Page with a table
                  </label>
                  <input
                    id="workbench-extract-url"
                    type="url"
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    data-testid="input-extract-url"
                    placeholder="https://..."
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isExtracting}
                  />
                </div>
                <div>
                  <label htmlFor="workbench-extract-intent" className="text-sm font-medium text-foreground/80">
                    Intent <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="workbench-extract-intent"
                    value={extractIntent}
                    onChange={(e) => setExtractIntent(e.target.value)}
                    data-testid="input-extract-intent"
                    placeholder="e.g. Only the comparison table, not the footer."
                    rows={3}
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isExtracting}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    A default table schema is sent for you — you do not need to write JSON.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!key || !extractUrl.trim() || isExtracting || !isValidUrl(extractUrl.trim())}
                  data-testid="button-run-extract"
                  className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isExtracting ? "Extracting..." : "Extract table"}
                </button>
                {extractError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {extractError}
                  </p>
                )}
              </form>
              )}

              {mode === "crawl" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runCrawl();
                }}
              >
                <div>
                  <label htmlFor="workbench-crawl-url" className="text-sm font-medium text-foreground/80">
                    Site origin or start URL
                  </label>
                  <input
                    id="workbench-crawl-url"
                    type="text"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    data-testid="input-crawl-url"
                    placeholder="https://example.com"
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isCrawling}
                  />
                </div>
                <div>
                  <label htmlFor="workbench-crawl-max" className="text-sm font-medium text-foreground/80">
                    Max pages (1–25)
                  </label>
                  <input
                    id="workbench-crawl-max"
                    type="number"
                    min={1}
                    max={25}
                    value={crawlMax}
                    onChange={(e) => setCrawlMax(e.target.value)}
                    data-testid="input-crawl-max"
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isCrawling}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!key || !crawlUrl.trim() || isCrawling}
                  data-testid="button-run-crawl"
                  className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isCrawling ? "Crawling..." : "Crawl this site"}
                </button>
                {crawlError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {crawlError}
                  </p>
                )}
              </form>
              )}

              {mode === "pdf" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runPdf();
                }}
              >
                <div>
                  <label htmlFor="workbench-pdf-url" className="text-sm font-medium text-foreground/80">
                    PDF URL
                  </label>
                  <input
                    id="workbench-pdf-url"
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    data-testid="input-pdf-url"
                    placeholder="https://example.com/paper.pdf"
                    className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all"
                    disabled={isReadingPdf}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm cursor-pointer group w-fit">
                  <input
                    type="checkbox"
                    checked={pdfOutline}
                    onChange={(e) => setPdfOutline(e.target.checked)}
                    data-testid="checkbox-pdf-outline"
                    className="w-4 h-4 rounded border-border/80 text-[#236CFF] focus:ring-[#236CFF]/50"
                    disabled={isReadingPdf}
                  />
                  <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">Include outline</span>
                </label>
                <button
                  type="submit"
                  disabled={!key || !pdfUrl.trim() || isReadingPdf || !isValidUrl(pdfUrl.trim())}
                  data-testid="button-run-pdf"
                  className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                >
                  {isReadingPdf ? "Reading PDF..." : "Read PDF"}
                </button>
                {pdfError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {pdfError}
                  </p>
                )}
              </form>
              )}

              {mode === "watch" && (
              <div className="space-y-5">
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void registerWatch();
                  }}
                >
                  <div>
                    <label htmlFor="workbench-watch-urls" className="text-sm font-medium text-foreground/80">
                      URLs to watch — one per line, up to 20
                    </label>
                    <textarea
                      id="workbench-watch-urls"
                      value={watchText}
                      onChange={(e) => setWatchText(e.target.value)}
                      data-testid="input-watch-urls"
                      placeholder={"https://example.com/pricing\nhttps://example.com/changelog"}
                      rows={5}
                      className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all font-mono"
                      disabled={isRegisteringWatch}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">{Math.min(watchUrlCount, 20)} / 20 URLs</p>
                  </div>
                  <div>
                    <label htmlFor="workbench-watch-webhook" className="text-sm font-medium text-foreground/80">
                      Webhook URL <span className="font-normal text-muted-foreground">(optional, https)</span>
                    </label>
                    <input
                      id="workbench-watch-webhook"
                      type="url"
                      value={watchWebhook}
                      onChange={(e) => setWatchWebhook(e.target.value)}
                      data-testid="input-watch-webhook"
                      placeholder="https://example.com/hooks/skim"
                      className="mt-2 w-full bg-background border border-border/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#236CFF]/40 focus:border-[#236CFF] transition-all font-mono"
                      disabled={isRegisteringWatch}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      When GET /diff finds a change, Skim POSTs a signed payload. No email. No cron.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={!key || watchUrlCount === 0 || isRegisteringWatch}
                    data-testid="button-register-watch"
                    className="w-full bg-[#236CFF] text-white font-semibold py-3 rounded-xl hover:bg-[#236CFF]/90 transition-all shadow-[0_8px_20px_rgba(35,108,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-[1px] active:translate-y-0"
                  >
                    {isRegisteringWatch ? "Registering..." : "Register watch"}
                  </button>
                </form>

                {watchSession && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Watch id</p>
                    <code className="block text-xs font-mono break-all text-foreground" data-testid="status-watch-id">
                      {watchSession.watchId}
                    </code>
                    {watchSession.webhookUrl && (
                      <p className="text-[13px] text-muted-foreground break-all">
                        Webhook: {watchSession.webhookUrl}
                      </p>
                    )}
                    {watchSession.webhookSecret && (
                      <p className="text-[13px] text-foreground/80 break-all" data-testid="status-webhook-secret">
                        Secret (shown once): <code className="font-mono text-xs">{watchSession.webhookSecret}</code>
                      </p>
                    )}
                    <p className="text-[13px] text-muted-foreground">
                      First check saves a baseline. Later checks report what changed. Webhooks fire on that check, not in the background.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void checkWatch("diff")}
                        disabled={!key || isCheckingWatch}
                        data-testid="button-check-watch"
                        className="w-full bg-[#10131a] text-white font-semibold py-2.5 rounded-xl hover:bg-[#10131a]/90 transition-all disabled:opacity-50"
                      >
                        {isCheckingWatch ? "Checking..." : "Check for changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void checkWatch("status")}
                        disabled={!key || isCheckingWatch}
                        data-testid="button-watch-status"
                        className="w-full text-sm font-medium text-[#236CFF] hover:underline py-1"
                      >
                        Status only (free)
                      </button>
                    </div>
                  </div>
                )}

                {watchError && (
                  <p className="text-[13px] text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 leading-relaxed">
                    {watchError}
                  </p>
                )}
              </div>
              )}
            </div>

            {mode === "read" && history.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm flex flex-col">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Recent Sessions</h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 -mr-2">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className={`text-sm p-3 rounded-xl border transition-all cursor-pointer ${
                        currentResult?.id === item.id
                          ? "border-[#236CFF]/40 bg-[#236CFF]/5"
                          : "border-border/40 hover:border-border/80 hover:bg-muted/30"
                      }`}
                      onClick={() => loadHistory(item)}
                    >
                      <p className="truncate font-medium text-foreground/90">{item.url}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-muted-foreground">
                        <span>{item.ms}ms</span>
                        <span>{item.wordCount}w</span>
                        <button
                          type="button"
                          data-testid={`button-rerun-recent-read-${item.id}`}
                          className="ml-auto text-[#236CFF] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            runRead(item.url, item.stripLinks, item.stripImages);
                          }}
                        >
                          Rerun
                        </button>
                        <button
                          type="button"
                          data-testid={`button-copy-recent-request-${item.id}`}
                          className="text-[#236CFF] hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyRequest(item);
                          }}
                        >
                          Copy request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:h-[calc(100dvh-120px)] lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border/60 bg-card h-full min-h-[500px] flex flex-col shadow-sm overflow-hidden">
               {mode === "read" && currentResult ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Read Receipt</h2>
                      <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-read-receipt">
                         <span className="text-foreground/70">{currentResult.ms} ms round trip</span>
                        <span className="text-foreground/70">{currentResult.wordCount} words</span>
                        <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                          {currentResult.credits} credit{currentResult.credits > 1 ? "s (JS Fallback)" : ""}
                        </span>
                         {currentResult.jsonRaw.receipt?.tokensEst !== undefined && (
                           <span className="text-foreground/70">{currentResult.jsonRaw.receipt.tokensEst} est. tokens</span>
                         )}
                         {currentResult.jsonRaw.receipt?.cacheHit !== undefined && (
                           <span className="text-foreground/70">
                             {currentResult.jsonRaw.receipt.cacheHit
                               ? `cache ${currentResult.jsonRaw.receipt.cacheAgeSeconds ?? 0}s old`
                               : "fresh fetch"}
                           </span>
                         )}
                     </div>
                   </div>

                   <div className="flex-1 overflow-hidden flex flex-col bg-background">
                      <Tabs defaultValue="markdown" className="w-full h-full flex flex-col">
                        <div className="px-6 pt-2 border-b border-border/50 bg-muted/10">
                          <TabsList className="bg-transparent h-12">
                             <TabsTrigger value="markdown" data-testid="tab-markdown" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                              Markdown
                            </TabsTrigger>
                             <TabsTrigger value="json" data-testid="tab-json" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                              Raw JSON
                            </TabsTrigger>
                             <TabsTrigger value="code" data-testid="tab-integration" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                              Integration
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="markdown" className="flex-1 p-0 m-0 overflow-hidden flex flex-col outline-none">
                          <div className="flex justify-end p-3 border-b border-border/30 bg-muted/5">
                            <button
                              type="button"
                              onClick={copyMarkdown}
                              data-testid="button-copy-markdown"
                              className="text-xs bg-background border border-border hover:bg-muted px-3 py-1.5 rounded-lg font-medium transition-colors text-foreground/80 flex items-center gap-2"
                            >
                              {copiedMarkdown ? "Copied to clipboard" : "Copy Markdown"}
                            </button>
                          </div>
                          <div className="flex-1 overflow-auto p-6">
                            <pre className="text-[13px] leading-[1.8] font-mono whitespace-pre-wrap text-foreground/80 break-words">
                              {currentResult.markdown}
                            </pre>
                          </div>
                        </TabsContent>

                        <TabsContent value="json" className="flex-1 p-6 overflow-auto m-0 outline-none">
                          <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                            {JSON.stringify(currentResult.jsonRaw, null, 2)}
                          </pre>
                        </TabsContent>

                        <TabsContent value="code" className="flex-1 p-6 overflow-auto m-0 outline-none">
                           <div className="space-y-8 max-w-3xl">
                              <div className="text-[13px] text-muted-foreground bg-muted/40 p-4 rounded-xl border border-border/50">
                                Use these exact snippets to run this request from your agent or backend. The trial key is included for testing.
                              </div>
                              <CodeSnippet
                                title="cURL"
                                code={curlSnippet(currentResult)}
                              />
                              <CodeSnippet
                                title="JavaScript"
                                code={`const url = ${JSON.stringify(currentResult.url)};\nconst params = new URLSearchParams({ url });${currentResult.stripLinks ? '\nparams.set("stripLinks", "true");' : ''}${currentResult.stripImages ? '\nparams.set("stripImages", "true");' : ''}\nconst res = await fetch(\n  \`https://skim402.com/api/t/read?\${params}\`,\n  { headers: { Authorization: "Bearer ${token}" } }\n);\nconst data = await res.json();\nconsole.log(data.markdown);`}
                              />
                              <CodeSnippet
                                title="Python"
                                code={`import requests\n\nres = requests.get(\n    "https://skim402.com/api/t/read",\n    headers={"Authorization": "Bearer ${token}"},\n    params={\n        "url": ${JSON.stringify(currentResult.url)}${currentResult.stripLinks ? ',\n        "stripLinks": "true"' : ''}${currentResult.stripImages ? ',\n        "stripImages": "true"' : ''}\n    }\n)\nprint(res.json().get("markdown", ""))`}
                              />
                           </div>
                        </TabsContent>
                      </Tabs>
                   </div>
                 </div>
               ) : mode === "batch" && batchResult ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Batch receipt</h2>
                     <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-batch-receipt">
                       <span className="text-foreground/70">{batchResult.ms} ms</span>
                       <span className="text-foreground/70">
                         {batchResult.results.filter((item) => item.ok).length}/{batchResult.results.length || batchResult.urls.length} pages
                       </span>
                       <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                         {creditLabel(batchResult.credits)}
                       </span>
                     </div>
                   </div>
                   <div className="flex-1 overflow-hidden flex flex-col bg-background">
                     <Tabs defaultValue="pages" className="w-full h-full flex flex-col">
                       <div className="px-6 pt-2 border-b border-border/50 bg-muted/10">
                         <TabsList className="bg-transparent h-12">
                           <TabsTrigger value="pages" data-testid="tab-batch-pages" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Pages
                           </TabsTrigger>
                           <TabsTrigger value="json" data-testid="tab-batch-json" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Raw JSON
                           </TabsTrigger>
                           <TabsTrigger value="code" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Integration
                           </TabsTrigger>
                         </TabsList>
                       </div>
                       <TabsContent value="pages" className="flex-1 p-6 overflow-auto m-0 outline-none space-y-4">
                         {(batchResult.results.length ? batchResult.results : batchResult.urls.map((item) => ({ url: item, ok: false }))).map((item, index) => (
                           <div key={`${item.url}-${index}`} className="rounded-xl border border-border/50 p-4">
                             <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                               <p className="text-sm font-medium break-all">{item.url}</p>
                               <span className={`text-xs font-semibold ${item.ok ? "text-foreground/70" : "text-destructive"}`}>
                                 {item.ok ? "Read" : "Failed"}
                               </span>
                             </div>
                             {item.ok ? (
                               <pre className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80 max-h-64 overflow-auto">
                                 {item.data?.markdown || JSON.stringify(item.data, null, 2)}
                               </pre>
                             ) : (
                               <p className="text-[13px] text-destructive">
                                 {typeof item.error === "string"
                                   ? item.error
                                   : item.error?.message || "This URL could not be read."}
                               </p>
                             )}
                           </div>
                         ))}
                       </TabsContent>
                       <TabsContent value="json" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                           {JSON.stringify(batchResult.jsonRaw, null, 2)}
                         </pre>
                       </TabsContent>
                       <TabsContent value="code" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <CodeSnippet
                           title="cURL"
                           code={`curl -X POST https://skim402.com/api/t/read/batch \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ urls: batchResult.urls, stripLinks: batchResult.stripLinks, stripImages: batchResult.stripImages })}'`}
                         />
                       </TabsContent>
                     </Tabs>
                   </div>
                 </div>
               ) : mode === "extract" && extractResult ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Extract receipt</h2>
                     <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-extract-receipt">
                       <span className="text-foreground/70">{extractResult.ms} ms</span>
                       <span className="text-foreground/70">
                         {extractResult.tables.length} table{extractResult.tables.length === 1 ? "" : "s"}
                       </span>
                       <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                         {creditLabel(extractResult.credits)}
                       </span>
                     </div>
                   </div>
                   <div className="flex-1 overflow-hidden flex flex-col bg-background">
                     <Tabs defaultValue="rows" className="w-full h-full flex flex-col">
                       <div className="px-6 pt-2 border-b border-border/50 bg-muted/10">
                         <TabsList className="bg-transparent h-12">
                           <TabsTrigger value="rows" data-testid="tab-extract-rows" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Rows
                           </TabsTrigger>
                           <TabsTrigger value="json" data-testid="tab-extract-json" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Raw JSON
                           </TabsTrigger>
                           <TabsTrigger value="code" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Integration
                           </TabsTrigger>
                         </TabsList>
                       </div>
                       <TabsContent value="rows" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <ExtractedTables tables={extractResult.tables} fallback={extractResult.data} />
                       </TabsContent>
                       <TabsContent value="json" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                           {JSON.stringify(extractResult.jsonRaw, null, 2)}
                         </pre>
                       </TabsContent>
                       <TabsContent value="code" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <CodeSnippet
                           title="cURL"
                           code={`curl -X POST https://skim402.com/api/t/extract \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({
                             url: extractResult.url,
                             schema: TABLE_SCHEMA,
                             ...(extractResult.intent ? { instructions: extractResult.intent } : {}),
                           })}'`}
                         />
                       </TabsContent>
                     </Tabs>
                   </div>
                 </div>
               ) : mode === "crawl" && crawlResult ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Crawl receipt</h2>
                     <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-crawl-receipt">
                       <span className="text-foreground/70">{crawlResult.ms} ms</span>
                       <span className="text-foreground/70">
                         {crawlResult.pages.filter((item) => item.ok).length}/{crawlResult.pages.length} pages
                       </span>
                       <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                         {creditLabel(crawlResult.charged)}
                       </span>
                     </div>
                   </div>
                   <div className="flex-1 overflow-hidden flex flex-col bg-background">
                     <Tabs defaultValue="pages" className="w-full h-full flex flex-col">
                       <div className="px-6 pt-2 border-b border-border/50 bg-muted/10">
                         <TabsList className="bg-transparent h-12">
                           <TabsTrigger value="pages" data-testid="tab-crawl-pages" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Pages
                           </TabsTrigger>
                           <TabsTrigger value="json" data-testid="tab-crawl-json" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Raw JSON
                           </TabsTrigger>
                           <TabsTrigger value="code" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Integration
                           </TabsTrigger>
                         </TabsList>
                       </div>
                       <TabsContent value="pages" className="flex-1 p-6 overflow-auto m-0 outline-none space-y-4">
                         {crawlResult.sources.length > 0 && (
                           <p className="text-xs text-muted-foreground">Discovery: {crawlResult.sources.join(", ")}</p>
                         )}
                         {crawlResult.pages.map((item, index) => (
                           <div key={`${item.url}-${index}`} className="rounded-xl border border-border/50 p-4">
                             <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                               <p className="text-sm font-medium break-all">{item.url}</p>
                               <span className={`text-xs font-semibold ${item.ok ? "text-foreground/70" : "text-destructive"}`}>
                                 {item.ok ? "Read" : "Failed"}
                               </span>
                             </div>
                             {item.ok ? (
                               <pre className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80 max-h-64 overflow-auto">
                                 {item.markdown || item.title || ""}
                               </pre>
                             ) : (
                               <p className="text-[13px] text-destructive">
                                 {typeof item.error === "string" ? item.error : item.error?.message || "This URL could not be read."}
                               </p>
                             )}
                           </div>
                         ))}
                       </TabsContent>
                       <TabsContent value="json" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                           {JSON.stringify(crawlResult.jsonRaw, null, 2)}
                         </pre>
                       </TabsContent>
                       <TabsContent value="code" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <CodeSnippet
                           title="cURL"
                           code={`curl -X POST https://skim402.com/api/t/crawl \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ url: crawlResult.startUrl, maxPages: Number(crawlMax) || 10 })}'`}
                         />
                       </TabsContent>
                     </Tabs>
                   </div>
                 </div>
               ) : mode === "pdf" && pdfResult ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">PDF receipt</h2>
                     <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-pdf-receipt">
                       <span className="text-foreground/70">{pdfResult.ms} ms</span>
                       {typeof pdfResult.pageCount === "number" && (
                         <span className="text-foreground/70">{pdfResult.pageCount} pages</span>
                       )}
                       <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                         {creditLabel(pdfResult.charged)}
                       </span>
                     </div>
                   </div>
                   <div className="flex-1 overflow-hidden flex flex-col bg-background">
                     <Tabs defaultValue="markdown" className="w-full h-full flex flex-col">
                       <div className="px-6 pt-2 border-b border-border/50 bg-muted/10">
                         <TabsList className="bg-transparent h-12">
                           <TabsTrigger value="markdown" data-testid="tab-pdf-markdown" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Markdown
                           </TabsTrigger>
                           <TabsTrigger value="json" data-testid="tab-pdf-json" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Raw JSON
                           </TabsTrigger>
                           <TabsTrigger value="code" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#236CFF] rounded-none px-4 h-full">
                             Integration
                           </TabsTrigger>
                         </TabsList>
                       </div>
                       <TabsContent value="markdown" className="flex-1 p-6 overflow-auto m-0 outline-none space-y-4">
                         {pdfResult.outline.length > 0 && (
                           <div>
                             <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Outline</p>
                             <ul className="text-sm text-foreground/80 space-y-1">
                               {pdfResult.outline.map((item, index) => (
                                 <li key={`${item.title}-${index}`}>{item.title}</li>
                               ))}
                             </ul>
                           </div>
                         )}
                         <pre className="text-[13px] leading-[1.8] font-mono whitespace-pre-wrap text-foreground/80 break-words">
                           {pdfResult.markdown}
                         </pre>
                       </TabsContent>
                       <TabsContent value="json" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                           {JSON.stringify(pdfResult.jsonRaw, null, 2)}
                         </pre>
                       </TabsContent>
                       <TabsContent value="code" className="flex-1 p-6 overflow-auto m-0 outline-none">
                         <CodeSnippet
                           title="cURL"
                           code={`curl -X POST https://skim402.com/api/t/read-pdf \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ url: pdfResult.url, outline: pdfOutline })}'`}
                         />
                       </TabsContent>
                     </Tabs>
                   </div>
                 </div>
               ) : mode === "watch" && (watchResult || watchSession) ? (
                 <div className="flex flex-col h-full">
                   <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
                     <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Watch receipt</h2>
                     <div className="flex items-center gap-4 text-[13px] font-mono font-medium" data-testid="status-watch-receipt">
                       {watchResult?.ms ? <span className="text-foreground/70">{watchResult.ms} ms</span> : null}
                       {typeof watchResult?.changedCount === "number" && (
                         <span className="text-foreground/70">
                           {watchResult.changedCount} changed
                         </span>
                       )}
                       {watchResult?.fresh && <span className="text-foreground/70">cached check</span>}
                       <span className="bg-[#fde68a] text-[#5a4500] px-2 py-0.5 rounded-md">
                         {watchResult
                           ? watchResult.credits === 0
                             ? "Free"
                             : creditLabel(watchResult.credits)
                           : "Registered"}
                       </span>
                     </div>
                   </div>
                   <div className="flex-1 overflow-auto p-6 bg-background space-y-6">
                     {watchResult?.kind === "diff" && typeof watchResult.changedCount === "number" && (
                       <p className="text-sm text-foreground/80">
                         {watchResult.changedCount === 0
                           ? "No content changes since the last check."
                           : `${watchResult.changedCount} page${watchResult.changedCount === 1 ? "" : "s"} changed.`}
                       </p>
                     )}
                     {watchResult ? (
                       <WatchUrlList urls={watchResult.urls} />
                     ) : (
                       <p className="text-sm text-muted-foreground">
                         Watch registered. Press Check for changes to save a baseline, then check again later.
                       </p>
                     )}
                     {watchResult && (
                       <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/70 bg-muted/20 p-4 rounded-xl border border-border/40">
                         {JSON.stringify(watchResult.jsonRaw, null, 2)}
                       </pre>
                     )}
                   </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center h-full">
                    {isBusy ? (
                       <div className="flex flex-col items-center gap-6">
                         <div className="w-12 h-12 rounded-full bg-[#236CFF]/10 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-2 border-[#236CFF]/20 border-t-[#236CFF] animate-spin" />
                         </div>
                         <p className="text-[15px] font-medium text-[#236CFF]">
                           {mode === "extract" ? "Extracting the table..." : mode === "crawl" ? "Crawling the site..." : mode === "pdf" ? "Reading the PDF..." : mode === "watch" ? "Talking to Watch..." : "Skimming the web..."}
                         </p>
                       </div>
                    ) : (
                       <div className="max-w-[320px] flex flex-col items-center">
                         <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center mb-6 shadow-sm">
                           <span className="text-3xl font-bold opacity-20 text-foreground font-sans">S</span>
                         </div>
                         <p className="text-[15px] font-medium text-foreground/80 mb-2">Workbench is empty</p>
                         <p className="text-[13px] leading-relaxed">
                           Create a trial key, pick a mode above, and run a request to see markdown, crawled pages, a PDF, or changed/unchanged results here.
                         </p>
                       </div>
                    )}
                 </div>
               )}
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}
