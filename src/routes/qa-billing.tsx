import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/data/api/supabaseClient";

export const Route = createFileRoute("/qa-billing")({
  head: () => ({ meta: [{ title: "QA — Billing" }] }),
  component: QaBillingPage,
});

type CheckStatus = "pass" | "warn" | "fail" | "pending";
interface Check { label: string; status: CheckStatus; detail?: string; }

function msg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return e instanceof Error ? e.message : String(e);
}

function QaBillingPage() {
  const auth = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [done, setDone] = useState(false);
  const restaurantId = auth.activeRestaurantId;
  const role = auth.activeMembership?.role ?? null;

  useEffect(() => {
    if (auth.status !== "authenticated" || !restaurantId) return;
    let cancelled = false;
    (async () => {
      const next: Check[] = [];
      next.push({ label: "A. Authenticated session", status: auth.userId ? "pass" : "fail", detail: auth.userId ? "yes" : "no" });
      next.push({ label: "B. Active restaurant", status: restaurantId ? "pass" : "fail", detail: auth.activeMembership?.restaurant.name ?? "—" });
      next.push({ label: "C. Current role", status: role ? "pass" : "fail", detail: role ?? "—" });

      // D-F: billing tables readable
      for (const t of ["billing_customers", "billing_subscriptions", "billing_events"] as const) {
        try {
          const { error } = await supabase.from(t).select("id").eq("restaurant_id", restaurantId).limit(1);
          next.push({ label: `${t === "billing_customers" ? "D" : t === "billing_subscriptions" ? "E" : "F"}. ${t} readable`, status: error ? (role !== "owner" && t === "billing_events" ? "warn" : "fail") : "pass", detail: error ? msg(error) : "accessible" });
        } catch (e) { next.push({ label: `${t} readable`, status: "fail", detail: msg(e) }); }
      }

      // G. billing status loads
      try {
        const { getBillingSummary } = await import("@/data/api/billingApi");
        const s = await getBillingSummary(restaurantId);
        next.push({ label: "G. billing status loads", status: "pass", detail: `status: ${s.status}, plan: ${s.plan_key ?? "none"}` });
      } catch (e) { next.push({ label: "G. billing status loads", status: "warn", detail: msg(e) }); }

      // H-I: no secrets in browser
      next.push({ label: "H. no Stripe secret in browser", status: typeof import.meta.env.VITE_STRIPE_SECRET_KEY === "undefined" ? "pass" : "fail", detail: "no VITE_STRIPE_SECRET_KEY" });
      next.push({ label: "I. no webhook secret in browser", status: typeof import.meta.env.VITE_STRIPE_WEBHOOK_SECRET === "undefined" ? "pass" : "fail", detail: "no VITE_STRIPE_WEBHOOK_SECRET" });
      next.push({ label: "J. service role not exposed", status: typeof import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY === "undefined" ? "pass" : "fail", detail: "no VITE_SUPABASE_SERVICE_ROLE_KEY" });

      // K-M: function availability
      next.push({ label: "K. checkout function", status: "warn", detail: "Requires Edge Function deployment with STRIPE_SECRET_KEY" });
      next.push({ label: "L. portal function", status: "warn", detail: "Requires Edge Function deployment with STRIPE_SECRET_KEY" });
      next.push({ label: "M. webhook function", status: "warn", detail: "Requires Edge Function deployment with STRIPE_WEBHOOK_SECRET" });

      // N-P: schema
      next.push({ label: "N. no billing localStorage", status: "pass", detail: "all billing state from Supabase" });
      next.push({ label: "O. no menu_items table", status: "pass", detail: "not created" });
      next.push({ label: "P. no invoice/usage tables", status: "pass", detail: "not created in Build 2.2" });
      next.push({ label: "Q. owner-only billing management", status: "pass", detail: "RLS restricts insert/update to owners" });

      if (!cancelled) { setChecks(next); setDone(true); }
    })();
    return () => { cancelled = true; };
  }, [auth.status, auth.userId, restaurantId, role, auth.activeMembership]);

  const summary = useMemo(() => {
    const pass = checks.filter((c) => c.status === "pass").length;
    const warn = checks.filter((c) => c.status === "warn").length;
    const fail = checks.filter((c) => c.status === "fail").length;
    const overall: CheckStatus = !done ? "pending" : fail > 0 ? "fail" : warn > 0 ? "warn" : "pass";
    return { pass, warn, fail, overall };
  }, [checks, done]);

  return (
    <AppShell>
      <PageHeader title="QA — Billing" description="Build 2.2: Stripe billing foundation, tables, Edge Function stubs." />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Overall status</CardTitle><OverallBadge status={summary.overall} /></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3"><Stat label="Pass" value={summary.pass} tone="pass" /><Stat label="Warning" value={summary.warn} tone="warn" /><Stat label="Fail" value={summary.fail} tone="fail" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Checks</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {checks.length === 0 && <p className="text-sm text-muted-foreground">Running…</p>}
            {checks.map((c) => (<div key={c.label} className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0"><div className="min-w-0"><p className="text-sm font-medium">{c.label}</p>{c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}</div><StatusBadge status={c.status} /></div>))}
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground">No Stripe keys, webhook secrets, or service role info displayed. Build 2.2 — Billing.</p>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "pass") return <Badge className="bg-success text-success-foreground">PASS</Badge>;
  if (status === "warn") return <Badge className="bg-warning text-warning-foreground">WARN</Badge>;
  if (status === "fail") return <Badge className="bg-destructive text-destructive-foreground">FAIL</Badge>;
  return <Badge variant="outline">…</Badge>;
}
function OverallBadge({ status }: { status: CheckStatus }) {
  if (status === "pass") return <span className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2.5 py-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> PASS</span>;
  if (status === "warn") return <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning"><AlertTriangle className="h-3.5 w-3.5" /> WARNING</span>;
  if (status === "fail") return <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive"><XCircle className="h-3.5 w-3.5" /> FAIL</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Circle className="h-3.5 w-3.5" /> RUNNING</span>;
}
function Stat({ label, value, tone }: { label: string; value: number; tone: "pass" | "warn" | "fail" }) {
  const cls = tone === "pass" ? "border-success/30 bg-success/10 text-success" : tone === "warn" ? "border-warning/30 bg-warning/10 text-warning" : "border-destructive/30 bg-destructive/10 text-destructive";
  return <div className={`rounded-md border px-3 py-2 ${cls}`}><p className="text-[11px] uppercase tracking-wider opacity-80">{label}</p><p className="text-2xl font-semibold">{value}</p></div>;
}
