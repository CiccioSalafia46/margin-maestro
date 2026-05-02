// Build 1.1 — Auth + tenant + settings/admin reference API types.
// Operational data (ingredients/recipes/etc.) remains mock for now.

export type RestaurantRole = "owner" | "manager" | "viewer";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantMembership {
  restaurant: Restaurant;
  role: RestaurantRole;
}

export interface RestaurantSettingsRow {
  restaurant_id: string;
  currency_code: string;
  locale: string;
  target_gpm: number;
  tax_mode: "ex_tax" | "inc_tax";
  timezone: string;
  ingredient_spike_threshold_percent: number;
  gpm_drop_threshold_percent: number;
  gp_floor_amount: number | null;
}

export type UnitFamily = "mass" | "volume" | "count";

export interface UnitRow {
  code: string;
  label: string;
  family: UnitFamily;
  base_unit_code: string | null;
  to_base_factor: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface UnitConversionRow {
  id: string;
  from_unit_code: string;
  to_unit_code: string;
  factor: number;
  requires_density: boolean;
  is_active: boolean;
}

export interface MenuCategoryRow {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierRow {
  id: string;
  restaurant_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SettingsPatch = Partial<{
  currency_code: string;
  locale: string;
  target_gpm: number;
  tax_mode: "ex_tax" | "inc_tax";
  timezone: string;
  ingredient_spike_threshold_percent: number;
  gpm_drop_threshold_percent: number;
  gp_floor_amount: number | null;
}>;

export interface ApiError {
  code: "auth" | "permission" | "duplicate" | "validation" | "not_found" | "unknown";
  message: string;
}
