// Price Trend API — Build 1.5B.
// Reads from ingredient_price_log to derive trend data for a selected ingredient.

import { getPriceLogEntries } from "./priceLogApi";
import { getIngredients } from "./ingredientsApi";
import type { IngredientPriceLogRow, IngredientWithCostState } from "./types";

export interface PriceTrendStats {
  first_recorded: number | null;
  current: number | null;
  absolute_change: number | null;
  percent_change: number | null;
  number_of_changes: number;
  largest_increase_pct: number | null;
  latest_change_at: string | null;
  baseline_version: number;
}

export interface PriceTrendPoint {
  date: string;
  cost: number;
  event_type: string;
}

export async function getPriceTrendIngredients(
  restaurantId: string,
): Promise<IngredientWithCostState[]> {
  const ingredients = await getIngredients(restaurantId);
  return ingredients.filter((i) => i.is_active && i.type !== "intermediate");
}

export async function getIngredientPriceTrend(
  restaurantId: string,
  ingredientId: string,
): Promise<IngredientPriceLogRow[]> {
  const all = await getPriceLogEntries(restaurantId);
  return all
    .filter((e) => e.ingredient_id === ingredientId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function derivePriceTrendStats(entries: IngredientPriceLogRow[]): PriceTrendStats {
  const valid = entries.filter((e) => e.new_recipe_unit_cost != null && isFinite(Number(e.new_recipe_unit_cost)));

  const first = valid.length > 0 ? Number(valid[0].new_recipe_unit_cost) : null;
  const current = valid.length > 0 ? Number(valid[valid.length - 1].new_recipe_unit_cost) : null;
  const absChange = first != null && current != null ? current - first : null;
  const pctChange = first != null && current != null && first !== 0 ? (current - first) / first : null;

  const changeEntries = valid.filter((e) => e.event_type === "change");
  const increases = changeEntries
    .map((e) => e.delta_recipe_unit_cost_percent)
    .filter((v): v is number => v != null && isFinite(v) && v > 0);
  const largestIncrease = increases.length > 0 ? Math.max(...increases) : null;

  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  return {
    first_recorded: first,
    current,
    absolute_change: absChange,
    percent_change: pctChange,
    number_of_changes: changeEntries.length,
    largest_increase_pct: largestIncrease,
    latest_change_at: latestEntry?.created_at ?? null,
    baseline_version: latestEntry?.baseline_version ?? 1,
  };
}

export function derivePriceTrendSeries(
  entries: IngredientPriceLogRow[],
  includeBaseline: boolean,
): PriceTrendPoint[] {
  return entries
    .filter((e) => includeBaseline || e.event_type !== "baseline")
    .filter((e) => e.new_recipe_unit_cost != null && isFinite(Number(e.new_recipe_unit_cost)))
    .map((e) => ({
      date: e.created_at.slice(0, 10),
      cost: Number(Number(e.new_recipe_unit_cost).toFixed(6)),
      event_type: e.event_type,
    }));
}
