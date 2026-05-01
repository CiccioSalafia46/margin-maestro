import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { createRestaurantWithOwner, setStoredActiveRestaurantId } from "@/data/api/tenantApi";

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
  const { refreshTenants, signOut, email } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Restaurant name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const id = await createRestaurantWithOwner(trimmed);
      setStoredActiveRestaurantId(id);
      await refreshTenants();
      toast.success("Restaurant created.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create restaurant";
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
              {submitting ? "Creating…" : "Create restaurant"}
            </Button>
          </form>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
