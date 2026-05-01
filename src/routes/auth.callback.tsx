import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in… — Margin IQ" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status !== "loading") {
      navigate({ to: "/", replace: true });
    }
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}
