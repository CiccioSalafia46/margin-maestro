import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeIngredientCostState,
  computeOriginalUnitCost,
  computeRecipeQuantity,
  computeRecipeUnitCost,
} from "@/lib/ingredientCost";
import { convertQuantity } from "@/lib/units";
import { computeGP, computeGPM, suggestedMenuPrice } from "@/lib/margin";
import { calculationNotes } from "@/lib/calculationNotes";
import {
  getAlerts,
  getDashboardKpis,
  getImpactCascadeHistory,
  getLatestImpactCascade,
  getLatestImpactCascadeSummary,
  getMenuAnalyticsRows,
  getMenuBenchmarks,
  getPriceTrendStats,
} from "@/data/selectors";
import { priceLog, recipes } from "@/data/mock";
import type { Ingredient } from "@/lib/types";

export const Route = createFileRoute("/qa-calculations")({
  head: () => ({
    meta: [
      { title: "Calculation QA — Margin IQ" },
      { name: "description", content: "Pass/fail checks for the calculation engine." },
    ],
  }),
  component: QaPage,
});

interface CheckResult {
  id: string;
  name: string;
  inputs: string;
  expected: string;
  actual: string;
  pass: boolean;
  error?: string;
}

const APPROX = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= tol;

function makeIng(partial: Partial<Ingredient>): Ingredient {
  return {
    id: "test",
    name: "Test",
    type: "Primary",
    supplier: null,
    original_qty: 1,
    original_uom: "Kg",
    total_cost: 1,
    recipe_uom: "Gr",
    adjustment: 0,
    conversion_on: true,
    recipe_unit_cost: 0,
    last_change_pct: null,
    spike: false,
    ...partial,
  };
}

