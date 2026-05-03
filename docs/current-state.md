# Current State

**Date:** 2026-05-03
**Build:** 1.6 — Dish Analysis
**Branch:** `build-1.6-dish-analysis`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients, Recipes, Menu Analytics, Price Log, Snapshots, Price Update Batches, Price Trend, and Dish Analysis use Supabase.** Dashboard, Impact Cascade, and Alerts remain mock-based.

## Backend Scope (Supabase, live)

| Table | Build | Status |
|-------|-------|--------|
| `profiles` | 1.0 | Accepted |
| `restaurants` | 1.0 | Accepted |
| `restaurant_members` | 1.0 | Accepted |
| `restaurant_settings` | 1.0 | Accepted |
| `units` | 1.1 | Accepted |
| `unit_conversions` | 1.1 | Accepted |
| `menu_categories` | 1.1 | Accepted |
| `suppliers` | 1.1 | Accepted |
| `ingredients` | 1.2 | Accepted |
| `ingredient_cost_state` | 1.2 | Accepted |
| `recipes` | 1.3 | Accepted |
| `recipe_lines` | 1.3 | Accepted |
| `price_update_batches` | 1.5 | Live |
| `ingredient_price_log` | 1.5 | Live |
| `ingredient_snapshots` | 1.5 | Live |

**Derived (no table):** Menu Analytics (1.4), Price Trend (1.5B), Dish Analysis (1.6).

## What Remains Mock

Dashboard, impact cascade, alerts.

## Next Task

**Build 1.7 — Impact Cascade** or **Dashboard Supabase migration.**
