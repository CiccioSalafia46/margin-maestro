# Current State

**Date:** 2026-05-03
**Build:** 1.7 — Impact Cascade
**Branch:** `build-1.7-impact-cascade`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Core chain Supabase-backed.** Ingredients → Recipes → Menu Analytics → Price Log → Price Trend → Dish Analysis → Impact Cascade. Dashboard and Alerts remain mock-based.

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
| `impact_cascade_runs` | 1.7 | **New** |
| `impact_cascade_items` | 1.7 | **New** |

**Derived (no table):** Menu Analytics (1.4), Price Trend (1.5B), Dish Analysis (1.6).

## What Remains Mock

Dashboard, alerts.

## Next Task

**Build 1.8 — Alerts** or **Dashboard Supabase migration.**
