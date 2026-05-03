import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { KpiCard } from "@/components/common/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import {
  acknowledgeAlert, deriveAlertSummary, dismissAlert, generateAlertsForRestaurant, getAlerts, resolveAlert,
} from "@/data/api/alertsApi";
import type { AlertRow } from "@/data/api/types";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Alerts — Margin IQ" }, { name: "description", content: "Operator-facing margin intelligence alerts." }] }),
  component: AlertsPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

const SEV_ORDER = { critical: 0, warning: 1, info: 2 };

function AlertsPage() {
  const { activeRestaurantId, activeMembership, userId } = useAuth();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sevFilter, setSevFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      setAlerts(await getAlerts(activeRestaurantId));
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => deriveAlertSummary(alerts), [alerts]);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => sevFilter === "all" || a.severity === sevFilter)
      .filter((a) => typeFilter === "all" || a.alert_type === typeFilter)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || b.detected_at.localeCompare(a.detected_at));
  }, [alerts, sevFilter, typeFilter, statusFilter]);

  const onGenerate = async () => {
    if (!activeRestaurantId) return;
    setGenerating(true);
    try {
      const result = await generateAlertsForRestaurant(activeRestaurantId);
      toast.success(`${result.created} new alert(s) generated.`);
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setGenerating(false); }
  };

  const onAction = async (alertId: string, action: "acknowledge" | "resolve" | "dismiss") => {
    if (!activeRestaurantId || !userId) return;
    try {
      if (action === "acknowledge") await acknowledgeAlert(activeRestaurantId, alertId, userId);
      if (action === "resolve") await resolveAlert(activeRestaurantId, alertId, userId);
      if (action === "dismiss") await dismissAlert(activeRestaurantId, alertId, userId);
      toast.success(`Alert ${action}d.`);
      await load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!activeRestaurantId || !activeMembership) {
    return <AppShell><PageHeader title="Alerts" /><div className="p-6 text-sm text-muted-foreground">No active restaurant.</div></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Alerts" description="Operator-facing margin intelligence alerts." actions={
        canManage ? (
          <Button size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Generating…</> : <><Zap className="mr-1.5 h-4 w-4" />Generate Alerts</>}
          </Button>
        ) : undefined
      } />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Open alerts" value={summary.open} tone={summary.open > 0 ? "negative" : "positive"} />
            <KpiCard label="Critical" value={summary.critical} tone={summary.critical > 0 ? "negative" : "positive"} />
            <KpiCard label="Warning" value={summary.warning} tone={summary.warning > 0 ? "warning" : "positive"} />
            <KpiCard label="Resolved" value={summary.resolved} />
          </div>
        )}
      </div>

      {!loading && (
        <>
          <FilterBar>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="dish_below_target">Dish below target</SelectItem>
                <SelectItem value="dish_newly_below_target">Newly below target</SelectItem>
                <SelectItem value="ingredient_cost_spike">Ingredient spike</SelectItem>
                <SelectItem value="impact_cascade_margin_drop">Margin drop</SelectItem>
                <SelectItem value="missing_menu_price">Missing price</SelectItem>
                <SelectItem value="incomplete_costing">Incomplete costing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <p className="ml-auto text-xs text-muted-foreground">{filtered.length} of {alerts.length} alerts</p>
          </FilterBar>

          <div className="p-6 pt-4">
            <div className="overflow-hidden rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2"><Bell className="h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">{alerts.length === 0 ? "No alerts yet. Generate alerts to analyze current state." : "No alerts match the current filters."}</p></div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><SevBadge severity={a.severity} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{a.alert_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-medium text-sm">{a.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{a.message}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.detected_at)}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        {canManage && (
                          <TableCell className="text-right space-x-1">
                            {a.status === "open" && <Button size="sm" variant="outline" onClick={() => onAction(a.id, "acknowledge")}>Ack</Button>}
                            {(a.status === "open" || a.status === "acknowledged") && <Button size="sm" variant="outline" onClick={() => onAction(a.id, "resolve")}>Resolve</Button>}
                            {a.status === "open" && <Button size="sm" variant="ghost" onClick={() => onAction(a.id, "dismiss")}>Dismiss</Button>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function SevBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Critical</Badge>;
  if (severity === "warning") return <Badge className="bg-warning text-warning-foreground text-[10px]">Warning</Badge>;
  return <Badge variant="outline" className="text-[10px]">Info</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open") return <Badge variant="outline" className="text-[10px]">Open</Badge>;
  if (status === "acknowledged") return <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Ack'd</Badge>;
  if (status === "resolved") return <Badge className="bg-success text-success-foreground text-[10px]">Resolved</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Dismissed</Badge>;
}
