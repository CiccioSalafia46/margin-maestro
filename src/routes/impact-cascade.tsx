import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { EmptyState } from "@/components/common/EmptyState";
import { MoneyCell, PercentCell } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import { getImpactCascadeRuns, getImpactCascadeItems, generateImpactCascadeForBatch } from "@/data/api/impactCascadeApi";
import { getPriceUpdateBatches } from "@/data/api/priceLogApi";
import type { ImpactCascadeItemRow, ImpactCascadeRunRow, PriceUpdateBatchRow } from "@/data/api/types";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/impact-cascade")({
  head: () => ({
    meta: [{ title: "Impact Cascade — Margin IQ" }, { name: "description", content: "Dish-level margin impact from supplier price changes." }],
  }),
  component: ImpactCascadePage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function ImpactCascadePage() {
  const { activeRestaurantId, activeMembership, userId } = useAuth();
  const [runs, setRuns] = useState<ImpactCascadeRunRow[]>([]);
  const [batches, setBatches] = useState<PriceUpdateBatchRow[]>([]);
  const [latestItems, setLatestItems] = useState<ImpactCascadeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [r, b] = await Promise.all([
        getImpactCascadeRuns(activeRestaurantId),
        getPriceUpdateBatches(activeRestaurantId),
      ]);
      setRuns(r);
      setBatches(b.filter((b) => b.status === "applied" && b.source === "manual"));
      if (r.length > 0) {
        const items = await getImpactCascadeItems(activeRestaurantId, r[0].id);
        setLatestItems(items);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const onGenerate = async (batchId: string) => {
    if (!activeRestaurantId || !userId) return;
    setGenerating(batchId);
    try {
      const result = await generateImpactCascadeForBatch(activeRestaurantId, batchId, userId);
      toast.success(`Impact cascade generated — ${result.item_count} dish(es) affected.`);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGenerating(null);
    }
  };

  const latestRun = runs[0] ?? null;

  if (!activeRestaurantId || !activeMembership) {
    return <AppShell><PageHeader title="Impact Cascade" /><div className="p-6 text-sm text-muted-foreground">No active restaurant.</div></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Impact Cascade" description="Dish-level margin impact from supplier price changes. Per-serving metrics." />
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            {/* Latest run summary */}
            {latestRun ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <KpiCard label="Changed ingredients" value={latestRun.changed_ingredients_count} />
                  <KpiCard label="Affected dishes" value={latestRun.affected_dish_count} />
                  <KpiCard label="Newly below target" value={latestRun.newly_below_target_count} tone={latestRun.newly_below_target_count > 0 ? "negative" : "positive"} />
                  <KpiCard label="Total COGS Δ / serving" value={latestRun.total_cogs_delta_per_serving != null ? <MoneyCell value={latestRun.total_cogs_delta_per_serving} /> : "—"} />
                  <KpiCard label="Total GP Δ / serving" value={latestRun.total_margin_delta_per_serving != null ? <MoneyCell value={latestRun.total_margin_delta_per_serving} /> : "—"} />
                </div>

                {/* Items table */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Affected dishes (latest run)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <ImpactItemsTable items={latestItems} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <EmptyState icon={<Zap className="h-6 w-6" />} title="No impact cascades yet" description="Run a Price Update Batch first, then generate impact cascade." />
            )}

            {/* Batch history */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Price update batches</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Cascade</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No manual price update batches yet.</TableCell></TableRow>
                    ) : (
                      batches.map((b) => {
                        const run = runs.find((r) => r.batch_id === b.id);
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(b.applied_at ?? b.created_at)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{b.source}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.note ?? "—"}</TableCell>
                            <TableCell>
                              {run ? <Badge className="bg-success text-success-foreground text-[10px]">Generated</Badge> : <Badge variant="outline" className="text-[10px]">Not generated</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              {run ? (
                                <Button size="sm" variant="outline" asChild><Link to="/impact-cascade/$batchId" params={{ batchId: b.id }}>Open</Link></Button>
                              ) : canManage ? (
                                <Button size="sm" onClick={() => onGenerate(b.id)} disabled={generating === b.id}>
                                  {generating === b.id ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Generating…</> : "Generate"}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Read-only</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">Per-serving impact. Alerts arrive in Build 1.8.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ImpactItemsTable({ items }: { items: ImpactCascadeItemRow[] }) {
  if (items.length === 0) return <div className="p-6"><EmptyState title="No dishes affected" description="This batch did not impact any active dish recipes." /></div>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dish</TableHead>
          <TableHead>Affected ingredients</TableHead>
          <TableHead className="text-right">Old COGS/srv</TableHead>
          <TableHead className="text-right">New COGS/srv</TableHead>
          <TableHead className="text-right">Δ COGS</TableHead>
          <TableHead className="text-right">Old GPM</TableHead>
          <TableHead className="text-right">New GPM</TableHead>
          <TableHead className="text-right">Δ GPM</TableHead>
          <TableHead>Target</TableHead>
          <TableHead className="text-right">Suggested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="font-medium">{i.dish_name_at_time}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{i.affected_ingredient_names?.join(", ") ?? "—"}</TableCell>
            <TableCell className="text-right text-xs tabular-nums"><MoneyCell value={i.old_cogs_per_serving} /></TableCell>
            <TableCell className="text-right text-xs tabular-nums"><MoneyCell value={i.new_cogs_per_serving} /></TableCell>
            <TableCell className="text-right text-xs tabular-nums">
              {i.cogs_delta_per_serving != null ? <span className={Number(i.cogs_delta_per_serving) > 0 ? "text-destructive" : "text-success"}>{Number(i.cogs_delta_per_serving) > 0 ? "+" : ""}<MoneyCell value={i.cogs_delta_per_serving} /></span> : "—"}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums">{i.old_gpm != null ? <PercentCell value={i.old_gpm} decimals={1} /> : "—"}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">{i.new_gpm != null ? <PercentCell value={i.new_gpm} decimals={1} /> : "—"}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">
              {i.gpm_delta != null ? <span className={Number(i.gpm_delta) < 0 ? "text-destructive" : "text-success"}>{(Number(i.gpm_delta) * 100).toFixed(1)} pp</span> : "—"}
            </TableCell>
            <TableCell>
              {i.newly_below_target ? <Badge className="bg-destructive text-destructive-foreground text-[10px]">Below</Badge> : i.is_on_target === true ? <Badge className="bg-success text-success-foreground text-[10px]">On</Badge> : i.is_on_target === false ? <Badge variant="outline" className="text-[10px]">Below</Badge> : "—"}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums"><MoneyCell value={i.suggested_menu_price} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
