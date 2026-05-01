// Recipe COGS helpers — pure, frontend-only.

import type { Ingredient, Recipe, RecipeLine } from "./types";
import { convertQuantity } from "./units";
import {
  computeIngredientCostState,
  type IngredientCostState,
} from "./ingredientCost";

export interface LineCostOk {
  ok: true;
  line_id: string;
  ingredient_id: string;
  qty_in_recipe_uom: number;
  unit_cost: number;
  line_cost: number;
}
export interface LineCostErr {
  ok: false;
  line_id: string;
  ingredient_id: string;
  error: string;
}
export type LineCostResult = LineCostOk | LineCostErr;

export function computeRecipeLineCost(
  line: RecipeLine,
  ingredient: Ingredient,
  costState: IngredientCostState,
): LineCostResult {
  if (!Number.isFinite(line.qty) || line.qty <= 0)
    return {
      ok: false,
      line_id: line.id,
      ingredient_id: line.ingredient_id,
      error: "Line qty must be > 0.",
    };
  if (!costState.ok)
    return {
      ok: false,
      line_id: line.id,
      ingredient_id: line.ingredient_id,
      error: costState.error,
    };

  // Convert line qty to ingredient's recipe_uom if needed
  let qtyInRecipeUom = line.qty;
  if (line.uom !== costState.recipe_uom) {
    const c = convertQuantity(line.qty, line.uom, costState.recipe_uom, ingredient.density_g_per_ml);
    if (!c.ok) {
      return {
        ok: false,
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        error: c.error,
      };
    }
    qtyInRecipeUom = c.value;
  }

  const lineCost = qtyInRecipeUom * costState.recipe_unit_cost;
  return {
    ok: true,
    line_id: line.id,
    ingredient_id: line.ingredient_id,
    qty_in_recipe_uom: qtyInRecipeUom,
    unit_cost: costState.recipe_unit_cost,
    line_cost: lineCost,
  };
}

export interface RecipeCogsResult {
  cogs: number;
  cost_per_serving: number;
  lines: LineCostResult[];
  errors: string[];
}

export function computeRecipeCOGS(
  recipe: Recipe,
  ingredients: Ingredient[],
  costStates: Map<string, IngredientCostState>,
): RecipeCogsResult {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const errors: string[] = [];
  const lineResults: LineCostResult[] = [];
  let cogs = 0;

  for (const line of recipe.lines) {
    const ing = ingById.get(line.ingredient_id);
    if (!ing) {
      const e = `Ingredient ${line.ingredient_id} not found for line ${line.id}.`;
      errors.push(e);
      lineResults.push({
        ok: false,
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        error: e,
      });
      continue;
    }
    const cs = costStates.get(line.ingredient_id);
    if (!cs) {
      const e = `Cost state missing for ingredient ${line.ingredient_id}.`;
      errors.push(e);
      lineResults.push({
        ok: false,
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        error: e,
      });
      continue;
    }
    const lc = computeRecipeLineCost(line, ing, cs);
    lineResults.push(lc);
    if (lc.ok) cogs += lc.line_cost;
    else errors.push(lc.error);
  }

  const cps = computeCostPerServing(cogs, recipe.serving_qty);

  return { cogs, cost_per_serving: cps, lines: lineResults, errors };
}

export function computeCostPerServing(cogs: number, serving_qty: number): number {
  if (!Number.isFinite(serving_qty) || serving_qty <= 0) return 0;
  if (!Number.isFinite(cogs)) return 0;
  return cogs / serving_qty;
}

/**
 * Resolve Intermediate ingredient costs from their linked Intermediate recipes.
 * Detects circular dependencies. Returns a Map<ingredient_id, IngredientCostState>
 * for ALL ingredients (Primary, Fixed, Intermediate).
 */
export function resolveIntermediateRecipeCosts(
  recipes: Recipe[],
  ingredients: Ingredient[],
): { costStates: Map<string, IngredientCostState>; errors: string[] } {
  const errors: string[] = [];
  const costStates = new Map<string, IngredientCostState>();
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const ingById = new Map(ingredients.map((i) => [i.id, i]));

  // Seed Primary + Fixed first (no dependencies)
  for (const ing of ingredients) {
    if (ing.type === "Primary" || ing.type === "Fixed") {
      costStates.set(ing.id, computeIngredientCostState(ing));
    }
  }

  // Resolve Intermediate ingredients with cycle detection
  const visiting = new Set<string>();
  const resolved = new Set<string>();

  function resolve(ingId: string): IngredientCostState {
    const cached = costStates.get(ingId);
    if (cached && resolved.has(ingId)) return cached;
    const ing = ingById.get(ingId);
    if (!ing) {
      const cs: IngredientCostState = {
        ok: false,
        ingredient_id: ingId,
        error: `Ingredient ${ingId} not found.`,
      };
      costStates.set(ingId, cs);
      return cs;
    }
    if (ing.type !== "Intermediate") {
      const cs = costStates.get(ingId) ?? computeIngredientCostState(ing);
      costStates.set(ingId, cs);
      resolved.add(ingId);
      return cs;
    }
    if (visiting.has(ingId)) {
      const e = `Circular intermediate dependency detected at ${ing.name} (${ingId}).`;
      errors.push(e);
      const cs: IngredientCostState = { ok: false, ingredient_id: ingId, error: e };
      costStates.set(ingId, cs);
      return cs;
    }
    visiting.add(ingId);

    const linkedRecipeId = ing.linked_recipe_id;
    if (!linkedRecipeId) {
      visiting.delete(ingId);
      const cs = computeIngredientCostState(ing); // fallback to stored
      costStates.set(ingId, cs);
      resolved.add(ingId);
      return cs;
    }
    const recipe = recipeById.get(linkedRecipeId);
    if (!recipe) {
      visiting.delete(ingId);
      const e = `Linked recipe ${linkedRecipeId} not found for intermediate ${ing.name}.`;
      errors.push(e);
      const cs: IngredientCostState = { ok: false, ingredient_id: ingId, error: e };
      costStates.set(ingId, cs);
      return cs;
    }

    // Resolve any nested Intermediate dependencies first
    for (const line of recipe.lines) {
      const child = ingById.get(line.ingredient_id);
      if (child && child.type === "Intermediate" && !resolved.has(child.id)) {
        resolve(child.id);
      }
    }

    const cogsResult = computeRecipeCOGS(recipe, ingredients, costStates);
    const perUnit = computeCostPerServing(cogsResult.cogs, recipe.serving_qty);

    visiting.delete(ingId);
    resolved.add(ingId);

    const cs: IngredientCostState = {
      ok: true,
      ingredient_id: ingId,
      original_unit_cost: perUnit,
      recipe_quantity: recipe.serving_qty,
      recipe_unit_cost: perUnit,
      recipe_uom: recipe.serving_uom,
    };
    costStates.set(ingId, cs);
    return cs;
  }

  for (const ing of ingredients) {
    if (ing.type === "Intermediate") resolve(ing.id);
  }

  return { costStates, errors };
}
