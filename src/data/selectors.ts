// Central derived selectors. Pure, read-only, frontend-only.
//
// Selectors return derived intelligence from the mock store without mutating it.
// They power Dashboard KPIs, Menu Analytics deltas, Impact Cascade, Alerts,
// and Price Trend stats.
//
// Rules:
//   - Never return NaN, Infinity, or undefined to UI; use null and structured
//     `{ ok: false, error }` shapes.
//   - Never mutate input arrays/maps.
//   - Defer financial math to helpers in src/lib.

import type {
  AlertItem,
  Ingredient,
  PriceBatch,
  PriceLogEntry,
  Recipe,
  RestaurantSettings,
} from "@/lib/types";
import { computeRecipeCOGS, resolveIntermediateRecipeCosts } from "@/lib/cogs";
import type { IngredientCostState } from "@/lib/ingredientCost";
import { computeGP, computeGPM, isOnTarget, suggestedMenuPrice } from "@/lib/margin";
import { buildImpactCascadeForBatch, type DerivedImpactCascadeRun } from "@/lib/cascade";
import { deriveAlerts, type DerivedMenuRow } from "@/lib/alerts";
import {
  alerts as legacyAlerts,
  ingredients,
  ingredientCostStates,
  priceBatches,
  priceLog,
  recipes,
  restaurantSettings,
  computeRecipeMetrics,
} from "@/data/mock";
import {
  estimatedMonthlyUnitsSold,
  priorIngredientSnapshots,
} from "@/data/snapshots";

// ---------- Settings ----------

export function getActiveRestaurantSettings(): RestaurantSettings {
  return restaurantSettings;
}

export const ALERT_THRESHOLDS = {
  ingredient_spike_threshold: 0.10, // 10%
  margin_drop_review_pp: 0.03, // 3pp
  critical_gpm_gap_pp: 0.05, // 5pp
  recent_changes_window_days: 30,
};

// ---------- Ingredients ----------

export function getIngredientCostStates(): Map<string, IngredientCostState> {
  return ingredientCostStates;
}

// ---------- Recipe metrics ----------

export interface RecipeMetricsRow {
  recipe: Recipe;
  cogs: number;
  cost_per_serving: number;
  gp: number | null;
  gpm: number | null;
  on_target: boolean;
  suggested_menu_price: number | null;
  errors: string[];
}

export function getRecipeMetrics(): RecipeMetricsRow[] {
  return recipes.map((r) => ({ recipe: r, ...computeRecipeMetrics(r) }));
}

// ---------- Menu analytics rows (derived deltas vs prior snapshot) ----------

export interface MenuAnalyticsRow extends RecipeMetricsRow {
  prior_cogs_per_serving: number | null;
  prior_gp: number | null;
  prior_gpm: number | null;
  delta_cogs_vs_snapshot: number | null;
  delta_gp_vs_snapshot: number | null;
  delta_gpm_vs_snapshot: number | null;
}

/**
 * Recompute COGS for every dish using PRIOR ingredient unit costs (from the
 * last confirmed snapshot). Intermediate ingredient unit costs are recomputed
 * from prior Primary unit costs through the same recipe graph.
 */
function buildPriorCostStates(): Map<string, IngredientCostState> {
  const priorByIng = new Map(
    priorIngredientSnapshots.map((s) => [s.ingredient_id, s.unit_cost]),
  );
  // Clone ingredients with prior unit costs baked in via total_cost adjustment.
  const synthetic: Ingredient[] = ingredients.map((ing) => {
    if (ing.type === "Intermediate") return { ...ing };
    const priorUc = priorByIng.get(ing.id);
    if (priorUc === undefined) return { ...ing };
    return { ...ing };
  });

  const { costStates } = resolveIntermediateRecipeCosts(recipes, synthetic);

  // Override Primary + Fixed with snapshot unit costs.
  for (const ing of synthetic) {
    if (ing.type === "Intermediate") continue;
    const priorUc = priorByIng.get(ing.id);
    if (priorUc === undefined) continue;
    costStates.set(ing.id, {
      ok: true,
      ingredient_id: ing.id,
      original_unit_cost: priorUc,
      recipe_quantity: 1,
      recipe_unit_cost: priorUc,
      recipe_uom: ing.recipe_uom,
    });
  }

  // Recompute Intermediate ingredient unit costs from the overridden Primary set.
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  for (let pass = 0; pass < 3; pass++) {
    for (const ing of synthetic) {
      if (ing.type !== "Intermediate" || !ing.linked_recipe_id) continue;
      const rec = recipeById.get(ing.linked_recipe_id);
      if (!rec) continue;
      const cogs = computeRecipeCOGS(rec, synthetic, costStates);
      const perUnit = rec.serving_qty > 0 ? cogs.cogs / rec.serving_qty : 0;
      costStates.set(ing.id, {
        ok: true,
        ingredient_id: ing.id,
        original_unit_cost: perUnit,
        recipe_quantity: rec.serving_qty,
        recipe_unit_cost: perUnit,
        recipe_uom: rec.serving_uom,
      });
    }
  }

  return costStates;
}

