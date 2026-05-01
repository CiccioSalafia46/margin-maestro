// Impact Cascade — pure helpers, frontend-only.
//
// Two layers:
//   1. computeCascadeRow(): single-line ratio-method math (Build 0.2).
//   2. buildImpactCascadeForBatch(): generates a full ImpactCascadeRun by
//      walking price log entries for a batch and propagating cost changes
//      through Primary → Dish (direct) and Primary → Intermediate → Dish
//      (indirect) paths. No mutation; returns a fresh structure.
//
// Ratio method (per dish, per affected ingredient line):
//   New Line Cost     = Old Line Cost × (New Unit Cost / Old Unit Cost)
//   Delta per Serving = (New Line Cost - Old Line Cost) / Serving Quantity
//   New COGS / Serving = Old COGS / Serving + Delta per Serving
//   Old GPM           = (Menu Price - Old COGS/Serving) / Menu Price
//   New GPM           = (Menu Price - New COGS/Serving) / Menu Price

import type {
  Ingredient,
  PriceBatch,
  PriceLogEntry,
  Recipe,
} from "./types";
import { suggestedMenuPrice } from "./margin";
import { convertQuantity } from "./units";

export interface CascadeInputs {
  old_unit_cost: number;
  new_unit_cost: number;
  old_line_cost: number;
  serving_qty: number;
  old_cogs_per_serving: number;
  menu_price: number;
}

export interface CascadeOk {
  ok: true;
  new_line_cost: number;
  delta_per_serving: number;
  new_cogs_per_serving: number;
  old_gpm: number;
  new_gpm: number;
  delta_gpm: number;
}
export interface CascadeErr {
  ok: false;
  error: string;
}
export type CascadeResult = CascadeOk | CascadeErr;

export function computeCascadeRow(input: CascadeInputs): CascadeResult {
  const {
    old_unit_cost,
    new_unit_cost,
    old_line_cost,
    serving_qty,
    old_cogs_per_serving,
    menu_price,
  } = input;

  if (!Number.isFinite(old_unit_cost) || old_unit_cost <= 0)
    return { ok: false, error: "old_unit_cost must be > 0." };
  if (!Number.isFinite(new_unit_cost) || new_unit_cost < 0)
    return { ok: false, error: "new_unit_cost must be ≥ 0." };
  if (!Number.isFinite(serving_qty) || serving_qty <= 0)
    return { ok: false, error: "serving_qty must be > 0." };
  if (!Number.isFinite(menu_price) || menu_price <= 0)
    return { ok: false, error: "menu_price must be > 0 to compute GPM." };
  if (!Number.isFinite(old_line_cost) || old_line_cost < 0)
    return { ok: false, error: "old_line_cost must be ≥ 0." };
  if (!Number.isFinite(old_cogs_per_serving) || old_cogs_per_serving < 0)
    return { ok: false, error: "old_cogs_per_serving must be ≥ 0." };

  const new_line_cost = old_line_cost * (new_unit_cost / old_unit_cost);
  const delta_per_serving = (new_line_cost - old_line_cost) / serving_qty;
  const new_cogs_per_serving = old_cogs_per_serving + delta_per_serving;
  const old_gpm = (menu_price - old_cogs_per_serving) / menu_price;
  const new_gpm = (menu_price - new_cogs_per_serving) / menu_price;
  return {
    ok: true,
    new_line_cost,
    delta_per_serving,
    new_cogs_per_serving,
    old_gpm,
    new_gpm,
    delta_gpm: new_gpm - old_gpm,
  };
}

// ---------- Cascade generation from batch + mock data ----------

export interface CascadeImpactPathStep {
  kind: "primary" | "intermediate" | "dish";
  ingredient_id?: string;
  ingredient_name?: string;
  recipe_id?: string;
  recipe_name?: string;
}

export interface DerivedCascadeAffectedDish {
  recipe_id: string;
  recipe_name: string;
  old_cogs: number; // per serving
  new_cogs: number; // per serving
  delta_cogs: number; // per serving
  menu_price: number | null;
  old_gpm: number | null;
  new_gpm: number | null;
  delta_gpm: number | null;
  suggested_menu_price: number | null;
  status: "below_target" | "on_target" | "no_price";
  pathway: "direct" | "indirect";
  impact_path: CascadeImpactPathStep[];
  needs_review: boolean;
}

