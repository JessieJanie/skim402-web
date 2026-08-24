/** Ledger remaining credits from GET /api/card/account. */

export function creditsFromAccount(account: unknown): number | null {
  if (!account || typeof account !== "object" || Array.isArray(account)) return null;
  const rec = account as Record<string, unknown>;
  for (const key of ["creditsRemaining", "remainingCredits"] as const) {
    const value = rec[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  }
  const packs = rec.packCredits;
  const plan = rec.planCredits;
  if (typeof packs === "number" || typeof plan === "number") {
    return Math.max(0, (Number(packs) || 0) + (Number(plan) || 0));
  }
  if (typeof rec.credits === "number" && Number.isFinite(rec.credits)) {
    return Math.max(0, rec.credits);
  }
  return null;
}

export async function fetchAccountCredits(apiBase: string, token: string): Promise<number | null> {
  try {
    const base = apiBase.replace(/\/+$/, "");
    const res = await fetch(`${base}/card/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return creditsFromAccount(body);
  } catch {
    return null;
  }
}
