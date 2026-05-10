// Menu Price Audit Trail API — Build 2.9.
// Append-only audit of dish recipe menu_price changes. Browser client + RLS only.
// This is NOT ingredient_price_log (supplier prices) and NOT POS publishing.

import { supabase } from "./supabaseClient";
import type {
  ApiError,
  MenuPriceAuditInput,
  MenuPriceAuditLogRow,
  MenuPriceAuditSource,
  MenuPriceAuditSummary,
} from "./types";

const VALID_SOURCES: ReadonlyArray<MenuPriceAuditSource> = [
  "apply_price",
  "manual_recipe_edit",
  "import",
  "system",
  "other",
];

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated"))
    return { code: "auth", message: "Please sign in again." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission." };
  if (code === "23505") return { code: "duplicate", message: "Duplicate audit entry." };
  if (/violates check constraint/i.test(raw))
    return { code: "validation", message: "Audit entry rejected by validation." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

export function validateMenuPriceAuditInput(input: MenuPriceAuditInput): string | null {
  if (!input.restaurant_id) return "restaurant_id is required.";
  if (!input.recipe_name_at_time?.trim()) return "recipe_name_at_time is required.";
  if (!isFinite(input.new_menu_price)) return "new_menu_price must be a finite number.";
  if (input.new_menu_price <= 0) return "new_menu_price must be greater than zero.";
  if (input.old_menu_price != null && !isFinite(input.old_menu_price))
    return "old_menu_price must be a finite number when provided.";
  if (!VALID_SOURCES.includes(input.source)) return "source is not a valid value.";
  return null;
}

function computeDeltas(
  oldPrice: number | null,
  newPrice: number,
): { delta_amount: number | null; delta_percent: number | null } {
  if (oldPrice == null || !isFinite(oldPrice)) return { delta_amount: null, delta_percent: null };
  const amount = newPrice - oldPrice;
  const percent = oldPrice > 0 ? amount / oldPrice : null;
  return {
    delta_amount: amount,
    delta_percent: percent != null && isFinite(percent) ? percent : null,
  };
}

export interface MenuPriceAuditFilters {
  recipe_id?: string;
  source?: MenuPriceAuditSource;
  since?: string;
  until?: string;
  limit?: number;
}

export async function getMenuPriceAuditLog(
  restaurantId: string,
  filters: MenuPriceAuditFilters = {},
): Promise<MenuPriceAuditLogRow[]> {
  let query = supabase
    .from("menu_price_audit_log")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("changed_at", { ascending: false });

  if (filters.recipe_id) query = query.eq("recipe_id", filters.recipe_id);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.since) query = query.gte("changed_at", filters.since);
  if (filters.until) query = query.lte("changed_at", filters.until);
  if (filters.limit && filters.limit > 0) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw toApiError(error);
  return (data ?? []) as unknown as MenuPriceAuditLogRow[];
}

export async function getMenuPriceAuditForRecipe(
  restaurantId: string,
  recipeId: string,
  limit = 50,
): Promise<MenuPriceAuditLogRow[]> {
  return getMenuPriceAuditLog(restaurantId, { recipe_id: recipeId, limit });
}

export async function createMenuPriceAuditEntry(
  input: MenuPriceAuditInput,
): Promise<MenuPriceAuditLogRow> {
  const err = validateMenuPriceAuditInput(input);
  if (err) throw { code: "validation", message: err } as ApiError;

  const { delta_amount, delta_percent } = computeDeltas(input.old_menu_price, input.new_menu_price);
  const { data: userData } = await supabase.auth.getUser();
  const changed_by = userData?.user?.id ?? null;

  const row = {
    restaurant_id: input.restaurant_id,
    recipe_id: input.recipe_id,
    recipe_name_at_time: input.recipe_name_at_time.trim(),
    recipe_kind_at_time: "dish",
    category_name_at_time: input.category_name_at_time ?? null,
    old_menu_price: input.old_menu_price,
    new_menu_price: input.new_menu_price,
    delta_amount,
    delta_percent,
    source: input.source,
    context: (input.context ?? null) as never,
    note: input.note ?? null,
    changed_by,
  };

  const { data, error } = await supabase
    .from("menu_price_audit_log")
    .insert(row)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as unknown as MenuPriceAuditLogRow;
}

export function deriveMenuPriceAuditSummary(
  entries: ReadonlyArray<MenuPriceAuditLogRow>,
): MenuPriceAuditSummary {
  if (entries.length === 0) {
    return {
      total_entries: 0,
      last_change_at: null,
      last_source: null,
      last_old_price: null,
      last_new_price: null,
      last_delta_amount: null,
      last_delta_percent: null,
    };
  }
  const sorted = [...entries].sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  const last = sorted[0];
  return {
    total_entries: entries.length,
    last_change_at: last.changed_at,
    last_source: last.source,
    last_old_price: last.old_menu_price,
    last_new_price: last.new_menu_price,
    last_delta_amount: last.delta_amount,
    last_delta_percent: last.delta_percent,
  };
}
