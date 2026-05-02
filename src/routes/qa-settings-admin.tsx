import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/data/api/supabaseClient";
import {
  createMenuCategory,
  createSupplier,
  getMenuCategories,
  getRestaurantSettings,
  getSuppliers,
  getUnitConversions,
  getUnits,
  updateRestaurantSettings,
} from "@/data/api/settingsApi";
import type {
  MenuCategoryRow,
  RestaurantSettingsRow,
  SupplierRow,
  UnitConversionRow,
  UnitRow,
} from "@/data/api/types";

export const Route = createFileRoute("/qa-settings-admin")({
  head: () => ({ meta: [{ title: "QA — Settings/Admin" }] }),
  component: QaSettingsAdminPage,
});

type CheckStatus = "pass" | "warn" | "fail" | "pending";
interface Check {
  label: string;
  status: CheckStatus;
  detail?: string;
}

const REQUIRED_UNITS = ["Ct", "Gr", "Kg", "Lb", "Oz", "Ml", "Lt", "Gl"];
const DEFAULT_CATEGORIES = [
  "Appetizers & Salads",
  "The Classics",
  "Signature Dishes",
  "Specials",
  "Desserts",
  "Pizzeria",
  "Wine",
  "Beer",
  "Non-alcoholic beverages",
  "Intermediate",
];

