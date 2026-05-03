import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Loader2, Database as DbIcon, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import { getIngredients } from "@/data/api/ingredientsApi";
import {
  applyPriceUpdateBatch,
  getPriceLogEntries,
  getSnapshotStatus,
  initializeBaseline,
  previewPriceChanges,
} from "@/data/api/priceLogApi";
import type {
  IngredientPriceLogRow,
  IngredientWithCostState,
  PriceChangeInput,
  PriceChangePreview,
  SnapshotStatus,
} from "@/data/api/types";
import { formatDateTime, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/price-log")({
  head: () => ({
    meta: [
      { title: "Price Log — Margin IQ" },
      { name: "description", content: "Append-only ingredient price history and price update batches." },
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
  const [ingredients, setIngredients] = useState<IngredientWithCostState[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [eventFilter, setEventFilter] = useState("all");
  const [ingredientFilter, setIngredientFilter] = useState("all");
  const [batchOpen, setBatchOpen] = useState(false);

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [log, status, ings] = await Promise.all([
        getPriceLogEntries(activeRestaurantId),
        getSnapshotStatus(activeRestaurantId),
        getIngredients(activeRestaurantId),
      ]);
      setEntries(log);
      setSnapStatus(status);
      setIngredients(ings);
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
        actions={
          <div className="flex gap-2">
            {canManage && snapStatus?.initialized && (
              <Button size="sm" onClick={() => setBatchOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Run Price Update
              </Button>
            )}
            <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Read-only</Badge>
          </div>
        }
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

      {canManage && (
        <PriceUpdateBatchDrawer
          open={batchOpen}
          onOpenChange={setBatchOpen}
          restaurantId={activeRestaurantId}
          userId={userId ?? ""}
          ingredients={ingredients}
          onApplied={load}
        />
      )}
    </AppShell>
  );
}

function SF({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div>;
}

// ── Price Update Batch Drawer ────────────────────────────────────────

interface DraftChange {
  ingredient_id: string;
  selected: boolean;
  new_total_cost: string;
  new_original_quantity: string;
}

function PriceUpdateBatchDrawer({
  open, onOpenChange, restaurantId, userId, ingredients, onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  userId: string;
  ingredients: IngredientWithCostState[];
  onApplied: () => Promise<void>;
}) {
  const primaryIngredients = ingredients.filter((i) => i.is_active && i.type === "primary");
  const fixedIngredients = ingredients.filter((i) => i.is_active && i.type === "fixed");
  const updatable = [...primaryIngredients, ...fixedIngredients];

  const [drafts, setDrafts] = useState<DraftChange[]>([]);
  const [previews, setPreviews] = useState<PriceChangePreview[]>([]);
  const [note, setNote] = useState("");
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState<"select" | "preview">("select");

  useEffect(() => {
    if (open) {
      setDrafts(updatable.map((i) => ({
        ingredient_id: i.id,
        selected: false,
        new_total_cost: i.total_cost != null ? String(Number(i.total_cost)) : "",
        new_original_quantity: i.original_quantity != null ? String(Number(i.original_quantity)) : "",
      })));
      setPreviews([]);
      setNote("");
      setStep("select");
    }
  }, [open]);

  const updateDraft = (id: string, field: keyof DraftChange, value: string | boolean) => {
    setDrafts((prev) => prev.map((d) => d.ingredient_id === id ? { ...d, [field]: value } : d));
  };

  const selectedDrafts = drafts.filter((d) => d.selected);

  const onPreview = () => {
    const changes: PriceChangeInput[] = selectedDrafts.map((d) => {
      const ing = ingredients.find((i) => i.id === d.ingredient_id)!;
      return {
        ingredient_id: d.ingredient_id,
        new_total_cost: ing.type === "primary" ? (Number(d.new_total_cost) || null) : null,
        new_original_quantity: ing.type === "primary" ? (Number(d.new_original_quantity) || null) : null,
        new_original_uom_code: null,
        new_recipe_uom_code: null,
        new_adjustment: Number(ing.adjustment),
        new_density_g_per_ml: ing.density_g_per_ml,
        new_manual_recipe_unit_cost: ing.type === "fixed" ? (Number(d.new_total_cost) || null) : null,
      };
    });
    const pvs = previewPriceChanges(changes, ingredients);
    setPreviews(pvs);
    setStep("preview");
  };

  const onApply = async () => {
    setApplying(true);
    try {
      const changes: PriceChangeInput[] = selectedDrafts.map((d) => {
        const ing = ingredients.find((i) => i.id === d.ingredient_id)!;
        return {
          ingredient_id: d.ingredient_id,
          new_total_cost: ing.type === "primary" ? (Number(d.new_total_cost) || null) : null,
          new_original_quantity: ing.type === "primary" ? (Number(d.new_original_quantity) || null) : null,
          new_original_uom_code: null,
          new_recipe_uom_code: null,
          new_adjustment: Number(ing.adjustment),
          new_density_g_per_ml: ing.density_g_per_ml,
          new_manual_recipe_unit_cost: ing.type === "fixed" ? (Number(d.new_total_cost) || null) : null,
        };
      });
      const result = await applyPriceUpdateBatch(restaurantId, userId, changes, note || undefined);
      toast.success(`Price update applied — ${result.applied_count} ingredient(s) updated.`);
      onOpenChange(false);
      await onApplied();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Run Price Update Batch</SheetTitle>
          <SheetDescription>
            {step === "select"
              ? "Select ingredients and enter new supplier prices. Intermediate costs are updated through recipes."
              : "Review changes before applying. This will write append-only price log entries."}
          </SheetDescription>
        </SheetHeader>

        {step === "select" && (
          <div className="space-y-4 py-4">
            {updatable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No primary or fixed ingredients available for price update.</p>
            ) : (
              <div className="space-y-2">
                {drafts.map((d) => {
                  const ing = ingredients.find((i) => i.id === d.ingredient_id);
                  if (!ing) return null;
                  return (
                    <Card key={d.ingredient_id} className={d.selected ? "border-primary/50" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={d.selected}
                            onCheckedChange={(v) => updateDraft(d.ingredient_id, "selected", !!v)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{ing.name}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{ing.type}</Badge>
                              {ing.supplier_name && <span className="text-xs text-muted-foreground">{ing.supplier_name}</span>}
                            </div>
                            {d.selected && (
                              <div className="grid grid-cols-2 gap-2">
                                {ing.type === "primary" && (
                                  <>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Total cost</Label>
                                      <Input type="number" min={0} step="any" className="h-8 text-xs" value={d.new_total_cost} onChange={(e) => updateDraft(d.ingredient_id, "new_total_cost", e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Quantity</Label>
                                      <Input type="number" min={0.001} step="any" className="h-8 text-xs" value={d.new_original_quantity} onChange={(e) => updateDraft(d.ingredient_id, "new_original_quantity", e.target.value)} />
                                    </div>
                                  </>
                                )}
                                {ing.type === "fixed" && (
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">Manual unit cost</Label>
                                    <Input type="number" min={0} step="any" className="h-8 text-xs" value={d.new_total_cost} onChange={(e) => updateDraft(d.ingredient_id, "new_total_cost", e.target.value)} />
                                  </div>
                                )}
                                <div className="col-span-2 text-[10px] text-muted-foreground">
                                  Current RUC: {ing.cost_state?.recipe_unit_cost != null ? formatUnitCost(Number(ing.cost_state.recipe_unit_cost), 6) : "—"}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Batch note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., May 2026 supplier price update" />
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={onPreview} disabled={selectedDrafts.length === 0}>
                Preview {selectedDrafts.length} change(s)
              </Button>
            </SheetFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Old RUC</TableHead>
                  <TableHead className="text-right">New RUC</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previews.map((p) => (
                  <TableRow key={p.ingredient_id}>
                    <TableCell className="text-sm font-medium">{p.ingredient_name}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{p.old_recipe_unit_cost != null ? formatUnitCost(p.old_recipe_unit_cost, 6) : "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{p.new_recipe_unit_cost != null ? formatUnitCost(p.new_recipe_unit_cost, 6) : "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {p.delta_percent != null && p.delta_percent !== 0
                        ? <span className={p.delta_percent > 0 ? "text-destructive" : "text-success"}>{(p.delta_percent * 100).toFixed(2)}%</span>
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {p.status === "valid" && <Badge className="bg-success text-success-foreground text-[10px]">Valid</Badge>}
                      {p.status === "unchanged" && <Badge variant="outline" className="text-[10px]">Unchanged</Badge>}
                      {p.status === "error" && <Badge className="bg-destructive text-destructive-foreground text-[10px]">Error</Badge>}
                      {p.error && <p className="text-[10px] text-destructive mt-0.5">{p.error}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              {previews.filter((p) => p.status === "valid").length} valid, {previews.filter((p) => p.status === "unchanged").length} unchanged, {previews.filter((p) => p.status === "error").length} error(s). Only valid changes will be applied.
            </p>
            <SheetFooter>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={onApply} disabled={applying || previews.filter((p) => p.status === "valid").length === 0}>
                {applying ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Applying…</> : `Apply ${previews.filter((p) => p.status === "valid").length} change(s)`}
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
