// Settings/Admin reference API — Build 1.1.
// All calls go through the browser Supabase client; RLS enforces tenant scoping.

import { supabase } from "./supabaseClient";
import type {
  ApiError,
  MenuCategoryRow,
  RestaurantSettingsRow,
  SettingsPatch,
  SupplierRow,
  UnitConversionRow,
  UnitRow,
} from "./types";

function toApiError(e: unknown): ApiError {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message ?? "")
      : String(e ?? "");
  const code = (e as { code?: string } | null)?.code;
  if (raw.includes("not authenticated")) return { code: "auth", message: "Please sign in again." };
  if (code === "23505" || /duplicate key/i.test(raw))
    return { code: "duplicate", message: "An entry with that name already exists." };
  if (code === "42501" || /permission denied|row-level security/i.test(raw))
    return { code: "permission", message: "You don't have permission to perform this action." };
  if (/required|must be|invalid/i.test(raw))
    return { code: "validation", message: raw || "Invalid input." };
  return { code: "unknown", message: raw || "Something went wrong." };
}

// ---------------- Restaurant settings ----------------
export async function getRestaurantSettings(
  restaurantId: string,
): Promise<RestaurantSettingsRow | null> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw toApiError(error);
  return (data as RestaurantSettingsRow | null) ?? null;
}

export async function updateRestaurantSettings(
  restaurantId: string,
  patch: SettingsPatch,
): Promise<RestaurantSettingsRow> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as RestaurantSettingsRow;
}

export async function updateRestaurantName(
  restaurantId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw { code: "validation", message: "Restaurant name is required." } as ApiError;
  const { error } = await supabase
    .from("restaurants")
    .update({ name: trimmed })
    .eq("id", restaurantId);
  if (error) throw toApiError(error);
}

// ---------------- Units / conversions ----------------
export async function getUnits(): Promise<UnitRow[]> {
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw toApiError(error);
  return (data ?? []) as UnitRow[];
}

export async function getUnitConversions(): Promise<UnitConversionRow[]> {
  const { data, error } = await supabase.from("unit_conversions").select("*");
  if (error) throw toApiError(error);
  return (data ?? []) as UnitConversionRow[];
}

// ---------------- Menu categories ----------------
export async function getMenuCategories(restaurantId: string): Promise<MenuCategoryRow[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw toApiError(error);
  return (data ?? []) as MenuCategoryRow[];
}

export async function createMenuCategory(
  restaurantId: string,
  input: { name: string; sort_order?: number },
): Promise<MenuCategoryRow> {
  const name = input.name.trim();
  if (!name) throw { code: "validation", message: "Category name is required." } as ApiError;
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({ restaurant_id: restaurantId, name, sort_order: input.sort_order ?? 0 })
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as MenuCategoryRow;
}

export async function updateMenuCategory(
  categoryId: string,
  patch: Partial<Pick<MenuCategoryRow, "name" | "sort_order" | "is_active">>,
): Promise<MenuCategoryRow> {
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) throw { code: "validation", message: "Category name is required." } as ApiError;
    patch = { ...patch, name: t };
  }
  const { data, error } = await supabase
    .from("menu_categories")
    .update(patch)
    .eq("id", categoryId)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as MenuCategoryRow;
}

// ---------------- Suppliers ----------------
export async function getSuppliers(restaurantId: string): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (error) throw toApiError(error);
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(
  restaurantId: string,
  input: { name: string; contact_name?: string; email?: string; phone?: string; notes?: string },
): Promise<SupplierRow> {
  const name = input.name.trim();
  if (!name) throw { code: "validation", message: "Supplier name is required." } as ApiError;
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      restaurant_id: restaurantId,
      name,
      contact_name: input.contact_name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as SupplierRow;
}

export async function updateSupplier(
  supplierId: string,
  patch: Partial<
    Pick<SupplierRow, "name" | "contact_name" | "email" | "phone" | "notes" | "is_active">
  >,
): Promise<SupplierRow> {
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) throw { code: "validation", message: "Supplier name is required." } as ApiError;
    patch = { ...patch, name: t };
  }
  const { data, error } = await supabase
    .from("suppliers")
    .update(patch)
    .eq("id", supplierId)
    .select("*")
    .single();
  if (error) throw toApiError(error);
  return data as SupplierRow;
}

// ---------------- Onboarding helper ----------------
export async function initializeRestaurantReferenceData(restaurantId: string): Promise<void> {
  const { error } = await supabase.rpc("initialize_restaurant_reference_data", {
    p_restaurant_id: restaurantId,
  });
  if (error) throw toApiError(error);
}
