// Build 2.1 — Full operational + team management API types.

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

// ---------------- Menu Analytics (Build 1.4, derived — no table) ----

export type MenuAnalyticsStatus = "valid" | "warning" | "error" | "incomplete";

export interface MenuAnalyticsRow {
  recipe_id: string;
  dish_name: string;
  category_name: string | null;
  serving_quantity: number;
  serving_uom_code: string;
  cogs: number;
  cost_per_serving: number;
  menu_price: number | null;
  gp: number | null;
  gpm: number | null;
  target_gpm: number;
  on_target: boolean | null;
  suggested_menu_price: number | null;
  status: MenuAnalyticsStatus;
  issues: string[];
}

export interface MenuAnalyticsSummary {
  total_dishes: number;
  priced_dishes: number;
  avg_gpm: number | null;
  avg_gp: number | null;
  below_target_count: number;
  missing_price_count: number;
  incomplete_costing_count: number;
  top_performer: MenuAnalyticsRow | null;
  bottom_performer: MenuAnalyticsRow | null;
}

// ---------------- Price Log + Snapshot (Build 1.5) ----------------

export type PriceUpdateBatchStatus = "draft" | "previewed" | "applied" | "cancelled" | "failed";
export type PriceUpdateBatchSource = "manual" | "baseline_initialization" | "baseline_reset" | "system";
export type PriceLogEventType = "baseline" | "change" | "correction" | "manual_note";

export interface PriceUpdateBatchRow {
  id: string;
  restaurant_id: string;
  created_by: string | null;
  status: PriceUpdateBatchStatus;
  source: PriceUpdateBatchSource;
  note: string | null;
  baseline_version: number;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientPriceLogRow {
  id: string;
  restaurant_id: string;
  batch_id: string | null;
  ingredient_id: string | null;
  baseline_version: number;
  ingredient_name_at_time: string;
  supplier_name_at_time: string | null;
  ingredient_type_at_time: string;
  old_total_cost: number | null;
  old_quantity: number | null;
  old_uom_code: string | null;
  old_unit_cost: number | null;
  old_recipe_unit_cost: number | null;
  new_total_cost: number | null;
  new_quantity: number | null;
  new_uom_code: string | null;
  new_unit_cost: number | null;
  new_recipe_unit_cost: number | null;
  delta_recipe_unit_cost_amount: number | null;
  delta_recipe_unit_cost_percent: number | null;
  event_type: PriceLogEventType;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface IngredientSnapshotRow {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  baseline_version: number;
  ingredient_name_at_time: string;
  supplier_name_at_time: string | null;
  ingredient_type_at_time: string;
  total_cost: number | null;
  quantity: number | null;
  uom_code: string | null;
  unit_cost: number | null;
  recipe_unit_cost: number | null;
  calculation_status: string | null;
  captured_at: string;
}

export interface SnapshotStatus {
  initialized: boolean;
  baseline_version: number;
  snapshot_count: number;
  active_ingredient_count: number;
  coverage_complete: boolean;
  latest_batch_at: string | null;
}

// ---------------- Price Update Batch Flow (Build 1.5A) ----------------

export interface PriceChangeInput {
  ingredient_id: string;
  new_total_cost: number | null;
  new_original_quantity: number | null;
  new_original_uom_code: string | null;
  new_recipe_uom_code: string | null;
  new_adjustment: number;
  new_density_g_per_ml: number | null;
  new_manual_recipe_unit_cost: number | null;
}

export interface PriceChangePreview {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_type: string;
  supplier_name: string | null;
  old_recipe_unit_cost: number | null;
  new_recipe_unit_cost: number | null;
  delta_amount: number | null;
  delta_percent: number | null;
  status: "valid" | "error" | "unchanged";
  error: string | null;
}

// ---------------- Impact Cascade (Build 1.7) ----------------

export type ImpactCascadeStatus = "generated" | "failed";
export type ImpactCascadeCalcStatus = "valid" | "warning" | "error" | "incomplete";

export interface ImpactCascadeRunRow {
  id: string;
  restaurant_id: string;
  batch_id: string;
  baseline_version: number;
  status: ImpactCascadeStatus;
  generated_by: string | null;
  generated_at: string;
  changed_ingredients_count: number;
  affected_dish_count: number;
  impact_item_count: number;
  newly_below_target_count: number;
  total_cogs_delta_per_serving: number | null;
  total_margin_delta_per_serving: number | null;
  note: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ImpactCascadeItemRow {
  id: string;
  restaurant_id: string;
  run_id: string;
  batch_id: string;
  dish_recipe_id: string | null;
  dish_name_at_time: string;
  category_name_at_time: string | null;
  affected_ingredient_ids: string[] | null;
  affected_ingredient_names: string[] | null;
  impact_paths: unknown;
  menu_price: number | null;
  target_gpm: number | null;
  old_cogs_per_serving: number | null;
  new_cogs_per_serving: number | null;
  cogs_delta_per_serving: number | null;
  old_gp: number | null;
  new_gp: number | null;
  gp_delta: number | null;
  old_gpm: number | null;
  new_gpm: number | null;
  gpm_delta: number | null;
  was_on_target: boolean | null;
  is_on_target: boolean | null;
  newly_below_target: boolean;
  suggested_menu_price: number | null;
  suggested_price_delta: number | null;
  calculation_status: ImpactCascadeCalcStatus;
  issue_summary: string | null;
  created_at: string;
}

// ---------------- Alerts (Build 1.8) ----------------

export type AlertType = "dish_below_target" | "dish_newly_below_target" | "ingredient_cost_spike" | "impact_cascade_margin_drop" | "missing_menu_price" | "incomplete_costing" | "intermediate_cost_shift";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface AlertRow {
  id: string;
  restaurant_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  recommended_action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  batch_id: string | null;
  impact_cascade_run_id: string | null;
  impact_cascade_item_id: string | null;
  recipe_id: string | null;
  ingredient_id: string | null;
  payload: unknown;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface AlertSummary {
  total: number;
  open: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
}

// ---------------- Team Management (Build 2.1) ----------------

export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired";

export interface RestaurantInvitationRow {
  id: string;
  restaurant_id: string;
  email: string;
  role: RestaurantRole;
  status: InvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  token: string;
  note: string | null;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: RestaurantRole;
  joined_at: string;
}

export interface ApiError {
  code: "auth" | "permission" | "duplicate" | "validation" | "not_found" | "unknown";
  message: string;
}
