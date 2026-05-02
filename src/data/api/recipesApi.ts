// Recipes API — Build 1.3.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import type {
  ApiError,
  IngredientCostStateRow,
  IngredientWithCostState,
  RecipeInput,
  RecipeLineCost,
  RecipeLineInput,
  RecipeLineRow,
  RecipeMetrics,
  RecipePatch,
  RecipeRow,
  RecipeWithLines,
} from "./types";
import { upsertIngredientCostState } from "./ingredientsApi";
import { convertQuantity } from "@/lib/units";
import { computeGP, computeGPM, isOnTarget } from "@/lib/margin";
import type { UoM } from "@/lib/types";

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "23505" || /duplicate key/i.test(raw))
    return { code: "duplicate", message: "A recipe with that name already exists." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission to perform this action." };
  if (code === "23503" || /violates foreign key|still referenced/i.test(raw))
    return { code: "validation", message: "Cannot remove — this item is still referenced by other data." };
  if (/required|must be|invalid/i.test(raw))
    return { code: "validation", message: raw || "Invalid input." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getRecipes(restaurantId: string): Promise<RecipeWithLines[]> {
  const { data: rows, error } = await supabase
    .from("recipes")
    .select("*, menu_categories:menu_category_id(name)")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (error) throw toApiError(error);

  const { data: lineRows } = await supabase
    .from("recipe_lines")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  const linesByRecipe = new Map<string, RecipeLineRow[]>();
  for (const l of (lineRows ?? []) as unknown as RecipeLineRow[]) {
    const arr = linesByRecipe.get(l.recipe_id) ?? [];
    arr.push(l);
    linesByRecipe.set(l.recipe_id, arr);
  }

  return (rows ?? []).map((row: Record<string, unknown>) => {
    const catObj = row.menu_categories as { name: string } | null;
    const r = { ...row } as unknown as RecipeRow & { menu_categories?: unknown };
    delete r.menu_categories;
    return {
      ...(r as RecipeRow),
      lines: linesByRecipe.get(r.id) ?? [],
      category_name: catObj?.name ?? null,
    } satisfies RecipeWithLines;
  });
}

export async function getRecipeById(
  restaurantId: string,
  recipeId: string,
): Promise<RecipeWithLines | null> {
  const { data: row, error } = await supabase
    .from("recipes")
    .select("*, menu_categories:menu_category_id(name)")
    .eq("restaurant_id", restaurantId)
    .eq("id", recipeId)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!row) return null;

  const { data: lineRows } = await supabase
    .from("recipe_lines")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  const catObj = (row as Record<string, unknown>).menu_categories as { name: string } | null;
  const r = { ...row } as Record<string, unknown>;
  delete r.menu_categories;

  return {
    ...(r as unknown as RecipeRow),
    lines: ((lineRows ?? []) as unknown as RecipeLineRow[]),
    category_name: catObj?.name ?? null,
  };
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createRecipe(
  restaurantId: string,
  input: RecipeInput,
): Promise<RecipeRow> {
  const name = input.name.trim();
  if (!name) throw { code: "validation", message: "Recipe name is required." } as ApiError;

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      restaurant_id: restaurantId,
      name,
      kind: input.kind,
      menu_category_id: input.menu_category_id ?? null,
      serving_quantity: input.serving_quantity,
      serving_uom_code: input.serving_uom_code,
      menu_price: input.kind === "dish" ? (input.menu_price ?? null) : null,
      linked_intermediate_ingredient_id:
        input.kind === "intermediate" ? (input.linked_intermediate_ingredient_id ?? null) : null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as unknown as RecipeRow;
}

export async function updateRecipe(
  restaurantId: string,
  recipeId: string,
  patch: RecipePatch,
): Promise<RecipeRow> {
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) throw { code: "validation", message: "Recipe name is required." } as ApiError;
    patch = { ...patch, name: t };
  }
  const { data, error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("id", recipeId)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as unknown as RecipeRow;
}

export async function deactivateRecipe(
  restaurantId: string,
  recipeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({ is_active: false })
    .eq("id", recipeId)
    .eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

// ── Recipe Lines ─────────────────────────────────────────────────────

export async function replaceRecipeLines(
  restaurantId: string,
  recipeId: string,
  lines: RecipeLineInput[],
): Promise<RecipeLineRow[]> {
  // Delete existing lines
  const { error: delErr } = await supabase
    .from("recipe_lines")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("restaurant_id", restaurantId);
  if (delErr) throw toApiError(delErr);

  if (lines.length === 0) return [];

  // Insert new lines
  const { data, error: insErr } = await supabase
    .from("recipe_lines")
    .insert(
      lines.map((l, idx) => ({
        restaurant_id: restaurantId,
        recipe_id: recipeId,
        ingredient_id: l.ingredient_id,
        quantity: l.quantity,
        uom_code: l.uom_code,
        sort_order: l.sort_order ?? idx * 10,
        notes: l.notes?.trim() || null,
      })),
    )
    .select("*")
    .order("sort_order", { ascending: true });
  if (insErr) throw toApiError(insErr);
  return (data ?? []) as unknown as RecipeLineRow[];
}

// ── Cost Calculation ─────────────────────────────────────────────────

export function calculateRecipeMetrics(
  recipe: RecipeRow,
  lines: RecipeLineRow[],
  ingredients: IngredientWithCostState[],
  targetGpm: number,
): RecipeMetrics {
  const lineCosts: RecipeLineCost[] = [];
  const errors: string[] = [];
  let cogs = 0;

  for (const line of lines) {
    const ing = ingredients.find((i) => i.id === line.ingredient_id);
    if (!ing) {
      lineCosts.push({
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        ingredient_name: "Unknown",
        qty_in_recipe_uom: 0,
        unit_cost: 0,
        line_cost: 0,
        error: "Ingredient not found.",
      });
      errors.push(`Line references unknown ingredient ${line.ingredient_id}.`);
      continue;
    }

    const cs = ing.cost_state;
    if (!cs || cs.recipe_unit_cost == null) {
      lineCosts.push({
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        ingredient_name: ing.name,
        qty_in_recipe_uom: 0,
        unit_cost: 0,
        line_cost: 0,
        error: cs?.calculation_error ?? "No cost state available.",
      });
      errors.push(`${ing.name}: no recipe_unit_cost available.`);
      continue;
    }

    const lineUom = line.uom_code as UoM;
    const ingUom = (ing.recipe_uom_code ?? line.uom_code) as UoM;
    let qtyConverted = Number(line.quantity);

    if (lineUom !== ingUom) {
      const conv = convertQuantity(
        Number(line.quantity),
        lineUom,
        ingUom,
        ing.density_g_per_ml ?? undefined,
      );
      if (!conv.ok) {
        lineCosts.push({
          line_id: line.id,
          ingredient_id: line.ingredient_id,
          ingredient_name: ing.name,
          qty_in_recipe_uom: 0,
          unit_cost: Number(cs.recipe_unit_cost),
          line_cost: 0,
          error: conv.error,
        });
        errors.push(`${ing.name}: ${conv.error}`);
        continue;
      }
      qtyConverted = conv.value;
    }

    const unitCost = Number(cs.recipe_unit_cost);
    const lineCost = qtyConverted * unitCost;

    if (!isFinite(lineCost)) {
      lineCosts.push({
        line_id: line.id,
        ingredient_id: line.ingredient_id,
        ingredient_name: ing.name,
        qty_in_recipe_uom: qtyConverted,
        unit_cost: unitCost,
        line_cost: 0,
        error: "Line cost is not finite.",
      });
      errors.push(`${ing.name}: non-finite line cost.`);
      continue;
    }

    lineCosts.push({
      line_id: line.id,
      ingredient_id: line.ingredient_id,
      ingredient_name: ing.name,
      qty_in_recipe_uom: qtyConverted,
      unit_cost: unitCost,
      line_cost: lineCost,
      error: null,
    });
    cogs += lineCost;
  }

  const servQty = Number(recipe.serving_quantity);
  const costPerServing = servQty > 0 ? cogs / servQty : 0;
  const menuPrice = recipe.menu_price != null ? Number(recipe.menu_price) : null;

  const gp = menuPrice != null && menuPrice > 0 ? computeGP(menuPrice, costPerServing) : null;
  const gpm = menuPrice != null && menuPrice > 0 ? computeGPM(menuPrice, costPerServing) : null;
  const onTarget = gpm != null ? isOnTarget(gpm, targetGpm) : null;
  const suggestedMenuPrice =
    targetGpm > 0 && targetGpm < 1 && costPerServing > 0
      ? costPerServing / (1 - targetGpm)
      : null;

  return { cogs, cost_per_serving: costPerServing, gp, gpm, on_target: onTarget, suggested_menu_price: suggestedMenuPrice, line_costs: lineCosts, errors };
}

// ── Intermediate Propagation ─────────────────────────────────────────

export async function updateLinkedIntermediateIngredientCostState(
  restaurantId: string,
  recipe: RecipeRow,
  metrics: RecipeMetrics,
): Promise<void> {
  if (recipe.kind !== "intermediate" || !recipe.linked_intermediate_ingredient_id) return;

  if (metrics.errors.length > 0) {
    await upsertIngredientCostState(restaurantId, recipe.linked_intermediate_ingredient_id, {
      cost_source: "error",
      original_unit_cost: null,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: `Recipe "${recipe.name}" has errors: ${metrics.errors[0]}`,
    });
    return;
  }

  await upsertIngredientCostState(restaurantId, recipe.linked_intermediate_ingredient_id, {
    cost_source: "calculated",
    original_unit_cost: null,
    recipe_quantity: Number(recipe.serving_quantity),
    recipe_unit_cost: metrics.cost_per_serving,
    calculation_status: "valid",
    calculation_error: null,
  });
}

// ── Cycle Detection ──────────────────────────────────────────────────

export function detectCycle(
  recipeId: string,
  lineIngredientIds: string[],
  allRecipes: RecipeWithLines[],
  allIngredients: IngredientWithCostState[],
): string | null {
  // Build a map: intermediate ingredient id → recipe that produces it
  const producerMap = new Map<string, RecipeWithLines>();
  for (const r of allRecipes) {
    if (r.kind === "intermediate" && r.linked_intermediate_ingredient_id && r.is_active) {
      producerMap.set(r.linked_intermediate_ingredient_id, r);
    }
  }

  // Check if any line ingredient eventually leads back to this recipe
  const visited = new Set<string>();

  function walk(ingredientId: string): boolean {
    if (visited.has(ingredientId)) return false;
    visited.add(ingredientId);

    const ing = allIngredients.find((i) => i.id === ingredientId);
    if (!ing || ing.type !== "intermediate") return false;

    const producer = producerMap.get(ingredientId);
    if (!producer) return false;
    if (producer.id === recipeId) return true; // cycle!

    for (const line of producer.lines) {
      if (walk(line.ingredient_id)) return true;
    }
    return false;
  }

  for (const ingId of lineIngredientIds) {
    visited.clear();
    if (walk(ingId)) {
      const ing = allIngredients.find((i) => i.id === ingId);
      return `Circular dependency detected through ingredient "${ing?.name ?? ingId}".`;
    }
  }

  return null;
}
