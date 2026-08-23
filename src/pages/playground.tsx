import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const API_BASE = `${import.meta.env.BASE_URL}api`;
const SESSION_KEY_STORAGE = "skim-workbench-trial-key";

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

export default function Playground() {
  useDocumentMeta({
    title: "Reader Workbench | Skim",
    description:
      "Test the Skim reader, adjust output options, and generate integration code for your AI agent.",
    canonical: "https://skim402.com/playground",
  });

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

  const isValidUrl = (s: string) => {
    try {
      const parsed = new URL(s);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
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
        if (res.status === 401) {
          setReadError("Invalid or expired API key.");
          setKey(null);
          window.localStorage.removeItem(SESSION_KEY_STORAGE);
        } else if (res.status === 402) {
          setReadError("Insufficient credits. Add a card for the Free Plan or use wallet pay.");
        } else if (res.status === 429) {
          setReadError("Rate limit exceeded. Try again in a minute.");
        } else {
          setReadError(body?.error || "Read failed. Please try another URL.");
        }
        setIsReading(false);
        return;
      }

      const creditsUsed = res.headers.get("X-Skim-Fallback") === "js" ? 2 : 1;
      const wordCount = body.wordCount ?? 0;
      
      setKey(prev => prev ? { ...prev, credits: Math.max(0, prev.credits - creditsUsed) } : null);

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
    } catch (err) {
      setReadError("Network error. Could not reach the reader.");
    } finally {
      setIsReading(false);
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
    setUrl(item.url);
    setStripLinks(item.stripLinks);
    setStripImages(item.stripImages);
    setCurrentResult(item);
    setReadError("");
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 md:py-16">
        
        {/* Title Block */}
        <div className="mb-10">
          <Badge variant="secondary" className="mb-3 bg-[#fde68a] text-[#5a4500] hover:bg-[#fde68a]">
            Developer Tools
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#10131a]">
            Reader Workbench
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Test the Skim reader, adjust options, and copy exact integration snippets for your AI agent.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">
          
          <div className="flex flex-col gap-6">
            {/* Key Panel */}
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

            {/* Request Panel */}
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm flex flex-col">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">2. Read Request</h2>
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
            </div>

            {/* History Panel */}
            {history.length > 0 && (
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
            {/* Result Panel */}
            <div className="rounded-2xl border border-border/60 bg-card h-full min-h-[500px] flex flex-col shadow-sm overflow-hidden">
               {currentResult ? (
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
                                code={`const url = ${JSON.stringify(currentResult.url)};\nconst params = new URLSearchParams({ url });${currentResult.stripLinks ? '\nparams.set("stripLinks", "true");' : ''}${currentResult.stripImages ? '\nparams.set("stripImages", "true");' : ''}\nconst res = await fetch(\n  \`https://skim402.com/api/t/read?\${params}\`,\n  { headers: { Authorization: "Bearer ${key?.token ?? "YOUR_API_KEY"}" } }\n);\nconst data = await res.json();\nconsole.log(data.markdown);`}
                              />
                              <CodeSnippet 
                                title="Python" 
                                code={`import requests\n\nres = requests.get(\n    "https://skim402.com/api/t/read",\n    headers={"Authorization": "Bearer ${key?.token ?? "YOUR_API_KEY"}"},\n    params={\n        "url": ${JSON.stringify(currentResult.url)}${currentResult.stripLinks ? ',\n        "stripLinks": "true"' : ''}${currentResult.stripImages ? ',\n        "stripImages": "true"' : ''}\n    }\n)\nprint(res.json().get("markdown", ""))`}
                              />
                           </div>
                        </TabsContent>
                      </Tabs>
                   </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center h-full">
                    {isReading ? (
                       <div className="flex flex-col items-center gap-6">
                         <div className="w-12 h-12 rounded-full bg-[#236CFF]/10 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-2 border-[#236CFF]/20 border-t-[#236CFF] animate-spin" />
                         </div>
                         <p className="text-[15px] font-medium text-[#236CFF]">Skimming the web...</p>
                       </div>
                    ) : (
                       <div className="max-w-[280px] flex flex-col items-center">
                         <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center mb-6 shadow-sm">
                           <span className="text-3xl font-bold opacity-20 text-foreground font-sans">S</span>
                         </div>
                         <p className="text-[15px] font-medium text-foreground/80 mb-2">Workbench is empty</p>
                         <p className="text-[13px] leading-relaxed">
                           Create a trial key and run a read request to view the markdown output, raw JSON, and integration snippets here.
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
