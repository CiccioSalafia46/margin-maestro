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
import { priceBatches } from "@/data/mock";
import { getLatestImpactCascade } from "@/data/selectors";
import { formatDateTime } from "@/lib/format";

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
  if (!latestCascade) {
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
        description={`Latest batch: ${formatDateTime(latestCascade.created_at)}`}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Ingredients changed"
            value={latestCascade.ingredients_changed}
            icon={<Zap className="h-4 w-4" />}
          />
          <KpiCard label="Dishes affected" value={latestCascade.dishes_affected} />
          <KpiCard
            label="Newly below target"
            value={latestCascade.dishes_newly_below_target}
            tone={latestCascade.dishes_newly_below_target > 0 ? "negative" : "positive"}
          />
          <KpiCard
            label="Total margin impact"
            value={<MoneyCell value={latestCascade.total_margin_impact_usd} />}
            tone="negative"
          />
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
                      <TableCell className="font-medium">{d.recipe_name}</TableCell>
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
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Ingredients</TableHead>
                  <TableHead className="text-right">Dishes</TableHead>
                  <TableHead className="text-right">Margin impact</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceBatches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(b.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.ingredients_changed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.dishes_affected}</TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={b.total_margin_impact_usd} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/impact-cascade/$batchId" params={{ batchId: b.id }}>
                          Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