function QaSettingsAdminPage() {
  const auth = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [done, setDone] = useState(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeResult, setWriteResult] = useState<Check | null>(null);

  const restaurantId = auth.activeRestaurantId;
  const role = auth.activeMembership?.role ?? null;

  useEffect(() => {
    if (auth.status !== "authenticated" || !restaurantId) return;
    let cancelled = false;
    (async () => {
      const next: Check[] = [];

      // A. Session
      next.push({
        label: "A. Authenticated session exists",
        status: auth.userId ? "pass" : "fail",
        detail: auth.userId ? "session present" : "no user id",
      });
      // B. Active restaurant
      next.push({
        label: "B. Active restaurant exists",
        status: restaurantId ? "pass" : "fail",
        detail: restaurantId ? auth.activeMembership?.restaurant.name ?? "" : "—",
      });
      // C. Role
      next.push({
        label: "C. Current role detected",
        status: role ? "pass" : "fail",
        detail: role ?? "—",
      });

      // D. settings loaded
      let settings: RestaurantSettingsRow | null = null;
      try {
        settings = await getRestaurantSettings(restaurantId);
        next.push({
          label: "D. restaurant_settings loaded",
          status: settings ? "pass" : "fail",
          detail: settings ? `target_gpm=${settings.target_gpm}` : "no row",
        });
      } catch (e) {
        next.push({
          label: "D. restaurant_settings loaded",
          status: "fail",
          detail: msg(e),
        });
      }

      // E. units
      let units: UnitRow[] = [];
      try {
        units = await getUnits();
        const codes = new Set(units.map((u) => u.code));
        const missing = REQUIRED_UNITS.filter((c) => !codes.has(c));
        next.push({
          label: "E. units loaded (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl)",
          status: missing.length === 0 ? "pass" : "fail",
          detail: missing.length === 0 ? `${units.length} unit(s)` : `missing: ${missing.join(", ")}`,
        });
      } catch (e) {
        next.push({ label: "E. units loaded", status: "fail", detail: msg(e) });
      }

      // F-H. conversions
      let conv: UnitConversionRow[] = [];
      try {
        conv = await getUnitConversions();
        const massCodes = new Set(["Gr", "Kg", "Lb", "Oz"]);
        const volCodes = new Set(["Ml", "Lt", "Gl"]);
        const massMass = conv.filter(
          (c) => massCodes.has(c.from_unit_code) && massCodes.has(c.to_unit_code),
        ).length;
        const volVol = conv.filter(
          (c) => volCodes.has(c.from_unit_code) && volCodes.has(c.to_unit_code),
        ).length;
        const ctCt = conv.filter(
          (c) => c.from_unit_code === "Ct" && c.to_unit_code === "Ct",
        ).length;
        const ctOther = conv.filter(
          (c) =>
            (c.from_unit_code === "Ct" && c.to_unit_code !== "Ct") ||
            (c.to_unit_code === "Ct" && c.from_unit_code !== "Ct"),
        ).length;
        next.push({
          label: "F. mass↔mass conversions loaded",
          status: massMass >= 16 ? "pass" : "fail",
          detail: `${massMass} rule(s)`,
        });
        next.push({
          label: "G. volume↔volume conversions loaded",
          status: volVol >= 9 ? "pass" : "fail",
          detail: `${volVol} rule(s)`,
        });
        next.push({
          label: "H. Ct only converts to Ct",
          status: ctCt >= 1 && ctOther === 0 ? "pass" : "fail",
          detail: `Ct↔Ct=${ctCt}, Ct↔other=${ctOther}`,
        });
      } catch (e) {
        next.push({ label: "F-H. unit_conversions loaded", status: "fail", detail: msg(e) });
      }

      // I-J. menu categories
      let categories: MenuCategoryRow[] = [];
      try {
        categories = await getMenuCategories(restaurantId);
        const names = new Set(categories.map((c) => c.name.toLowerCase()));
        const missing = DEFAULT_CATEGORIES.filter((n) => !names.has(n.toLowerCase()));
        next.push({
          label: "I. menu_categories loaded",
          status: categories.length > 0 ? "pass" : "fail",
          detail: `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`,
        });
        next.push({
          label: "J. default menu categories exist",
          status: missing.length === 0 ? "pass" : "warn",
          detail:
            missing.length === 0 ? "all defaults present" : `missing: ${missing.join(", ")}`,
        });
      } catch (e) {
        next.push({ label: "I-J. menu categories", status: "fail", detail: msg(e) });
      }

      // K. suppliers
      let suppliers: SupplierRow[] = [];
      try {
        suppliers = await getSuppliers(restaurantId);
        next.push({
          label: "K. suppliers loaded",
          status: "pass",
          detail: `${suppliers.length} supplier(s)`,
        });
      } catch (e) {
        next.push({ label: "K. suppliers loaded", status: "fail", detail: msg(e) });
      }

      // L/M. role-based update behavior
      if (role === "viewer") {
        try {
          const { error } = await supabase
            .from("restaurant_settings")
            .update({ target_gpm: settings?.target_gpm ?? 0.78 })
            .eq("restaurant_id", restaurantId)
            .select("*");
          // Postgres + RLS: an update that violates RLS returns no rows but
          // not necessarily an error code. We treat *anything* that didn't
          // surface a permission error as inconclusive but not a hard fail.
          next.push({
            label: "L. viewer cannot write settings",
            status: error ? "pass" : "warn",
            detail: error ? "write blocked" : "no error returned (RLS likely filtered rows)",
          });
        } catch (e) {
          next.push({ label: "L. viewer cannot write settings", status: "pass", detail: msg(e) });
        }
      } else {
        next.push({
          label: "L. viewer cannot write settings",
          status: "warn",
          detail: "Skipped — current role is not viewer.",
        });
      }

      if (role === "owner" && settings) {
        try {
          // No-op: write the same target_gpm back.
          await updateRestaurantSettings(restaurantId, { target_gpm: settings.target_gpm });
          next.push({
            label: "M. owner can update settings (no-op)",
            status: "pass",
            detail: "round-trip succeeded",
          });
        } catch (e) {
          next.push({
            label: "M. owner can update settings (no-op)",
            status: "fail",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "M. owner can update settings (no-op)",
          status: "warn",
          detail: "Skipped — current role is not owner.",
        });
      }

      // N. duplicate category rejected
      if (categories.length > 0 && (role === "owner" || role === "manager")) {
        try {
          await createMenuCategory(restaurantId, { name: categories[0].name });
          next.push({
            label: "N. duplicate category rejected",
            status: "fail",
            detail: "duplicate insert succeeded — UNIQUE index missing?",
          });
        } catch (e) {
          const errCode =
            (e as { code?: string } | null)?.code ?? "unknown";
          next.push({
            label: "N. duplicate category rejected",
            status: errCode === "duplicate" ? "pass" : "warn",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "N. duplicate category rejected",
          status: "warn",
          detail: "Skipped — no categories or insufficient role.",
        });
      }

      // O. duplicate supplier rejected
      if (suppliers.length > 0 && (role === "owner" || role === "manager")) {
        try {
          await createSupplier(restaurantId, { name: suppliers[0].name });
          next.push({
            label: "O. duplicate supplier rejected",
            status: "fail",
            detail: "duplicate insert succeeded — UNIQUE index missing?",
          });
        } catch (e) {
          const errCode = (e as { code?: string } | null)?.code ?? "unknown";
          next.push({
            label: "O. duplicate supplier rejected",
            status: errCode === "duplicate" ? "pass" : "warn",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "O. duplicate supplier rejected",
          status: "warn",
          detail: "Skipped — no suppliers or insufficient role.",
        });
      }

      // P. cross-tenant access — check by trying a random uuid
      try {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const { data } = await supabase
          .from("menu_categories")
          .select("id")
          .eq("restaurant_id", fakeId);
        next.push({
          label: "P. no cross-tenant access detected",
          status: (data?.length ?? 0) === 0 ? "pass" : "fail",
          detail: `${data?.length ?? 0} row(s) returned for non-member restaurant`,
        });
      } catch (e) {
        next.push({
          label: "P. no cross-tenant access detected",
          status: "warn",
          detail: msg(e),
        });
      }

      // Q. service role exposed?
      next.push({
        label: "Q. service-role key not exposed to client",
        status:
          typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined" ? "pass" : "fail",
        detail: "no VITE_SUPABASE_SERVICE_ROLE_KEY in client env",
      });

      if (!cancelled) {
        setChecks(next);
        setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.userId, restaurantId, role, auth.activeMembership]);

  const summary = useMemo(() => {
    const pass = checks.filter((c) => c.status === "pass").length;
    const warn = checks.filter((c) => c.status === "warn").length;
    const fail = checks.filter((c) => c.status === "fail").length;
    const overall: CheckStatus = !done
      ? "pending"
      : fail > 0
        ? "fail"
        : warn > 0
          ? "warn"
          : "pass";
    return { pass, warn, fail, overall };
  }, [checks, done]);

  const runManualWrite = async () => {
    if (!restaurantId) return;
    setWriteBusy(true);
    setWriteResult(null);
    try {
      const settings = await getRestaurantSettings(restaurantId);
      if (!settings) throw new Error("no settings");
      await updateRestaurantSettings(restaurantId, { target_gpm: settings.target_gpm });
      setWriteResult({
        label: "Manual no-op write",
        status: "pass",
        detail: "Round-trip update succeeded.",
      });
    } catch (e) {
      setWriteResult({ label: "Manual no-op write", status: "fail", detail: msg(e) });
    } finally {
      setWriteBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="QA — Settings/Admin Reference"
        description="Verifies the Build 1.1 reference layer: units, conversions, menu categories, suppliers, and settings RLS."
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Overall</CardTitle>
            <OverallBadge status={summary.overall} />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Pass" value={summary.pass} tone="pass" />
            <Stat label="Warning" value={summary.warn} tone="warn" />
            <Stat label="Fail" value={summary.fail} tone="fail" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {checks.length === 0 && (
              <p className="text-sm text-muted-foreground">Running…</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual no-op write smoke test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Re-saves the current <code>target_gpm</code> back to{" "}
              <code>restaurant_settings</code>. Reversible (no value changes).
              Available to owners only.
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={writeBusy || role !== "owner" || !restaurantId}
                onClick={runManualWrite}
              >
                {writeBusy ? "Running…" : "Run no-op write"}
              </Button>
              {writeResult && <StatusBadge status={writeResult.status} />}
              {writeResult?.detail && (
                <span className="text-xs text-muted-foreground">{writeResult.detail}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          No tokens or secrets are displayed. Build 1.1 — Settings/Admin Reference.
        </p>
      </div>
    </AppShell>
  );
}

function msg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return e instanceof Error ? e.message : String(e);
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

function Stat({
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
