import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Loader2, Database as DbIcon } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import {
  getPriceLogEntries,
  getSnapshotStatus,
  initializeBaseline,
} from "@/data/api/priceLogApi";
import type { IngredientPriceLogRow, SnapshotStatus } from "@/data/api/types";
import { formatDateTime, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/price-log")({
  head: () => ({
    meta: [
      { title: "Price Log — Margin IQ" },
      { name: "description", content: "Append-only ingredient price history." },
    ],
  }),
  component: PriceLogPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function PriceLogPage() {
  const { activeRestaurantId, activeMembership, userId } = useAuth();
  const [entries, setEntries] = useState<IngredientPriceLogRow[]>([]);
  const [snapStatus, setSnapStatus] = useState<SnapshotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [eventFilter, setEventFilter] = useState("all");
  const [ingredientFilter, setIngredientFilter] = useState("all");

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [log, status] = await Promise.all([
        getPriceLogEntries(activeRestaurantId),
        getSnapshotStatus(activeRestaurantId),
      ]);
      setEntries(log);
      setSnapStatus(status);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const ingredientNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.ingredient_name_at_time))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (eventFilter !== "all" && e.event_type !== eventFilter) return false;
      if (ingredientFilter !== "all" && e.ingredient_name_at_time !== ingredientFilter) return false;
      return true;
    });
  }, [entries, eventFilter, ingredientFilter]);

  const onInitialize = async () => {
    if (!activeRestaurantId || !userId) return;
    setInitializing(true);
    try {
      const result = await initializeBaseline(activeRestaurantId, userId, "Initial baseline");
      toast.success(`Baseline initialized — ${result.entries_created} ingredient(s) captured.`);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setInitializing(false);
    }
  };

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Price Log" description="Append-only price history." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Price Log"
        description="Append-only history. Records cannot be edited or deleted."
        actions={<Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Read-only</Badge>}
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Baseline / Snapshot Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <SF label="Initialized" value={snapStatus?.initialized ? "Yes" : "No"} />
                <SF label="Baseline version" value={snapStatus?.initialized ? `v${snapStatus.baseline_version}` : "—"} />
                <SF label="Snapshots" value={snapStatus?.initialized ? `${snapStatus.snapshot_count} / ${snapStatus.active_ingredient_count}` : "—"} />
                <SF label="Coverage" value={snapStatus?.coverage_complete ? "Complete" : snapStatus?.initialized ? "Incomplete" : "—"} />
              </div>
              {!snapStatus?.initialized && canManage && (
                <Button size="sm" onClick={onInitialize} disabled={initializing}>
                  {initializing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Initializing…</> : "Initialize Baseline"}
                </Button>
              )}
              {!snapStatus?.initialized && !canManage && (
                <p className="text-xs text-muted-foreground">Baseline not initialized. Owner/manager can initialize.</p>
              )}
              {snapStatus?.initialized && (
                <p className="text-xs text-muted-foreground">Non-destructive baseline reset arrives in a later build.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!loading && (
        <>
          <FilterBar>
            <Select value={ingredientFilter} onValueChange={setIngredientFilter}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Ingredient" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ingredients</SelectItem>
                {ingredientNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Event" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="baseline">Baseline</SelectItem>
                <SelectItem value="change">Change</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
              </SelectContent>
            </Select>
            <p className="ml-auto text-xs text-muted-foreground">{filtered.length} of {entries.length} entries</p>
          </FilterBar>

          <div className="p-6 pt-4">
            <div className="overflow-hidden rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Old RUC</TableHead>
                    <TableHead className="text-right">New RUC</TableHead>
                    <TableHead className="text-right">Δ RUC</TableHead>
                    <TableHead className="text-right">Δ %</TableHead>
                    <TableHead>v</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <DbIcon className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm font-medium">{entries.length === 0 ? "No price log entries yet. Initialize baseline to start." : "No entries match the current filters."}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] capitalize ${e.event_type === "baseline" ? "text-muted-foreground" : ""}`}>{e.event_type}</Badge></TableCell>
                        <TableCell className="font-medium text-sm">{e.ingredient_name_at_time}</TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">{e.ingredient_type_at_time}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.supplier_name_at_time ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{e.old_recipe_unit_cost != null ? formatUnitCost(Number(e.old_recipe_unit_cost), 6) : "—"}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{e.new_recipe_unit_cost != null ? formatUnitCost(Number(e.new_recipe_unit_cost), 6) : "—"}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {e.delta_recipe_unit_cost_amount != null && Number(e.delta_recipe_unit_cost_amount) !== 0
                            ? <span className={Number(e.delta_recipe_unit_cost_amount) > 0 ? "text-destructive" : "text-success"}>{Number(e.delta_recipe_unit_cost_amount) > 0 ? "+" : ""}{formatUnitCost(Number(e.delta_recipe_unit_cost_amount), 6)}</span>
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {e.delta_recipe_unit_cost_percent != null && Number(e.delta_recipe_unit_cost_percent) !== 0
                            ? <span className={Number(e.delta_recipe_unit_cost_percent) > 0 ? "text-destructive" : "text-success"}>{(Number(e.delta_recipe_unit_cost_percent) * 100).toFixed(2)}%</span>
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">v{e.baseline_version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.note ?? ""}</TableCell>
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

function SF({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div>;
}
