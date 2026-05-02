// Ingredients API — Build 1.2.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import type {
  ApiError,
  CostSource,
  CostStatus,
  IngredientCostStateRow,
  IngredientInput,
  IngredientPatch,
  IngredientRow,
  IngredientWithCostState,
} from "./types";
import {
  computeOriginalUnitCost,
  computeRecipeQuantity,
  computeRecipeUnitCost,
} from "@/lib/ingredientCost";
import type { UoM } from "@/lib/types";

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "23505" || /duplicate key/i.test(raw))
    return { code: "duplicate", message: "An ingredient with that name already exists." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission to perform this action." };
  if (/required|must be|invalid/i.test(raw))
    return { code: "validation", message: raw || "Invalid input." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getIngredients(
  restaurantId: string,
): Promise<IngredientWithCostState[]> {
  const { data: rows, error } = await supabase
    .from("ingredients")
    .select("*, suppliers:supplier_id(name)")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (error) throw toApiError(error);

  const { data: costRows } = await supabase
    .from("ingredient_cost_state")
    .select("*")
    .eq("restaurant_id", restaurantId);

  const costMap = new Map(
    (costRows ?? []).map((c) => [
      (c as unknown as IngredientCostStateRow).ingredient_id,
      c as unknown as IngredientCostStateRow,
    ]),
  );

  return (rows ?? []).map((row: Record<string, unknown>) => {
    const supplierObj = row.suppliers as { name: string } | null;
    const r = { ...row } as unknown as IngredientRow & { suppliers?: unknown };
    delete r.suppliers;
    return {
      ...(r as IngredientRow),
      cost_state: costMap.get(r.id) ?? null,
      supplier_name: supplierObj?.name ?? null,
    } satisfies IngredientWithCostState;
  });
}

export async function getIngredientById(
  restaurantId: string,
  ingredientId: string,
): Promise<IngredientWithCostState | null> {
  const { data: row, error } = await supabase
    .from("ingredients")
    .select("*, suppliers:supplier_id(name)")
    .eq("restaurant_id", restaurantId)
    .eq("id", ingredientId)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!row) return null;

  const { data: costRow } = await supabase
    .from("ingredient_cost_state")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .maybeSingle();

  const supplierObj = (row as Record<string, unknown>).suppliers as { name: string } | null;
  const r = { ...row } as Record<string, unknown>;
  delete r.suppliers;

  return {
    ...(r as unknown as IngredientRow),
    cost_state: (costRow as unknown as IngredientCostStateRow | null) ?? null,
    supplier_name: supplierObj?.name ?? null,
  };
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createIngredient(
  restaurantId: string,
  input: IngredientInput,
): Promise<IngredientRow> {
  const name = input.name.trim();
  if (!name) throw { code: "validation", message: "Ingredient name is required." } as ApiError;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({
      restaurant_id: restaurantId,
      name,
      type: input.type,
      supplier_id: input.supplier_id ?? null,
      total_cost: input.total_cost ?? null,
      original_quantity: input.original_quantity ?? null,
      original_uom_code: input.original_uom_code ?? null,
      conversion_on: input.conversion_on ?? true,
      recipe_uom_code: input.recipe_uom_code ?? null,
      adjustment: input.adjustment ?? 0,
      density_g_per_ml: input.density_g_per_ml ?? null,
      manual_recipe_unit_cost: input.manual_recipe_unit_cost ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as IngredientRow;
}

export async function updateIngredient(
  restaurantId: string,
  ingredientId: string,
  patch: IngredientPatch,
): Promise<IngredientRow> {
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) throw { code: "validation", message: "Ingredient name is required." } as ApiError;
    patch = { ...patch, name: t };
  }
  const { data, error } = await supabase
    .from("ingredients")
    .update(patch)
    .eq("id", ingredientId)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as IngredientRow;
}

export async function deactivateIngredient(
  restaurantId: string,
  ingredientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ingredients")
    .update({ is_active: false })
    .eq("id", ingredientId)
    .eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
}

// ── Cost State ───────────────────────────────────────────────────────

export function calculateCostState(
  ingredient: IngredientRow,
): Omit<IngredientCostStateRow, "ingredient_id" | "restaurant_id" | "last_calculated_at"> {
  // Fixed → manual cost
  if (ingredient.type === "fixed") {
    const ruc = ingredient.manual_recipe_unit_cost;
    if (ruc == null || ruc < 0) {
      return {
        cost_source: "error",
        original_unit_cost: null,
        recipe_quantity: null,
        recipe_unit_cost: null,
        calculation_status: "error",
        calculation_error: "Fixed ingredient requires a non-negative manual recipe unit cost.",
      };
    }
    return {
      cost_source: "manual",
      original_unit_cost: null,
      recipe_quantity: null,
      recipe_unit_cost: ruc,
      calculation_status: "valid",
      calculation_error: null,
    };
  }

  // Intermediate → pending until Build 1.3 recipes
  if (ingredient.type === "intermediate") {
    return {
      cost_source: "intermediate_pending",
      original_unit_cost: null,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "pending",
      calculation_error: "Intermediate cost will be calculated from recipes in Build 1.3.",
    };
  }

  // Primary → full calculation
  const tc = ingredient.total_cost;
  const oq = ingredient.original_quantity;
  if (tc == null || oq == null || oq <= 0) {
    return {
      cost_source: "error",
      original_unit_cost: null,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: "Primary ingredient requires total cost and original quantity > 0.",
    };
  }

  const oucResult = computeOriginalUnitCost(tc, oq);
  if (typeof oucResult !== "number") {
    return {
      cost_source: "error",
      original_unit_cost: null,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: oucResult.error,
    };
  }

  const fromUom = ingredient.original_uom_code as UoM | null;
  const toUom = ingredient.recipe_uom_code as UoM | null;
  if (!fromUom || !toUom) {
    return {
      cost_source: "error",
      original_unit_cost: oucResult,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: "Original UoM and Recipe UoM are required.",
    };
  }

  const rqResult = computeRecipeQuantity(
    oq,
    fromUom,
    toUom,
    ingredient.conversion_on,
    ingredient.density_g_per_ml ?? undefined,
  );
  if (!rqResult.ok) {
    return {
      cost_source: "error",
      original_unit_cost: oucResult,
      recipe_quantity: null,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: rqResult.error,
    };
  }

  const rucResult = computeRecipeUnitCost(tc, rqResult.value, ingredient.adjustment);
  if (!rucResult.ok) {
    return {
      cost_source: "error",
      original_unit_cost: oucResult,
      recipe_quantity: rqResult.value,
      recipe_unit_cost: null,
      calculation_status: "error",
      calculation_error: rucResult.error,
    };
  }

  return {
    cost_source: "calculated",
    original_unit_cost: oucResult,
    recipe_quantity: rqResult.value,
    recipe_unit_cost: rucResult.value,
    calculation_status: "valid",
    calculation_error: null,
  };
}

export async function upsertIngredientCostState(
  restaurantId: string,
  ingredientId: string,
  state: Omit<IngredientCostStateRow, "ingredient_id" | "restaurant_id" | "last_calculated_at">,
): Promise<void> {
  const { error } = await supabase
    .from("ingredient_cost_state")
    .upsert(
      {
        ingredient_id: ingredientId,
        restaurant_id: restaurantId,
        ...state,
        last_calculated_at: new Date().toISOString(),
      },
      { onConflict: "ingredient_id" },
    );
  if (error) throw toApiError(error);
}

export async function getIngredientCostStates(
  restaurantId: string,
): Promise<IngredientCostStateRow[]> {
  const { data, error } = await supabase
    .from("ingredient_cost_state")
    .select("*")
    .eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as IngredientCostStateRow[];
}
