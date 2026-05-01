// Derived alerts — pure, frontend-only.
//
// Alerts are derived from:
//   - Menu analytics rows (current GPM vs target)
//   - Price log changes (ingredient spikes)
//   - Impact cascade rows (needs price review, intermediate propagation)
//
// No persistence. UI may surface acknowledge/resolve buttons that toast only.

import type { AlertItem, AlertSeverity, Recipe } from "./types";
import { formatPercent, formatPpDelta } from "./format";
import { suggestedMenuPrice } from "./margin";
import type {
  DerivedCascadeAffectedDish,
  DerivedCascadeIngredientGroup,
  DerivedImpactCascadeRun,
} from "./cascade";

export interface DerivedMenuRow {
  recipe: Recipe;
  cogs_per_serving: number;
  gpm: number | null;
  on_target: boolean;
}

export interface DeriveAlertsInput {
  menuRows: DerivedMenuRow[];
  cascade: DerivedImpactCascadeRun | null;
  targetGpm: number;
  ingredientSpikeThreshold: number; // e.g. 0.10
  marginDropReviewPp: number; // e.g. 0.03
  recentChanges: Array<{
    ingredient_id: string;
    name_at_time: string;
    pct_change: number | null;
    timestamp: string;
  }>;
}

function severityForGpmGap(gapPp: number, criticalGapPp = 0.05): AlertSeverity {
  if (gapPp >= criticalGapPp) return "critical";
  if (gapPp > 0) return "warning";
  return "info";
}

function severityForSpike(pct: number, affectedCount: number): AlertSeverity {
  // Spec: spikes are at most "warning". Spikes with zero affected on-menu
  // dishes drop to "info" so they never appear as critical dashboard actions.
  if (affectedCount === 0) return "info";
  if (pct >= 0.10) return "warning";
  return "info";
}

export function deriveAlerts(input: DeriveAlertsInput): AlertItem[] {
  const {
    menuRows,
    cascade,
    targetGpm,
    ingredientSpikeThreshold,
    marginDropReviewPp,
    recentChanges,
  } = input;
  const out: AlertItem[] = [];

  // A. Dish below target GPM (on-menu only)
  for (const row of menuRows) {
    if (!row.recipe.on_menu) continue;
    if (row.gpm === null) continue;
    if (row.on_target) continue;
    const gap = targetGpm - row.gpm; // > 0
    const sp = suggestedMenuPrice(row.cogs_per_serving, targetGpm);
    out.push({
      id: `alert-margin-${row.recipe.id}`,
      severity: severityForGpmGap(gap),
      type: "dish_below_target",
      status: "open",
      title: `${row.recipe.name} below target GPM`,
      summary: `Current GPM ${formatPercent(row.gpm)} vs target ${formatPercent(targetGpm)} (gap ${formatPpDelta(-gap)}).${
        sp !== null ? ` Suggested menu price ${sp.toFixed(2)}.` : ""
      }`,
      affected_recipe_id: row.recipe.id,
      created_at: cascade?.created_at ?? new Date().toISOString(),
    });
  }

  // B. Ingredient cost spike (from recent change list)
  for (const c of recentChanges) {
    if (c.pct_change === null) continue;
    if (c.pct_change < ingredientSpikeThreshold) continue;
    const affectedCount = countDishesForIngredient(c.ingredient_id, cascade);
    out.push({
      id: `alert-spike-${c.ingredient_id}-${c.timestamp}`,
      severity: severityForSpike(c.pct_change, affectedCount),
      type: "ingredient_spike",
      status: "open",
      title: `${c.name_at_time} up ${formatPercent(c.pct_change, { decimals: 1, signed: true })}`,
      summary: `Cost spike crosses ${formatPercent(ingredientSpikeThreshold, { decimals: 0 })} threshold. Affects ${affectedCount} dish${affectedCount === 1 ? "" : "es"}.`,
      affected_ingredient_id: c.ingredient_id,
      created_at: c.timestamp,
    });
  }

  // C. Needs price review — from cascade rows
  if (cascade) {
    for (const g of cascade.groups) {
      for (const d of g.affected_dishes) {
        if (!d.needs_review) continue;
        // Skip those already covered by a margin alert (still on_target but big drop)
        if (d.status === "below_target") continue;
        out.push({
          id: `alert-review-${d.recipe_id}-${g.ingredient_id}`,
          severity: "warning",
          type: "dish_needs_price_review",
          status: "open",
          title: `${d.recipe_name} needs price review`,
          summary: `Margin shifted ${formatPpDelta(d.delta_gpm)} after ${g.ingredient_name} change. ${
            d.suggested_menu_price !== null
              ? `Suggested menu price ${d.suggested_menu_price.toFixed(2)}.`
              : ""
          }`,
          affected_recipe_id: d.recipe_id,
          affected_ingredient_id: g.ingredient_id,
          created_at: cascade.created_at,
        });
      }
    }

    // D. Intermediate propagation — emit once per (intermediate, dish)
    const seenIntermediate = new Set<string>();
    for (const g of cascade.groups) {
      for (const d of g.affected_dishes) {
        if (d.pathway !== "indirect") continue;
        const interStep = d.impact_path.find((s) => s.kind === "intermediate");
        if (!interStep) continue;
        const key = `${interStep.recipe_id}-${d.recipe_id}-${g.ingredient_id}`;
        if (seenIntermediate.has(key)) continue;
        seenIntermediate.add(key);
        out.push({
          id: `alert-inter-${key}`,
          severity: marginDropReviewPp && d.delta_gpm !== null && d.delta_gpm <= -marginDropReviewPp ? "warning" : "info",
          type: "intermediate_cost_shift",
          status: "open",
          title: `${interStep.recipe_name} cost shift propagated`,
          summary: `${g.ingredient_name} change flowed through ${interStep.recipe_name} into ${d.recipe_name}.`,
          affected_recipe_id: d.recipe_id,
          affected_ingredient_id: interStep.ingredient_id,
          created_at: cascade.created_at,
        });
      }
    }
  }

  // Sort: critical first, then warning, then info; newest first within group.
  const sevRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  out.sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity])
      return sevRank[a.severity] - sevRank[b.severity];
    return b.created_at.localeCompare(a.created_at);
  });

  return out;
}

function countDishesForIngredient(
  ingredientId: string,
  cascade: DerivedImpactCascadeRun | null,
): number {
  if (!cascade) return 0;
  const group = cascade.groups.find(
    (g: DerivedCascadeIngredientGroup) => g.ingredient_id === ingredientId,
  );
  if (!group) return 0;
  return new Set(group.affected_dishes.map((d: DerivedCascadeAffectedDish) => d.recipe_id)).size;
}