export interface DerivedCascadeIngredientGroup {
  ingredient_id: string;
  ingredient_name: string;
  old_unit_cost: number;
  new_unit_cost: number;
  delta: number;
  pct_change: number;
  affected_dishes: DerivedCascadeAffectedDish[];
}

export interface DerivedImpactCascadeRun {
  batch_id: string;
  created_at: string;
  ingredients_changed: number;
  dishes_affected: number;
  dishes_newly_below_target: number;
  total_margin_impact_usd: number; // signed; negative = profit lost
  groups: DerivedCascadeIngredientGroup[];
  errors: string[];
}

interface BuildArgs {
  batch: PriceBatch;
  priceLog: PriceLogEntry[]; // entries for this batch (or all; we'll filter)
  recipes: Recipe[];
  ingredients: Ingredient[];
  /** Resolves the unit cost (per ingredient.recipe_uom) used PRIOR to the batch. */
  priorUnitCostFor: (ingredientId: string) => number | undefined;
  /** Resolves the unit cost AFTER the batch was applied (current state). */
  currentUnitCostFor: (ingredientId: string) => number | undefined;
  /** Pre-batch COGS per serving for a dish. */
  oldCogsPerServingFor: (recipeId: string) => number | null;
  /** Post-batch COGS per serving for a dish. */
  newCogsPerServingFor: (recipeId: string) => number | null;
  targetGpm: number;
  marginDropReviewPp?: number; // e.g. 0.03 = 3pp drop triggers needs_review
}

