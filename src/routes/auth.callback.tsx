import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in… — Margin IQ" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { status, refreshAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const completeCallback = async () => {
      try {
        await refreshAuth();
      } finally {
        if (!cancelled && status !== "loading") {
          navigate({ to: "/", replace: true });
        }
      }
    };

    void completeCallback();

    return () => {
      cancelled = true;
    };
  }, [status, refreshAuth, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Completing sign-in…
      </p>
    </div>
  );
}
