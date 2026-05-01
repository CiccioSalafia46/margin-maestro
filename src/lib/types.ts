// Core domain types for the Margin Intelligence platform.
// Mock-only for Build 0.1 — no backend, no persistence.

export type UoM = "Ct" | "Gr" | "Kg" | "Lb" | "Oz" | "Gl" | "Lt" | "Ml";

export type IngredientType = "Primary" | "Intermediate" | "Fixed";
export type RecipeType = "Intermediate" | "Dish";

export interface Ingredient {
  id: string;
  name: string;
  type: IngredientType;
  supplier: string | null;
  original_qty: number;
  original_uom: UoM;
  total_cost: number; // USD
  recipe_uom: UoM;
  adjustment: number; // -1 < adjustment, e.g. -0.1 trim, +0.05 hydration
  conversion_on: boolean;
  density_g_per_ml?: number;
  // Derived (precomputed for mock display, recomputed via helpers in real use):
  recipe_unit_cost: number; // USD per recipe_uom
  last_change_pct: number | null; // last price change %, signed
  spike: boolean;
  linked_recipe_id?: string; // for Intermediate ingredients
}

export interface RecipeLine {
  id: string;
  ingredient_id: string;
  qty: number;
  uom: UoM;
}

export interface Recipe {
  id: string;
  name: string;
  type: RecipeType;
  category: string; // e.g., "Pasta", "Pizza", "Antipasti", "Secondi", "Base"
  serving_qty: number;
  serving_uom: UoM;
  menu_price: number | null; // null/0 => "Set menu price"
  on_menu: boolean;
  lines: RecipeLine[];
  linked_ingredient_id?: string; // for Intermediate recipes
  estimated_monthly_units_sold?: number; // demo data: drives Profit-at-Risk if present
}

// Prior confirmed cost snapshot for an ingredient. Used to compute deltas
// (COGS, GP, GPM) for derived menu analytics, without mutating live state.
export interface IngredientSnapshot {
  ingredient_id: string;
  unit_cost: number; // cost in the ingredient's recipe_uom
  taken_at: string; // ISO
  baseline_version: number;
}

export type PriceLogEvent = "baseline" | "change";

export interface PriceLogEntry {
  id: string;
  timestamp: string; // ISO
  batch_id: string;
  ingredient_id: string;
  name_at_time: string;
  supplier_at_time: string | null;
  old_unit_cost: number | null;
  new_unit_cost: number;
  delta: number; // new - old
  pct_change: number | null; // (new-old)/old
  event: PriceLogEvent;
  baseline_version: number;
  notes?: string;
}

export interface PriceBatch {
  id: string;
  label: string;
  created_at: string;
  ingredients_changed: number;
  dishes_affected: number;
  dishes_newly_below_target: number;
  total_margin_impact_usd: number; // signed (negative = profit lost)
}

export interface CascadeAffectedDish {
  recipe_id: string;
  recipe_name: string;
  old_cogs: number;
  new_cogs: number;
  delta_cogs: number;
  menu_price: number;
  old_gpm: number;
  new_gpm: number;
  delta_gpm: number; // pp as fraction
  suggested_menu_price: number;
  status: "below_target" | "on_target";
}

export interface CascadeIngredientGroup {
  ingredient_id: string;
  ingredient_name: string;
  old_unit_cost: number;
  new_unit_cost: number;
  delta: number;
  pct_change: number;
  affected_dishes: CascadeAffectedDish[];
}

export interface ImpactCascadeRun {
  batch_id: string;
  created_at: string;
  ingredients_changed: number;
  dishes_affected: number;
  dishes_newly_below_target: number;
  total_margin_impact_usd: number;
  groups: CascadeIngredientGroup[];
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType =
  | "dish_below_target"
  | "ingredient_spike"
  | "dish_needs_price_review"
  | "intermediate_cost_shift";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  status: AlertStatus;
  title: string;
  summary: string;
  affected_recipe_id?: string;
  affected_ingredient_id?: string;
  created_at: string;
}

export interface RestaurantSettings {
  restaurant_name: string;
  currency: "USD";
  locale: "en-US";
  target_gpm: number; // 0..1
  tax_mode: "ex_tax" | "inc_tax";
  units: UoM[];
}
