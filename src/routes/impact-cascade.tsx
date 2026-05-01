import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, ArrowRight } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  PpDeltaCell,
  SignedMoneyCell,
  UnitCostCell,
} from "@/components/common/badges";
import { PathwayBadge, ImpactPath } from "@/components/impact-cascade/PathwayBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getImpactCascadeHistory,
  getLatestImpactCascade,
  getLatestImpactCascadeSummary,
} from "@/data/selectors";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/impact-cascade")({
  head: () => ({
    meta: [
      { title: "Impact Cascade — Margin IQ" },
      {
        name: "description",
        content: "How the latest price batch propagated through dishes and margins.",
      },
    ],
  }),
  component: ImpactCascadePage,
});

function ImpactCascadePage() {
  const latestCascade = getLatestImpactCascade();
  const latestSummary = getLatestImpactCascadeSummary();
  const history = getImpactCascadeHistory();

  if (!latestCascade || !latestSummary) {
    return (
      <AppShell>
        <PageHeader title="Impact Cascade" description="No batches yet." />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader
        title="Impact Cascade"
        description={`Latest batch: ${formatDateTime(latestSummary.latest_batch_timestamp)}`}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Ingredients changed"
            value={latestSummary.ingredients_changed_count}
            icon={<Zap className="h-4 w-4" />}
          />
          <KpiCard
            label="Dishes affected"
            value={latestSummary.affected_dish_count_unique}
            hint="Unique dishes"
          />
          <KpiCard
            label="Impact rows"
            value={latestSummary.impact_row_count}
            hint="Ingredient → dish rows"
          />
          <KpiCard
            label="Newly below target"
            value={latestSummary.newly_below_target_count}
            tone={latestSummary.newly_below_target_count > 0 ? "negative" : "positive"}
          />
          {latestSummary.has_sales_data ? (
            <KpiCard
              label="Margin impact"
              value={
                <MoneyCell
                  value={latestSummary.total_estimated_monthly_margin_impact}
                />
              }
              hint="Monthly, demo unit sales"
              tone={
                (latestSummary.total_estimated_monthly_margin_impact ?? 0) < 0
                  ? "negative"
                  : "positive"
              }
            />
          ) : (
            <KpiCard
              label="Margin impact"
              value={<MoneyCell value={latestSummary.total_margin_impact_per_serving} />}
              hint="Per serving (sum of unique dishes)"
              tone={latestSummary.total_margin_impact_per_serving < 0 ? "negative" : "positive"}
            />
          )}
        </div>

        {latestCascade.groups.map((g) => (
          <Card key={g.ingredient_id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>{g.ingredient_name}</span>
                <span className="flex flex-wrap items-center gap-3 text-sm font-normal">
                  <span className="text-muted-foreground">
                    <UnitCostCell value={g.old_unit_cost} /> →{" "}
                    <span className="font-medium text-foreground">
                      <UnitCostCell value={g.new_unit_cost} />
                    </span>
                  </span>
                  <span className="text-destructive font-medium">
                    <PercentCell value={g.pct_change} signed decimals={2} />
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affected dish</TableHead>
                    <TableHead>Pathway</TableHead>
                    <TableHead className="text-right">Old COGS</TableHead>
                    <TableHead className="text-right">New COGS</TableHead>
                    <TableHead className="text-right">Δ COGS</TableHead>
                    <TableHead className="text-right">Old GPM</TableHead>
                    <TableHead className="text-right">New GPM</TableHead>
                    <TableHead className="text-right">Δ GPM</TableHead>
                    <TableHead className="text-right">Suggested price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.affected_dishes.map((d) => (
                    <TableRow key={d.recipe_id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/dish-analysis/$id"
                          params={{ id: d.recipe_id }}
                          className="hover:underline"
                        >
                          {d.recipe_name}
                        </Link>
                        <ImpactPath path={d.impact_path} />
                      </TableCell>
                      <TableCell>
                        <PathwayBadge pathway={d.pathway} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyCell value={d.old_cogs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyCell value={d.new_cogs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <SignedMoneyCell value={d.delta_cogs} />
                      </TableCell>
                      <TableCell className="text-right">
                        <PercentCell value={d.old_gpm} />
                      </TableCell>
                      <TableCell className="text-right">
                        <PercentCell value={d.new_gpm} />
                      </TableCell>
                      <TableCell className="text-right">
                        <PpDeltaCell value={d.delta_gpm} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyCell value={d.suggested_menu_price} />
                      </TableCell>
                      <TableCell>
                        <OnTargetBadge onTarget={d.status === "on_target"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Batch history</CardTitle>
            <p className="text-xs text-muted-foreground">
              All values derived from the same cascade selector. Margin impact{" "}
              {latestSummary.has_sales_data
                ? "shown as monthly (demo unit sales)."
                : "shown per serving (unique dishes)."}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Ingredients changed</TableHead>
                  <TableHead className="text-right">Dishes affected</TableHead>
                  <TableHead className="text-right">
                    {latestSummary.has_sales_data
                      ? "Monthly margin impact (demo)"
                      : "Per-serving margin impact"}
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((s) => {
                  const metric = s.has_sales_data
                    ? s.total_estimated_monthly_margin_impact
                    : s.total_margin_impact_per_serving;
                  return (
                    <TableRow key={s.batch_id}>
                      <TableCell className="font-medium">{s.batch_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(s.latest_batch_timestamp)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.ingredients_changed_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.affected_dish_count_unique}
                      </TableCell>
                      <TableCell
                        className={
                          (metric ?? 0) < 0
                            ? "text-right tabular-nums text-destructive"
                            : "text-right tabular-nums"
                        }
                      >
                        {metric === null ? "—" : formatMoney(metric)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to="/impact-cascade/$batchId"
                            params={{ batchId: s.batch_id }}
                          >
                            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
