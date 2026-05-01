// Ingredient costing helpers — pure, frontend-only.
//
// Formulas:
//   original_unit_cost = total_cost / original_quantity
//   recipe_quantity    = if conversion_on -> convert(original_quantity, original_uom, recipe_uom, density)
//                        else                original_quantity
//   recipe_unit_cost   = total_cost / (recipe_quantity * (1 + adjustment))

import type { Ingredient, UoM } from "./types";
import { convertQuantity } from "./units";

const EPS = 1e-12;

export interface CostStateOk {
  ok: true;
  ingredient_id: string;
  original_unit_cost: number;
  recipe_quantity: number;
  recipe_unit_cost: number;
  recipe_uom: UoM;
}
export interface CostStateErr {
  ok: false;
  ingredient_id: string;
  error: string;
}
export type IngredientCostState = CostStateOk | CostStateErr;

export function computeOriginalUnitCost(
  total_cost: number,
  original_quantity: number,
): number | { error: string } {
  if (!Number.isFinite(total_cost) || total_cost < 0)
    return { error: "total_cost must be a non-negative finite number." };
  if (!Number.isFinite(original_quantity) || original_quantity <= 0)
    return { error: "original_quantity must be greater than 0." };
  return total_cost / original_quantity;
}

export function computeRecipeQuantity(
  original_quantity: number,
  original_uom: UoM,
  recipe_uom: UoM,
  conversion_on: boolean,
  density_g_per_ml?: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(original_quantity) || original_quantity <= 0)
    return { ok: false, error: "original_quantity must be greater than 0." };
  if (!conversion_on) return { ok: true, value: original_quantity };
  if (original_uom === recipe_uom) return { ok: true, value: original_quantity };
  const r = convertQuantity(original_quantity, original_uom, recipe_uom, density_g_per_ml);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, value: r.value };
}

export function computeRecipeUnitCost(
  total_cost: number,
  recipe_quantity: number,
  adjustment: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(total_cost) || total_cost < 0)
    return { ok: false, error: "total_cost must be a non-negative finite number." };
  if (!Number.isFinite(recipe_quantity) || recipe_quantity <= 0)
    return { ok: false, error: "recipe_quantity must be greater than 0." };
  if (!Number.isFinite(adjustment))
    return { ok: false, error: "adjustment must be a finite number." };
  if (Math.abs(1 + adjustment) < EPS)
    return { ok: false, error: "adjustment cannot equal -1 (division by zero)." };
  const denom = recipe_quantity * (1 + adjustment);
  if (denom <= 0) return { ok: false, error: "Effective yield (qty × (1+adj)) must be > 0." };
  return { ok: true, value: total_cost / denom };
}

/**
 * Compute a complete ingredient cost state from source fields.
 * Fixed ingredients: total_cost is treated as cost per recipe_uom (typically per Ct),
 * and recipe_unit_cost = total_cost (after adjustment normalization at qty=1).
 */
export function computeIngredientCostState(ingredient: Ingredient): IngredientCostState {
  const id = ingredient.id;

  if (ingredient.type === "Fixed") {
    // Fixed cost: treat as a flat per-recipe_uom cost.
    if (!Number.isFinite(ingredient.total_cost) || ingredient.total_cost < 0)
      return { ok: false, ingredient_id: id, error: "Fixed total_cost must be ≥ 0." };
    return {
      ok: true,
      ingredient_id: id,
      original_unit_cost: ingredient.total_cost,
      recipe_quantity: 1,
      recipe_unit_cost: ingredient.total_cost,
      recipe_uom: ingredient.recipe_uom,
    };
  }

  // Intermediate: cost is determined by the linked recipe (resolved elsewhere).
  // We still compute a baseline using stored fields if total_cost > 0, otherwise
  // we return ok with recipe_unit_cost = stored ingredient.recipe_unit_cost so
  // downstream can detect "needs recipe resolution".
  if (ingredient.type === "Intermediate") {
    return {
      ok: true,
      ingredient_id: id,
      original_unit_cost: ingredient.recipe_unit_cost,
      recipe_quantity: ingredient.original_qty,
      recipe_unit_cost: ingredient.recipe_unit_cost,
      recipe_uom: ingredient.recipe_uom,
    };
  }

  // Primary: full pipeline
  const ouc = computeOriginalUnitCost(ingredient.total_cost, ingredient.original_qty);
  if (typeof ouc !== "number") return { ok: false, ingredient_id: id, error: ouc.error };

  const rq = computeRecipeQuantity(
    ingredient.original_qty,
    ingredient.original_uom,
    ingredient.recipe_uom,
    ingredient.conversion_on,
    ingredient.density_g_per_ml,
  );
  if (!rq.ok) return { ok: false, ingredient_id: id, error: rq.error };

  const ruc = computeRecipeUnitCost(ingredient.total_cost, rq.value, ingredient.adjustment);
  if (!ruc.ok) return { ok: false, ingredient_id: id, error: ruc.error };

  return {
    ok: true,
    ingredient_id: id,
    original_unit_cost: ouc,
    recipe_quantity: rq.value,
    recipe_unit_cost: ruc.value,
    recipe_uom: ingredient.recipe_uom,
  };
}
