// Menu Analytics API — Build 1.4.
// Derived from active dish recipes, recipe_lines, ingredients, ingredient_cost_state,
// restaurant_settings. No new tables — all computed on read.

import { getIngredients } from "./ingredientsApi";
import { calculateRecipeMetrics, getRecipes } from "./recipesApi";
import { getRestaurantSettings } from "./settingsApi";
import type {
  IngredientWithCostState,
  MenuAnalyticsRow,
  MenuAnalyticsSummary,
  MenuAnalyticsStatus,
  RecipeWithLines,
  RestaurantSettingsRow,
} from "./types";
import { suggestedMenuPrice } from "@/lib/margin";

// ── Core Derivation ──────────────────────────────────────────────────

export function deriveMenuAnalyticsRows(
  recipes: RecipeWithLines[],
  ingredients: IngredientWithCostState[],
  targetGpm: number,
): MenuAnalyticsRow[] {
  const dishRecipes = recipes.filter((r) => r.kind === "dish" && r.is_active);

  return dishRecipes.map((r) => {
    const metrics = calculateRecipeMetrics(r, r.lines, ingredients, targetGpm);
    const issues: string[] = [];
    let status: MenuAnalyticsStatus = "valid";

    // Check for incomplete costing
    if (r.lines.length === 0) {
      issues.push("No ingredient lines.");
      status = "incomplete";
    }
    if (metrics.errors.length > 0) {
      issues.push(...metrics.errors);
      status = status === "incomplete" ? "incomplete" : "warning";
    }

    // Check menu price
    const mp = r.menu_price != null ? Number(r.menu_price) : null;
    if (mp == null || mp <= 0) {
      issues.push("Menu price not set.");
      if (status === "valid") status = "incomplete";
    }

    // Suggested price
    const suggested = suggestedMenuPrice(metrics.cost_per_serving, targetGpm);

    return {
      recipe_id: r.id,
      dish_name: r.name,
      category_name: r.category_name,
      serving_quantity: Number(r.serving_quantity),
      serving_uom_code: r.serving_uom_code,
      cogs: metrics.cogs,
      cost_per_serving: metrics.cost_per_serving,
      menu_price: mp,
      gp: metrics.gp,
      gpm: metrics.gpm,
      target_gpm: targetGpm,
      on_target: metrics.on_target,
      suggested_menu_price: suggested,
      status,
      issues,
    };
  });
}

export function deriveMenuAnalyticsSummary(
  rows: MenuAnalyticsRow[],
): MenuAnalyticsSummary {
  const pricedRows = rows.filter(
    (r) => r.menu_price != null && r.menu_price > 0 && r.gpm != null && r.status !== "incomplete",
  );

  const avg_gpm =
    pricedRows.length > 0
      ? pricedRows.reduce((sum, r) => sum + (r.gpm ?? 0), 0) / pricedRows.length
      : null;

  const avg_gp =
    pricedRows.length > 0
      ? pricedRows.reduce((sum, r) => sum + (r.gp ?? 0), 0) / pricedRows.length
      : null;

  const below_target_count = pricedRows.filter((r) => r.on_target === false).length;
  const missing_price_count = rows.filter((r) => r.menu_price == null || r.menu_price <= 0).length;
  const incomplete_costing_count = rows.filter((r) => r.status === "incomplete" || r.status === "error").length;

  const sorted = [...pricedRows].sort((a, b) => (b.gpm ?? 0) - (a.gpm ?? 0));
  const top_performer = sorted[0] ?? null;
  const bottom_performer = sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0] ?? null;

  return {
    total_dishes: rows.length,
    priced_dishes: pricedRows.length,
    avg_gpm,
    avg_gp,
    below_target_count,
    missing_price_count,
    incomplete_costing_count,
    top_performer,
    bottom_performer,
  };
}

// ── Convenience Loaders ──────────────────────────────────────────────

export async function getMenuAnalyticsData(restaurantId: string): Promise<{
  rows: MenuAnalyticsRow[];
  summary: MenuAnalyticsSummary;
  settings: RestaurantSettingsRow | null;
}> {
  const [recipes, ingredients, settings] = await Promise.all([
    getRecipes(restaurantId),
    getIngredients(restaurantId),
    getRestaurantSettings(restaurantId),
  ]);

  const targetGpm = settings?.target_gpm ?? 0.78;
  const rows = deriveMenuAnalyticsRows(recipes, ingredients, targetGpm);
  const summary = deriveMenuAnalyticsSummary(rows);

  return { rows, summary, settings };
}
