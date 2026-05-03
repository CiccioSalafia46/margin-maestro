import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { EmptyState } from "@/components/common/EmptyState";
import { MoneyCell, PercentCell } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import { getImpactCascadeForBatch, generateImpactCascadeForBatch } from "@/data/api/impactCascadeApi";
import type { ImpactCascadeItemRow, ImpactCascadeRunRow } from "@/data/api/types";

export const Route = createFileRoute("/impact-cascade/$batchId")({
  head: () => ({ meta: [{ title: "Impact Cascade — Batch Detail" }] }),
  component: ImpactCascadeBatchPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

function ImpactCascadeBatchPage() {
  const { batchId } = Route.useParams();
  const { activeRestaurantId, activeMembership, userId } = useAuth();
  const [run, setRun] = useState<ImpactCascadeRunRow | null>(null);
  const [items, setItems] = useState<ImpactCascadeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const data = await getImpactCascadeForBatch(activeRestaurantId, batchId);
      setRun(data.run);
      setItems(data.items);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId, batchId]);

  useEffect(() => { void load(); }, [load]);

  const onGenerate = async () => {
    if (!activeRestaurantId || !userId) return;
    setGenerating(true);
    try {
      await generateImpactCascadeForBatch(activeRestaurantId, batchId, userId);
      toast.success("Impact cascade generated.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGenerating(false);
    }
  };

  if (!activeRestaurantId || !activeMembership) {
    return <AppShell><PageHeader title="Impact Cascade" /><div className="p-6 text-sm text-muted-foreground">No active restaurant.</div></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Impact Cascade" description={`Batch ${batchId.slice(0, 8)}…`} actions={
        <Button variant="outline" size="sm" asChild><Link to="/impact-cascade"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link></Button>
      } />
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !run ? (
          <div className="space-y-4">
            <EmptyState icon={<Zap className="h-6 w-6" />} title="No impact cascade for this batch" description="Generate the impact cascade to see which dishes were affected." />
            {canManage && (
              <div className="flex justify-center">
                <Button onClick={onGenerate} disabled={generating}>
                  {generating ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Generating…</> : "Generate Impact Cascade"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Changed ingredients" value={run.changed_ingredients_count} />
              <KpiCard label="Affected dishes" value={run.affected_dish_count} />
              <KpiCard label="Newly below target" value={run.newly_below_target_count} tone={run.newly_below_target_count > 0 ? "negative" : "positive"} />
              <KpiCard label="Total COGS Δ / serving" value={run.total_cogs_delta_per_serving != null ? <MoneyCell value={run.total_cogs_delta_per_serving} /> : "—"} />
              <KpiCard label="Total GP Δ / serving" value={run.total_margin_delta_per_serving != null ? <MoneyCell value={run.total_margin_delta_per_serving} /> : "—"} />
            </div>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Affected dishes</CardTitle></CardHeader>
              <CardContent className="p-0">
                {items.length === 0 ? (
                  <div className="p-6"><EmptyState title="No dishes affected" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dish</TableHead>
                        <TableHead>Ingredients</TableHead>
                        <TableHead className="text-right">Δ COGS/srv</TableHead>
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
                          <TableCell className="text-right text-xs tabular-nums">
                            {i.cogs_delta_per_serving != null ? <span className={Number(i.cogs_delta_per_serving) > 0 ? "text-destructive" : "text-success"}>{Number(i.cogs_delta_per_serving) > 0 ? "+" : ""}<MoneyCell value={i.cogs_delta_per_serving} /></span> : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{i.old_gpm != null ? <PercentCell value={i.old_gpm} decimals={1} /> : "—"}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{i.new_gpm != null ? <PercentCell value={i.new_gpm} decimals={1} /> : "—"}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {i.gpm_delta != null ? <span className={Number(i.gpm_delta) < 0 ? "text-destructive" : "text-success"}>{(Number(i.gpm_delta) * 100).toFixed(1)} pp</span> : "—"}
                          </TableCell>
                          <TableCell>
                            {i.newly_below_target ? <Badge className="bg-destructive text-destructive-foreground text-[10px]">Below</Badge> : i.is_on_target ? <Badge className="bg-success text-success-foreground text-[10px]">On</Badge> : <Badge variant="outline" className="text-[10px]">Below</Badge>}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums"><MoneyCell value={i.suggested_menu_price} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <p className="text-[11px] text-muted-foreground">Per-serving impact. Alerts arrive in Build 1.8.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
