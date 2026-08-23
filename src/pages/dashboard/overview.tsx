import { Link } from "wouter";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Radio,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useGetMe,
  useGetUsageSummary,
  useGetUsageByDay,
  useGetUsageByMode,
  useGetUsageRecent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const modeColors: Record<string, string> = {
  basic: "bg-primary",
  js: "bg-blue-500",
  structured: "bg-purple-500",
};

export default function DashboardOverview() {
  const me = useGetMe();
  const summary = useGetUsageSummary();
  const byDay = useGetUsageByDay({ days: 30 });
  const byMode = useGetUsageByMode();
  const recent = useGetUsageRecent({ limit: 8 });

  const planLabel = me.data?.planTier ?? "free";
  const used = summary.data?.requestsThisMonth ?? 0;
  const quota = summary.data?.monthlyQuota ?? me.data?.monthlyQuota ?? 1000;
  const pct = Math.min(100, Math.round((used / Math.max(1, quota)) * 100));

  const chartData = (byDay.data ?? []).map((d) => ({
    day: format(parseISO(d.day), "MMM d"),
    requests: d.requests,
    successes: d.successes,
    failures: d.failures,
  }));

  const totalModeReqs = (byMode.data ?? []).reduce((acc, m) => acc + m.requests, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's how your Skim usage is shaping up.
          </p>
        </div>
        <Badge variant="outline" className="capitalize text-sm py-1.5 px-3">
          {planLabel} plan
        </Badge>
      </div>

      {/* Live x402 traffic — pointer to the live metrics page for the public
          /v1/* endpoints. The dashboard above is API-key-scoped (legacy);
          the metrics page below is the live view of x402 traffic at the
          process level. */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-emerald-500/10 p-2">
                <Radio className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Live x402 traffic</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  Real-time request counts, latencies (p50 / p95), and error
                  rates for the public <code className="text-xs">/v1/*</code>{" "}
                  endpoints. In-memory, auto-refreshes every 5s. Useful for
                  watching launch traffic.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/api/v1/_metrics" target="_blank" rel="noreferrer">
                Open live metrics
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quota card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-muted-foreground">This month's usage</p>
              <p className="text-2xl font-bold tracking-tight mt-1">
                {used.toLocaleString()}{" "}
                <span className="text-muted-foreground font-normal text-lg">
                  / {quota.toLocaleString()} requests
                </span>
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">
                Upgrade <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {pct}% of monthly quota used · resets on the 1st
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today"
          value={(summary.data?.requestsToday ?? 0).toLocaleString()}
          hint="Requests in the last 24h"
          icon={Calendar}
          loading={summary.isLoading}
        />
        <StatCard
          label="All time"
          value={(summary.data?.requestsAllTime ?? 0).toLocaleString()}
          hint="Total successful reads"
          icon={TrendingUp}
          loading={summary.isLoading}
        />
        <StatCard
          label="Success rate"
          value={`${Math.round((summary.data?.successRate ?? 0) * 100)}%`}
          hint="Last 30 days"
          icon={CheckCircle2}
          loading={summary.isLoading}
        />
        <StatCard
          label="Avg latency"
          value={`${Math.round(summary.data?.avgLatencyMs ?? 0)} ms`}
          hint="Last 30 days"
          icon={Clock}
          loading={summary.isLoading}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Requests · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {byDay.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Activity className="h-8 w-8 mb-3 opacity-40" />
              <p>No requests yet. Make your first call to see traffic here.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#reqGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By mode</CardTitle>
          </CardHeader>
          <CardContent>
            {byMode.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : !byMode.data || byMode.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No usage yet.</p>
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

        {/* Recent */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent calls</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/usage">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !recent.data || recent.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No calls yet.</p>
            ) : (
              <ul className="space-y-1">
                {recent.data.map((e) => {
                  const ok = e.statusCode >= 200 && e.statusCode < 300;
                  return (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 py-2 text-sm border-b border-border/40 last:border-0"
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-destructive"}`}
                      />
                      <span className="font-mono text-xs truncate flex-1" title={e.url}>
                        {e.url}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
