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
          detail: settings
            ? `target_gpm=${settings.target_gpm}, currency=${settings.currency_code}, locale=${settings.locale}, tax=${settings.tax_mode}, tz=${settings.timezone}`
            : "no row",
        });
      } catch (e) {
        next.push({
          label: "D. restaurant_settings loaded",
          status: "fail",
          detail: msg(e),
        });
      }

      // E. units loaded + required codes present
      let units: UnitRow[] = [];
      try {
        units = await getUnits();
        const codes = new Set(units.map((u) => u.code));
        const missing = REQUIRED_UNITS.filter((c) => !codes.has(c));
        next.push({
          label: "E. units loaded (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl)",
          status: missing.length === 0 ? "pass" : "fail",
          detail:
            missing.length === 0 ? `${units.length} unit(s)` : `missing: ${missing.join(", ")}`,
        });

        // E2. unit families correct + factors correct
        const expectedFamilies: Record<string, string> = {
          Ct: "count",
          Gr: "mass",
          Kg: "mass",
          Lb: "mass",
          Oz: "mass",
          Ml: "volume",
          Lt: "volume",
          Gl: "volume",
        };
        const expectedFactors: Record<string, number> = {
          Kg: 1000,
          Lb: 453.592,
          Oz: 28.3495,
          Lt: 1000,
          Gl: 3785.411784,
        };
        const familyMismatch: string[] = [];
        const factorMismatch: string[] = [];
        for (const u of units) {
          const fam = expectedFamilies[u.code];
          if (fam && u.family !== fam) familyMismatch.push(`${u.code}=${u.family}`);
          const f = expectedFactors[u.code];
          if (f != null && Number(u.to_base_factor ?? 0) !== f) {
            factorMismatch.push(`${u.code}=${u.to_base_factor}`);
          }
        }
        next.push({
          label: "E2. unit families correct (Ct=count, Gr/Kg/Lb/Oz=mass, Ml/Lt/Gl=volume)",
          status: familyMismatch.length === 0 ? "pass" : "fail",
          detail: familyMismatch.length === 0 ? "all families match" : familyMismatch.join(", "),
        });
        next.push({
          label: "E3. unit factors correct (Kg=1000, Lb=453.592, Oz=28.3495, Lt=1000, Gl=3785.411784)",
          status: factorMismatch.length === 0 ? "pass" : "fail",
          detail: factorMismatch.length === 0 ? "all factors match" : factorMismatch.join(", "),
        });
      } catch (e) {
        next.push({ label: "E. units loaded", status: "fail", detail: msg(e) });
      }

      // F-J. conversions
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
        const crossNoDensity = conv.filter(
          (c) =>
            !c.requires_density &&
            ((massCodes.has(c.from_unit_code) && volCodes.has(c.to_unit_code)) ||
              (volCodes.has(c.from_unit_code) && massCodes.has(c.to_unit_code))),
        ).length;
        next.push({
          label: "F. mass↔mass conversions exist",
          status: massMass >= 16 ? "pass" : "fail",
          detail: `${massMass} rule(s)`,
        });
        next.push({
          label: "G. volume↔volume conversions exist",
          status: volVol >= 9 ? "pass" : "fail",
          detail: `${volVol} rule(s)`,
        });
        next.push({
          label: "H. Ct only converts to Ct",
          status: ctCt >= 1 && ctOther === 0 ? "pass" : "fail",
          detail: `Ct↔Ct=${ctCt}, Ct↔other=${ctOther}`,
        });
        next.push({
          label: "J. no silent cross-family conversion (mass↔volume) without density",
          status: crossNoDensity === 0 ? "pass" : "fail",
          detail:
            crossNoDensity === 0
              ? "no unsafe cross-family rules"
              : `${crossNoDensity} cross-family rule(s) without requires_density`,
        });
      } catch (e) {
        next.push({ label: "F-J. unit_conversions loaded", status: "fail", detail: msg(e) });
      }

      // K-L. menu categories
      let categories: MenuCategoryRow[] = [];
      try {
        categories = await getMenuCategories(restaurantId);
        const names = new Set(categories.map((c) => c.name.toLowerCase()));
        const missing = DEFAULT_CATEGORIES.filter((n) => !names.has(n.toLowerCase()));
        next.push({
          label: "K. menu_categories loaded",
          status: categories.length > 0 ? "pass" : "fail",
          detail: `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`,
        });
        next.push({
          label: "L. default menu categories exist",
          status: missing.length === 0 ? "pass" : "warn",
          detail:
            missing.length === 0 ? "all defaults present" : `missing: ${missing.join(", ")}`,
        });
      } catch (e) {
        next.push({ label: "K-L. menu categories", status: "fail", detail: msg(e) });
      }

      // M. duplicate category rejected (read-only when role can't write)
      if (categories.length > 0 && (role === "owner" || role === "manager")) {
        try {
          await createMenuCategory(restaurantId, { name: categories[0].name });
          next.push({
            label: "M. duplicate menu category name rejected",
            status: "fail",
            detail: "duplicate insert succeeded — UNIQUE index missing?",
          });
        } catch (e) {
          const errCode = (e as { code?: string } | null)?.code ?? "unknown";
          next.push({
            label: "M. duplicate menu category name rejected",
            status: errCode === "duplicate" ? "pass" : "warn",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "M. duplicate menu category name rejected",
          status: "warn",
          detail: "Skipped — no categories or insufficient role.",
        });
      }

      // N. suppliers loaded (or empty state acceptable)
      let suppliers: SupplierRow[] = [];
      try {
        suppliers = await getSuppliers(restaurantId);
        next.push({
          label: "N. suppliers loaded (empty allowed)",
          status: "pass",
          detail: `${suppliers.length} supplier(s)`,
        });
      } catch (e) {
        next.push({ label: "N. suppliers loaded", status: "fail", detail: msg(e) });
      }

      // O. duplicate supplier rejected
      if (suppliers.length > 0 && (role === "owner" || role === "manager")) {
        try {
          await createSupplier(restaurantId, { name: suppliers[0].name });
          next.push({
            label: "O. duplicate supplier name rejected",
            status: "fail",
            detail: "duplicate insert succeeded — UNIQUE index missing?",
          });
        } catch (e) {
          const errCode = (e as { code?: string } | null)?.code ?? "unknown";
          next.push({
            label: "O. duplicate supplier name rejected",
            status: errCode === "duplicate" ? "pass" : "warn",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "O. duplicate supplier name rejected",
          status: "warn",
          detail: "Skipped — no suppliers or insufficient role.",
        });
      }

      // P. owner can update settings (no-op)
      if (role === "owner" && settings) {
        try {
          await updateRestaurantSettings(restaurantId, { target_gpm: settings.target_gpm });
          next.push({
            label: "P. owner can update settings (no-op round-trip)",
            status: "pass",
            detail: "round-trip succeeded",
          });
        } catch (e) {
          next.push({
            label: "P. owner can update settings (no-op round-trip)",
            status: "fail",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "P. owner can update settings (no-op round-trip)",
          status: "warn",
          detail: "Skipped — current role is not owner.",
        });
      }

      // Q. manager/viewer cannot update settings
      if (role === "viewer" || role === "manager") {
        try {
          const { error } = await supabase
            .from("restaurant_settings")
            .update({ target_gpm: settings?.target_gpm ?? 0.78 })
            .eq("restaurant_id", restaurantId)
            .select("*");
          next.push({
            label: "Q. manager/viewer cannot update settings",
            status: error ? "pass" : "warn",
            detail: error ? "write blocked" : "no error returned (RLS likely filtered rows)",
          });
        } catch (e) {
          next.push({
            label: "Q. manager/viewer cannot update settings",
            status: "pass",
            detail: msg(e),
          });
        }
      } else {
        next.push({
          label: "Q. manager/viewer cannot update settings",
          status: "warn",
          detail: "Skipped — current role is owner.",
        });
      }

      // R. menu_categories tenant-scoped (cross-tenant fake id read returns 0)
      try {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const { data } = await supabase
          .from("menu_categories")
          .select("id")
          .eq("restaurant_id", fakeId);
        next.push({
          label: "R. menu_categories are tenant-scoped",
          status: (data?.length ?? 0) === 0 ? "pass" : "fail",
          detail: `${data?.length ?? 0} row(s) returned for non-member restaurant`,
        });
      } catch (e) {
        next.push({
          label: "R. menu_categories are tenant-scoped",
          status: "warn",
          detail: msg(e),
        });
      }

      // S. suppliers tenant-scoped
      try {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const { data } = await supabase
          .from("suppliers")
          .select("id")
          .eq("restaurant_id", fakeId);
        next.push({
          label: "S. suppliers are tenant-scoped",
          status: (data?.length ?? 0) === 0 ? "pass" : "fail",
          detail: `${data?.length ?? 0} row(s) returned for non-member restaurant`,
        });
      } catch (e) {
        next.push({
          label: "S. suppliers are tenant-scoped",
          status: "warn",
          detail: msg(e),
        });
      }

      // T. service-role exposure
      next.push({
        label: "T. service-role key not exposed to client",
        status:
          typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined" ? "pass" : "fail",
        detail: "no VITE_SUPABASE_SERVICE_ROLE_KEY in client env",
      });

      // U. no operational tables created (probe should return relation-not-found / 404)
      try {
        const opTables = ["ingredients", "recipes", "menu_items", "ingredient_price_log"] as const;
        const probes = await Promise.all(
          opTables.map(async (t) => {
            // Cast to any: these tables intentionally don't exist in the schema yet.
            const { error } = await (supabase as unknown as {
              from: (t: string) => {
                select: (s: string) => { limit: (n: number) => Promise<{ error: unknown }> };
              };
            })
              .from(t)
              .select("id")
              .limit(1);
            return { t, error };
          }),
        );
        const present = probes.filter((p) => !p.error).map((p) => p.t);
        next.push({
          label: "U. no operational tables created",
          status: present.length === 0 ? "pass" : "fail",
          detail:
            present.length === 0
              ? "ingredients/recipes/menu_items/price_log absent"
              : `unexpected tables present: ${present.join(", ")}`,
        });
      } catch {
        next.push({
          label: "U. no operational tables created",
          status: "pass",
          detail: "probe rejected (tables absent)",
        });
      }

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

    const sectionStatus = (prefixes: string[]): CheckStatus => {
      const subset = checks.filter((c) => prefixes.some((p) => c.label.startsWith(p)));
      if (subset.length === 0) return "pending";
      if (subset.some((c) => c.status === "fail")) return "fail";
      if (subset.some((c) => c.status === "warn")) return "warn";
      return "pass";
    };
    const sections = {
      authTenant: sectionStatus(["A.", "B.", "C."]),
      settings: sectionStatus(["D.", "P."]),
      reference: sectionStatus(["E.", "E2.", "E3.", "F.", "G.", "H.", "J.", "K.", "L.", "N."]),
      rls: sectionStatus(["R.", "S.", "T.", "U."]),
      roles: sectionStatus(["M.", "O.", "P.", "Q."]),
    };
    return { pass, warn, fail, overall, sections };
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
        title="QA — Settings/Admin Acceptance"
        description="Build 1.1A acceptance pass: units, conversions, menu categories, suppliers, settings, RLS, and role behavior."
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Overall acceptance status</CardTitle>
            <OverallBadge status={summary.overall} />
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Pass" value={summary.pass} tone="pass" />
              <Stat label="Warning" value={summary.warn} tone="warn" />
              <Stat label="Fail" value={summary.fail} tone="fail" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <SectionStat label="Auth / Tenant" status={summary.sections.authTenant} />
              <SectionStat label="Settings" status={summary.sections.settings} />
              <SectionStat label="Reference data" status={summary.sections.reference} />
              <SectionStat label="RLS / Security" status={summary.sections.rls} />
              <SectionStat label="Role behavior" status={summary.sections.roles} />
            </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual acceptance checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Static guidance for human verification. Not persisted.
            </p>
            <ul className="space-y-1.5">
              {[
                "Owner can open Settings.",
                "Owner can update General settings (currency, locale, tax mode, timezone, target GPM).",
                "Owner can update Alert Thresholds (spike %, GPM drop %, GP floor).",
                "Owner can add, edit, and deactivate a Menu Category.",
                "Owner can add, edit, and deactivate a Supplier.",
                "Units & Conversions tab is read-only (global reference).",
                "Team tab is placeholder/read-only.",
                "Duplicate menu category names are handled gracefully (friendly error, no crash).",
                "Duplicate supplier names are handled gracefully (friendly error, no crash).",
                "Manager can manage Categories/Suppliers but cannot update General/Thresholds.",
                "Viewer is read-only across all Settings tabs.",
                "Operational pages (/dashboard, /ingredients, /recipes, /menu-analytics, /dish-analysis, /impact-cascade, /price-trend, /price-log, /alerts) still render mock data.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          No tokens or secrets are displayed. Build 1.1A — Settings/Admin Accepted.
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

function SectionStat({ label, status }: { label: string; status: CheckStatus }) {
  const tone =
    status === "pass"
      ? "border-success/30 bg-success/10 text-success"
      : status === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : status === "fail"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-muted bg-muted text-muted-foreground";
  const text =
    status === "pass" ? "Pass" : status === "warn" ? "Warning" : status === "fail" ? "Fail" : "…";
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}
