import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { UomBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { getIngredients } from "@/data/api/ingredientsApi";
import {
  calculateRecipeMetrics,
  detectCycle,
  getRecipeById,
  getRecipes,
  replaceRecipeLines,
  updateLinkedIntermediateIngredientCostState,
} from "@/data/api/recipesApi";
import type {
  IngredientWithCostState,
  RecipeLineInput,
  RecipeMetrics,
  RecipeWithLines,
} from "@/data/api/types";
import { formatMoney, formatUnitCost } from "@/lib/format";

export const Route = createFileRoute("/recipes/$id")({
  head: () => ({
    meta: [
      { title: "Recipe — Margin IQ" },
      { name: "description", content: "Recipe detail, ingredient lines, and cost breakdown." },
    ],
  }),
  component: RecipeDetailPage,
});

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return e instanceof Error ? e.message : "Something went wrong.";
}

const UOM_CODES = ["Ct", "Gr", "Kg", "Lb", "Oz", "Gl", "Lt", "Ml"] as const;

interface DraftLine {
  key: string;
  ingredient_id: string;
  quantity: string;
  uom_code: string;
}

function RecipeDetailPage() {
  const { id } = Route.useParams();
  const { activeRestaurantId, activeMembership, activeRestaurantSettings } = useAuth();
  const [recipe, setRecipe] = useState<RecipeWithLines | null>(null);
  const [allRecipes, setAllRecipes] = useState<RecipeWithLines[]>([]);
  const [ingredients, setIngredients] = useState<IngredientWithCostState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canManage = activeMembership?.role === "owner" || activeMembership?.role === "manager";
  const targetGpm = activeRestaurantSettings?.target_gpm ?? 0.78;

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const [rec, ings, recs] = await Promise.all([
        getRecipeById(activeRestaurantId, id),
        getIngredients(activeRestaurantId),
        getRecipes(activeRestaurantId),
      ]);
      if (!rec) { setError("Recipe not found."); return; }
      setRecipe(rec);
      setIngredients(ings);
      setAllRecipes(recs);
      setDraftLines(rec.lines.map((l) => ({
        key: l.id,
        ingredient_id: l.ingredient_id,
        quantity: String(Number(l.quantity)),
        uom_code: l.uom_code,
      })));
      setDirty(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId, id]);

  useEffect(() => { void load(); }, [load]);

  const virtualLines = useMemo(() => draftLines.map((d, idx) => ({
    id: d.key,
    restaurant_id: activeRestaurantId ?? "",
    recipe_id: id,
    ingredient_id: d.ingredient_id,
    quantity: Number(d.quantity) || 0,
    uom_code: d.uom_code,
    sort_order: idx * 10,
    notes: null,
    created_at: "",
    updated_at: "",
  })), [draftLines, activeRestaurantId, id]);

  const metrics: RecipeMetrics | null = useMemo(() => {
    if (!recipe) return null;
    return calculateRecipeMetrics(recipe, virtualLines, ingredients, targetGpm);
  }, [recipe, virtualLines, ingredients, targetGpm]);

  const addLine = () => {
    setDraftLines((prev) => [...prev, { key: crypto.randomUUID(), ingredient_id: "", quantity: "1", uom_code: "Gr" }]);
    setDirty(true);
  };

  const removeLine = (key: string) => {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
    setDirty(true);
  };

  const updateLine = (key: string, field: keyof DraftLine, value: string) => {
    setDraftLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
    setDirty(true);
  };

  const onSave = async () => {
    if (!activeRestaurantId || !recipe) return;

    if (recipe.kind === "intermediate") {
      const lineIngIds = draftLines.filter((l) => l.ingredient_id).map((l) => l.ingredient_id);
      const cycleErr = detectCycle(recipe.id, lineIngIds, allRecipes, ingredients);
      if (cycleErr) { toast.error(cycleErr); return; }
    }

    setSaving(true);
    try {
      const lines: RecipeLineInput[] = draftLines
        .filter((d) => d.ingredient_id && Number(d.quantity) > 0)
        .map((d, idx) => ({ ingredient_id: d.ingredient_id, quantity: Number(d.quantity), uom_code: d.uom_code, sort_order: idx * 10 }));

      await replaceRecipeLines(activeRestaurantId, recipe.id, lines);

      if (recipe.kind === "intermediate" && recipe.linked_intermediate_ingredient_id && metrics) {
        await updateLinkedIntermediateIngredientCostState(activeRestaurantId, recipe, metrics);
      }

      toast.success("Recipe lines saved.");
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading recipe…
        </div>
      </AppShell>
    );
  }

  if (error || !recipe) {
    return (
      <AppShell>
        <div className="p-6">
          <EmptyState title="Recipe not found" description={error ?? "Invalid link."} action={<Button asChild variant="outline" size="sm"><Link to="/recipes">Back</Link></Button>} />
        </div>
      </AppShell>
    );
  }

  const isDish = recipe.kind === "dish";

  return (
    <AppShell>
      <PageHeader
        title={recipe.name}
        description={`${recipe.category_name ?? "No category"} · ${Number(recipe.serving_quantity)} ${recipe.serving_uom_code}/serving`}
        actions={
          <div className="flex gap-2">
            {canManage && dirty && (
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-1.5 h-4 w-4" />Save lines</>}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/recipes"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDish ? "default" : "outline"}>{isDish ? "Dish" : "Intermediate"}</Badge>
          {!recipe.is_active && <Badge variant="outline">Inactive</Badge>}
          {isDish && recipe.menu_price != null && <Badge variant="outline">Menu: {formatMoney(Number(recipe.menu_price))}</Badge>}
          {!isDish && recipe.linked_intermediate_ingredient_id && <Badge variant="outline">Linked ingredient</Badge>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Ingredient lines</CardTitle>
              {canManage && <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-4 w-4" /> Add line</Button>}
            </CardHeader>
            <CardContent className="p-0">
              {draftLines.length === 0 ? (
                <div className="p-6"><EmptyState title="No ingredient lines" description="Add ingredients to calculate COGS." /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Ingredient</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-24">UoM</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="text-right">Line cost</TableHead>
                      {canManage && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftLines.map((d) => {
                      const lc = metrics?.line_costs.find((lc) => lc.line_id === d.key);
                      return (
                        <TableRow key={d.key}>
                          <TableCell>
                            {canManage ? (
                              <Select value={d.ingredient_id || "none"} onValueChange={(v) => updateLine(d.key, "ingredient_id", v === "none" ? "" : v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Select ingredient…</SelectItem>
                                  {ingredients.filter((i) => i.is_active).map((i) => (
                                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.type})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm">{lc?.ingredient_name ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <Input type="number" min={0.001} step="any" className="h-8 w-20 text-xs" value={d.quantity} onChange={(e) => updateLine(d.key, "quantity", e.target.value)} />
                            ) : (
                              <span className="text-sm tabular-nums">{d.quantity}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <Select value={d.uom_code} onValueChange={(v) => updateLine(d.key, "uom_code", v)}>
                                <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{UOM_CODES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <UomBadge uom={d.uom_code as "Gr"} />
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {lc && !lc.error ? formatUnitCost(lc.unit_cost) : <span className="text-destructive text-xs">{lc?.error ?? "—"}</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {lc && !lc.error ? formatMoney(lc.line_cost) : "—"}
                          </TableCell>
                          {canManage && (
                            <TableCell><Button size="sm" variant="ghost" onClick={() => removeLine(d.key)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Live totals</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <TotalRow label="COGS" value={metrics ? formatMoney(metrics.cogs) : "—"} />
              <TotalRow label="Cost/serving" value={metrics ? formatUnitCost(metrics.cost_per_serving, 4) : "—"} />
              {isDish && (
                <>
                  <Separator />
                  <TotalRow label="Menu price" value={recipe.menu_price != null ? formatMoney(Number(recipe.menu_price)) : "—"} />
                  <TotalRow label="GP" value={metrics?.gp != null ? formatMoney(metrics.gp) : "—"} />
                  <TotalRow label="GPM" value={metrics?.gpm != null ? `${(metrics.gpm * 100).toFixed(1)}%` : "—"} />
                  <TotalRow label="On target" value={metrics?.on_target != null ? (metrics.on_target ? "Yes" : "No") : "—"} />
                  {metrics?.suggested_menu_price != null && <TotalRow label="Suggested price" value={formatMoney(metrics.suggested_menu_price)} highlight />}
                </>
              )}
              {!isDish && recipe.linked_intermediate_ingredient_id && (
                <>
                  <Separator />
                  <TotalRow label="Resulting unit cost" value={metrics ? formatUnitCost(metrics.cost_per_serving, 6) : "—"} />
                  <p className="text-[11px] text-muted-foreground">Saving updates the linked Intermediate ingredient's cost state.</p>
                </>
              )}
              {metrics && metrics.errors.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive">Errors:</p>
                    {metrics.errors.map((err, i) => <p key={i} className="text-[11px] text-destructive">{err}</p>)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {recipe.notes && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{recipe.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function TotalRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
