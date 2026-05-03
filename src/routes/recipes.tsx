import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/recipes")({
  head: () => ({
    meta: [
      { title: "Recipes — Margin IQ" },
      { name: "description", content: "Recipe database with COGS, margins, and cost breakdown." },
    ],
  }),
  component: () => <Outlet />,
});
