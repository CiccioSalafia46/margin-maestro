import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { PercentCell, UnitCostCell } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  derivePriceTrendSeries,
  derivePriceTrendStats,
  getIngredientPriceTrend,
  getPriceTrendIngredients,
} from "@/data/api/priceTrendApi";
import type { IngredientPriceLogRow, IngredientWithCostState } from "@/data/api/types";
import { formatDateTime, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/price-trend")({
  head: () => ({
    meta: [
      { title: "Price Trend — Margin IQ" },
      { name: "description", content: "Per-ingredient unit cost history with trend statistics." },
    ],
  }),
  component: PriceTrendPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function PriceTrendPage() {
  const { activeRestaurantId, activeMembership } = useAuth();
  const [tracked, setTracked] = useState<IngredientWithCostState[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [entries, setEntries] = useState<IngredientPriceLogRow[]>([]);
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const loadIngredients = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const ings = await getPriceTrendIngredients(activeRestaurantId);
      setTracked(ings);
      if (ings.length > 0 && !selectedId) {
        setSelectedId(ings[0].id);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void loadIngredients(); }, [loadIngredients]);

  const loadTrend = useCallback(async () => {
    if (!activeRestaurantId || !selectedId) return;
    setLoadingTrend(true);
    try {
      const rows = await getIngredientPriceTrend(activeRestaurantId, selectedId);
      setEntries(rows);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoadingTrend(false);
    }
  }, [activeRestaurantId, selectedId]);

  useEffect(() => { void loadTrend(); }, [loadTrend]);

  const stats = useMemo(() => derivePriceTrendStats(entries), [entries]);
  const chartData = useMemo(() => derivePriceTrendSeries(entries, includeBaseline), [entries, includeBaseline]);
  const filteredEntries = useMemo(
    () => includeBaseline ? entries : entries.filter((e) => e.event_type !== "baseline"),
    [entries, includeBaseline],
  );

  if (!activeRestaurantId || !activeMembership) {
    return (
      <AppShell>
        <PageHeader title="Price Trend" description="Per-ingredient unit cost history." />
        <div className="p-6 text-sm text-muted-foreground">No active restaurant.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Price Trend"
        description="Track an ingredient's unit cost across price update batches."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 h-9">
              <Switch id="include-baseline" checked={includeBaseline} onCheckedChange={setIncludeBaseline} />
              <Label htmlFor="include-baseline" className="text-xs cursor-pointer">Include baseline</Label>
            </div>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Select ingredient…" /></SelectTrigger>
              <SelectContent>
                {tracked.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tracked.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No primary or fixed ingredients available. Add ingredients first.
          </p>
        ) : (
          <>
            {loadingTrend ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading trend…
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No price log entries for this ingredient yet. Initialize baseline from the Price Log page.
              </p>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <KpiCard label="First recorded" value={<UnitCostCell value={stats.first_recorded} decimals={6} />} />
                  <KpiCard label="Current" value={<UnitCostCell value={stats.current} decimals={6} />} />
                  <KpiCard
                    label="Absolute change"
                    value={<UnitCostCell value={stats.absolute_change} decimals={6} />}
                    tone={stats.absolute_change != null && stats.absolute_change > 0 ? "negative" : "positive"}
                  />
                  <KpiCard
                    label="Percent change"
                    value={<PercentCell value={stats.percent_change} signed decimals={2} />}
                    tone={stats.percent_change != null && stats.percent_change > 0 ? "negative" : "positive"}
                  />
                  <KpiCard label="Number of changes" value={stats.number_of_changes} />
                  <KpiCard
                    label="Largest increase"
                    value={<PercentCell value={stats.largest_increase_pct} signed decimals={2} />}
                    tone={stats.largest_increase_pct != null && stats.largest_increase_pct > 0 ? "negative" : "positive"}
                  />
                </div>

                {/* Chart */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Recipe unit cost over time</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      {chartData.length < 2 ? (
                        <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          {stats.number_of_changes === 0
                            ? "Only baseline data exists. Run a Price Update Batch to create trend changes."
                            : "Not enough data points for a chart."}
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatUnitCost(v as number, 4)} width={90} />
                            <RTooltip
                              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
                              formatter={(v) => formatUnitCost(v as number, 6)}
                            />
                            <Line type="monotone" dataKey="cost" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-1)" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* History table */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Price history</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Old RUC</TableHead>
                          <TableHead className="text-right">New RUC</TableHead>
                          <TableHead className="text-right">Δ RUC %</TableHead>
                          <TableHead>v</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                              No entries for this filter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredEntries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] capitalize ${e.event_type === "baseline" ? "text-muted-foreground" : ""}`}>{e.event_type}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {e.old_recipe_unit_cost != null ? formatUnitCost(Number(e.old_recipe_unit_cost), 6) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {e.new_recipe_unit_cost != null ? formatUnitCost(Number(e.new_recipe_unit_cost), 6) : "—"}
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
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Data from append-only Price Log. Records cannot be edited or deleted.
        </p>
      </div>
    </AppShell>
  );
}
