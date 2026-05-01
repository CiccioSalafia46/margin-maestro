import { createFileRoute, Link, useParams } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { recipes } from "@/data/mock";
import { DishAnalysisView } from "@/components/dish-analysis/DishAnalysisView";

export const Route = createFileRoute("/dish-analysis/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Dish Analysis — ${params.id}` },
      {
        name: "description",
        content: "Per-dish deep dive with the requested dish preselected.",
      },
    ],
  }),
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
  return <DishAnalysisView initialDishId={id} />;
}
