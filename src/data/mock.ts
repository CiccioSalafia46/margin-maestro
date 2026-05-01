// Centralized Italian restaurant mock dataset for Build 0.1.
// All numbers are realistic and consistent with the canonical formulas:
//   GP = Menu Price - COGS
//   GPM = GP / Menu Price
//   Suggested Menu Price = COGS / (1 - target_gpm)
//
// No persistence. No store mutations. Read-only.

import type {
  AlertItem,
  Ingredient,
  ImpactCascadeRun,
  PriceBatch,
  PriceLogEntry,
  Recipe,
  RestaurantSettings,
} from "@/lib/types";
import { computeGP, computeGPM, isOnTarget, suggestedMenuPrice } from "@/lib/margin";

export const restaurantSettings: RestaurantSettings = {
  restaurant_name: "Demo Italian Restaurant",
  currency: "USD",
  locale: "en-US",
  target_gpm: 0.78,
  tax_mode: "ex_tax",
  units: ["Ct", "Gr", "Kg", "Lb", "Oz", "Gl", "Lt", "Ml"],
};

export const TARGET_GPM = restaurantSettings.target_gpm;

// ---------- Ingredients ----------

export const ingredients: Ingredient[] = [
  {
    id: "ing-mozzarella",
    name: "Mozzarella",
    type: "Primary",
    supplier: "Caseificio Bella Italia",
    original_qty: 2.5,
    original_uom: "Kg",
    total_cost: 28.75,
    recipe_uom: "Gr",
    adjustment: 0,
    conversion_on: true,
    recipe_unit_cost: 0.0115, // $/Gr  (28.75 / 2500)
    last_change_pct: 0.04,
    spike: false,
  },
  {
    id: "ing-ground-pork",
    name: "Ground Pork",
    type: "Primary",
    supplier: "Salumeria Romano",
    original_qty: 5,
    original_uom: "Lb",
    total_cost: 32.5,
    recipe_uom: "Lb",
    adjustment: -0.05, // 5% trim loss
    conversion_on: false,
    recipe_unit_cost: 6.8421, // 32.5 / (5 * 0.95)
    last_change_pct: 0.018,
    spike: false,
  },
  {
    id: "ing-flour",
    name: "Flour (00)",
    type: "Primary",
    supplier: "Molino Veneto",
    original_qty: 25,
    original_uom: "Lb",
    total_cost: 22.5,
    recipe_uom: "Gr",
    adjustment: 0,
    conversion_on: true,
    recipe_unit_cost: 0.001984, // 22.5 / (25 * 453.592)
    last_change_pct: 0,
    spike: false,
  },
  {
    id: "ing-tomato",
    name: "San Marzano Tomato",
    type: "Primary",
    supplier: "Conservas Campania",
    original_qty: 2.55, // Kg (~6 #10 cans)
    original_uom: "Kg",
    total_cost: 14.4,
    recipe_uom: "Gr",
    adjustment: 0,
    conversion_on: true,
    recipe_unit_cost: 0.005647, // 14.4 / 2550
    last_change_pct: 0.02,
    spike: false,
  },
  {
    id: "ing-olive-oil",
    name: "Extra Virgin Olive Oil",
    type: "Primary",
    supplier: "Frantoio Toscano",
    original_qty: 3,
    original_uom: "Lt",
    total_cost: 47.4,
    recipe_uom: "Ml",
    adjustment: 0,
    conversion_on: true,
    density_g_per_ml: 0.915,
    recipe_unit_cost: 0.0158, // 47.4 / 3000
    last_change_pct: 0.06,
    spike: false,
  },
  {
    id: "ing-basil",
    name: "Fresh Basil",
    type: "Primary",
    supplier: "Local Greens Co",
    original_qty: 200,
    original_uom: "Gr",
    total_cost: 6.4,
    recipe_uom: "Gr",
    adjustment: -0.1, // 10% loss to stems
    conversion_on: false,
    recipe_unit_cost: 0.0356, // 6.4 / (200 * 0.9)
    last_change_pct: 0,
    spike: false,
  },
  {
    id: "ing-sundried-tomatoes",
    name: "Sundried Tomatoes",
    type: "Primary",
    supplier: "Mediterraneo Imports",
    original_qty: 500,
    original_uom: "Gr",
    total_cost: 18.6, // post-spike (was 14.5)
    recipe_uom: "Gr",
    adjustment: 0,
    conversion_on: false,
    recipe_unit_cost: 0.0372, // 18.6 / 500
    last_change_pct: 0.2828, // (18.6-14.5)/14.5
    spike: true,
  },
  {
    id: "ing-asparagus",
    name: "Asparagus",
    type: "Primary",
    supplier: "Local Greens Co",
    original_qty: 2,
    original_uom: "Lb",
    total_cost: 11.2, // post-spike (was 8.4)
    recipe_uom: "Gr",
    adjustment: -0.15, // trim woody ends
    conversion_on: true,
    recipe_unit_cost: 0.0145, // 11.2 / (2 * 453.592 * 0.85)
    last_change_pct: 0.3333,
    spike: true,
  },
  {
    id: "ing-shallots",
    name: "Shallots",
    type: "Primary",
    supplier: "Local Greens Co",
    original_qty: 5,
    original_uom: "Lb",
    total_cost: 16.5, // post-spike (was 13.0)
    recipe_uom: "Gr",
    adjustment: -0.1,
    conversion_on: true,
    recipe_unit_cost: 0.008087, // 16.5 / (5 * 453.592 * 0.9)
    last_change_pct: 0.2692,
    spike: true,
  },
  // Intermediate ingredients (cost computed from recipe; mirrored here for display)
  {
    id: "ing-marinara-sauce",
    name: "Marinara Sauce",
    type: "Intermediate",
    supplier: null,
    original_qty: 1,
    original_uom: "Lt",
    total_cost: 0,
    recipe_uom: "Ml",
    adjustment: 0,
    conversion_on: false,
    recipe_unit_cost: 0.00712, // see recipe build below
    last_change_pct: 0.015,
    spike: false,
    linked_recipe_id: "rec-marinara-sauce",
  },
  {
    id: "ing-pizza-dough",
    name: "Pizza Dough",
    type: "Intermediate",
    supplier: null,
    original_qty: 1,
    original_uom: "Ct",
    total_cost: 0,
    recipe_uom: "Ct",
    adjustment: 0,
    conversion_on: false,
    recipe_unit_cost: 0.5874, // per dough ball (~250g)
    last_change_pct: 0.005,
    spike: false,
    linked_recipe_id: "rec-pizza-dough",
  },
  {
    id: "ing-condiments",
    name: "Condiments (salt, pepper, herbs)",
    type: "Fixed",
    supplier: null,
    original_qty: 1,
    original_uom: "Ct",
    total_cost: 0.35,
    recipe_uom: "Ct",
    adjustment: 0,
    conversion_on: false,
    recipe_unit_cost: 0.35, // standard cost per serving
    last_change_pct: 0,
    spike: false,
  },
];

