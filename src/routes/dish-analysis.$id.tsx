import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dish-analysis/$id")({
  beforeLoad: () => {
    // Deep links route through the selector page; the selector handles state.
    throw redirect({ to: "/dish-analysis" });
  },
});
