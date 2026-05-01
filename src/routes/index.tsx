import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Margin IQ — Restaurant Margin Intelligence" },
      {
        name: "description",
        content:
          "Margin Intelligence decision layer for restaurant operators. Know which dishes are affected when supplier prices move.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