function runChecks(): CheckResult[] {
  const out: CheckResult[] = [];

  // A — Ground Pork conversion
  {
    const ing = makeIng({
      total_cost: 22,
      original_qty: 10,
      original_uom: "Lb",
      recipe_uom: "Gr",
      conversion_on: true,
      adjustment: 0,
    });
    const cs = computeIngredientCostState(ing);
    const expectedQty = 4535.92;
    const expectedRuc = 22 / 4535.92;
    const ok =
      cs.ok &&
      APPROX(cs.recipe_quantity, expectedQty, 0.01) &&
      APPROX(cs.recipe_unit_cost, expectedRuc, 1e-7);
    out.push({
      id: "A",
      name: "Ground Pork conversion (Lb→Gr)",
      inputs: "total=22, qty=10 Lb, recipe=Gr, adj=0",
      expected: `qty≈${expectedQty}, ruc≈${expectedRuc.toFixed(8)}`,
      actual: cs.ok
        ? `qty=${cs.recipe_quantity.toFixed(4)}, ruc=${cs.recipe_unit_cost.toFixed(8)}`
        : `error: ${cs.error}`,
      pass: !!ok,
    });
  }

  // B — Asparagus trim loss
  {
    const ing = makeIng({
      total_cost: 3.97,
      original_qty: 1,
      original_uom: "Lb",
      recipe_uom: "Gr",
      conversion_on: true,
      adjustment: -0.1,
    });
    const cs = computeIngredientCostState(ing);
    const expectedRuc = 3.97 / (453.592 * 0.9);
    const ok = cs.ok && APPROX(cs.recipe_unit_cost, expectedRuc, 1e-6);
    out.push({
      id: "B",
      name: "Asparagus trim loss (-10%)",
      inputs: "total=3.97, qty=1 Lb, recipe=Gr, adj=-0.10",
      expected: `ruc≈${expectedRuc.toFixed(8)}`,
      actual: cs.ok ? `ruc=${cs.recipe_unit_cost.toFixed(8)}` : `error: ${cs.error}`,
      pass: !!ok,
    });
  }

  // C — Ct conversion blocked
  {
    const ing = makeIng({
      original_uom: "Ct",
      recipe_uom: "Gr",
      conversion_on: true,
    });
    const cs = computeIngredientCostState(ing);
    const ok = !cs.ok;
    out.push({
      id: "C",
      name: "Ct → Gr blocked",
      inputs: "original=Ct, recipe=Gr, conversion_on=true",
      expected: "validation error, no recipe_unit_cost",
      actual: cs.ok ? `unexpected ruc=${cs.recipe_unit_cost}` : `error: ${cs.error}`,
      pass: ok,
    });
  }

  // D — Ct → Ct allowed
  {
    const ing = makeIng({
      original_uom: "Ct",
      recipe_uom: "Ct",
      conversion_on: false,
      original_qty: 12,
      total_cost: 24,
    });
    const cs = computeIngredientCostState(ing);
    const ok = cs.ok && APPROX(cs.recipe_quantity, 12) && APPROX(cs.recipe_unit_cost, 2);
    out.push({
      id: "D",
      name: "Ct → Ct allowed",
      inputs: "qty=12 Ct, recipe=Ct, conversion_on=false",
      expected: "qty=12, ruc=2.00",
      actual: cs.ok
        ? `qty=${cs.recipe_quantity}, ruc=${cs.recipe_unit_cost}`
        : `error: ${cs.error}`,
      pass: !!ok,
    });
  }

  // E — Volume → mass without density blocked
  {
    const ing = makeIng({
      total_cost: 36,
      original_qty: 1,
      original_uom: "Gl",
      recipe_uom: "Gr",
      conversion_on: true,
    });
    const cs = computeIngredientCostState(ing);
    const ok = !cs.ok;
    out.push({
      id: "E",
      name: "Volume → mass without density blocked",
      inputs: "qty=1 Gl, recipe=Gr, no density",
      expected: "validation error",
      actual: cs.ok ? `unexpected ruc=${cs.recipe_unit_cost}` : `error: ${cs.error}`,
      pass: ok,
    });
  }

  // F — Volume → mass with density allowed
  {
    const ing = makeIng({
      total_cost: 36,
      original_qty: 1,
      original_uom: "Gl",
      recipe_uom: "Gr",
      conversion_on: true,
      density_g_per_ml: 0.91,
      adjustment: 0,
    });
    const cs = computeIngredientCostState(ing);
    // 1 Gl = 3785.411784 Ml × 0.91 = 3444.7247 Gr; 36 / 3444.7247 ≈ 0.010451
    const expectedRuc = 36 / (3785.411784 * 0.91);
    const ok = cs.ok && APPROX(cs.recipe_unit_cost, expectedRuc, 1e-6);
    out.push({
      id: "F",
      name: "Volume → mass with density (oil 1 Gl)",
      inputs: "qty=1 Gl, recipe=Gr, density=0.91",
      expected: `ruc≈${expectedRuc.toFixed(8)}`,
      actual: cs.ok ? `ruc=${cs.recipe_unit_cost.toFixed(8)}` : `error: ${cs.error}`,
      pass: !!ok,
    });
  }

  // G — adjustment = -1 blocked
  {
    const ing = makeIng({
      total_cost: 10,
      original_qty: 1,
      original_uom: "Kg",
      recipe_uom: "Gr",
      conversion_on: true,
      adjustment: -1,
    });
    const cs = computeIngredientCostState(ing);
    const ok = !cs.ok;
    out.push({
      id: "G",
      name: "adjustment = -1 blocked",
      inputs: "adjustment=-1",
      expected: "validation error",
      actual: cs.ok ? `unexpected ruc=${cs.recipe_unit_cost}` : `error: ${cs.error}`,
      pass: ok,
    });
  }

  // H — Menu price 0 → no NaN
  {
    const gp = computeGP(0, 5);
    const gpm = computeGPM(0, 5);
    const ok = gp === null && gpm === null;
    out.push({
      id: "H",
      name: "menu_price = 0 → GP/GPM blank",
      inputs: "COGS=5, menu_price=0",
      expected: "GP=null, GPM=null",
      actual: `GP=${gp}, GPM=${gpm}`,
      pass: ok,
    });
  }

  // I — Suggested menu price
  {
    const sp = suggestedMenuPrice(8.85, 0.78);
    const expected = 8.85 / 0.22;
    const ok = sp !== null && APPROX(sp, expected, 1e-4);
    out.push({
      id: "I",
      name: "Suggested menu price",
      inputs: "COGS=8.85, target_gpm=0.78",
      expected: `≈${expected.toFixed(5)}`,
      actual: sp === null ? "null" : sp.toFixed(5),
      pass: !!ok,
    });
  }

  // J — Scenario isolation: helpers don't mutate inputs
  {
    const ing = makeIng({
      total_cost: 10,
      original_qty: 1,
      original_uom: "Kg",
      recipe_uom: "Gr",
      conversion_on: true,
      adjustment: 0,
    });
    const before = JSON.stringify(ing);
    const ouc = computeOriginalUnitCost(ing.total_cost, ing.original_qty);
    const rq = computeRecipeQuantity(
      ing.original_qty,
      ing.original_uom,
      ing.recipe_uom,
      ing.conversion_on,
    );
    const ruc =
      rq.ok ? computeRecipeUnitCost(ing.total_cost, rq.value, ing.adjustment) : { ok: false };
    const conv = convertQuantity(1, "Kg", "Gr");
    const after = JSON.stringify(ing);
    const ok = before === after && typeof ouc === "number" && rq.ok && ruc.ok && conv.ok;
    out.push({
      id: "J",
      name: "Helpers are pure (no mutation)",
      inputs: "Run helper chain on a test ingredient",
      expected: "input object unchanged",
      actual: before === after ? "unchanged" : "MUTATED",
      pass: !!ok,
    });
  }

  // K — Impact Cascade direct path
  {
    const cascade = getLatestImpactCascade();
    let pass = false;
    let detail = "no cascade";
    if (cascade) {
      // sundried tomatoes -> bruschetta is direct
      const g = cascade.groups.find((g) => g.ingredient_id === "ing-sundried-tomatoes");
      const d = g?.affected_dishes.find((d) => d.recipe_id === "rec-bruschetta");
      if (d) {
        const path = d.impact_path;
        const tail = path[path.length - 1];
        pass =
          d.pathway === "direct" &&
          path[0]?.kind === "primary" &&
          path[0]?.ingredient_id === "ing-sundried-tomatoes" &&
          tail.kind === "dish" &&
          tail.recipe_id === "rec-bruschetta" &&
          path.length === 2;
        detail = `pathway=${d.pathway}, steps=${path.map((s) => s.kind).join(">")}`;
      } else {
        detail = "bruschetta row missing";
      }
    }
    out.push({
      id: "K",
      name: "Impact Cascade direct path",
      inputs: "Latest cascade — Sundried Tomatoes → Bruschetta",
      expected: "pathway=direct, path=primary>dish, dish tail",
      actual: detail,
      pass,
    });
  }

  // L — Impact Cascade indirect path
  {
    const cascade = getLatestImpactCascade();
    // tomato change in batch-3 should propagate via marinara sauce into dishes
    let pass = false;
    let detail = "no cascade";
    if (cascade) {
      const g = cascade.groups.find((g) => g.ingredient_id === "ing-tomato");
      const d = g?.affected_dishes.find((d) => d.pathway === "indirect");
      if (d) {
        const inter = d.impact_path.find((s) => s.kind === "intermediate");
        const tail = d.impact_path[d.impact_path.length - 1];
        const intermediateAsFinal = recipes
          .filter((r) => r.type === "Intermediate")
          .some((r) => r.id === tail.recipe_id);
        pass =
          d.pathway === "indirect" &&
          !!inter &&
          inter.recipe_id === "rec-marinara-sauce" &&
          tail.kind === "dish" &&
          !intermediateAsFinal &&
          d.impact_path.length === 3;
        detail = `pathway=${d.pathway}, steps=${d.impact_path.map((s) => s.kind).join(">")}`;
      } else {
        detail = "no indirect dish for tomato";
      }
    }
    out.push({
      id: "L",
      name: "Impact Cascade indirect path",
      inputs: "Latest cascade — Tomato → Marinara Sauce → Dish",
      expected: "pathway=indirect, primary>intermediate>dish, no intermediate as final",
      actual: detail,
      pass,
    });
  }

  // M — Off-menu dishes excluded from benchmarks
  {
    const rows = getMenuAnalyticsRows();
    const bench = getMenuBenchmarks();
    const onMenu = rows.filter((r) => r.recipe.on_menu);
    const validGpms = onMenu.map((r) => r.gpm).filter((g): g is number => g !== null);
    const expectedAvg = validGpms.length
      ? validGpms.reduce((a, b) => a + b, 0) / validGpms.length
      : null;
    const pass =
      bench.on_menu_count === onMenu.length &&
      ((expectedAvg === null && bench.avg_gpm === null) ||
        (expectedAvg !== null &&
          bench.avg_gpm !== null &&
          APPROX(bench.avg_gpm, expectedAvg, 1e-9)));
    out.push({
      id: "M",
      name: "Off-menu dishes excluded from benchmarks",
      inputs: "getMenuBenchmarks() vs on-menu rows",
      expected: `avg_gpm from ${onMenu.length} on-menu only`,
      actual: `avg_gpm=${bench.avg_gpm?.toFixed(6) ?? "null"}, on_menu_count=${bench.on_menu_count}`,
      pass,
    });
  }

  // N — Alerts match derived Menu Analytics
  {
    const rows = getMenuAnalyticsRows();
    const alerts = getAlerts();
    const marginAlerts = alerts.filter((a) => a.type === "dish_below_target");
    const onMenuBelow = rows.filter((r) => r.recipe.on_menu && r.gpm !== null && !r.on_target);
    const onMenuAbove = rows.filter((r) => r.recipe.on_menu && r.on_target);
    const belowIds = new Set(onMenuBelow.map((r) => r.recipe.id));
    const alertRecipeIds = new Set(
      marginAlerts.map((a) => a.affected_recipe_id).filter(Boolean) as string[],
    );
    const allBelowAlerted = [...belowIds].every((id) => alertRecipeIds.has(id));
    const noFalsePositive = onMenuAbove.every((r) => !alertRecipeIds.has(r.recipe.id));
    const pass = allBelowAlerted && noFalsePositive;
    out.push({
      id: "N",
      name: "Alerts match derived Menu Analytics",
      inputs: "getAlerts() vs on-menu below/above target",
      expected: "every below-target dish has margin alert; no above-target dish does",
      actual: `below=${belowIds.size} alerted=${alertRecipeIds.size} false_pos=${
        onMenuAbove.filter((r) => alertRecipeIds.has(r.recipe.id)).length
      }`,
      pass,
    });
  }

  // O — Price Trend largest increase derived
  {
    const ingId = "ing-sundried-tomatoes";
    const stats = getPriceTrendStats(ingId, { includeBaseline: false });
    const changes = priceLog.filter(
      (p) => p.ingredient_id === ingId && p.event === "change",
    );
    const expected = changes.reduce<number | null>(
      (m, e) =>
        e.pct_change !== null && e.pct_change > 0 && (m === null || e.pct_change > m)
          ? e.pct_change
          : m,
      null,
    );
    const pass =
      (expected === null && stats.largest_increase_pct === null) ||
      (expected !== null &&
        stats.largest_increase_pct !== null &&
        APPROX(stats.largest_increase_pct, expected, 1e-9));
    out.push({
      id: "O",
      name: "Price Trend largest increase derived",
      inputs: `getPriceTrendStats('${ingId}', no baseline)`,
      expected: `${expected === null ? "null" : expected.toFixed(6)}`,
      actual: `${stats.largest_increase_pct === null ? "null" : stats.largest_increase_pct.toFixed(6)}`,
      pass,
    });
  }

  // P — Dashboard below-target count matches Menu Analytics
  {
    const rows = getMenuAnalyticsRows();
    const k = getDashboardKpis();
    const expected = rows.filter((r) => r.recipe.on_menu && !r.on_target).length;
    const pass = k.below_target_count === expected;
    out.push({
      id: "P",
      name: "Dashboard below-target count matches Menu Analytics",
      inputs: "getDashboardKpis().below_target_count vs derived rows",
      expected: `${expected}`,
      actual: `${k.below_target_count}`,
      pass,
    });
  }

  // Q — Latest cascade summary matches batch history
  {
    const summary = getLatestImpactCascadeSummary();
    const history = getImpactCascadeHistory();
    const top = history[0] ?? null;
    let pass = false;
    let detail = "no summary";
    if (summary && top) {
      const metricSummary = summary.has_sales_data
        ? summary.total_estimated_monthly_margin_impact
        : summary.total_margin_impact_per_serving;
      const metricTop = top.has_sales_data
        ? top.total_estimated_monthly_margin_impact
        : top.total_margin_impact_per_serving;
      pass =
        summary.batch_id === top.batch_id &&
        summary.ingredients_changed_count === top.ingredients_changed_count &&
        summary.affected_dish_count_unique === top.affected_dish_count_unique &&
        ((metricSummary === null && metricTop === null) ||
          (metricSummary !== null &&
            metricTop !== null &&
            APPROX(metricSummary, metricTop, 1e-9)));
      detail = `summary(ing=${summary.ingredients_changed_count}, dishes=${summary.affected_dish_count_unique}, m=${metricSummary?.toFixed(4) ?? "null"}) vs top(ing=${top.ingredients_changed_count}, dishes=${top.affected_dish_count_unique}, m=${metricTop?.toFixed(4) ?? "null"})`;
    }
    out.push({
      id: "Q",
      name: "Latest cascade summary matches batch history",
      inputs: "getLatestImpactCascadeSummary() vs getImpactCascadeHistory()[0]",
      expected: "ingredients, unique dishes, and margin impact metric all match",
      actual: detail,
      pass,
    });
  }

  // R — No ambiguous margin impact labels (selector exposes per-serving + monthly + has_sales_data)
  {
    const summary = getLatestImpactCascadeSummary();
    const pass =
      !!summary &&
      typeof summary.total_margin_impact_per_serving === "number" &&
      Number.isFinite(summary.total_margin_impact_per_serving) &&
      typeof summary.has_sales_data === "boolean" &&
      (summary.has_sales_data
        ? summary.total_estimated_monthly_margin_impact !== null &&
          Number.isFinite(summary.total_estimated_monthly_margin_impact)
        : summary.total_estimated_monthly_margin_impact === null);
    out.push({
      id: "R",
      name: "Margin impact labels are unambiguous",
      inputs: "Selector exposes per-serving, monthly (when sales), and has_sales_data flag",
      expected: "per-serving always present; monthly present iff has_sales_data",
      actual: summary
        ? `per_serving=${summary.total_margin_impact_per_serving.toFixed(4)}, monthly=${summary.total_estimated_monthly_margin_impact?.toFixed(2) ?? "null"}, has_sales=${summary.has_sales_data}`
        : "no summary",
      pass,
    });
  }

  // S — No duplicate dish double-counting in batch summary
  {
    const summary = getLatestImpactCascadeSummary();
    const cascade = getLatestImpactCascade();
    let pass = false;
    let detail = "no data";
    if (summary && cascade) {
      const perDishDelta = new Map<string, number>();
      let rows = 0;
      for (const g of cascade.groups) {
        for (const d of g.affected_dishes) {
          rows++;
          perDishDelta.set(
            d.recipe_id,
            (perDishDelta.get(d.recipe_id) ?? 0) + d.delta_cogs,
          );
        }
      }
      const expectedPerServing = -Array.from(perDishDelta.values()).reduce(
        (a, b) => a + b,
        0,
      );
      pass =
        summary.affected_dish_count_unique <= summary.impact_row_count &&
        summary.affected_dish_count_unique === perDishDelta.size &&
        summary.impact_row_count === rows &&
        APPROX(summary.total_margin_impact_per_serving, expectedPerServing, 1e-9);
      detail = `unique=${summary.affected_dish_count_unique}, rows=${summary.impact_row_count}, per_serving=${summary.total_margin_impact_per_serving.toFixed(6)} expected=${expectedPerServing.toFixed(6)}`;
    }
    out.push({
      id: "S",
      name: "No duplicate dish double-counting in batch summary",
      inputs: "Aggregate cascade groups by unique dish_id",
      expected: "unique ≤ rows; per-serving margin impact = −Σ unique-dish ΔCOGS",
      actual: detail,
      pass,
    });
  }

  return out;
}

function QaPage() {
  const checks = useMemo(() => runChecks(), []);
  const passing = checks.filter((c) => c.pass).length;
  const failing = checks.length - passing;

  return (
    <AppShell>
      <PageHeader
        title="Calculation QA"
        description="Pass/fail checks for the calculation engine. Pure helpers, no persistence."
      />
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-success/30 bg-success/10 text-success"
          >
            {passing} passing
          </Badge>
          <Badge
            variant="outline"
            className={
              failing > 0
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "text-muted-foreground"
            }
          >
            {failing} failing
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Checks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Inputs</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.inputs}</TableCell>
                    <TableCell className="text-xs">{c.expected}</TableCell>
                    <TableCell className="text-xs">{c.actual}</TableCell>
                    <TableCell>
                      {c.pass ? (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-success"
                        >
                          Pass
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          Fail
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calculation rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {calculationNotes.map((n) => (
              <div key={n.id}>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
