import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUpWithPassword } from "@/data/api/authApi";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Margin IQ" },
      { name: "description", content: "Create your Margin IQ account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [requestStarted, setRequestStarted] = useState(false);
  const [resultState, setResultState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [nextAction, setNextAction] = useState<"onboarding" | "email_confirmation" | "login" | "retry">("retry");

  const emailLooksValid = /.+@.+\..+/.test(email.trim());
  const passwordLengthValid = password.length >= 8;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setMessage(null);
    setRequestStarted(false);
    setResultState("idle");
    setNextAction("retry");

    if (!emailLooksValid) {
      const text = "Enter a valid email address.";
      setMessage({ tone: "error", text });
      setResultState("error");
      toast.error(text);
      return;
    }

    if (!passwordLengthValid) {
      const text = "Password must be at least 8 characters.";
      setMessage({ tone: "error", text });
      setResultState("error");
      toast.error(text);
      return;
    }

    setSubmitting(true);
    setRequestStarted(true);
    setResultState("pending");
    try {
      const result = await signUpWithPassword(email.trim(), password, fullName.trim() || undefined);

      if (result.session?.user) {
        await refreshAuth();
        const text = "Account created. Continue with restaurant setup.";
        setMessage({ tone: "success", text });
        setResultState("success");
        setNextAction("onboarding");
        toast.success(text);
        navigate({ to: "/", replace: true });
        return;
      }

      const text =
        "Account created. Please check your email to confirm your account, then sign in.";
      setMessage({ tone: "info", text });
      setResultState("success");
      setNextAction("email_confirmation");
      toast.success(text);
    } catch (err) {
      const msg = getSignupErrorMessage(err);
      setMessage({ tone: "error", text: msg });
      setResultState("error");
      setNextAction("retry");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your Margin IQ account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Development note</AlertTitle>
            <AlertDescription>
              Create a new account with your email and password. If email confirmation is
              enabled, confirm the email before signing in.
            </AlertDescription>
          </Alert>
          {message && (
            <Alert variant={message.tone === "error" ? "destructive" : "default"}>
              <AlertTitle>
                {message.tone === "success"
                  ? "Account created"
                  : message.tone === "info"
                    ? "Check your email"
                    : "Couldn’t create account"}
              </AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Dev auth diagnostics</p>
            <dl className="mt-2 space-y-1">
              <DiagnosticRow label="Form submit attempted" value={submitAttempted ? "yes" : "no"} />
              <DiagnosticRow label="Email field valid" value={emailLooksValid ? "yes" : "no"} />
              <DiagnosticRow label="Password length valid" value={passwordLengthValid ? "yes" : "no"} />
              <DiagnosticRow label="signUp request started" value={requestStarted ? "yes" : "no"} />
              <DiagnosticRow label="signUp result" value={resultState} />
              <DiagnosticRow label="Sanitized error" value={message?.tone === "error" ? message.text : "—"} />
              <DiagnosticRow label="Next action" value={formatNextAction(nextAction)} />
            </dl>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
            {nextAction === "email_confirmation" && (
              <p className="text-center text-xs text-muted-foreground">
                After confirming your email, return to Login.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function getSignupErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Sign-up failed";

  if (/known to be weak|weak_password|pwned/i.test(raw)) {
    return "That password is too weak or has appeared in a public breach. Choose a stronger password and try again.";
  }

  if (/user already registered/i.test(raw)) {
    return "An account with that email already exists. Try signing in instead.";
  }

  if (/password/i.test(raw) && /least/i.test(raw)) {
    return "Please choose a stronger password with at least 8 characters.";
  }

  return raw;
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-mono text-foreground">{value}</dd>
    </div>
  );
}

function formatNextAction(nextAction: "onboarding" | "email_confirmation" | "login" | "retry") {
  switch (nextAction) {
    case "onboarding":
      return "onboarding";
    case "email_confirmation":
      return "email confirmation then login";
    case "login":
      return "login";
    default:
      return "retry signup";
  }
}
