import { useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Activity } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  useGetUsageByDay,
  useGetUsageByMode,
  useGetUsageRecent,
  getGetUsageByDayQueryKey,
  getGetUsageRecentQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

const ranges = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
] as const;

const modeColors: Record<string, string> = {
  basic: "bg-primary",
  js: "bg-blue-500",
  structured: "bg-purple-500",
};

export default function DashboardUsage() {
  const [days, setDays] = useState<number>(30);

  const byDay = useGetUsageByDay(
    { days },
    { query: { queryKey: getGetUsageByDayQueryKey({ days }) } }
  );
  const byMode = useGetUsageByMode();
  const recent = useGetUsageRecent(
    { limit: 100 },
    { query: { queryKey: getGetUsageRecentQueryKey({ limit: 100 }) } }
  );

  const chartData = (byDay.data ?? []).map((d) => ({
    day: format(parseISO(d.day), days <= 7 ? "EEE" : "MMM d"),
    Successes: d.successes,
    Failures: d.failures,
  }));

  const totalModeReqs = (byMode.data ?? []).reduce((acc, m) => acc + m.requests, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
        <p className="text-muted-foreground mt-1">
          Detailed traffic, per-mode breakdown, and a live log of every request.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Traffic</CardTitle>
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v))}
            className="inline-flex rounded-md border border-border bg-card p-0.5"
          >
            {ranges.map((r) => (
              <ToggleGroupItem
                key={r.value}
                value={r.value}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  String(days) === r.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {byDay.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Activity className="h-8 w-8 mb-3 opacity-40" />
              <p>No traffic in this window.</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Successes" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Failures" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By mode</CardTitle>
        </CardHeader>
        <CardContent>
          {byMode.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !byMode.data || byMode.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage yet.</p>
          ) : (
            <div className="space-y-4">
              {byMode.data.map((m) => {
                const share =
                  totalModeReqs > 0 ? Math.round((m.requests / totalModeReqs) * 100) : 0;
                return (
                  <div key={m.mode}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-mono font-medium capitalize">{m.mode}</span>
                      <span className="text-muted-foreground">
                        {m.requests.toLocaleString()} · {share}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${modeColors[m.mode] ?? "bg-primary"} transition-all`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.isLoading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !recent.data || recent.data.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No calls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-medium px-6 py-3">Status</th>
                    <th className="text-left font-medium px-6 py-3">URL</th>
                    <th className="text-left font-medium px-6 py-3">Mode</th>
                    <th className="text-left font-medium px-6 py-3">Key</th>
                    <th className="text-right font-medium px-6 py-3">Latency</th>
                    <th className="text-right font-medium px-6 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.data.map((e) => {
                    const ok = e.statusCode >= 200 && e.statusCode < 300;
                    return (
                      <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono text-xs",
                              ok
                                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : "border-destructive/30 text-destructive"
                            )}
                          >
                            {e.statusCode}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs max-w-md truncate" title={e.url}>
                          {e.url}
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground capitalize">
                          {e.mode}
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground truncate max-w-[150px]">
                          {e.apiKeyName ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-right text-xs text-muted-foreground">
                          {e.latencyMs}ms
                        </td>
                        <td className="px-6 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