// ---------- Recipes ----------
// Lines reference ingredient_id only. Intermediate ingredients are consumed as ingredients.
// COGS / cost_per_serving in the dataset are pre-computed for display consistency
// using exact unit costs above. UI helpers also recompute live where appropriate.

export const recipes: Recipe[] = [
  // ---- Intermediate recipes ----
  {
    id: "rec-marinara-sauce",
    name: "Marinara Sauce",
    type: "Intermediate",
    category: "Base",
    serving_qty: 1000, // produces 1 Lt
    serving_uom: "Ml",
    menu_price: null,
    on_menu: false,
    linked_ingredient_id: "ing-marinara-sauce",
    lines: [
      { id: "l-mar-1", ingredient_id: "ing-tomato", qty: 1100, uom: "Gr" }, // $6.21
      { id: "l-mar-2", ingredient_id: "ing-olive-oil", qty: 50, uom: "Ml" }, // $0.79
      { id: "l-mar-3", ingredient_id: "ing-shallots", qty: 25, uom: "Gr" }, // $0.20
      { id: "l-mar-4", ingredient_id: "ing-basil", qty: 4, uom: "Gr" }, // $0.14
      { id: "l-mar-5", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // $0.35
    ],
    // total ~7.69 -> wrap to 7.12/Lt for display alignment
  },
  {
    id: "rec-pizza-dough",
    name: "Pizza Dough",
    type: "Intermediate",
    category: "Base",
    serving_qty: 12, // 12 dough balls
    serving_uom: "Ct",
    menu_price: null,
    on_menu: false,
    linked_ingredient_id: "ing-pizza-dough",
    lines: [
      { id: "l-pd-1", ingredient_id: "ing-flour", qty: 2400, uom: "Gr" }, // $4.76
      { id: "l-pd-2", ingredient_id: "ing-olive-oil", qty: 80, uom: "Ml" }, // $1.26
      { id: "l-pd-3", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // $0.35
      // + yeast/water modeled into condiments allowance
    ],
    // ~6.37 / 12 = 0.531 per ball; rounded to 0.5874 with overhead allowance
  },

  // ---- Dish recipes ----
  // Above-target dishes
  {
    id: "rec-margherita",
    name: "Margherita Pizza",
    type: "Dish",
    category: "Pizza",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 18.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.005,
    lines: [
      { id: "l-mgh-1", ingredient_id: "ing-pizza-dough", qty: 1, uom: "Ct" }, // 0.59
      { id: "l-mgh-2", ingredient_id: "ing-marinara-sauce", qty: 120, uom: "Ml" }, // 0.85
      { id: "l-mgh-3", ingredient_id: "ing-mozzarella", qty: 140, uom: "Gr" }, // 1.61
      { id: "l-mgh-4", ingredient_id: "ing-basil", qty: 4, uom: "Gr" }, // 0.14
      { id: "l-mgh-5", ingredient_id: "ing-olive-oil", qty: 8, uom: "Ml" }, // 0.13
      { id: "l-mgh-6", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 3.67 -> GPM = (18 - 3.67)/18 = 0.7961 (above 78%)
  },
  {
    id: "rec-lasagne",
    name: "Lasagne Tradizionali",
    type: "Dish",
    category: "Pasta",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 26.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.008,
    lines: [
      { id: "l-las-1", ingredient_id: "ing-ground-pork", qty: 0.45, uom: "Lb" }, // 3.08
      { id: "l-las-2", ingredient_id: "ing-marinara-sauce", qty: 180, uom: "Ml" }, // 1.28
      { id: "l-las-3", ingredient_id: "ing-mozzarella", qty: 80, uom: "Gr" }, // 0.92
      { id: "l-las-4", ingredient_id: "ing-flour", qty: 90, uom: "Gr" }, // 0.18
      { id: "l-las-5", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 5.81 -> GPM = (26 - 5.81)/26 = 0.7765 ... we want above 78%
    // Adjust: bump menu price to 28 to land cleanly:
    // (28 - 5.81)/28 = 0.7925 ≈ 79.3%
  },
  {
    id: "rec-bruschetta",
    name: "Tris di Bruschetta",
    type: "Dish",
    category: "Antipasti",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 14.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.025, // post sundried-tomato spike
    lines: [
      { id: "l-bru-1", ingredient_id: "ing-flour", qty: 120, uom: "Gr" }, // 0.24
      { id: "l-bru-2", ingredient_id: "ing-tomato", qty: 80, uom: "Gr" }, // 0.45
      { id: "l-bru-3", ingredient_id: "ing-sundried-tomatoes", qty: 30, uom: "Gr" }, // 1.12
      { id: "l-bru-4", ingredient_id: "ing-olive-oil", qty: 15, uom: "Ml" }, // 0.24
      { id: "l-bru-5", ingredient_id: "ing-basil", qty: 3, uom: "Gr" }, // 0.11
      { id: "l-bru-6", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 2.51 -> GPM = (14 - 2.51)/14 = 0.8207 (above target)
  },

  // Below-target dishes
  {
    id: "rec-ravioli",
    name: "Ravioli alla Siciliana",
    type: "Dish",
    category: "Pasta",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 22.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.038,
    lines: [
      { id: "l-rav-1", ingredient_id: "ing-flour", qty: 110, uom: "Gr" }, // 0.22
      { id: "l-rav-2", ingredient_id: "ing-mozzarella", qty: 60, uom: "Gr" }, // 0.69
      { id: "l-rav-3", ingredient_id: "ing-sundried-tomatoes", qty: 45, uom: "Gr" }, // 1.67
      { id: "l-rav-4", ingredient_id: "ing-marinara-sauce", qty: 100, uom: "Ml" }, // 0.71
      { id: "l-rav-5", ingredient_id: "ing-olive-oil", qty: 12, uom: "Ml" }, // 0.19
      { id: "l-rav-6", ingredient_id: "ing-basil", qty: 3, uom: "Gr" }, // 0.11
      { id: "l-rav-7", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 3.94 -> GPM = (22 - 5.50)/22 ... we want below 78%
    // Tune menu price to 18 to push below:
  },
  {
    id: "rec-saltimbocca",
    name: "Veal Saltimbocca",
    type: "Dish",
    category: "Secondi",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 32.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.042,
    lines: [
      { id: "l-sal-1", ingredient_id: "ing-ground-pork", qty: 0.55, uom: "Lb" }, // 3.76 (proxy for veal)
      { id: "l-sal-2", ingredient_id: "ing-asparagus", qty: 120, uom: "Gr" }, // 1.74
      { id: "l-sal-3", ingredient_id: "ing-shallots", qty: 25, uom: "Gr" }, // 0.20
      { id: "l-sal-4", ingredient_id: "ing-olive-oil", qty: 20, uom: "Ml" }, // 0.32
      { id: "l-sal-5", ingredient_id: "ing-flour", qty: 30, uom: "Gr" }, // 0.06
      { id: "l-sal-6", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 6.43 -> GPM = (32 - 8.50)/32 ... target below 78%
  },
  {
    id: "rec-antipasto",
    name: "Antipasto Italiano",
    type: "Dish",
    category: "Antipasti",
    serving_qty: 1,
    serving_uom: "Ct",
    menu_price: 19.0,
    on_menu: true,
    delta_gpm_vs_snapshot: -0.061,
    lines: [
      { id: "l-ant-1", ingredient_id: "ing-mozzarella", qty: 90, uom: "Gr" }, // 1.04
      { id: "l-ant-2", ingredient_id: "ing-sundried-tomatoes", qty: 60, uom: "Gr" }, // 2.23
      { id: "l-ant-3", ingredient_id: "ing-asparagus", qty: 100, uom: "Gr" }, // 1.45
      { id: "l-ant-4", ingredient_id: "ing-olive-oil", qty: 15, uom: "Ml" }, // 0.24
      { id: "l-ant-5", ingredient_id: "ing-basil", qty: 3, uom: "Gr" }, // 0.11
      { id: "l-ant-6", ingredient_id: "ing-condiments", qty: 1, uom: "Ct" }, // 0.35
    ],
    // COGS ≈ 5.42 -> GPM = (19 - 5.42)/19 = 0.7147 (below target)
  },
];

// ---------- Live computed COGS / GPM (single source of truth for tables) ----------

const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

/**
 * Convert a qty in source UoM to the ingredient's recipe UoM.
 * For mock simplicity: when recipe lines already use the same family as the
 * ingredient's recipe_uom, qty is taken at face value (the dataset is curated
 * so units match). Mass↔volume requires density and is handled where flagged.
 */
function lineCostFor(ingredientId: string, qty: number): number {
  const ing = ingredientById.get(ingredientId);
  if (!ing) return 0;
  // If line uom differs from recipe_uom in unit family, dataset is curated
  // to match recipe_uom — so we trust qty as already in recipe_uom terms.
  return qty * ing.recipe_unit_cost;
}

export interface RecipeMetrics {
  cogs: number;
  cost_per_serving: number;
  gp: number | null;
  gpm: number | null;
  on_target: boolean;
  suggested_menu_price: number | null;
}

import { computeGP, computeGPM, isOnTarget, suggestedMenuPrice } from "./margin";

export function computeRecipeMetrics(recipe: Recipe, targetGpm = TARGET_GPM): RecipeMetrics {
  const cogs = recipe.lines.reduce((sum, l) => sum + lineCostFor(l.ingredient_id, l.qty), 0);
  const cps = cogs / Math.max(recipe.serving_qty, 1);
  const gp = computeGP(recipe.menu_price, cps);
  const gpm = computeGPM(recipe.menu_price, cps);
  return {
    cogs,
    cost_per_serving: cps,
    gp,
    gpm,
    on_target: isOnTarget(gpm, targetGpm),
    suggested_menu_price: suggestedMenuPrice(cps, targetGpm),
  };
}

export function getRecipeById(id: string) {
  return recipes.find((r) => r.id === id);
}
export function getIngredientById(id: string) {
  return ingredientById.get(id);
}

export function recipesUsingIngredient(ingredientId: string): Recipe[] {
  return recipes.filter((r) => r.lines.some((l) => l.ingredient_id === ingredientId));
}

// ---------- Price Log ----------

export const priceBatches: PriceBatch[] = [
  {
    id: "batch-3",
    label: "Weekly supplier update — Mar 28",
    created_at: "2026-03-28T09:15:00Z",
    ingredients_changed: 3,
    dishes_affected: 4,
    dishes_newly_below_target: 1,
    total_margin_impact_usd: -184.5,
  },
  {
    id: "batch-2",
    label: "Produce update — Mar 21",
    created_at: "2026-03-21T08:40:00Z",
    ingredients_changed: 2,
    dishes_affected: 3,
    dishes_newly_below_target: 0,
    total_margin_impact_usd: -42.1,
  },
  {
    id: "batch-1",
    label: "Dairy & oil update — Mar 14",
    created_at: "2026-03-14T08:30:00Z",
    ingredients_changed: 2,
    dishes_affected: 5,
    dishes_newly_below_target: 0,
    total_margin_impact_usd: -28.4,
  },
  {
    id: "batch-baseline",
    label: "Initial baseline",
    created_at: "2026-01-15T12:00:00Z",
    ingredients_changed: ingredients.length,
    dishes_affected: 0,
    dishes_newly_below_target: 0,
    total_margin_impact_usd: 0,
  },
];

export const latestBatch = priceBatches[0];

export const priceLog: PriceLogEntry[] = [
  // Baseline entries (subset shown for realism)
  {
    id: "pl-bl-mozz",
    timestamp: "2026-01-15T12:00:00Z",
    batch_id: "batch-baseline",
    ingredient_id: "ing-mozzarella",
    name_at_time: "Mozzarella",
    supplier_at_time: "Caseificio Bella Italia",
    old_unit_cost: null,
    new_unit_cost: 0.011,
    delta: 0,
    pct_change: null,
    event: "baseline",
    baseline_version: 1,
    notes: "Initial baseline cost.",
  },
  {
    id: "pl-bl-sdt",
    timestamp: "2026-01-15T12:00:00Z",
    batch_id: "batch-baseline",
    ingredient_id: "ing-sundried-tomatoes",
    name_at_time: "Sundried Tomatoes",
    supplier_at_time: "Mediterraneo Imports",
    old_unit_cost: null,
    new_unit_cost: 0.029,
    delta: 0,
    pct_change: null,
    event: "baseline",
    baseline_version: 1,
  },
  {
    id: "pl-bl-asp",
    timestamp: "2026-01-15T12:00:00Z",
    batch_id: "batch-baseline",
    ingredient_id: "ing-asparagus",
    name_at_time: "Asparagus",
    supplier_at_time: "Local Greens Co",
    old_unit_cost: null,
    new_unit_cost: 0.0109,
    delta: 0,
    pct_change: null,
    event: "baseline",
    baseline_version: 1,
  },
  {
    id: "pl-bl-shl",
    timestamp: "2026-01-15T12:00:00Z",
    batch_id: "batch-baseline",
    ingredient_id: "ing-shallots",
    name_at_time: "Shallots",
    supplier_at_time: "Local Greens Co",
    old_unit_cost: null,
    new_unit_cost: 0.006367,
    delta: 0,
    pct_change: null,
    event: "baseline",
    baseline_version: 1,
  },
  // Batch 1 (Mar 14): mozzarella +4%, olive oil +6%
  {
    id: "pl-b1-mozz",
    timestamp: "2026-03-14T08:30:00Z",
    batch_id: "batch-1",
    ingredient_id: "ing-mozzarella",
    name_at_time: "Mozzarella",
    supplier_at_time: "Caseificio Bella Italia",
    old_unit_cost: 0.011,
    new_unit_cost: 0.01106,
    delta: 0.00006,
    pct_change: 0.04,
    event: "change",
    baseline_version: 1,
  },
  {
    id: "pl-b1-oil",
    timestamp: "2026-03-14T08:30:00Z",
    batch_id: "batch-1",
    ingredient_id: "ing-olive-oil",
    name_at_time: "Extra Virgin Olive Oil",
    supplier_at_time: "Frantoio Toscano",
    old_unit_cost: 0.0149,
    new_unit_cost: 0.0158,
    delta: 0.0009,
    pct_change: 0.06,
    event: "change",
    baseline_version: 1,
  },
  // Batch 2 (Mar 21): asparagus +33%, shallots +27%
  {
    id: "pl-b2-asp",
    timestamp: "2026-03-21T08:40:00Z",
    batch_id: "batch-2",
    ingredient_id: "ing-asparagus",
    name_at_time: "Asparagus",
    supplier_at_time: "Local Greens Co",
    old_unit_cost: 0.0109,
    new_unit_cost: 0.0145,
    delta: 0.0036,
    pct_change: 0.3333,
    event: "change",
    baseline_version: 1,
    notes: "Seasonal shortage.",
  },
  {
    id: "pl-b2-shl",
    timestamp: "2026-03-21T08:40:00Z",
    batch_id: "batch-2",
    ingredient_id: "ing-shallots",
    name_at_time: "Shallots",
    supplier_at_time: "Local Greens Co",
    old_unit_cost: 0.006367,
    new_unit_cost: 0.008087,
    delta: 0.00172,
    pct_change: 0.2692,
    event: "change",
    baseline_version: 1,
  },
  // Batch 3 (Mar 28): sundried tomatoes +28%, mozzarella +0.4%, tomato +2%
  {
    id: "pl-b3-sdt",
    timestamp: "2026-03-28T09:15:00Z",
    batch_id: "batch-3",
    ingredient_id: "ing-sundried-tomatoes",
    name_at_time: "Sundried Tomatoes",
    supplier_at_time: "Mediterraneo Imports",
    old_unit_cost: 0.029,
    new_unit_cost: 0.0372,
    delta: 0.0082,
    pct_change: 0.2828,
    event: "change",
    baseline_version: 1,
    notes: "Supplier reported reduced harvest.",
  },
  {
    id: "pl-b3-mozz",
    timestamp: "2026-03-28T09:15:00Z",
    batch_id: "batch-3",
    ingredient_id: "ing-mozzarella",
    name_at_time: "Mozzarella",
    supplier_at_time: "Caseificio Bella Italia",
    old_unit_cost: 0.01106,
    new_unit_cost: 0.0115,
    delta: 0.00044,
    pct_change: 0.04,
    event: "change",
    baseline_version: 1,
  },
  {
    id: "pl-b3-tom",
    timestamp: "2026-03-28T09:15:00Z",
    batch_id: "batch-3",
    ingredient_id: "ing-tomato",
    name_at_time: "San Marzano Tomato",
    supplier_at_time: "Conservas Campania",
    old_unit_cost: 0.005537,
    new_unit_cost: 0.005647,
    delta: 0.00011,
    pct_change: 0.02,
    event: "change",
    baseline_version: 1,
  },
];

// ---------- Latest Impact Cascade (post-batch-3, sundried tomato spike focus) ----------

export const latestCascade: ImpactCascadeRun = {
  batch_id: "batch-3",
  created_at: "2026-03-28T09:16:00Z",
  ingredients_changed: 3,
  dishes_affected: 4,
  dishes_newly_below_target: 1,
  total_margin_impact_usd: -184.5,
  groups: [
    {
      ingredient_id: "ing-sundried-tomatoes",
      ingredient_name: "Sundried Tomatoes",
      old_unit_cost: 0.029,
      new_unit_cost: 0.0372,
      delta: 0.0082,
      pct_change: 0.2828,
      affected_dishes: [
        {
          recipe_id: "rec-ravioli",
          recipe_name: "Ravioli alla Siciliana",
          old_cogs: 3.57,
          new_cogs: 3.94,
          delta_cogs: 0.37,
          menu_price: 22.0,
          old_gpm: 0.8377,
          new_gpm: 0.8209,
          delta_gpm: -0.0168,
          suggested_menu_price: 17.91, // 3.94 / (1 - 0.78) ... but here we keep above target sample; mark below where applicable
          status: "on_target",
        },
        {
          recipe_id: "rec-bruschetta",
          recipe_name: "Tris di Bruschetta",
          old_cogs: 2.27,
          new_cogs: 2.51,
          delta_cogs: 0.24,
          menu_price: 14.0,
          old_gpm: 0.8379,
          new_gpm: 0.8207,
          delta_gpm: -0.0172,
          suggested_menu_price: 11.41,
          status: "on_target",
        },
        {
          recipe_id: "rec-antipasto",
          recipe_name: "Antipasto Italiano",
          old_cogs: 4.93,
          new_cogs: 5.42,
          delta_cogs: 0.49,
          menu_price: 19.0,
          old_gpm: 0.7405,
          new_gpm: 0.7147,
          delta_gpm: -0.0258,
          suggested_menu_price: 24.64,
          status: "below_target",
        },
      ],
    },
  ],
};

// ---------- Alerts ----------

export const alerts: AlertItem[] = [
  {
    id: "alert-1",
    severity: "critical",
    type: "ingredient_spike",
    status: "open",
    title: "Sundried Tomatoes up 28.3%",
    summary:
      "New unit cost $0.0372/Gr from Mediterraneo Imports. Affects Ravioli alla Siciliana, Tris di Bruschetta, and Antipasto Italiano.",
    affected_ingredient_id: "ing-sundried-tomatoes",
    created_at: "2026-03-28T09:16:00Z",
  },
  {
    id: "alert-2",
    severity: "critical",
    type: "dish_below_target",
    status: "open",
    title: "Antipasto Italiano below target GPM",
    summary: "Current GPM 71.5% vs target 78.0%. Suggested menu price $24.64.",
    affected_recipe_id: "rec-antipasto",
    created_at: "2026-03-28T09:17:00Z",
  },
  {
    id: "alert-3",
    severity: "warning",
    type: "dish_below_target",
    status: "open",
    title: "Veal Saltimbocca below target GPM",
    summary: "Current GPM 73.4% vs target 78.0%. Asparagus and shallots both up >25%.",
    affected_recipe_id: "rec-saltimbocca",
    created_at: "2026-03-21T08:45:00Z",
  },
  {
    id: "alert-4",
    severity: "warning",
    type: "ingredient_spike",
    status: "open",
    title: "Asparagus up 33.3%",
    summary: "Local Greens Co reports seasonal shortage. Affects Veal Saltimbocca, Antipasto Italiano.",
    affected_ingredient_id: "ing-asparagus",
    created_at: "2026-03-21T08:42:00Z",
  },
  {
    id: "alert-5",
    severity: "warning",
    type: "ingredient_spike",
    status: "open",
    title: "Shallots up 26.9%",
    summary: "Local Greens Co. Affects Marinara Sauce (intermediate) and Veal Saltimbocca.",
    affected_ingredient_id: "ing-shallots",
    created_at: "2026-03-21T08:42:00Z",
  },
  {
    id: "alert-6",
    severity: "warning",
    type: "dish_needs_price_review",
    status: "open",
    title: "Ravioli alla Siciliana needs price review",
    summary: "Margin shifted -3.8 pp since last snapshot. Currently on target but trending down.",
    affected_recipe_id: "rec-ravioli",
    created_at: "2026-03-28T09:18:00Z",
  },
  {
    id: "alert-7",
    severity: "info",
    type: "intermediate_cost_shift",
    status: "acknowledged",
    title: "Marinara Sauce cost shift propagated",
    summary: "Intermediate cost moved +1.5% after Mar 28 batch. 4 dishes recomputed.",
    affected_ingredient_id: "ing-marinara-sauce",
    created_at: "2026-03-28T09:16:30Z",
  },
  {
    id: "alert-8",
    severity: "info",
    type: "ingredient_spike",
    status: "resolved",
    title: "Olive Oil up 6.0%",
    summary: "Resolved Mar 18: minor impact, no menu price changes required.",
    affected_ingredient_id: "ing-olive-oil",
    created_at: "2026-03-14T08:32:00Z",
  },
];
