import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Microscope, Check, Pencil, Clock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  MoneyCell,
  OnTargetBadge,
  PercentCell,
  PpDeltaCell,
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
import {
  computeRecipeMetrics,
  getIngredientById,
  getIngredientCostState,
  recipes,
  TARGET_GPM,
} from "@/data/mock";
import { getMenuAnalyticsRows } from "@/data/selectors";
import { suggestedMenuPrice, computeGPM } from "@/lib/margin";
import { convertQuantity } from "@/lib/units";
import { formatPercent } from "@/lib/format";

export function DishAnalysisView({ initialDishId }: { initialDishId?: string }) {
  const dishes = recipes.filter((r) => r.type === "Dish");
  const initial =
    initialDishId && dishes.some((d) => d.id === initialDishId)
      ? initialDishId
      : (dishes[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(initial);
  const [scenarioCostPct, setScenarioCostPct] = useState([0]);
  const [scenarioPricePct, setScenarioPricePct] = useState([0]);

  const recipe = useMemo(() => dishes.find((d) => d.id === selectedId), [dishes, selectedId]);
  const metrics = useMemo(() => (recipe ? computeRecipeMetrics(recipe) : null), [recipe]);
  const derivedDeltaGpm = useMemo(() => {
    if (!recipe) return null;
    const row = getMenuAnalyticsRows().find((r) => r.recipe.id === recipe.id);
    return row?.delta_gpm_vs_snapshot ?? null;
  }, [recipe]);

  if (!recipe || !metrics) {
    return (
      <AppShell>
        <PageHeader title="Dish Analysis" />
        <div className="p-6">
          <EmptyState
            icon={<Microscope className="h-6 w-6" />}
            title="No dishes available"
            description="Add a dish recipe to begin analysis."
          />
        </div>
      </AppShell>
    );
  }

  const lineRows = recipe.lines.map((l) => {
    const ing = getIngredientById(l.ingredient_id);
    const cs = getIngredientCostState(l.ingredient_id);
    let qtyInRecipeUom = l.qty;
    let unitCost = 0;
    if (ing && cs && cs.ok) {
      unitCost = cs.recipe_unit_cost;
      if (l.uom !== cs.recipe_uom) {
        const c = convertQuantity(l.qty, l.uom, cs.recipe_uom, ing.density_g_per_ml);
        qtyInRecipeUom = c.ok ? c.value : 0;
      }
    }
    const lineCost = qtyInRecipeUom * unitCost;
    return { line: l, ingredient: ing, lineCost, unitCost, qtyInRecipeUom };
  });
  const totalCogs = lineRows.reduce((s, r) => s + r.lineCost, 0);

  const costMul = 1 + scenarioCostPct[0] / 100;
  const scenarioCogsTotal = lineRows.reduce(
    (s, r) => s + r.qtyInRecipeUom * r.unitCost * costMul,
    0,
  );
  const scenarioCogsPerServing = scenarioCogsTotal / Math.max(recipe.serving_qty, 1);
  const scenarioPrice = (recipe.menu_price ?? 0) * (1 + scenarioPricePct[0] / 100);
  const scenarioGpm = computeGPM(scenarioPrice || null, scenarioCogsPerServing);
  const scenarioGp = scenarioPrice > 0 ? scenarioPrice - scenarioCogsPerServing : null;
  const deltaGpm =
    scenarioGpm !== null && metrics.gpm !== null ? scenarioGpm - metrics.gpm : null;

  const targets = [TARGET_GPM, 0.75, 0.8, 0.82];

  return (
    <AppShell>
      <PageHeader
        title="Dish Analysis"
        description="Deep dive into a single dish's margin and what changed."
        actions={
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-9 w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dishes.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current GPM vs target {(TARGET_GPM * 100).toFixed(0)}%
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tabular-nums">
                    {formatPercent(metrics.gpm)}
                  </span>
                  <OnTargetBadge onTarget={metrics.on_target} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  GP <MoneyCell value={metrics.gp} /> per serving • COGS{" "}
                  <MoneyCell value={metrics.cost_per_serving} /> • Menu price{" "}
                  <MoneyCell value={recipe.menu_price} />
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Δ vs last snapshot
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  <PpDeltaCell value={derivedDeltaGpm} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">COGS breakdown</CardTitle>
            </CardHeader>
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
                  {lineRows
                    .sort((a, b) => b.lineCost - a.lineCost)
                    .map(({ line, ingredient, lineCost }) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {ingredient?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyCell value={lineCost} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PercentCell
                            value={totalCogs > 0 ? lineCost / totalCogs : null}
                            decimals={1}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> What changed since last snapshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Margin shifted{" "}
                <span className="font-semibold">
                  <PpDeltaCell value={derivedDeltaGpm} />
                </span>{" "}
                since the last confirmed snapshot.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {lineRows
                  .filter((r) => r.ingredient?.spike)
                  .map((r) => (
                    <li
                      key={r.line.id}
                      className="flex items-center justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
                    >
                      <span className="font-medium">{r.ingredient?.name}</span>
                      <span className="text-destructive">
                        <PercentCell value={r.ingredient?.last_change_pct} signed />
                      </span>
                    </li>
                  ))}
                {lineRows.filter((r) => r.ingredient?.spike).length === 0 && (
                  <li className="text-muted-foreground">
                    No ingredient spikes affecting this dish.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenario analysis (mock)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Adjust ingredient cost: {scenarioCostPct[0] > 0 ? "+" : ""}
                  {scenarioCostPct[0]}%
                </Label>
                <Slider
                  value={scenarioCostPct}
                  onValueChange={setScenarioCostPct}
                  min={-30}
                  max={50}
                  step={1}
                  className="mt-3"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Adjust menu price: {scenarioPricePct[0] > 0 ? "+" : ""}
                  {scenarioPricePct[0]}%
                </Label>
                <Slider
                  value={scenarioPricePct}
                  onValueChange={setScenarioPricePct}
                  min={-20}
                  max={50}
                  step={1}
                  className="mt-3"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field
                label="Scenario COGS / serving"
                value={<UnitCostCell value={scenarioCogsPerServing} />}
              />
              <Field label="Scenario GP" value={<MoneyCell value={scenarioGp} />} />
              <Field
                label="Scenario menu price"
                value={<MoneyCell value={scenarioPrice || null} />}
              />
              <Field label="Scenario GPM" value={<PercentCell value={scenarioGpm} />} />
              <Field label="Δ vs current GPM" value={<PpDeltaCell value={deltaGpm} />} />
            </div>
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setScenarioCostPct([0]);
                  setScenarioPricePct([0]);
                }}
              >
                Reset scenario
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Margin Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suggested menu price = COGS / (1 − target GPM). Choose a target to compare options.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {targets.map((t) => {
                const sp = suggestedMenuPrice(metrics.cost_per_serving, t);
                const isPrimary = Math.abs(t - TARGET_GPM) < 1e-6;
                return (
                  <div
                    key={t}
                    className={
                      isPrimary
                        ? "rounded-md border border-primary/40 bg-primary/5 p-3"
                        : "rounded-md border bg-muted/30 p-3"
                    }
                  >
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Target {(t * 100).toFixed(0)}%
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      <MoneyCell value={sp} />
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => toast.success("Mock UI — apply not persisted.")}>
                <Check className="mr-1.5 h-4 w-4" /> Apply suggested price
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("Mock UI — override flow not persisted.")}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Override
              </Button>
              <Button
                variant="ghost"
                onClick={() => toast.info("Mock UI — deferred (no persistence).")}
              >
                Defer
              </Button>
              <Button variant="link" asChild className="ml-auto">
                <Link to="/recipes/$id" params={{ id: recipe.id }}>
                  Open recipe editor →
                </Link>
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
