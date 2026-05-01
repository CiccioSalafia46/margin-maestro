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
import {
  alerts,
  ingredients,
  latestBatch,
  latestCascade,
  priceLog,
  recipes,
  TARGET_GPM,
  computeRecipeMetrics,
} from "@/data/mock";
import { formatDateTime, formatMoney } from "@/lib/format";
import { suggestedMenuPrice } from "@/lib/margin";

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
  // ---- Derived KPIs ----
  const dishMetrics = recipes
    .filter((r) => r.type === "Dish")
    .map((r) => ({ recipe: r, metrics: computeRecipeMetrics(r) }));

  const onMenuDishes = dishMetrics.filter((d) => d.recipe.on_menu);
  const gpms = onMenuDishes
    .map((d) => d.metrics.gpm)
    .filter((g): g is number => g !== null);
  const avgGpm = gpms.length ? gpms.reduce((a, b) => a + b, 0) / gpms.length : null;

  const belowTarget = dishMetrics.filter((d) => !d.metrics.on_target && d.recipe.on_menu);
  const spikes = ingredients.filter((i) => i.spike);

  const recentChanges = priceLog
    .filter((p) => p.event === "change")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  const profitAtRisk = belowTarget.reduce((sum, d) => {
    if (d.metrics.gpm === null || d.recipe.menu_price === null) return sum;
    // Estimate: gap to target * menu price (per-unit profit shortfall)
    const gap = TARGET_GPM - d.metrics.gpm;
    return sum + gap * d.recipe.menu_price;
  }, 0);

  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && a.status === "open");

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
            value={<PercentCell value={avgGpm} decimals={1} />}
            hint={`Target ${(TARGET_GPM * 100).toFixed(0)}%`}
            tone={avgGpm !== null && avgGpm >= TARGET_GPM ? "positive" : "warning"}
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiCard
            label="Dishes Below Target"
            value={belowTarget.length}
            hint={`of ${onMenuDishes.length} on menu`}
            tone={belowTarget.length > 0 ? "negative" : "positive"}
            trend={belowTarget.length > 0 ? "down" : "flat"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <KpiCard
            label="Ingredient Cost Spikes"
            value={spikes.length}
            hint={`${spikes.length} ingredients flagged`}
            tone={spikes.length > 0 ? "warning" : "positive"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <KpiCard
            label="Estimated Profit at Risk"
            value={<MoneyCell value={profitAtRisk} />}
            hint="per cover, across off-target dishes"
            tone={profitAtRisk > 0 ? "negative" : "positive"}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            label="Recent Price Changes"
            value={recentChanges.length}
            hint={`Latest batch ${formatDateTime(latestBatch.created_at)}`}
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
                          <PercentCell value={d.metrics.gpm} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PpDeltaCell value={d.recipe.delta_gpm_vs_snapshot} />
                        </TableCell>
                        <TableCell className="text-right">
                          <OnTargetBadge onTarget={d.metrics.on_target} />
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
                  {recentChanges.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name_at_time}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(p.timestamp)}
                      </TableCell>
                      <TableCell className="text-right">
                        <PercentCell value={p.pct_change} signed decimals={2} />
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {belowTarget.map((d) => {
                    const suggested = suggestedMenuPrice(d.metrics.cost_per_serving, TARGET_GPM);
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
                  })}
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
              <p className="text-sm font-medium">{latestBatch.label}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(latestBatch.created_at)}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Ingredients changed
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {latestCascade.ingredients_changed}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Dishes affected
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {latestCascade.dishes_affected}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Newly below target
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-destructive">
                    {latestCascade.dishes_newly_below_target}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Margin impact
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-destructive">
                    {formatMoney(latestCascade.total_margin_impact_usd)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="h-3 w-3" />
          This is a mock UI build. No data is persisted and no backend is connected.
        </p>
      </div>
    </AppShell>
  );
}
