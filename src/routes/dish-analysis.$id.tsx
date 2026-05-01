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
  // Lazy import to share the same selector page; on valid id, render it
  // with the dish preselected via URL param consumed by the index page.
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
  // Re-export the index page component for the deep link.
  const Page = require("./dish-analysis.index").Route.options.component;
  return <Page initialDishId={id} />;
}
