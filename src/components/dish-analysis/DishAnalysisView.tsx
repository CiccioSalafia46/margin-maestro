import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Microscope, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  UnitCostCell,
} from "@/components/common/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/auth/AuthProvider";
import { getIngredients } from "@/data/api/ingredientsApi";
import { getRecipes, calculateRecipeMetrics } from "@/data/api/recipesApi";
import type {
  IngredientWithCostState,
  RecipeMetrics,
  RecipeWithLines,
} from "@/data/api/types";
import { suggestedMenuPrice, computeGPM } from "@/lib/margin";
import { convertQuantity } from "@/lib/units";
import { formatPercent, formatUnitCost } from "@/lib/format";
import type { UoM } from "@/lib/types";

export function DishAnalysisView({ initialDishId }: { initialDishId?: string }) {
  const { activeRestaurantId, activeMembership, activeRestaurantSettings } = useAuth();
  const [dishes, setDishes] = useState<RecipeWithLines[]>([]);
  const [ingredients, setIngredients] = useState<IngredientWithCostState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialDishId ?? "");
  const [scenarioCostPct, setScenarioCostPct] = useState([0]);
  const [scenarioPricePct, setScenarioPricePct] = useState([0]);

  const targetGpm = activeRestaurantSettings?.target_gpm ?? 0.78;
  const canManagePrice = activeMembership?.role === "owner" || activeMembership?.role === "manager";

  const onApplyPrice = async (newPrice: number) => {
    if (!activeRestaurantId || !recipe) return;
    if (!window.confirm(`Apply menu price $${newPrice.toFixed(2)} to ${recipe.name}? This updates Margin Maestro only, not POS.`)) return;
    try {
      const { applyDishMenuPrice } = await import("@/data/api/applyPriceApi");
      await applyDishMenuPrice(activeRestaurantId, recipe.id, newPrice);
      toast.success(`Menu price updated to $${newPrice.toFixed(2)}.`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to apply price.";
      toast.error(msg);
    }
  };

  const load = useCallback(async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      const [recs, ings] = await Promise.all([
        getRecipes(activeRestaurantId),
        getIngredients(activeRestaurantId),
      ]);
      const activeDishes = recs.filter((r) => r.kind === "dish" && r.is_active);
      setDishes(activeDishes);
      setIngredients(ings);
      if (!selectedId && activeDishes.length > 0) {
        setSelectedId(activeDishes[0].id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeRestaurantId]);

  useEffect(() => { void load(); }, [load]);

  const recipe = useMemo(() => dishes.find((d) => d.id === selectedId), [dishes, selectedId]);
  const metrics: RecipeMetrics | null = useMemo(
    () => recipe ? calculateRecipeMetrics(recipe, recipe.lines, ingredients, targetGpm) : null,
    [recipe, ingredients, targetGpm],
  );

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Dish Analysis" />
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!recipe || !metrics) {
    return (
      <AppShell>
        <PageHeader title="Dish Analysis" description="Deep dive into a single dish's margin." actions={
          dishes.length > 0 ? (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Select dish…" /></SelectTrigger>
              <SelectContent>{dishes.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : undefined
        } />
        <div className="p-6">
          <EmptyState icon={<Microscope className="h-6 w-6" />} title="No dishes available" description="Add a dish recipe to begin analysis." />
        </div>
      </AppShell>
    );
  }

  // Line breakdown
  const lineRows = recipe.lines.map((l) => {
    const ing = ingredients.find((i) => i.id === l.ingredient_id);
    const cs = ing?.cost_state;
    let qtyConverted = Number(l.quantity);
    let unitCost = cs?.recipe_unit_cost != null ? Number(cs.recipe_unit_cost) : 0;
    let lineError: string | null = null;

    if (ing && cs?.recipe_unit_cost != null) {
      const lineUom = l.uom_code as UoM;
      const ingUom = (ing.recipe_uom_code ?? l.uom_code) as UoM;
      if (lineUom !== ingUom) {
        const conv = convertQuantity(Number(l.quantity), lineUom, ingUom, ing.density_g_per_ml ?? undefined);
        if (conv.ok) { qtyConverted = conv.value; } else { lineError = conv.error; qtyConverted = 0; }
      }
    } else if (!ing) {
      lineError = "Ingredient not found";
    } else if (!cs || cs.recipe_unit_cost == null) {
      lineError = "No cost state";
    }

    const lineCost = qtyConverted * unitCost;
    return { line: l, ingredient: ing, lineCost, unitCost, qtyConverted, lineError };
  });
  const totalCogs = lineRows.reduce((s, r) => s + r.lineCost, 0);

  // Scenario
  const costMul = 1 + scenarioCostPct[0] / 100;
  const scenarioCogsTotal = lineRows.reduce((s, r) => s + r.qtyConverted * r.unitCost * costMul, 0);
  const scenarioCogsPerServing = scenarioCogsTotal / Math.max(Number(recipe.serving_quantity), 1);
  const menuPrice = recipe.menu_price != null ? Number(recipe.menu_price) : 0;
  const scenarioPrice = menuPrice * (1 + scenarioPricePct[0] / 100);
  const scenarioGpm = computeGPM(scenarioPrice || null, scenarioCogsPerServing);
  const scenarioGp = scenarioPrice > 0 ? scenarioPrice - scenarioCogsPerServing : null;
  const deltaGpm = scenarioGpm !== null && metrics.gpm !== null ? scenarioGpm - metrics.gpm : null;

  // Margin manager targets
  const targets = [targetGpm, 0.75, 0.80, 0.82];

  return (
    <AppShell>
      <PageHeader
        title="Dish Analysis"
        description="Deep dive into a single dish's margin and cost breakdown."
        actions={
          <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setScenarioCostPct([0]); setScenarioPricePct([0]); }}>
            <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
            <SelectContent>{dishes.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <div className="space-y-6 p-6">
        {/* Current GPM card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Current GPM vs target {(targetGpm * 100).toFixed(0)}%</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tabular-nums">{formatPercent(metrics.gpm)}</span>
                  {metrics.on_target != null && <OnTargetBadge onTarget={metrics.on_target} />}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  GP <MoneyCell value={metrics.gp} /> per serving · COGS <MoneyCell value={metrics.cost_per_serving} /> · Menu price <MoneyCell value={menuPrice || null} />
                </p>
              </div>
              {metrics.suggested_menu_price != null && (
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggested price</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums"><MoneyCell value={metrics.suggested_menu_price} /></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* COGS breakdown */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">COGS breakdown</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Line cost</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineRows.sort((a, b) => b.lineCost - a.lineCost).map(({ line, ingredient, lineCost, lineError }) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {ingredient?.name ?? "Unknown"}
                        {lineError && <span className="ml-1 text-[10px] text-destructive">({lineError})</span>}
                      </TableCell>
                      <TableCell className="text-right"><MoneyCell value={lineCost} /></TableCell>
                      <TableCell className="text-right"><PercentCell value={totalCogs > 0 ? lineCost / totalCogs : null} decimals={1} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Scenario */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Scenario analysis (local only)</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Adjust ingredient cost: {scenarioCostPct[0] > 0 ? "+" : ""}{scenarioCostPct[0]}%</Label>
                  <Slider value={scenarioCostPct} onValueChange={setScenarioCostPct} min={-30} max={50} step={1} className="mt-3" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Adjust menu price: {scenarioPricePct[0] > 0 ? "+" : ""}{scenarioPricePct[0]}%</Label>
                  <Slider value={scenarioPricePct} onValueChange={setScenarioPricePct} min={-20} max={50} step={1} className="mt-3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="COGS / serving" value={<UnitCostCell value={scenarioCogsPerServing} />} />
                <Field label="GP" value={<MoneyCell value={scenarioGp} />} />
                <Field label="Menu price" value={<MoneyCell value={scenarioPrice || null} />} />
                <Field label="GPM" value={<PercentCell value={scenarioGpm} />} />
                <Field label="Δ vs current" value={deltaGpm != null ? `${deltaGpm > 0 ? "+" : ""}${(deltaGpm * 100).toFixed(1)} pp` : "—"} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setScenarioCostPct([0]); setScenarioPricePct([0]); }}>Reset scenario</Button>
              <p className="text-[10px] text-muted-foreground">Scenarios are local only — no data is saved.</p>
            </CardContent>
          </Card>
        </div>

        {/* Margin Manager */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Margin Manager</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Suggested menu price = COGS / (1 − target GPM). Apply updates Margin Maestro only, not POS or external menus.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {targets.map((t) => {
                const sp = suggestedMenuPrice(metrics.cost_per_serving, t);
                const isPrimary = Math.abs(t - targetGpm) < 1e-6;
                return (
                  <div key={t} className={isPrimary ? "rounded-md border border-primary/40 bg-primary/5 p-3" : "rounded-md border bg-muted/30 p-3"}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target {(t * 100).toFixed(0)}%</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums"><MoneyCell value={sp} /></p>
                    {isPrimary && sp != null && canManagePrice && (
                      <button className="mt-1 text-[10px] text-primary hover:underline" onClick={() => onApplyPrice(sp)}>Apply this price</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="link" asChild className="px-0">
                <Link to="/recipes/$id" params={{ id: recipe.id }}>Open recipe editor →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
