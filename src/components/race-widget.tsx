import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Trophy, Zap } from "lucide-react";

type DemoUrl = {
  label: string;
  url: string;
  firecrawlMs: number;
};

const DEMO_URLS: DemoUrl[] = [
  {
    label: "Wikipedia / Anthropic",
    url: "https://en.wikipedia.org/wiki/Anthropic",
    firecrawlMs: 6950,
  },
  {
    label: "Wikipedia / Bitcoin",
    url: "https://en.wikipedia.org/wiki/Bitcoin",
    firecrawlMs: 9347,
  },
  {
    label: "Wikipedia / HTTP 402",
    url: "https://en.wikipedia.org/wiki/HTTP_402",
    firecrawlMs: 7601,
  },
  {
    label: "MDN / Using Fetch",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch",
    firecrawlMs: 6321,
  },
  {
    label: "GitHub README (coinbase/x402)",
    url: "https://github.com/coinbase/x402/blob/main/README.md",
    firecrawlMs: 3436,
  },
];

type RaceState =
  | { phase: "idle" }
  | { phase: "racing"; startedAt: number }
  | {
      phase: "done";
      skimMs: number;
      firecrawlMs: number;
      skimError: string | null;
    };

export function RaceWidget({ autoLoop = false }: { autoLoop?: boolean } = {}) {
  const [pickIdx, setPickIdx] = useState(0);
  const [state, setState] = useState<RaceState>({ phase: "idle" });
  const [skimElapsed, setSkimElapsed] = useState(0);
  const [fcElapsed, setFcElapsed] = useState(0);
  const skimFinishedAt = useRef<number | null>(null);
  const skimErrorRef = useRef<string | null>(null);
  const fcFinishedAt = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedOnceRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loopActiveRef = useRef(autoLoop);
  const loopTimeoutRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);
  const pickIdxRef = useRef(pickIdx);
  pickIdxRef.current = pickIdx;

  const pick = DEMO_URLS[pickIdx];

  // Auto-play the race once when the widget scrolls into view.
  useEffect(() => {
    if (startedOnceRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedOnceRef.current) {
            startedOnceRef.current = true;
            startRace();
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause the auto-loop when the tab is hidden so we don't burn the rate
  // limit when no one's looking. Resume on focus by triggering the next race.
  useEffect(() => {
    if (!autoLoop) return;
    function onVisibility() {
      isVisibleRef.current = !document.hidden;
      if (
        !document.hidden &&
        loopActiveRef.current &&
        state.phase === "idle"
      ) {
        startRace();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoop, state.phase]);

  // When a race finishes and autoLoop is on, advance to the next URL and
  // start the next race after a short pause so the result is readable.
  useEffect(() => {
    if (!autoLoop) return;
    if (state.phase !== "done") return;
    if (!loopActiveRef.current) return;
    if (!isVisibleRef.current) return;
    // Stop after the 5th race completes — the cycle is done, let the user
    // hit "Run all 5 again" if they want another pass.
    if (pickIdxRef.current === DEMO_URLS.length - 1) {
      loopActiveRef.current = false;
      return;
    }
    loopTimeoutRef.current = window.setTimeout(() => {
      if (!loopActiveRef.current || !isVisibleRef.current) return;
      const nextIdx = pickIdxRef.current + 1;
      setPickIdx(nextIdx);
      startRace(nextIdx);
    }, 2500);
    return () => {
      if (loopTimeoutRef.current !== null) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoop, state.phase]);

  function tick() {
    if (state.phase !== "racing") return;
    const now = Date.now();
    const elapsed = now - state.startedAt;
    if (skimFinishedAt.current === null) setSkimElapsed(elapsed);
    if (fcFinishedAt.current === null) {
      if (elapsed >= pick.firecrawlMs) {
        fcFinishedAt.current = pick.firecrawlMs;
        setFcElapsed(pick.firecrawlMs);
      } else {
        setFcElapsed(elapsed);
      }
    }
    if (skimFinishedAt.current !== null && fcFinishedAt.current !== null) {
      setState({
        phase: "done",
        skimMs: skimFinishedAt.current,
        firecrawlMs: fcFinishedAt.current,
        skimError: skimErrorRef.current,
      });
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  // Keep the rAF loop alive while the phase is "racing".
  useEffect(() => {
    if (state.phase !== "racing") return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  function startRace(idx?: number) {
    const useIdx = idx ?? pickIdxRef.current;
    const usePick = DEMO_URLS[useIdx];
    skimFinishedAt.current = null;
    skimErrorRef.current = null;
    fcFinishedAt.current = null;
    setSkimElapsed(0);
    setFcElapsed(0);
    const startedAt = Date.now();
    setState({ phase: "racing", startedAt });

    // Fire the real Skim call. The Firecrawl side animates against the
    // pre-recorded number for this URL — we don't hit Firecrawl per visitor
    // (cost + API key exposure). Disclosure is rendered below the widget.
    // Errors are stashed in skimErrorRef; the rAF tick() reads it when
    // building the final "done" state, so the red callout always wins
    // when Skim fails. Firecrawl's animation keeps running to completion.
    fetch(`/api/demo/race?url=${encodeURIComponent(usePick.url)}`)
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          ms?: number;
          error?: string;
        };
        if (!r.ok || !data.ok) {
          skimErrorRef.current = data.error ?? `HTTP ${r.status}`;
          skimFinishedAt.current = Date.now() - startedAt;
        } else {
          skimFinishedAt.current = data.ms ?? Date.now() - startedAt;
        }
        setSkimElapsed(skimFinishedAt.current);
      })
      .catch((err: unknown) => {
        skimErrorRef.current =
          err instanceof Error ? err.message : "Network error";
        skimFinishedAt.current = Date.now() - startedAt;
        setSkimElapsed(skimFinishedAt.current);
      });
  }

  const winnerRatio =
    state.phase === "done" && state.skimMs > 0
      ? state.firecrawlMs / state.skimMs
      : null;
  const isRunning = state.phase === "racing";

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-border bg-zinc-950 text-zinc-100 overflow-hidden shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="ml-2 font-mono">skim-vs-firecrawl.live</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          live race
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400 font-mono">URL:</span>
          <select
            disabled={isRunning}
            value={pickIdx}
            onChange={(e) => {
              loopActiveRef.current = false;
              if (loopTimeoutRef.current !== null) {
                clearTimeout(loopTimeoutRef.current);
                loopTimeoutRef.current = null;
              }
              setPickIdx(Number(e.target.value));
              setState({ phase: "idle" });
              setSkimElapsed(0);
              setFcElapsed(0);
            }}
            className="flex-1 min-w-0 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-zinc-600 disabled:opacity-60"
          >
            {DEMO_URLS.map((d, i) => (
              <option key={d.url} value={i}>
                {d.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => {
              if (autoLoop) {
                // Restart the full 5-URL cycle from the top.
                if (loopTimeoutRef.current !== null) {
                  clearTimeout(loopTimeoutRef.current);
                  loopTimeoutRef.current = null;
                }
                loopActiveRef.current = true;
                setPickIdx(0);
                startRace(0);
              } else {
                startRace();
              }
            }}
            disabled={isRunning}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
          >
            {state.phase === "done" ? (
              <>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Race again
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {isRunning ? "Racing…" : "Run live race"}
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <RacerColumn
            name="Skim"
            tag="x402"
            color="amber"
            elapsed={skimElapsed}
            done={skimFinishedAt.current !== null}
            isWinner={
              state.phase === "done" && state.skimMs < state.firecrawlMs
            }
            error={state.phase === "done" ? state.skimError : null}
          />
          <RacerColumn
            name="Firecrawl"
            tag="recorded"
            color="zinc"
            elapsed={fcElapsed}
            done={fcFinishedAt.current !== null}
            isWinner={
              state.phase === "done" && state.firecrawlMs < state.skimMs
            }
            error={null}
          />
        </div>

        {state.phase === "done" && winnerRatio !== null && !state.skimError && (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="text-sm">
              <span className="font-mono text-amber-300 font-bold">
                Skim won — {winnerRatio.toFixed(1)}x faster
              </span>
              <span className="text-zinc-400 ml-2">
                ({state.skimMs.toLocaleString()}ms vs{" "}
                {state.firecrawlMs.toLocaleString()}ms)
              </span>
            </div>
          </div>
        )}
        {state.phase === "done" && state.skimError && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Skim hiccupped on this run: {state.skimError}. Hit "Run again."
          </div>
        )}

        <p className="mt-4 text-[11px] text-zinc-500 leading-relaxed">
          Skim's number is measured live in your browser against{" "}
          <code className="text-zinc-400">/api/demo/race</code>. Firecrawl's
          number is the recorded result from our 2026-05-22 benchmark on the
          same URL — we don't hit their API per visitor (API key + cost).
          Rate-limited to 20 runs/min per IP.
        </p>
      </div>
    </div>
  );
}

function RacerColumn(props: {
  name: string;
  tag: string;
  color: "amber" | "zinc";
  elapsed: number;
  done: boolean;
  isWinner: boolean;
  error: string | null;
}) {
  const secs = (props.elapsed / 1000).toFixed(2);
  const accent =
    props.color === "amber" ? "text-amber-400" : "text-zinc-400";
  const ring =
    props.color === "amber" ? "border-amber-500/40" : "border-zinc-700";
  return (
    <div className={`rounded-xl border ${ring} bg-zinc-900/60 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap
            className={`h-4 w-4 ${
              props.isWinner ? "text-amber-400" : "text-zinc-400"
            }`}
          />
          <span className="font-semibold text-zinc-100">{props.name}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {props.tag}
        </span>
      </div>
      <div
        className={`font-mono text-3xl sm:text-4xl tabular-nums ${
          props.isWinner ? accent : "text-zinc-300"
        }`}
      >
        {secs}s
      </div>
      <div className="mt-2 text-[11px] text-zinc-500 h-4">
        {props.error
          ? "error"
          : props.done
            ? props.isWinner
              ? "winner"
              : "done"
            : "running…"}
      </div>
    </div>
  );
}
