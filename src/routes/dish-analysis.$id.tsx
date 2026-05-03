import { createFileRoute, useParams } from "@tanstack/react-router";
import { DishAnalysisView } from "@/components/dish-analysis/DishAnalysisView";

export const Route = createFileRoute("/dish-analysis/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Dish Analysis — ${params.id}` },
      { name: "description", content: "Per-dish deep dive with the requested dish preselected." },
    ],
  }),
  component: DishAnalysisDeepLinkPage,
});

function DishAnalysisDeepLinkPage() {
  const { id } = useParams({ from: "/dish-analysis/$id" });
  return <DishAnalysisView initialDishId={id} />;
}
