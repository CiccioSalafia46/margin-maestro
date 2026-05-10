// Apply Price API — Build 2.4 (audit integration added in Build 2.9).
// Updates recipe menu_price only. Does not write ingredient_price_log,
// price_update_batches, billing rows, or POS publishing.
// Build 2.9: after a successful menu_price update, an append-only
// menu_price_audit_log row is recorded with source = "apply_price".

import { supabase } from "./supabaseClient";
import { createMenuPriceAuditEntry } from "./menuPriceAuditApi";
import type { ApiError, RestaurantRole } from "./types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw)) return { code: "permission", message: "You don't have permission." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

export function canApplyPrice(role: RestaurantRole | null): boolean {
  return role === "owner" || role === "manager";
}

export function validateApplyPriceInput(newMenuPrice: number): string | null {
  if (!isFinite(newMenuPrice)) return "Price must be a finite number.";
  if (newMenuPrice <= 0) return "Price must be greater than zero.";
  return null;
}

export interface ApplyPriceContext {
  /** Where the apply was triggered from, e.g. "menu-analytics", "dish-analysis". */
  origin?: string;
  /** Target GPM used to derive the suggested price, when applicable. */
  target_gpm?: number;
  /** Cost per serving captured at the time of apply, for traceability. */
  cost_per_serving?: number;
  /** The price the UI suggested before the user confirmed. */
  suggested_price?: number;
  /** Free-form reason or scenario tag. */
  reason?: string;
}

export interface ApplyPriceResult {
  /** True when the menu_price_audit_log row was inserted successfully. */
  audit_recorded: boolean;
  /** Friendly message when audit insert failed; raw DB errors never leak here. */
  audit_error?: string;
  /** The previous menu_price (may be null if recipe had no price). */
  old_menu_price: number | null;
  /** The new menu_price persisted on the recipe. */
  new_menu_price: number;
}

interface RecipeReadback {
  id: string;
  restaurant_id: string;
  name: string;
  kind: string;
  is_active: boolean;
  menu_price: number | null;
  menu_category_id: string | null;
}

interface CategoryReadback {
  name: string | null;
}

export async function applyDishMenuPrice(
  restaurantId: string,
  recipeId: string,
  newMenuPrice: number,
  context: ApplyPriceContext = {},
): Promise<ApplyPriceResult> {
  const err = validateApplyPriceInput(newMenuPrice);
  if (err) throw { code: "validation", message: err } as ApiError;

  // 1. Read current recipe to capture old price + recipe-name-at-time + kind.
  const { data: existing, error: readError } = await supabase
    .from("recipes")
    .select("id, restaurant_id, name, kind, is_active, menu_price, menu_category_id")
    .eq("id", recipeId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (readError) throw toApiError(readError);
  if (!existing) throw { code: "not_found", message: "Recipe not found." } as ApiError;

  const recipe = existing as RecipeReadback;
  if (recipe.kind !== "dish")
    throw { code: "validation", message: "Apply Price is only available for dish recipes." } as ApiError;
  if (!recipe.is_active)
    throw { code: "validation", message: "This dish is inactive." } as ApiError;

  const oldMenuPrice = recipe.menu_price;

  // 2. Optionally read category name (best-effort, non-blocking on failure).
  let categoryName: string | null = null;
  if (recipe.menu_category_id) {
    const { data: cat } = await supabase
      .from("menu_categories")
      .select("name")
      .eq("id", recipe.menu_category_id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    categoryName = (cat as CategoryReadback | null)?.name ?? null;
  }

  // 3. Update menu_price.
  const { error: updateError } = await supabase
    .from("recipes")
    .update({ menu_price: newMenuPrice })
    .eq("id", recipeId)
    .eq("restaurant_id", restaurantId);
  if (updateError) throw toApiError(updateError);

  // 4. Best-effort audit insert. Failure here does NOT roll back the price update
  //    (client-orchestrated, not atomic) — the caller is told via ApplyPriceResult.
  let audit_recorded = true;
  let audit_error: string | undefined;
  try {
    await createMenuPriceAuditEntry({
      restaurant_id: restaurantId,
      recipe_id: recipeId,
      recipe_name_at_time: recipe.name,
      category_name_at_time: categoryName,
      old_menu_price: oldMenuPrice,
      new_menu_price: newMenuPrice,
      source: "apply_price",
      context: {
        origin: context.origin ?? null,
        target_gpm: context.target_gpm ?? null,
        cost_per_serving: context.cost_per_serving ?? null,
        suggested_price: context.suggested_price ?? null,
        reason: context.reason ?? null,
      },
    });
  } catch (e) {
    audit_recorded = false;
    const apiErr = e as ApiError | undefined;
    audit_error = apiErr?.message ?? "Audit entry could not be recorded.";
  }

  return {
    audit_recorded,
    audit_error,
    old_menu_price: oldMenuPrice,
    new_menu_price: newMenuPrice,
  };
}

export function deriveApplyPricePreview(
  currentMenuPrice: number | null,
  newMenuPrice: number,
  costPerServing: number,
  targetGpm: number,
): {
  current_gp: number | null;
  current_gpm: number | null;
  projected_gp: number;
  projected_gpm: number;
  price_delta: number | null;
  on_target: boolean;
} {
  const currentGp = currentMenuPrice != null && currentMenuPrice > 0 ? currentMenuPrice - costPerServing : null;
  const currentGpm = currentMenuPrice != null && currentMenuPrice > 0 ? (currentMenuPrice - costPerServing) / currentMenuPrice : null;
  const projectedGp = newMenuPrice - costPerServing;
  const projectedGpm = newMenuPrice > 0 ? projectedGp / newMenuPrice : 0;
  const priceDelta = currentMenuPrice != null ? newMenuPrice - currentMenuPrice : null;

  return {
    current_gp: currentGp,
    current_gpm: currentGpm,
    projected_gp: projectedGp,
    projected_gpm: projectedGpm,
    price_delta: priceDelta,
    on_target: projectedGpm >= targetGpm,
  };
}
