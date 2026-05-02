import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithPassword } from "@/data/api/authApi";
import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Margin IQ" },
      { name: "description", content: "Sign in to your Margin IQ account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { status, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = submitting || status === "loading";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      const session = await refreshAuth();

      if (!session?.user) {
        throw new Error("Sign-in did not create a session. Please try again.");
      }

      toast.success("Signed in successfully.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      const msg = getLoginErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Margin IQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Development note</AlertTitle>
            <AlertDescription>
              Create a new account with your email and password. If email confirmation is
              enabled, confirm the email before signing in.
            </AlertDescription>
          </Alert>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t sign you in</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isBusy}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : status === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing session…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No account?{" "}
              <Link to="/signup" className="font-medium text-foreground hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function getLoginErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Sign-in failed";

  if (/invalid login credentials/i.test(raw)) {
    return "Incorrect email or password. Check your details or create a new account.";
  }

  if (/email not confirmed/i.test(raw)) {
    return "Your account exists, but email confirmation is still required before sign in.";
  }

  return raw;
}
