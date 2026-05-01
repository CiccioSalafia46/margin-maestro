// Build 1.0 — Auth + tenant API types.
// Only auth/tenant entities live here. Operational data remains mock for now.

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
