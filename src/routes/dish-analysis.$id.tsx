import { createFileRoute, Link, useParams } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { recipes } from "@/data/mock";

export const Route = createFileRoute("/dish-analysis/$id")({
  component: DishAnalysisDeepLinkPage,
});

function DishAnalysisDeepLinkPage() {
  const { id } = useParams({ from: "/dish-analysis/$id" });
  const exists = recipes.some((r) => r.id === id && r.type === "Dish");
  if (!exists) {
    return (
      <AppShell>
        <PageHeader title="Dish Analysis" />
        <div className="p-6">
          <EmptyState
            title="Dish not found"
            description={`No dish with id "${id}".`}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/dish-analysis">Back to dish analysis</Link>
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader
        title="Dish Analysis"
        description="Open this dish from the selector on the main Dish Analysis page."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/dish-analysis">Open dish analysis</Link>
          </Button>
        }
      />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Deep links to a specific dish are valid; the selector-driven page
          will preselect this dish in a future iteration.
        </p>
      </div>
    </AppShell>
  );
}
