// Apply Price API — Build 2.4, atomic via RPC since Build 3.4.
// Updates a dish recipe's menu_price AND inserts the corresponding
// menu_price_audit_log row in one server-side SQL function call, so the price
// update and the audit row succeed or fail together.
//
// Build 3.4 RPC: public.apply_dish_menu_price_with_audit(...).
// Does NOT write ingredient_price_log, does NOT create price_update_batches,
// does NOT create billing rows, and does NOT publish to a POS.

import { supabase } from "./supabaseClient";
import type { ApiError, RestaurantRole } from "./types";

function toApiError(e: unknown): ApiError {
  const raw = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? "") : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security|requires owner or manager/i.test(raw)) {
    return { code: "permission", message: "You don't have permission." };
  }
  if (/recipe not found/i.test(raw)) return { code: "not_found", message: "Recipe not found." };
  if (/must be greater than zero/i.test(raw)) return { code: "validation", message: "Price must be greater than zero." };
  if (/only valid for dish/i.test(raw)) return { code: "validation", message: "Apply Price is only available for dish recipes." };
  if (/recipe is inactive/i.test(raw)) return { code: "validation", message: "This dish is inactive." };
  if (/invalid source/i.test(raw)) return { code: "validation", message: "Invalid audit source." };
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
  /** Always true on success since Build 3.4: the RPC writes both atomically. */
  audit_recorded: boolean;
  /** Reserved for future fallback paths; unused with the atomic RPC. */
  audit_error?: string;
  /** The previous menu_price (may be null if recipe had no prior price). */
  old_menu_price: number | null;
  /** The new menu_price persisted on the recipe. */
  new_menu_price: number;
  /** Audit row id (Build 3.4). */
  audit_log_id?: string;
  /** Server-side timestamp of the atomic write (Build 3.4). */
  changed_at?: string;
}

export async function applyDishMenuPrice(
  restaurantId: string,
  recipeId: string,
  newMenuPrice: number,
  context: ApplyPriceContext = {},
): Promise<ApplyPriceResult> {
  const err = validateApplyPriceInput(newMenuPrice);
  if (err) throw { code: "validation", message: err } as ApiError;

  // Build a JSON-safe context payload. Undefined values become null so the
  // audit row's jsonb column stores them as keys with null values rather than
  // dropping them silently.
  const contextPayload = {
    origin: context.origin ?? null,
    target_gpm: context.target_gpm ?? null,
    cost_per_serving: context.cost_per_serving ?? null,
    suggested_price: context.suggested_price ?? null,
    reason: context.reason ?? null,
  };

  const { data, error } = await supabase.rpc("apply_dish_menu_price_with_audit", {
    p_restaurant_id: restaurantId,
    p_recipe_id: recipeId,
    p_new_menu_price: newMenuPrice,
    p_source: "apply_price",
    p_note: null,
    p_context: contextPayload as never,
  });

  if (error) throw toApiError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw { code: "unknown", message: "Atomic apply price returned no row." } as ApiError;

  return {
    audit_recorded: true,
    old_menu_price: (row as { old_menu_price: number | null }).old_menu_price ?? null,
    new_menu_price: newMenuPrice,
    audit_log_id: (row as { audit_log_id: string }).audit_log_id,
    changed_at: (row as { changed_at: string }).changed_at,
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
