import { createFileRoute } from "@tanstack/react-router";
import { DishAnalysisView } from "@/components/dish-analysis/DishAnalysisView";

export const Route = createFileRoute("/dish-analysis/")({
  head: () => ({
    meta: [
      { title: "Dish Analysis — Margin IQ" },
      {
        name: "description",
        content:
          "Per-dish deep dive: GPM vs target, COGS breakdown, snapshot delta, scenario, and Margin Manager.",
      },
    ],
  }),
  component: () => <DishAnalysisView />,
});
