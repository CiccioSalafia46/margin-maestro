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
  getLatestImpactCascade,
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
