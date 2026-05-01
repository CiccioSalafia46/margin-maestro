import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
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
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  PpDeltaCell,
  SignedMoneyCell,
  UnitCostCell,
} from "@/components/common/badges";
import { PathwayBadge, ImpactPath } from "@/components/impact-cascade/PathwayBadge";
import { priceBatches } from "@/data/mock";
import { getImpactCascadeForBatch } from "@/data/selectors";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/impact-cascade/$batchId")({
  component: BatchPage,
});

function BatchPage() {
  const { batchId } = Route.useParams();
  const batch = priceBatches.find((b) => b.id === batchId);
  const cascade = batch ? getImpactCascadeForBatch(batch.id) : null;

  return (
    <AppShell>
      <PageHeader
        title={batch ? batch.label : "Batch not found"}
        description={batch ? formatDateTime(batch.created_at) : undefined}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/impact-cascade">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        {!batch || !cascade ? (
          <EmptyState
            title="Batch not found"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/impact-cascade">Back to cascades</Link>
              </Button>
            }
          />
        ) : cascade.groups.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No dishes were affected by this batch.
            </CardContent>
          </Card>
        ) : (
          cascade.groups.map((g) => (
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
                    <span className="font-medium text-destructive">
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
                      <TableHead className="text-right">Δ COGS</TableHead>
                      <TableHead className="text-right">Old → New GPM</TableHead>
                      <TableHead className="text-right">Δ GPM</TableHead>
                      <TableHead className="text-right">Suggested</TableHead>
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
                          <SignedMoneyCell value={d.delta_cogs} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PercentCell value={d.old_gpm} /> →{" "}
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
          ))
        )}
      </div>
    </AppShell>
  );
}
