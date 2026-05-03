// Apply Price API — Build 2.4.
// Updates recipe menu_price only. Does not write price log, snapshots, or billing.

import { supabase } from "./supabaseClient";
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

export async function applyDishMenuPrice(
  restaurantId: string,
  recipeId: string,
  newMenuPrice: number,
): Promise<void> {
  const err = validateApplyPriceInput(newMenuPrice);
  if (err) throw { code: "validation", message: err } as ApiError;

  const { error } = await supabase
    .from("recipes")
    .update({ menu_price: newMenuPrice })
    .eq("id", recipeId)
    .eq("restaurant_id", restaurantId);
  if (error) throw toApiError(error);
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
