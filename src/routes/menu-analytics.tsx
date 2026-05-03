import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { KpiCard } from "@/components/common/KpiCard";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
} from "@/components/common/badges";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { getMenuAnalyticsData } from "@/data/api/menuAnalyticsApi";
import type { MenuAnalyticsRow, MenuAnalyticsSummary } from "@/data/api/types";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/menu-analytics")({
  head: () => ({
    meta: [
      { title: "Menu Analytics — Margin IQ" },
      {
        name: "description",
        content: "Per-dish profitability: COGS, GP, GPM, target status, suggested price.",
      },
    ],
  }),
  component: MenuAnalyticsPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function MenuAnalyticsPage() {
  const { activeRestaurantId, activeMembership, activeRestaurantSettings } = useAuth();
  const [rows, setRows] = useState<MenuAnalyticsRow[]>([]);
  const [summary, setSummary] = useState<MenuAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [belowOnly, setBelowOnly] = useState(false);
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const targetGpm = activeRestaurantSettings?.target_gpm ?? 0.78;

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const data = await getMenuAnalyticsData(activeRestaurantId);
      setRows(data.rows);
      setSummary(data.summary);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category_name).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (belowOnly && r.on_target !== false) return false;
      if (category !== "all" && r.category_name !== category) return false;
      if (statusFilter === "incomplete" && r.status !== "incomplete") return false;
      if (statusFilter === "missing_price" && (r.menu_price != null && r.menu_price > 0)) return false;
      return true;
    }).sort((a, b) => (a.gpm ?? 1) - (b.gpm ?? 1));
  }, [rows, belowOnly, category, statusFilter]);

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Menu Analytics" description="Dish profitability analysis." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Menu Analytics"
        description={`Target GPM ${(targetGpm * 100).toFixed(0)}%. Derived from active dish recipes. Snapshot delta arrives in Build 1.5.`}
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading menu analytics…
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard
                label="Average GPM"
                value={summary?.avg_gpm != null ? <PercentCell value={summary.avg_gpm} decimals={1} /> : "—"}
                tone={summary?.avg_gpm != null && summary.avg_gpm >= targetGpm ? "positive" : "warning"}
                hint={`Target ${(targetGpm * 100).toFixed(0)}% • ${summary?.priced_dishes ?? 0} priced`}
              />
              <KpiCard
                label="Average GP"
                value={summary?.avg_gp != null ? <MoneyCell value={summary.avg_gp} /> : "—"}
                hint="Per serving"
              />
              <KpiCard
                label="Top performer"
                value={summary?.top_performer ? <span className="text-base">{summary.top_performer.dish_name}</span> : "—"}
                hint={summary?.top_performer?.gpm != null ? <PercentCell value={summary.top_performer.gpm} /> : ""}
                tone="positive"
              />
              <KpiCard
                label="Bottom performer"
                value={summary?.bottom_performer ? <span className="text-base">{summary.bottom_performer.dish_name}</span> : "—"}
                hint={summary?.bottom_performer?.gpm != null ? <PercentCell value={summary.bottom_performer.gpm} /> : ""}
                tone="negative"
              />
              <KpiCard
                label="Below target"
                value={summary?.below_target_count ?? 0}
                tone={(summary?.below_target_count ?? 0) > 0 ? "negative" : "positive"}
                hint={`${summary?.missing_price_count ?? 0} missing price`}
              />
            </div>
          </>
        )}
      </div>

      {!loading && (
        <>
          <FilterBar>
            <div className="flex items-center gap-2">
              <Switch id="below" checked={belowOnly} onCheckedChange={setBelowOnly} />
              <Label htmlFor="below" className="cursor-pointer">Below target only</Label>
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="incomplete">Incomplete costing</SelectItem>
                <SelectItem value="missing_price">Missing price</SelectItem>
              </SelectContent>
            </Select>
            <p className="ml-auto text-xs text-muted-foreground">
              {filtered.length} of {rows.length} dishes
            </p>
          </FilterBar>

          <div className="p-6 pt-4">
            <div className="overflow-hidden rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Menu price</TableHead>
                    <TableHead className="text-right">COGS/serving</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                    <TableHead className="text-right">GPM</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Suggested</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                        {rows.length === 0 ? "No active dish recipes. Create a dish recipe to see analytics." : "No dishes match the current filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.recipe_id}>
                        <TableCell className="font-medium">
                          <Link to="/recipes/$id" params={{ id: row.recipe_id }} className="hover:underline">
                            {row.dish_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.category_name ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {row.menu_price != null && row.menu_price > 0
                            ? <MoneyCell value={row.menu_price} />
                            : <span className="text-xs italic text-muted-foreground">Set menu price</span>}
                        </TableCell>
                        <TableCell className="text-right"><MoneyCell value={row.cost_per_serving} /></TableCell>
                        <TableCell className="text-right">
                          {row.gp != null ? <MoneyCell value={row.gp} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.gpm != null ? <PercentCell value={row.gpm} decimals={1} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {row.on_target != null ? <OnTargetBadge onTarget={row.on_target} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.suggested_menu_price != null ? (
                            <span className="tabular-nums text-sm">
                              {formatMoney(row.suggested_menu_price)}
                              {row.menu_price != null && row.menu_price > 0 && (
                                <span className={`ml-1 text-[10px] ${row.suggested_menu_price > row.menu_price ? "text-destructive" : "text-success"}`}>
                                  ({row.suggested_menu_price > row.menu_price ? "+" : ""}{formatMoney(row.suggested_menu_price - row.menu_price)})
                                </span>
                              )}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
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

function StatusBadge({ status }: { status: string }) {
  if (status === "valid") return <Badge className="bg-success text-success-foreground text-[10px]">OK</Badge>;
  if (status === "warning") return <Badge className="bg-warning text-warning-foreground text-[10px]">Warn</Badge>;
  if (status === "error") return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Err</Badge>;
  return <Badge variant="outline" className="text-[10px]">Incomplete</Badge>;
}
