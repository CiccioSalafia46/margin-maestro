import { createFileRoute } from "@tanstack/react-router";

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
  component: IndexRedirect,
});

// Auth-aware redirect is handled by <AuthGate /> in __root.tsx.
// This component just renders a brief loading state until then.
function IndexRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
