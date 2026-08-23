import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Button } from "@/components/ui/button";
import { COPY_SLOTS, useSiteCopy, renderCopy } from "@/lib/siteCopy";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type SaveState = "idle" | "saving" | "saved" | "error";

function CopyEditor({
  slotKey,
  currentValue,
  isOverridden,
  onChanged,
}: {
  slotKey: string;
  currentValue: string;
  isOverridden: boolean;
  onChanged: () => void;
}) {
  const slot = COPY_SLOTS[slotKey];
  const [value, setValue] = useState(currentValue);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const dirty = value !== currentValue;

  async function save() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/_site-copy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: slotKey, value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      setState("saved");
      onChanged();
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function reset() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/_site-copy/${encodeURIComponent(slotKey)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Reset failed (${res.status})`);
      setValue(slot.text);
      setState("saved");
      onChanged();
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <div className="font-semibold text-sm">{slot.label}</div>
        {isOverridden && (
          <span className="text-xs text-primary font-medium shrink-0">
            edited
          </span>
        )}
      </div>
      {slot.hint && (
        <p className="text-xs text-muted-foreground mb-2">{slot.hint}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.max(2, Math.ceil(value.length / 80))}
        className="w-full rounded-md border border-border bg-background p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <span className="text-xs uppercase tracking-wide mr-2 opacity-60">
          Preview
        </span>
        <span className="text-foreground">{renderCopy(value)}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={reset}
          disabled={state === "saving" || (!isOverridden && !dirty)}
        >
          Reset to default
        </Button>
        {state === "saved" && (
          <span className="text-sm text-primary font-medium">Saved.</span>
        )}
        {state === "error" && (
          <span className="text-sm text-destructive">{error}</span>
        )}
      </div>
    </div>
  );
}

export default function EditCopy() {
  useDocumentMeta({
    title: "Edit site copy — Skim",
    description: "Operator-only copy editor.",
    canonical: "https://skim402.com/edit",
  });
  const { copy, overrides, isLoading } = useSiteCopy();
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["site-copy"] });

  const keys = Object.keys(COPY_SLOTS);
  const homeKeys = keys.filter((k) => k.startsWith("home."));
  const faqKeys = keys.filter((k) => k.startsWith("faq."));

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Edit site copy
        </h1>
        <p className="text-muted-foreground mb-2 leading-relaxed">
          Changes go live on the site within about a minute of saving — no
          republish needed. New lines you type become line breaks. Links:
          [link text](url). Blue accent: **text**.
        </p>
        <p className="text-sm text-muted-foreground mb-10">
          Saving requires an operator sign-in — if saves fail with a
          permission error, sign in via Operator Sign In first.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading current copy…</p>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">Home page hero</h2>
            <div className="space-y-4 mb-12">
              {homeKeys.map((k) => (
                <CopyEditor
                  key={k}
                  slotKey={k}
                  currentValue={copy(k)}
                  isOverridden={k in overrides}
                  onChanged={refresh}
                />
              ))}
            </div>
            <h2 className="text-xl font-bold mb-4">
              Q&A page — highlighted block
            </h2>
            <div className="space-y-4">
              {faqKeys.map((k) => (
                <CopyEditor
                  key={k}
                  slotKey={k}
                  currentValue={copy(k)}
                  isOverridden={k in overrides}
                  onChanged={refresh}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
