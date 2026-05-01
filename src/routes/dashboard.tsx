import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  DollarSign,
  ArrowRight,
  Bell,
  Receipt,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import {
  AlertSeverityBadge,
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  PpDeltaCell,
  SignedMoneyCell,
} from "@/components/common/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TARGET_GPM } from "@/data/mock";
import {
  getAlerts,
  getDashboardKpis,
  getLatestImpactCascadeSummary,
  getMenuAnalyticsRows,
  getPriceLogByBatch,
  suggestedMenuPrice,
} from "@/data/selectors";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Margin IQ" },
      {
        name: "description",
        content:
          "Alert-first overview: dishes off target, ingredient spikes, profit at risk, and recent batch impact.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const kpis = getDashboardKpis();
  const latestSummary = getLatestImpactCascadeSummary();
  const allAlerts = getAlerts();
  const menuRows = getMenuAnalyticsRows();
  const belowTarget = menuRows.filter((r) => r.recipe.on_menu && !r.on_target);
  const recentChanges = kpis.latest_batch
    ? getPriceLogByBatch(kpis.latest_batch.id)
        .filter((p) => p.event === "change")
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5)
    : [];
  const criticalAlerts = allAlerts.filter((a) => a.severity === "critical").slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="What needs your attention right now."
      />

      <div className="space-y-6 p-6">
        {/* Critical alerts */}
        {criticalAlerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Critical alerts requiring action
                <Badge variant="outline" className="ml-1 border-destructive/30 bg-destructive/10 text-destructive">
                  {criticalAlerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 rounded-md border border-destructive/20 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertSeverityBadge severity={a.severity} />
                      <p className="truncate text-sm font-medium">{a.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/alerts">
                      View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Average GPM"
            value={<PercentCell value={kpis.avg_gpm} decimals={1} />}
            hint={`Target ${(TARGET_GPM * 100).toFixed(0)}% • on-menu only`}
            tone={kpis.avg_gpm !== null && kpis.avg_gpm >= TARGET_GPM ? "positive" : "warning"}
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiCard
            label="Dishes Below Target"
            value={kpis.below_target_count}
            hint={`of ${kpis.on_menu_count} on menu`}
            tone={kpis.below_target_count > 0 ? "negative" : "positive"}
            trend={kpis.below_target_count > 0 ? "down" : "flat"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <KpiCard
            label="Ingredient Cost Spikes"
            value={kpis.ingredient_cost_spike_count}
            hint={`In latest batch (>10%)`}
            tone={kpis.ingredient_cost_spike_count > 0 ? "warning" : "positive"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          {kpis.has_sales_data ? (
            <KpiCard
              label="Estimated Profit at Risk"
              value={<MoneyCell value={kpis.profit_at_risk_monthly_usd} />}
              hint="Monthly, demo unit sales"
              tone={(kpis.profit_at_risk_monthly_usd ?? 0) > 0 ? "negative" : "positive"}
              icon={<DollarSign className="h-4 w-4" />}
            />
          ) : (
            <KpiCard
              label="Estimated Margin Gap"
              value={<MoneyCell value={kpis.margin_gap_per_cover_usd} />}
              hint="per cover, off-target dishes"
              tone={kpis.margin_gap_per_cover_usd > 0 ? "negative" : "positive"}
              icon={<DollarSign className="h-4 w-4" />}
            />
          )}
          <KpiCard
            label="Recent Price Changes"
            value={kpis.recent_price_changes_count}
            hint={
              kpis.latest_batch
                ? `Latest batch ${formatDateTime(kpis.latest_batch.created_at)}`
                : "No batches"
            }
            icon={<Receipt className="h-4 w-4" />}
          />
        </div>

        {/* Two-column: Dishes to review + Recent ingredient changes */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Dishes to review now</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/menu-analytics">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead className="text-right">GPM</TableHead>
                    <TableHead className="text-right">Δ vs snapshot</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belowTarget.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        All dishes are on target.
                      </TableCell>
                    </TableRow>
                  ) : (
                    belowTarget.map((d) => (
                      <TableRow key={d.recipe.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/dish-analysis/$id"
                            params={{ id: d.recipe.id }}
                            className="hover:underline"
                          >
                            {d.recipe.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{d.recipe.category}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <PercentCell value={d.gpm} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PpDeltaCell value={d.delta_gpm_vs_snapshot} />
                        </TableCell>
                        <TableCell className="text-right">
                          <OnTargetBadge onTarget={d.on_target} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent ingredient cost changes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/price-log">
                  View log <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">% change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentChanges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                        No recent changes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentChanges.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name_at_time}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(p.timestamp)}
                        </TableCell>
                        <TableCell className="text-right">
                          <PercentCell value={p.pct_change} signed decimals={2} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Suggested reprices + Latest batch summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Suggested reprices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Suggested</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belowTarget.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        Nothing to reprice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    belowTarget.map((d) => {
                      const suggested = suggestedMenuPrice(d.cost_per_serving, TARGET_GPM);
                      const delta =
                        suggested !== null && d.recipe.menu_price !== null
                          ? suggested - d.recipe.menu_price
                          : null;
                      return (
                        <TableRow key={d.recipe.id}>
                          <TableCell className="font-medium">
                            <Link
                              to="/dish-analysis/$id"
                              params={{ id: d.recipe.id }}
                              className="hover:underline"
                            >
                              {d.recipe.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={d.recipe.menu_price} />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <MoneyCell value={suggested} />
                          </TableCell>
                          <TableCell className="text-right">
                            <SignedMoneyCell value={delta} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Latest batch summary</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/impact-cascade">
                  Open cascade <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {latestSummary ? (
                <>
                  <p className="text-sm font-medium">{latestSummary.batch_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(latestSummary.latest_batch_timestamp)}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stat
                      label="Ingredients changed"
                      value={latestSummary.ingredients_changed_count}
                    />
                    <Stat
                      label="Dishes affected (unique)"
                      value={latestSummary.affected_dish_count_unique}
                    />
                    <Stat
                      label="Newly below target"
                      value={latestSummary.newly_below_target_count}
                      negative={latestSummary.newly_below_target_count > 0}
                    />
                    {latestSummary.has_sales_data ? (
                      <Stat
                        label="Margin impact — monthly, demo unit sales"
                        value={formatMoney(
                          latestSummary.total_estimated_monthly_margin_impact,
                        )}
                        negative={
                          (latestSummary.total_estimated_monthly_margin_impact ?? 0) < 0
                        }
                      />
                    ) : (
                      <Stat
                        label="Margin impact — per serving"
                        value={formatMoney(
                          latestSummary.total_margin_impact_per_serving,
                        )}
                        negative={latestSummary.total_margin_impact_per_serving < 0}
                      />
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No batches yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="h-3 w-3" />
          Build 0.4 — Margin Intelligence over a mock dataset. No persistence, no backend.
        </p>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  negative,
}: {
  label: string;
  value: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={
          negative
            ? "mt-1 text-lg font-semibold tabular-nums text-destructive"
            : "mt-1 text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