export function buildImpactCascadeForBatch(args: BuildArgs): DerivedImpactCascadeRun {
  const {
    batch,
    priceLog,
    recipes,
    ingredients,
    priorUnitCostFor,
    currentUnitCostFor,
    oldCogsPerServingFor,
    newCogsPerServingFor,
    targetGpm,
    marginDropReviewPp = 0.03,
  } = args;

  const errors: string[] = [];
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  // 1. Find changed Primary/Fixed ingredients in this batch
  const batchEntries = priceLog.filter(
    (p) => p.batch_id === batch.id && p.event === "change",
  );

  // 2. For each changed ingredient, walk Dish recipes and find paths.
  //    Direct: dish.lines includes changed ingredient.
  //    Indirect: dish.lines includes an Intermediate ingredient whose linked
  //              recipe.lines includes the changed ingredient.
  const dishes = recipes.filter((r) => r.type === "Dish");

  const groups: DerivedCascadeIngredientGroup[] = [];

  for (const entry of batchEntries) {
    const changedIng = ingById.get(entry.ingredient_id);
    if (!changedIng) {
      errors.push(`Changed ingredient ${entry.ingredient_id} not found.`);
      continue;
    }
    if (changedIng.type === "Intermediate") {
      // Intermediate cost shifts are propagated indirectly via recipes; skip
      // as a top-level group (the underlying Primary change drives it).
      continue;
    }

    const oldUc = entry.old_unit_cost ?? priorUnitCostFor(changedIng.id);
    const newUc = entry.new_unit_cost ?? currentUnitCostFor(changedIng.id);
    if (oldUc === undefined || newUc === undefined || oldUc <= 0) {
      errors.push(`Missing prior/current unit cost for ${changedIng.name}.`);
      continue;
    }

    const affected: DerivedCascadeAffectedDish[] = [];

    for (const dish of dishes) {
      // Determine pathway by inspecting lines
      const directLine = dish.lines.find((l) => l.ingredient_id === changedIng.id);
      let pathway: "direct" | "indirect" | null = directLine ? "direct" : null;
      let intermediate: { ingredient: Ingredient; recipe: Recipe } | null = null;

      if (!pathway) {
        for (const l of dish.lines) {
          const lineIng = ingById.get(l.ingredient_id);
          if (lineIng && lineIng.type === "Intermediate" && lineIng.linked_recipe_id) {
            const linked = recipeById.get(lineIng.linked_recipe_id);
            if (linked && linked.lines.some((il) => il.ingredient_id === changedIng.id)) {
              pathway = "indirect";
              intermediate = { ingredient: lineIng, recipe: linked };
              break;
            }
          }
        }
      }
      if (!pathway) continue;

      const oldCogs = oldCogsPerServingFor(dish.id);
      const newCogs = newCogsPerServingFor(dish.id);
      if (oldCogs === null || newCogs === null) continue;
      const deltaCogs = newCogs - oldCogs;

      // Skip dishes with effectively no impact via this ingredient
      if (Math.abs(deltaCogs) < 1e-6) continue;

      const menuPrice = dish.menu_price && dish.menu_price > 0 ? dish.menu_price : null;
      const oldGpm = menuPrice !== null ? (menuPrice - oldCogs) / menuPrice : null;
      const newGpm = menuPrice !== null ? (menuPrice - newCogs) / menuPrice : null;
      const deltaGpm = oldGpm !== null && newGpm !== null ? newGpm - oldGpm : null;
      const suggested = suggestedMenuPrice(newCogs, targetGpm);

      let status: DerivedCascadeAffectedDish["status"];
      if (menuPrice === null) status = "no_price";
      else if (newGpm !== null && newGpm + 1e-9 < targetGpm) status = "below_target";
      else status = "on_target";

      const needs_review =
        status === "below_target" ||
        (deltaGpm !== null && deltaGpm <= -marginDropReviewPp);

      const path: CascadeImpactPathStep[] = [
        {
          kind: "primary",
          ingredient_id: changedIng.id,
          ingredient_name: changedIng.name,
        },
      ];
      if (pathway === "indirect" && intermediate) {
        path.push({
          kind: "intermediate",
          recipe_id: intermediate.recipe.id,
          recipe_name: intermediate.recipe.name,
          ingredient_id: intermediate.ingredient.id,
          ingredient_name: intermediate.ingredient.name,
        });
      }
      path.push({ kind: "dish", recipe_id: dish.id, recipe_name: dish.name });

      affected.push({
        recipe_id: dish.id,
        recipe_name: dish.name,
        old_cogs: oldCogs,
        new_cogs: newCogs,
        delta_cogs: deltaCogs,
        menu_price: menuPrice,
        old_gpm: oldGpm,
        new_gpm: newGpm,
        delta_gpm: deltaGpm,
        suggested_menu_price: suggested,
        status,
        pathway,
        impact_path: path,
        needs_review,
      });
    }

    if (affected.length === 0) continue;

    affected.sort((a, b) => (a.delta_gpm ?? 0) - (b.delta_gpm ?? 0));

    groups.push({
      ingredient_id: changedIng.id,
      ingredient_name: changedIng.name,
      old_unit_cost: oldUc,
      new_unit_cost: newUc,
      delta: newUc - oldUc,
      pct_change: oldUc > 0 ? (newUc - oldUc) / oldUc : 0,
      affected_dishes: affected,
    });
  }

  // Aggregate KPIs
  const ingredients_changed = groups.length;
  const dishesAffectedSet = new Set<string>();
  let dishes_newly_below_target = 0;
  let total_margin_impact_usd = 0;

  // Track newly below target ONCE per dish
  const newlyBelow = new Set<string>();
  for (const g of groups) {
    for (const d of g.affected_dishes) {
      dishesAffectedSet.add(d.recipe_id);
      // Per-dish impact: sum delta_cogs across groups via aggregated old/new.
      // Approximation per-group: if previously on_target and now below_target.
      if (
        d.menu_price !== null &&
        d.old_gpm !== null &&
        d.new_gpm !== null &&
        d.old_gpm + 1e-9 >= targetGpm &&
        d.new_gpm + 1e-9 < targetGpm
      ) {
        newlyBelow.add(d.recipe_id);
      }
      // Margin impact: -delta_cogs (negative = profit lost) per serving.
      total_margin_impact_usd += -d.delta_cogs;
    }
  }
  dishes_newly_below_target = newlyBelow.size;

  return {
    batch_id: batch.id,
    created_at: batch.created_at,
    ingredients_changed,
    dishes_affected: dishesAffectedSet.size,
    dishes_newly_below_target,
    total_margin_impact_usd,
    groups,
    errors,
  };
}
