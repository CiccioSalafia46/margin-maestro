// Mock prior snapshot dataset. DEMO DATA — read-only.
//
// A snapshot represents the last confirmed unit cost for an ingredient at
// the moment the prior batch closed. Selectors compute deltas (COGS, GP, GPM)
// by recomputing the menu using these prior unit costs.
//
// For Build 0.3 we keep a single "prior snapshot" set of unit costs that
// represents the state immediately BEFORE the latest price batch (batch-3).
// Plus per-dish `estimated_monthly_units_sold` to drive the Profit-at-Risk KPI.

import type { IngredientSnapshot } from "@/lib/types";

export const PRIOR_SNAPSHOT_LABEL = "Snapshot — Mar 21 close";
export const PRIOR_SNAPSHOT_TAKEN_AT = "2026-03-21T23:59:00Z";

// Unit costs as of just before batch-3 (the latest batch). Primary + Fixed
// only — Intermediate ingredient unit costs are recomputed by the selector
// from these prior Primary unit costs.
export const priorIngredientSnapshots: IngredientSnapshot[] = [
  // Unchanged in batch-3: copy current values
  { ingredient_id: "ing-mozzarella", unit_cost: 0.01106, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-ground-pork", unit_cost: 6.8421, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-flour", unit_cost: 0.001984, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  // Changed in batch-3
  { ingredient_id: "ing-tomato", unit_cost: 0.005537, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-sundried-tomatoes", unit_cost: 0.029, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  // Unchanged
  { ingredient_id: "ing-olive-oil", unit_cost: 0.0158, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-basil", unit_cost: 0.0356, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-asparagus", unit_cost: 0.0145, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-shallots", unit_cost: 0.008087, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
  { ingredient_id: "ing-condiments", unit_cost: 0.35, taken_at: PRIOR_SNAPSHOT_TAKEN_AT, baseline_version: 1 },
];

// Demo monthly unit sales. Used only to derive Estimated Profit at Risk.
// Marked as demo data in the UI.
export const estimatedMonthlyUnitsSold: Record<string, number> = {
  "rec-margherita": 620,
  "rec-lasagne": 280,
  "rec-bruschetta": 410,
  "rec-ravioli": 240,
  "rec-saltimbocca": 180,
  "rec-antipasto": 320,
};
