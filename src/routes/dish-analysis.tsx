import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dish-analysis")({
  head: () => ({
    meta: [
      { title: "Dish Analysis — Margin IQ" },
      {
        name: "description",
        content:
          "Per-dish deep dive: GPM vs target, COGS breakdown, snapshot delta, scenario, Margin Manager.",
      },
    ],
  }),
  component: () => <Outlet />,
});
