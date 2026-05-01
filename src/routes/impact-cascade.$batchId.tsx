import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { priceBatches, latestCascade } from "@/data/mock";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/impact-cascade/$batchId")({
  component: BatchPage,
});

function BatchPage() {
  const { batchId } = Route.useParams();
  const batch = priceBatches.find((b) => b.id === batchId);

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
      <div className="p-6">
        {!batch ? (
          <EmptyState
            title="Batch not found"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/impact-cascade">Back to cascades</Link>
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm">
                <span className="text-muted-foreground">Ingredients changed: </span>
                <span className="font-medium tabular-nums">{batch.ingredients_changed}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Dishes affected: </span>
                <span className="font-medium tabular-nums">{batch.dishes_affected}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Newly below target: </span>
                <span className="font-medium tabular-nums">
                  {batch.dishes_newly_below_target}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Margin impact: </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(batch.total_margin_impact_usd)}
                </span>
              </p>
              {batch.id === latestCascade.batch_id && (
                <p className="text-xs text-muted-foreground">
                  This is the latest batch. Full cascade is available on the main Impact Cascade page.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
