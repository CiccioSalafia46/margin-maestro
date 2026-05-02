import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { AUTH_SESSION_CONFIG, supabase } from "@/data/api/supabaseClient";
import { getRestaurantSettings } from "@/data/api/tenantApi";
import type { RestaurantSettingsRow } from "@/data/api/types";

export const Route = createFileRoute("/qa-auth")({
  head: () => ({
    meta: [{ title: "QA — Auth & Tenancy" }],
  }),
  component: QaAuthPage,
});

type CheckStatus = "pass" | "warn" | "fail" | "pending";
type OverallStatus = CheckStatus | "blocked";
interface Check {
  label: string;
  status: CheckStatus;
  detail?: string;
  /** When true, a fail in this check downgrades to warn for overall status. */
  nonCritical?: boolean;
}

function QaAuthPage() {
  const auth = useAuth();
  const [rlsChecks, setRlsChecks] = useState<Check[]>([]);
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null);
  const [done, setDone] = useState(false);
  const isAuthenticated = auth.status === "authenticated";
  const hasRestaurant = auth.memberships.length > 0 && !!auth.activeMembership;

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      setSettings(null);
      setRlsChecks([]);
      setDone(true);
      return;
    }

    if (auth.status !== "authenticated") {
      setDone(false);
      return;
    }

    if (!auth.activeRestaurantId) {
      setSettings(null);
      setRlsChecks([]);
      setDone(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const next: Check[] = [];

      // Profile read
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("id", auth.userId!)
          .maybeSingle();
        if (error) throw error;
        next.push({
          label: "Read own profile",
          status: data ? "pass" : "fail",
          detail: data ? "profile row visible" : "no profile row found",
        });
      } catch (e) {
        next.push({
          label: "Read own profile",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // Restaurants
      try {
        const { data, error } = await supabase.from("restaurants").select("id, name");
        if (error) throw error;
        next.push({
          label: "Read own restaurants",
          status: (data?.length ?? 0) > 0 ? "pass" : "fail",
          detail: `${data?.length ?? 0} restaurant(s) visible`,
        });
      } catch (e) {
        next.push({
          label: "Read own restaurants",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // Settings
      let settingsRow: RestaurantSettingsRow | null = null;
      if (auth.activeRestaurantId) {
        try {
          settingsRow = await getRestaurantSettings(auth.activeRestaurantId);
          next.push({
            label: "Read active restaurant_settings",
            status: settingsRow ? "pass" : "fail",
            detail: settingsRow ? `target_gpm=${settingsRow.target_gpm}` : "no settings row",
          });
        } catch (e) {
          next.push({
            label: "Read active restaurant_settings",
            status: "fail",
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Membership rows
      if (auth.activeRestaurantId) {
        try {
          const { data, error } = await supabase
            .from("restaurant_members")
            .select("role,user_id")
            .eq("restaurant_id", auth.activeRestaurantId);
          if (error) throw error;
          next.push({
            label: "Read own membership rows",
            status: (data?.length ?? 0) > 0 ? "pass" : "fail",
            detail: `${data?.length ?? 0} member row(s) visible`,
          });
        } catch (e) {
          next.push({
            label: "Read own membership rows",
            status: "fail",
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (!cancelled) {
        setSettings(settingsRow);
        setRlsChecks(next);
        setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.userId, auth.activeRestaurantId, auth.activeMembership]);

  // ----- Summary checks -----
  const authChecks: Check[] = useMemo(
    () => [
      {
        label: "Session present",
        status: auth.status === "authenticated" ? "pass" : auth.status === "loading" ? "pending" : "warn",
        detail:
          auth.status === "unauthenticated" ? "sign in required before auth QA can run" : auth.status,
      },
      {
        label: "User id available",
        status:
          auth.userId
            ? "pass"
            : auth.status === "loading"
              ? "pending"
              : auth.status === "unauthenticated"
                ? "warn"
                : "fail",
        detail:
          auth.userId
            ? "yes"
            : auth.status === "loading"
              ? "waiting for auth hydration"
              : auth.status === "unauthenticated"
                ? "sign in required"
                : "no",
      },
      {
        label: "Session restored from getSession",
        status:
          auth.status === "loading"
            ? "pending"
            : auth.sessionRestored
              ? "pass"
              : auth.status === "unauthenticated"
                ? "warn"
                : "fail",
        detail:
          auth.status === "loading"
            ? "waiting for browser session restore"
            : auth.sessionRestored
              ? "yes"
              : auth.status === "unauthenticated"
                ? "no session restored"
                : "session missing after restore",
      },
      {
        label: "Profile loaded",
        status:
          auth.profile
            ? "pass"
            : auth.status === "loading"
              ? "pending"
              : auth.status === "unauthenticated"
                ? "warn"
                : "fail",
        detail:
          auth.profile
            ? "yes"
            : auth.status === "loading"
              ? "waiting for auth hydration"
              : auth.status === "unauthenticated"
                ? "sign in required"
                : "no",
      },
    ],
    [auth.status, auth.userId, auth.profile],
  );

  const tenantChecks: Check[] = useMemo(
    () => [
      {
        label: "At least one membership",
        status:
          auth.memberships.length > 0
            ? "pass"
            : auth.status === "authenticated"
              ? "warn"
              : "warn",
        detail:
          auth.status === "authenticated"
            ? `${auth.memberships.length} membership(s)`
            : "sign in required",
      },
      {
        label: "Active restaurant selected",
        status: auth.activeMembership ? "pass" : auth.status === "authenticated" ? "warn" : "warn",
        detail:
          auth.activeMembership?.restaurant.name ??
          (auth.status === "authenticated" ? "create a restaurant to finish onboarding" : "sign in required"),
      },
      {
        label: "Active role known",
        status: auth.activeMembership ? "pass" : auth.status === "authenticated" ? "warn" : "warn",
        detail:
          auth.activeMembership?.role ??
          (auth.status === "authenticated" ? "awaiting onboarding" : "sign in required"),
      },
      {
        label: "Restaurant settings loaded",
        status: settings ? "pass" : auth.status === "authenticated" && hasRestaurant ? "fail" : "warn",
        detail:
          settings
            ? `target_gpm=${settings.target_gpm}`
            : auth.status === "authenticated"
              ? hasRestaurant
                ? "settings missing"
                : "settings load waits for restaurant creation"
              : "sign in required",
      },
    ],
    [auth.memberships.length, auth.activeMembership, auth.status, hasRestaurant, settings],
  );

  const securityChecks: Check[] = useMemo(
    () => [
      {
        label: "Service-role key not exposed to client",
        status: typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined"
          ? "pass"
          : "fail",
        detail: "no VITE_SUPABASE_SERVICE_ROLE_KEY in client env",
      },
      {
        label: "persistSession enabled",
        status: AUTH_SESSION_CONFIG.persistSession ? "pass" : "fail",
        detail: AUTH_SESSION_CONFIG.persistSession ? "yes" : "no",
      },
      {
        label: "autoRefreshToken enabled",
        status: AUTH_SESSION_CONFIG.autoRefreshToken ? "pass" : "fail",
        detail: AUTH_SESSION_CONFIG.autoRefreshToken ? "yes" : "no",
      },
      {
        label: "auth state source",
        status: "pass",
        detail: `Supabase Auth (${auth.lastAuthEvent})`,
      },
      {
        label: "Google OAuth enabled",
        status: "warn",
        nonCritical: true,
        detail: "Email/password only in Build 1.0B.",
      },
      {
        label: "Operational data still mock",
        status: "warn",
        nonCritical: true,
        detail: "Ingredients/recipes/etc. not in Supabase yet.",
      },
    ],
    [],
  );

  const allChecks = [...authChecks, ...tenantChecks, ...rlsChecks, ...securityChecks];
  const authenticatedChecks = [...authChecks, ...tenantChecks, ...rlsChecks, ...securityChecks].filter(
    (check) => check.status !== "pending",
  );
  const activeChecks = isAuthenticated ? authenticatedChecks : [];
  const passCount = activeChecks.filter((c) => c.status === "pass").length;
  const warnCount = activeChecks.filter((c) => c.status === "warn").length;
  const failCount = activeChecks.filter((c) => c.status === "fail" && !c.nonCritical).length;

  const overall: OverallStatus = auth.status === "unauthenticated"
    ? "blocked"
    : !done || auth.status === "loading"
      ? "pending"
      : failCount > 0
        ? "fail"
        : warnCount > 0
          ? "warn"
          : "pass";
  const overallDetail = overall === "blocked"
    ? "Not ready — sign in required"
    : overall === "pending"
      ? "Loading auth QA checks…"
      : !hasRestaurant
        ? "Warning — authenticated but no restaurant yet"
        : overall === "pass"
          ? "Auth and tenant runtime checks passed"
          : overall === "warn"
            ? "Auth runtime usable with non-blocking warnings"
            : "Auth runtime has blocking failures";

  return (
    <AppShell>
      <PageHeader
        title="QA — Auth & Tenancy"
        description="Acceptance diagnostics for authentication, tenancy, RLS, and security posture."
      />
      <div className="space-y-6 p-6">
        {/* Overall summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Overall status</CardTitle>
            <OverallBadge status={overall} />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{overallDetail}</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <SummaryStat label="Pass" value={passCount} tone="pass" />
              <SummaryStat label="Warning" value={warnCount} tone="warn" />
              <SummaryStat label="Fail" value={failCount} tone="fail" />
            </div>
          </CardContent>
        </Card>

        {!isAuthenticated && (
          <Alert>
            <AlertTitle>Auth QA requires sign in</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Not signed in. Sign in first to run Auth QA.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/login">Go to Login</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/signup">Create Account</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isAuthenticated && !hasRestaurant && (
          <Alert>
            <AlertTitle>Authenticated but no restaurant yet</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Create a restaurant to complete onboarding and unlock tenant checks.</p>
              <div>
                <Button asChild size="sm">
                  <Link to="/onboarding/create-restaurant">Open onboarding</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Session info (no tokens) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <Row label="Status" value={auth.status} />
            <Row label="persistSession enabled" value={AUTH_SESSION_CONFIG.persistSession ? "yes" : "no"} />
            <Row label="autoRefreshToken enabled" value={AUTH_SESSION_CONFIG.autoRefreshToken ? "yes" : "no"} />
            <Row label="detectSessionInUrl" value={AUTH_SESSION_CONFIG.detectSessionInUrl ? "yes" : "no"} />
            <Row label="Session restored from getSession" value={auth.sessionRestored ? "yes" : "no"} />
            <Row label="Auth state source" value={`Supabase Auth (${auth.lastAuthEvent})`} />
            <Row label="User id" value={auth.userId ? `${auth.userId.slice(0, 8)}…` : "—"} />
            <Row label="Email" value={auth.email ?? "—"} />
            <Row label="Profile loaded" value={auth.profile ? "yes" : "no"} />
            <Row label="Memberships" value={String(auth.memberships.length)} />
            <Row
              label="Active restaurant"
              value={auth.activeMembership?.restaurant.name ?? "—"}
            />
            <Row label="Active role" value={auth.activeMembership?.role ?? "—"} />
            <Row label="Settings loaded" value={settings ? "yes" : "no"} />
          </CardContent>
        </Card>

        <CheckGroup title="Auth status" checks={authChecks} />
        <CheckGroup title="Tenant status" checks={tenantChecks} />
        <CheckGroup title="RLS smoke checks" checks={rlsChecks} pendingMessage="Running checks…" />
        <CheckGroup title="Security posture" checks={securityChecks} />

        {/* Manual acceptance checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual acceptance checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {MANUAL_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Static guidance. Not persisted.
            </p>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          No access tokens, refresh tokens, service-role keys, or raw session JSON are displayed.
          Build 1.0E — Persistent Supabase Session Hard Fix.
        </p>
      </div>
    </AppShell>
  );
}

const MANUAL_CHECKLIST = [
  "Anonymous /dashboard redirects to /login",
  "/login renders",
  "/signup renders",
  "New signup reaches /onboarding/create-restaurant",
  "create_restaurant_with_owner creates restaurant, owner membership, and settings",
  "After onboarding, /dashboard renders",
  "Topbar shows active restaurant name",
  "Sign out redirects to /login",
  "/qa-calculations renders after login",
  "/qa-data-integrity renders after login",
  "Operational mock pages render after login",
];

function CheckGroup({
  title,
  checks,
  pendingMessage,
}: {
  title: string;
  checks: Check[];
  pendingMessage?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {checks.length === 0 && (
          <p className="text-sm text-muted-foreground">{pendingMessage ?? "—"}</p>
        )}
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.label}</p>
              {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
            </div>
            <StatusBadge status={c.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "pass")
    return <Badge className="bg-success text-success-foreground">PASS</Badge>;
  if (status === "warn")
    return <Badge className="bg-warning text-warning-foreground">WARN</Badge>;
  if (status === "fail")
    return <Badge className="bg-destructive text-destructive-foreground">FAIL</Badge>;
  return <Badge variant="outline">…</Badge>;
}

function OverallBadge({ status }: { status: OverallStatus }) {
  if (status === "blocked")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        <Circle className="h-3.5 w-3.5" /> SIGN IN REQUIRED
      </span>
    );
  if (status === "pass")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> PASS
      </span>
    );
  if (status === "warn")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5" /> WARNING
      </span>
    );
  if (status === "fail")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
        <XCircle className="h-3.5 w-3.5" /> FAIL
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <Circle className="h-3.5 w-3.5" /> RUNNING
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pass" | "warn" | "fail";
}) {
  const cls =
    tone === "pass"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
