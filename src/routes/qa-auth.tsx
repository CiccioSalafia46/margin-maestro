import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
}

function QaAuthPage() {
  const auth = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const next: Check[] = [];

      // 1. Profile read
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("id", auth.userId!)
          .maybeSingle();
        if (error) throw error;
        next.push({
          label: "Read own profile",
          status: data ? "pass" : "warn",
          detail: data ? `id=${data.id.slice(0, 8)}…` : "no row found",
        });
      } catch (e) {
        next.push({
          label: "Read own profile",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // 2. List restaurants
      try {
        const { data, error } = await supabase.from("restaurants").select("id, name");
        if (error) throw error;
        next.push({
          label: "Read own restaurants",
          status: "pass",
          detail: `${data?.length ?? 0} restaurant(s) visible`,
        });
      } catch (e) {
        next.push({
          label: "Read own restaurants",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // 3. Settings read
      let settingsRow: RestaurantSettingsRow | null = null;
      if (auth.activeRestaurantId) {
        try {
          settingsRow = await getRestaurantSettings(auth.activeRestaurantId);
          next.push({
            label: "Read active restaurant_settings",
            status: settingsRow ? "pass" : "warn",
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

      // Membership rows readable
      if (auth.activeRestaurantId) {
        try {
          const { data, error } = await supabase
            .from("restaurant_members")
            .select("role,user_id")
            .eq("restaurant_id", auth.activeRestaurantId);
          if (error) throw error;
          next.push({
            label: "Read own membership rows",
            status: "pass",
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
        setChecks(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.userId, auth.activeRestaurantId, auth.activeMembership]);

  return (
    <AppShell>
      <PageHeader
        title="QA — Auth & Tenancy"
        description="Diagnostic checks for authentication, tenant membership, and RLS."
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <Row label="Status" value={auth.status} />
            <Row label="User id" value={auth.userId ?? "—"} />
            <Row label="Email" value={auth.email ?? "—"} />
            <Row label="Profile loaded" value={auth.profile ? "yes" : "no"} />
            <Row label="Memberships" value={String(auth.memberships.length)} />
            <Row
              label="Active restaurant"
              value={
                auth.activeMembership
                  ? `${auth.activeMembership.restaurant.name} (${auth.activeMembership.restaurant.id.slice(0, 8)}…)`
                  : "—"
              }
            />
            <Row label="Active role" value={auth.activeMembership?.role ?? "—"} />
            <Row label="Settings loaded" value={settings ? "yes" : "no"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">RLS smoke checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checks.length === 0 && (
              <p className="text-sm text-muted-foreground">Running checks…</p>
            )}
            {checks.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          No tokens or secrets are displayed. Build 1.0 — auth + tenant only.
        </p>
      </div>
    </AppShell>
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
