import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { createRestaurantWithOwner } from "@/data/api/tenantApi";

export const Route = createFileRoute("/onboarding/create-restaurant")({
  head: () => ({
    meta: [
      { title: "Create your restaurant — Margin IQ" },
      { name: "description", content: "Set up your restaurant to start using Margin IQ." },
    ],
  }),
  component: CreateRestaurantPage,
});

function CreateRestaurantPage() {
  const { refreshTenants, signOut, email, status, activeMembership } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && activeMembership) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [status, activeMembership, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (status !== "authenticated") {
      const msg = "Please sign in to create a restaurant.";
      setMessage(msg);
      toast.error(msg);
      navigate({ to: "/login", replace: true });
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      const msg = "Restaurant name is required.";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setSubmitting(true);
    try {
      await createRestaurantWithOwner(trimmed);
      await refreshTenants();
      toast.success("Restaurant created.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Could not create restaurant";
      const msg =
        /not authenticated/i.test(raw)
          ? "Your session expired. Please sign in again."
          : /restaurant name required/i.test(raw)
            ? "Restaurant name is required."
            : "Could not create the restaurant. Please try again.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your restaurant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {message && (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t finish onboarding</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Welcome{email ? `, ${email}` : ""}. Set up your restaurant workspace to continue.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="restaurant_name">Restaurant name</Label>
              <Input
                id="restaurant_name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Trattoria Da Marco"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create restaurant"
              )}
            </Button>
          </form>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
