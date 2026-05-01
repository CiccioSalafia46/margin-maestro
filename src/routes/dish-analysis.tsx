import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dish-analysis")({
  component: () => <Outlet />,
});
