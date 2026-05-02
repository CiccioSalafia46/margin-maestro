// Build 1.3 — Auth + tenant + settings/admin + ingredients + recipes API types.
// Menu analytics/price log/cascade/alerts remain mock for now.

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

// ---------------- Ingredients (Build 1.2) ----------------

export type IngredientType = "primary" | "intermediate" | "fixed";
export type CostSource = "calculated" | "manual" | "intermediate_pending" | "error";
export type CostStatus = "valid" | "warning" | "error" | "pending";

export interface IngredientRow {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  name: string;
  type: IngredientType;
  total_cost: number | null;
  original_quantity: number | null;
  original_uom_code: string | null;
  conversion_on: boolean;
  recipe_uom_code: string | null;
  adjustment: number;
  density_g_per_ml: number | null;
  manual_recipe_unit_cost: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientCostStateRow {
  ingredient_id: string;
  restaurant_id: string;
  cost_source: CostSource;
  original_unit_cost: number | null;
  recipe_quantity: number | null;
  recipe_unit_cost: number | null;
  calculation_status: CostStatus;
  calculation_error: string | null;
  last_calculated_at: string | null;
}

export interface IngredientWithCostState extends IngredientRow {
  cost_state: IngredientCostStateRow | null;
  supplier_name: string | null;
}

export type IngredientInput = {
  name: string;
  type: IngredientType;
  supplier_id?: string | null;
  total_cost?: number | null;
  original_quantity?: number | null;
  original_uom_code?: string | null;
  conversion_on?: boolean;
  recipe_uom_code?: string | null;
  adjustment?: number;
  density_g_per_ml?: number | null;
  manual_recipe_unit_cost?: number | null;
  notes?: string | null;
};

export type IngredientPatch = Partial<IngredientInput> & { is_active?: boolean };

// ---------------- Recipes (Build 1.3) ----------------

export type RecipeKind = "intermediate" | "dish";

export interface RecipeRow {
  id: string;
  restaurant_id: string;
  name: string;
  kind: RecipeKind;
  menu_category_id: string | null;
  serving_quantity: number;
  serving_uom_code: string;
  menu_price: number | null;
  linked_intermediate_ingredient_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeLineRow {
  id: string;
  restaurant_id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  uom_code: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeWithLines extends RecipeRow {
  lines: RecipeLineRow[];
  category_name: string | null;
}

export interface RecipeMetrics {
  cogs: number;
  cost_per_serving: number;
  gp: number | null;
  gpm: number | null;
  on_target: boolean | null;
  suggested_menu_price: number | null;
  line_costs: RecipeLineCost[];
  errors: string[];
}

export interface RecipeLineCost {
  line_id: string;
  ingredient_id: string;
  ingredient_name: string;
  qty_in_recipe_uom: number;
  unit_cost: number;
  line_cost: number;
  error: string | null;
}

export type RecipeInput = {
  name: string;
  kind: RecipeKind;
  menu_category_id?: string | null;
  serving_quantity: number;
  serving_uom_code: string;
  menu_price?: number | null;
  linked_intermediate_ingredient_id?: string | null;
  notes?: string | null;
};

export type RecipePatch = Partial<RecipeInput> & { is_active?: boolean };

export type RecipeLineInput = {
  ingredient_id: string;
  quantity: number;
  uom_code: string;
  sort_order?: number;
  notes?: string | null;
};

export interface ApiError {
  code: "auth" | "permission" | "duplicate" | "validation" | "not_found" | "unknown";
  message: string;
}