let _priorCostStatesCache: Map<string, IngredientCostState> | null = null;
function priorCostStates(): Map<string, IngredientCostState> {
  if (_priorCostStatesCache) return _priorCostStatesCache;
  _priorCostStatesCache = buildPriorCostStates();
  return _priorCostStatesCache;
}

function priorCogsPerServing(recipe: Recipe): number | null {
  if (recipe.serving_qty <= 0) return null;
  const r = computeRecipeCOGS(recipe, ingredients, priorCostStates());
  if (!Number.isFinite(r.cogs)) return null;
  return r.cogs / recipe.serving_qty;
}

export function getMenuAnalyticsRows(): MenuAnalyticsRow[] {
  const target = restaurantSettings.target_gpm;
  return recipes
    .filter((r) => r.type === "Dish")
    .map((recipe) => {
      const m = computeRecipeMetrics(recipe);
      const priorCps = priorCogsPerServing(recipe);
      const priorGp = computeGP(recipe.menu_price, priorCps ?? 0);
      const priorGpm = priorCps !== null ? computeGPM(recipe.menu_price, priorCps) : null;
      const deltaCogs = priorCps !== null ? m.cost_per_serving - priorCps : null;
      const deltaGp = priorGp !== null && m.gp !== null ? m.gp - priorGp : null;
      const deltaGpm = priorGpm !== null && m.gpm !== null ? m.gpm - priorGpm : null;
      return {
        recipe,
        cogs: m.cogs,
        cost_per_serving: m.cost_per_serving,
        gp: m.gp,
        gpm: m.gpm,
        on_target: isOnTarget(m.gpm, target),
        suggested_menu_price: m.suggested_menu_price,
        errors: m.errors,
        prior_cogs_per_serving: priorCps,
        prior_gp: priorGp,
        prior_gpm: priorGpm,
        delta_cogs_vs_snapshot: deltaCogs,
        delta_gp_vs_snapshot: deltaGp,
        delta_gpm_vs_snapshot: deltaGpm,
      };
    });
}

// ---------- Menu benchmarks (on-menu only) ----------

export interface MenuBenchmarks {
  on_menu_count: number;
  off_menu_count: number;
  avg_gpm: number | null;
  avg_gp: number | null;
  below_target_count: number;
  top: MenuAnalyticsRow | null;
  bottom: MenuAnalyticsRow | null;
}

export function getMenuBenchmarks(): MenuBenchmarks {
  const rows = getMenuAnalyticsRows();
  const onMenu = rows.filter((r) => r.recipe.on_menu);
  const offMenuCount = rows.length - onMenu.length;
  const gpms = onMenu.map((r) => r.gpm).filter((g): g is number => g !== null);
  const gps = onMenu.map((r) => r.gp).filter((g): g is number => g !== null);
  const avg_gpm = gpms.length ? gpms.reduce((a, b) => a + b, 0) / gpms.length : null;
  const avg_gp = gps.length ? gps.reduce((a, b) => a + b, 0) / gps.length : null;
  const sorted = [...onMenu]
    .filter((d) => d.gpm !== null)
    .sort((a, b) => (b.gpm ?? 0) - (a.gpm ?? 0));
  const below_target_count = onMenu.filter((d) => !d.on_target).length;
  return {
    on_menu_count: onMenu.length,
    off_menu_count: offMenuCount,
    avg_gpm,
    avg_gp,
    below_target_count,
    top: sorted[0] ?? null,
    bottom: sorted[sorted.length - 1] ?? null,
  };
}

