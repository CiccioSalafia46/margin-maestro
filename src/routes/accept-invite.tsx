import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { acceptRestaurantInvitation } from "@/data/api/teamApi";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Accept Invitation — Margin IQ" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? "",
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const { status, refreshTenants } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "success" | "error" | "no-token" | "needs-auth">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("no-token"); return; }
    if (status === "loading") return;
    if (status === "unauthenticated") { setState("needs-auth"); return; }

    let cancelled = false;
    (async () => {
      try {
        const result = await acceptRestaurantInvitation(token);
        if (!cancelled) {
          await refreshTenants();
          setState("success");
          setMessage(result.already_member ? "You're already a member of this restaurant." : `You've been added as ${result.role}.`);
        }
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setMessage(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Failed to accept invitation.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Accept Invitation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Processing invitation…</p>
          )}
          {state === "no-token" && (
            <p className="text-sm text-destructive">No invitation token provided. Check the invite link.</p>
          )}
          {state === "needs-auth" && (
            <div className="space-y-3">
              <p className="text-sm">Sign in or create an account to accept this invitation.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate({ to: "/login" })}>Sign in</Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/signup" })}>Create account</Button>
              </div>
            </div>
          )}
          {state === "success" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> {message}</p>
              <Button size="sm" onClick={() => navigate({ to: "/dashboard" })}>Go to Dashboard</Button>
            </div>
          )}
          {state === "error" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" /> {message}</p>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/login" })}>Go to login</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
