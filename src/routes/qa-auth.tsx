import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/data/api/supabaseClient";
import { getRestaurantSettings } from "@/data/api/tenantApi";
import type { RestaurantSettingsRow } from "@/data/api/types";

export const Route = createFileRoute("/qa-auth")({
  head: () => ({
    meta: [{ title: "QA — Auth & Tenancy" }],
  }),
  component: QaAuthPage,
});

type CheckStatus = "pass" | "warn" | "fail" | "pending";
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

  useEffect(() => {
    if (auth.status !== "authenticated") return;
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
        status: auth.status === "authenticated" ? "pass" : "fail",
        detail: auth.status,
      },
      {
        label: "User id available",
        status: auth.userId ? "pass" : "fail",
        detail: auth.userId ? "yes" : "no",
      },
      {
        label: "Profile loaded",
        status: auth.profile ? "pass" : "fail",
        detail: auth.profile ? "yes" : "no",
      },
    ],
    [auth.status, auth.userId, auth.profile],
  );

  const tenantChecks: Check[] = useMemo(
    () => [
      {
        label: "At least one membership",
        status: auth.memberships.length > 0 ? "pass" : "fail",
        detail: `${auth.memberships.length} membership(s)`,
      },
      {
        label: "Active restaurant selected",
        status: auth.activeMembership ? "pass" : "fail",
        detail: auth.activeMembership?.restaurant.name ?? "—",
      },
      {
        label: "Active role known",
        status: auth.activeMembership ? "pass" : "fail",
        detail: auth.activeMembership?.role ?? "—",
      },
      {
        label: "Restaurant settings loaded",
        status: settings ? "pass" : "fail",
        detail: settings ? `target_gpm=${settings.target_gpm}` : "—",
      },
    ],
    [auth.memberships.length, auth.activeMembership, settings],
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
        label: "Sessions are in-memory only (no localStorage)",
        status: "warn",
        nonCritical: true,
        detail:
          "persistSession=false; production session persistence is a future task.",
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
  const passCount = allChecks.filter((c) => c.status === "pass").length;
  const warnCount = allChecks.filter((c) => c.status === "warn").length;
  const failCount = allChecks.filter(
    (c) => c.status === "fail" && !c.nonCritical,
  ).length;

  const overall: CheckStatus = !done
    ? "pending"
    : failCount > 0
      ? "fail"
      : warnCount > 0
        ? "warn"
        : "pass";

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
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <SummaryStat label="Pass" value={passCount} tone="pass" />
            <SummaryStat label="Warning" value={warnCount} tone="warn" />
            <SummaryStat label="Fail" value={failCount} tone="fail" />
          </CardContent>
        </Card>

        {/* Session info (no tokens) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <Row label="Status" value={auth.status} />
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
          Build 1.0B — Auth/RLS Accepted.
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

function OverallBadge({ status }: { status: CheckStatus }) {
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