// ---------- Price log / batches ----------

export function getLatestPriceBatch(): PriceBatch | null {
  const sorted = [...priceBatches]
    .filter((b) => b.id !== "batch-baseline")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0] ?? null;
}

export function getPriceLogByBatch(batchId: string): PriceLogEntry[] {
  return priceLog
    .filter((p) => p.batch_id === batchId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getChangedIngredientsForBatch(batchId: string): PriceLogEntry[] {
  return getPriceLogByBatch(batchId).filter((p) => p.event === "change");
}

export interface PriceTrendStats {
  ingredient_id: string;
  first_unit_cost: number | null;
  current_unit_cost: number | null;
  abs_change: number | null;
  pct_change: number | null;
  change_count: number;
  largest_increase_pct: number | null;
  entries: PriceLogEntry[];
}

export function getPriceTrendStats(
  ingredientId: string,
  opts: { includeBaseline?: boolean } = {},
): PriceTrendStats {
  const includeBaseline = opts.includeBaseline ?? true;
  const entries = priceLog
    .filter((p) => p.ingredient_id === ingredientId)
    .filter((p) => (includeBaseline ? true : p.event !== "baseline"))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const first = entries[0]?.new_unit_cost ?? null;
  const current = entries[entries.length - 1]?.new_unit_cost ?? null;
  const abs = first !== null && current !== null ? current - first : null;
  const pct =
    first !== null && current !== null && first !== 0 ? (current - first) / first : null;
  const changes = entries.filter((e) => e.event === "change");
  const largest =
    changes.length > 0
      ? changes.reduce<number | null>(
          (m, e) => (e.pct_change !== null && (m === null || e.pct_change > m) ? e.pct_change : m),
          null,
        )
      : null;
  return {
    ingredient_id: ingredientId,
    first_unit_cost: first,
    current_unit_cost: current,
    abs_change: abs,
    pct_change: pct,
    change_count: changes.length,
    largest_increase_pct: largest && largest > 0 ? largest : null,
    entries,
  };
}

// ---------- Impact Cascade ----------

export function getImpactCascadeForBatch(
  batchId: string,
): DerivedImpactCascadeRun | null {
  const batch = priceBatches.find((b) => b.id === batchId);
  if (!batch) return null;
  const target = restaurantSettings.target_gpm;
  const priorCs = priorCostStates();
  const currentCs = ingredientCostStates;

  return buildImpactCascadeForBatch({
    batch,
    priceLog,
    recipes,
    ingredients,
    priorUnitCostFor: (id) => {
      const s = priorCs.get(id);
      return s && s.ok ? s.recipe_unit_cost : undefined;
    },
    currentUnitCostFor: (id) => {
      const s = currentCs.get(id);
      return s && s.ok ? s.recipe_unit_cost : undefined;
    },
    oldCogsPerServingFor: (rid) => {
      const r = recipes.find((x) => x.id === rid);
      if (!r) return null;
      return priorCogsPerServing(r);
    },
    newCogsPerServingFor: (rid) => {
      const r = recipes.find((x) => x.id === rid);
      if (!r) return null;
      const m = computeRecipeMetrics(r);
      return m.cost_per_serving;
    },
    targetGpm: target,
    marginDropReviewPp: ALERT_THRESHOLDS.margin_drop_review_pp,
  });
}

export function getLatestImpactCascade(): DerivedImpactCascadeRun | null {
  const b = getLatestPriceBatch();
  if (!b) return null;
  return getImpactCascadeForBatch(b.id);
}

// ---------- Alerts ----------

export function getAlerts(): AlertItem[] {
  const cascade = getLatestImpactCascade();
  const target = restaurantSettings.target_gpm;
  const menuRows: DerivedMenuRow[] = getMenuAnalyticsRows().map((r) => ({
    recipe: r.recipe,
    cogs_per_serving: r.cost_per_serving,
    gpm: r.gpm,
    on_target: r.on_target,
  }));
  const recentBatches = priceBatches
    .filter((b) => b.id !== "batch-baseline")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 2)
    .map((b) => b.id);
  const recentChanges = priceLog
    .filter((p) => p.event === "change" && recentBatches.includes(p.batch_id))
    .map((p) => ({
      ingredient_id: p.ingredient_id,
      name_at_time: p.name_at_time,
      pct_change: p.pct_change,
      timestamp: p.timestamp,
    }));
  return deriveAlerts({
    menuRows,
    cascade,
    targetGpm: target,
    ingredientSpikeThreshold: ALERT_THRESHOLDS.ingredient_spike_threshold,
    marginDropReviewPp: ALERT_THRESHOLDS.margin_drop_review_pp,
    recentChanges,
  });
}

export const legacyAlertsExport: AlertItem[] = legacyAlerts;

// ---------- Dashboard KPIs ----------

export interface DashboardKpis {
  avg_gpm: number | null;
  on_menu_count: number;
  below_target_count: number;
  ingredient_cost_spike_count: number;
  recent_price_changes_count: number;
  profit_at_risk_monthly_usd: number | null;
  margin_gap_per_cover_usd: number;
  has_sales_data: boolean;
  latest_batch: PriceBatch | null;
  latest_cascade: DerivedImpactCascadeRun | null;
}

export function getDashboardKpis(): DashboardKpis {
  const bench = getMenuBenchmarks();
  const target = restaurantSettings.target_gpm;
  const rows = getMenuAnalyticsRows();
  const onMenuBelow = rows.filter((r) => r.recipe.on_menu && !r.on_target);

  const latestBatch = getLatestPriceBatch();
  const latestCascade = latestBatch ? getImpactCascadeForBatch(latestBatch.id) : null;

  const recentPriceChangesCount = latestBatch
    ? getChangedIngredientsForBatch(latestBatch.id).length
    : 0;

  const ingredientSpikeCount = latestBatch
    ? getChangedIngredientsForBatch(latestBatch.id).filter(
        (e) =>
          e.pct_change !== null &&
          e.pct_change >= ALERT_THRESHOLDS.ingredient_spike_threshold,
      ).length
    : 0;

  let marginGapPerCover = 0;
  for (const r of onMenuBelow) {
    if (r.recipe.menu_price === null || r.gpm === null) continue;
    const targetGp = r.recipe.menu_price * target;
    const actualGp = r.gp ?? 0;
    marginGapPerCover += Math.max(0, targetGp - actualGp);
  }

  const hasSales = Object.keys(estimatedMonthlyUnitsSold).length > 0;
  let profitAtRiskMonthly: number | null = null;
  if (hasSales) {
    profitAtRiskMonthly = 0;
    for (const r of onMenuBelow) {
      if (r.recipe.menu_price === null || r.gpm === null) continue;
      const units = estimatedMonthlyUnitsSold[r.recipe.id] ?? 0;
      const targetGp = r.recipe.menu_price * target;
      const actualGp = r.gp ?? 0;
      profitAtRiskMonthly += Math.max(0, targetGp - actualGp) * units;
    }
  }

  return {
    avg_gpm: bench.avg_gpm,
    on_menu_count: bench.on_menu_count,
    below_target_count: bench.below_target_count,
    ingredient_cost_spike_count: ingredientSpikeCount,
    recent_price_changes_count: recentPriceChangesCount,
    profit_at_risk_monthly_usd: profitAtRiskMonthly,
    margin_gap_per_cover_usd: marginGapPerCover,
    has_sales_data: hasSales,
    latest_batch: latestBatch,
    latest_cascade: latestCascade,
  };
}

// ---------- Data integrity ----------

export type IntegritySeverity = "pass" | "warning" | "fail";

export interface IntegrityCheck {
  id: string;
  name: string;
  severity: IntegritySeverity;
  message: string;
  affected?: string;
}

export interface IntegrityReport {
  checks: IntegrityCheck[];
  passing: number;
  warning: number;
  failing: number;
}

export function getDataIntegrityReport(): IntegrityReport {
  const checks: IntegrityCheck[] = [];

  {
    const ids = ingredients.map((i) => i.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    checks.push({
      id: "ing-id-unique",
      name: "Ingredient IDs unique",
      severity: dupes.length === 0 ? "pass" : "fail",
      message: dupes.length === 0 ? `${ids.length} unique IDs.` : `Duplicate IDs: ${dupes.join(", ")}`,
    });
  }
  {
    const names = ingredients.map((i) => i.name.toLowerCase());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    checks.push({
      id: "ing-name-unique",
      name: "Ingredient names unique (case-insensitive)",
      severity: dupes.length === 0 ? "pass" : "warning",
      message: dupes.length === 0 ? "OK" : `Duplicates: ${[...new Set(dupes)].join(", ")}`,
    });
  }
  {
    const ids = recipes.map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    checks.push({
      id: "rec-id-unique",
      name: "Recipe IDs unique",
      severity: dupes.length === 0 ? "pass" : "fail",
      message: dupes.length === 0 ? `${ids.length} unique IDs.` : `Duplicate IDs: ${dupes.join(", ")}`,
    });
  }
  {
    const names = recipes.map((r) => r.name.toLowerCase());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    checks.push({
      id: "rec-name-unique",
      name: "Recipe names unique (case-insensitive)",
      severity: dupes.length === 0 ? "pass" : "warning",
      message: dupes.length === 0 ? "OK" : `Duplicates: ${[...new Set(dupes)].join(", ")}`,
    });
  }
  {
    const ingIds = new Set(ingredients.map((i) => i.id));
    const missing: string[] = [];
    for (const r of recipes) {
      for (const l of r.lines) {
        if (!ingIds.has(l.ingredient_id)) missing.push(`${r.name}/${l.ingredient_id}`);
      }
    }
    checks.push({
      id: "rec-line-ing-fk",
      name: "Recipe lines reference known ingredients",
      severity: missing.length === 0 ? "pass" : "fail",
      message: missing.length === 0 ? "OK" : missing.join(", "),
    });
  }
  {
    const ingById = new Map(ingredients.map((i) => [i.id, i]));
    const issues: string[] = [];
    for (const r of recipes) {
      if (r.type !== "Intermediate") continue;
      if (!r.linked_ingredient_id) {
        issues.push(`${r.name}: no linked ingredient`);
        continue;
      }
      const li = ingById.get(r.linked_ingredient_id);
      if (!li || li.type !== "Intermediate") {
        issues.push(`${r.name}: linked ingredient missing or not Intermediate`);
      }
    }
    checks.push({
      id: "inter-recipe-link",
      name: "Intermediate recipes link to Intermediate ingredient",
      severity: issues.length === 0 ? "pass" : "fail",
      message: issues.length === 0 ? "OK" : issues.join("; "),
    });
  }
  {
    const recById = new Map(recipes.map((r) => [r.id, r]));
    const issues: string[] = [];
    for (const i of ingredients) {
      if (i.type !== "Intermediate") continue;
      if (!i.linked_recipe_id) {
        issues.push(`${i.name}: no linked recipe`);
        continue;
      }
      const r = recById.get(i.linked_recipe_id);
      if (!r || r.type !== "Intermediate") {
        issues.push(`${i.name}: linked recipe missing or not Intermediate`);
      }
    }
    checks.push({
      id: "inter-ing-link",
      name: "Intermediate ingredients link to Intermediate recipe",
      severity: issues.length === 0 ? "pass" : "warning",
      message: issues.length === 0 ? "OK" : issues.join("; "),
    });
  }
  {
    const { errors } = resolveIntermediateRecipeCosts(recipes, ingredients);
    const cyc = errors.filter((e) => e.toLowerCase().includes("circular"));
    checks.push({
      id: "no-cycles",
      name: "No circular recipe dependencies",
      severity: cyc.length === 0 ? "pass" : "fail",
      message: cyc.length === 0 ? "OK" : cyc.join("; "),
    });
  }
  {
    const bad = recipes.filter((r) => r.type === "Dish" && !(r.serving_qty > 0));
    checks.push({
      id: "dish-serving-qty",
      name: "Dish serving_qty > 0",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.map((r) => r.name).join(", "),
    });
  }
  {
    const bad: string[] = [];
    for (const r of recipes)
      for (const l of r.lines) if (!(l.qty > 0)) bad.push(`${r.name}/${l.id}`);
    checks.push({
      id: "line-qty",
      name: "Recipe line quantities > 0",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.join(", "),
    });
  }
  {
    const bad = recipes.filter(
      (r) => r.type === "Dish" && r.on_menu && !(r.menu_price && r.menu_price > 0),
    );
    checks.push({
      id: "on-menu-price",
      name: "On-menu dishes have menu_price > 0",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.map((r) => r.name).join(", "),
    });
  }
  {
    const ingIds = new Set(ingredients.map((i) => i.id));
    const bad = priceLog.filter((p) => !ingIds.has(p.ingredient_id));
    checks.push({
      id: "pl-ing-fk",
      name: "Price log entries reference known ingredients",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.map((p) => p.id).join(", "),
    });
  }
  {
    const ingIds = new Set(ingredients.map((i) => i.id));
    const bad = priorIngredientSnapshots.filter((s) => !ingIds.has(s.ingredient_id));
    checks.push({
      id: "snap-ing-fk",
      name: "Snapshots reference known ingredients",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.map((s) => s.ingredient_id).join(", "),
    });
  }
  {
    const bad = ingredients.filter((i) => Math.abs(1 + i.adjustment) < 1e-9);
    checks.push({
      id: "adj-not-neg-one",
      name: "No ingredient adjustment = -1",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.map((i) => i.name).join(", "),
    });
  }
  {
    const bad: string[] = [];
    for (const r of getMenuAnalyticsRows()) {
      const vals = [r.cogs, r.cost_per_serving, r.gp, r.gpm, r.delta_gpm_vs_snapshot];
      for (const v of vals) {
        if (v !== null && !Number.isFinite(v)) {
          bad.push(r.recipe.name);
          break;
        }
      }
    }
    checks.push({
      id: "no-nan",
      name: "No NaN/Infinity in derived menu values",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.join(", "),
    });
  }
  {
    const cascade = getLatestImpactCascade();
    const recById = new Map(recipes.map((r) => [r.id, r]));
    const ingById = new Map(ingredients.map((i) => [i.id, i]));
    const bad: string[] = [];
    if (cascade) {
      for (const g of cascade.groups) {
        for (const d of g.affected_dishes) {
          const path = d.impact_path;
          if (!path || path.length < 2) {
            bad.push(`${d.recipe_name}: empty path`);
            continue;
          }
          if (path[0].kind !== "primary" || !path[0].ingredient_id || !ingById.has(path[0].ingredient_id)) {
            bad.push(`${d.recipe_name}: bad primary head`);
            continue;
          }
          const tail = path[path.length - 1];
          if (tail.kind !== "dish" || !tail.recipe_id || !recById.has(tail.recipe_id)) {
            bad.push(`${d.recipe_name}: bad dish tail`);
            continue;
          }
          if (d.pathway === "indirect") {
            const inter = path.find((s) => s.kind === "intermediate");
            if (!inter || !inter.recipe_id || !recById.has(inter.recipe_id)) {
              bad.push(`${d.recipe_name}: missing intermediate step`);
            }
          }
        }
      }
    }
    checks.push({
      id: "cascade-paths",
      name: "Impact Cascade rows have valid dependency paths",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : bad.join("; "),
    });
  }
  {
    const recIds = new Set(recipes.map((r) => r.id));
    const ingIds = new Set(ingredients.map((i) => i.id));
    const bad: string[] = [];
    for (const a of getAlerts()) {
      const hasRecipe = a.affected_recipe_id && recIds.has(a.affected_recipe_id);
      const hasIng = a.affected_ingredient_id && ingIds.has(a.affected_ingredient_id);
      if (!hasRecipe && !hasIng) bad.push(a.id);
      else {
        if (a.affected_recipe_id && !recIds.has(a.affected_recipe_id)) bad.push(a.id);
        if (a.affected_ingredient_id && !ingIds.has(a.affected_ingredient_id)) bad.push(a.id);
      }
    }
    checks.push({
      id: "alert-subjects",
      name: "Derived alerts reference valid subjects",
      severity: bad.length === 0 ? "pass" : "fail",
      message: bad.length === 0 ? "OK" : `Bad alerts: ${bad.join(", ")}`,
    });
  }

  const passing = checks.filter((c) => c.severity === "pass").length;
  const warning = checks.filter((c) => c.severity === "warning").length;
  const failing = checks.filter((c) => c.severity === "fail").length;
  return { checks, passing, warning, failing };
}

export { suggestedMenuPrice };
