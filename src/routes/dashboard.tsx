import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Loader2, ArrowRight, Zap } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { MoneyCell, PercentCell } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { getDashboardData, type DashboardData } from "@/data/api/dashboardApi";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Margin IQ" },
      { name: "description", content: "Margin Intelligence overview: alerts, KPIs, and recommended actions." },
    ],
  }),
  component: DashboardPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function DashboardPage() {
  const { activeRestaurantId, activeMembership, activeRestaurantSettings } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const targetGpm = activeRestaurantSettings?.target_gpm ?? 0.78;

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      setData(await getDashboardData(activeRestaurantId));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Dashboard" description="Margin Intelligence overview." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Dashboard" description={`Target GPM ${(targetGpm * 100).toFixed(0)}%. Alert-first margin intelligence.`} />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
          </div>
        ) : !data ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Unable to load dashboard data.</p>
        ) : (
          <>
            {/* A. Alert-first header */}
            {data.criticalAlerts.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-center gap-4 p-4">
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive">{data.criticalAlerts.length} critical alert(s) require attention</p>
                    <p className="text-xs text-muted-foreground">{data.criticalAlerts[0]?.title}</p>
                  </div>
                  <Button size="sm" variant="destructive" asChild>
                    <Link to="/alerts">Review alerts <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* B. KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <KpiCard label="Average GPM" value={data.menuSummary.avg_gpm != null ? <PercentCell value={data.menuSummary.avg_gpm} decimals={1} /> : "—"} tone={data.menuSummary.avg_gpm != null && data.menuSummary.avg_gpm >= targetGpm ? "positive" : "warning"} hint={`Target ${(targetGpm * 100).toFixed(0)}%`} />
              <KpiCard label="Below target" value={data.menuSummary.below_target_count} tone={data.menuSummary.below_target_count > 0 ? "negative" : "positive"} />
              <KpiCard label="Open alerts" value={data.alertSummary.open} tone={data.alertSummary.open > 0 ? "negative" : "positive"} hint={data.alertSummary.critical > 0 ? `${data.alertSummary.critical} critical` : undefined} />
              <KpiCard label="Missing price" value={data.menuSummary.missing_price_count} tone={data.menuSummary.missing_price_count > 0 ? "warning" : "positive"} />
              <KpiCard label="Price changes" value={data.recentChangeCount} hint="All time" />
              <KpiCard label="Impacted dishes" value={data.latestRun?.affected_dish_count ?? 0} hint={data.latestRun ? "Latest cascade" : "No cascade"} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* C. Active alerts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Active alerts</CardTitle>
                  <Button size="sm" variant="outline" asChild><Link to="/alerts">View all</Link></Button>
                </CardHeader>
                <CardContent>
                  {data.latestAlerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active alerts. Generate alerts to surface margin intelligence.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.latestAlerts.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 border-b pb-2 last:border-0 last:pb-0">
                          <Badge className={`text-[10px] shrink-0 mt-0.5 ${a.severity === "critical" ? "bg-destructive text-destructive-foreground" : a.severity === "warning" ? "bg-warning text-warning-foreground" : ""}`} variant={a.severity === "info" ? "outline" : "default"}>
                            {a.severity}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.title}</p>
                            {a.recommended_action && <p className="text-xs text-muted-foreground truncate">{a.recommended_action}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* D. Menu health */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Menu health</CardTitle>
                  <Button size="sm" variant="outline" asChild><Link to="/menu-analytics">Analytics</Link></Button>
                </CardHeader>
                <CardContent>
                  {data.menuRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active dish recipes. Add recipes to see menu health.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div><p className="text-2xl font-semibold">{data.menuSummary.priced_dishes}</p><p className="text-[10px] text-muted-foreground uppercase">Priced</p></div>
                        <div><p className="text-2xl font-semibold text-destructive">{data.menuSummary.below_target_count}</p><p className="text-[10px] text-muted-foreground uppercase">Below target</p></div>
                        <div><p className="text-2xl font-semibold">{data.menuSummary.total_dishes - data.menuSummary.priced_dishes}</p><p className="text-[10px] text-muted-foreground uppercase">Incomplete</p></div>
                      </div>
                      {data.worstDishes.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Worst margins</p>
                          {data.worstDishes.slice(0, 3).map((d) => (
                            <div key={d.recipe_id} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                              <Link to="/dish-analysis/$id" params={{ id: d.recipe_id }} className="hover:underline truncate">{d.dish_name}</Link>
                              <span className="text-xs tabular-nums">{d.gpm != null ? `${(d.gpm * 100).toFixed(1)}%` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* E. Price activity */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Price activity</CardTitle>
                  <Button size="sm" variant="outline" asChild><Link to="/price-log">Price Log</Link></Button>
                </CardHeader>
                <CardContent>
                  {!data.latestBatch ? (
                    <p className="text-sm text-muted-foreground">No price update batches yet. Run a batch when supplier costs change.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Latest batch</span>
                        <span className="text-xs">{formatDateTime(data.latestBatch.applied_at ?? data.latestBatch.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total price changes</span>
                        <span className="font-medium">{data.recentChangeCount}</span>
                      </div>
                      {data.recentLogEntries.filter((e) => e.event_type === "change").slice(0, 3).map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-xs border-b py-1 last:border-0">
                          <span className="truncate">{e.ingredient_name_at_time}</span>
                          {e.delta_recipe_unit_cost_percent != null && Number(e.delta_recipe_unit_cost_percent) !== 0 && (
                            <span className={Number(e.delta_recipe_unit_cost_percent) > 0 ? "text-destructive" : "text-success"}>
                              {(Number(e.delta_recipe_unit_cost_percent) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* F. Impact cascade */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Impact cascade</CardTitle>
                  <Button size="sm" variant="outline" asChild><Link to="/impact-cascade">Details</Link></Button>
                </CardHeader>
                <CardContent>
                  {!data.latestRun ? (
                    <p className="text-sm text-muted-foreground">No cascade generated yet. Run a Price Update Batch first.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div><p className="text-2xl font-semibold">{data.latestRun.affected_dish_count}</p><p className="text-[10px] text-muted-foreground uppercase">Affected</p></div>
                        <div><p className="text-2xl font-semibold text-destructive">{data.latestRun.newly_below_target_count}</p><p className="text-[10px] text-muted-foreground uppercase">Newly below</p></div>
                        <div><p className="text-2xl font-semibold">{data.latestRun.changed_ingredients_count}</p><p className="text-[10px] text-muted-foreground uppercase">Changed</p></div>
                      </div>
                      {data.latestRun.total_cogs_delta_per_serving != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total COGS Δ/serving</span>
                          <MoneyCell value={data.latestRun.total_cogs_delta_per_serving} />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* G. Recommended actions */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recommended next actions</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {data.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              Build 1.9 — Dashboard. Per-serving metrics. No sales volume or monthly revenue projections.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
