# Current State

**Date:** 2026-05-03
**Build:** 1.5 — Price Log + Snapshot
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients, Recipes, Menu Analytics, Price Log, and Snapshots use Supabase.** Price Log is append-only. Baseline initialization captures current ingredient state. Dashboard, Dish Analysis, Impact Cascade, Price Trend, and Alerts remain mock-based.

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
| `price_update_batches` | 1.5 | **New** |
| `ingredient_price_log` | 1.5 | **New** |
| `ingredient_snapshots` | 1.5 | **New** |

## What Remains Mock

Dashboard, dish analysis, impact cascade, price trend, alerts.

## Next Task

**Build 1.5A — Price Update Batch Flow** or **Build 1.6 — Recalculation Cascade.**

## Known Limitations

- Full price update batch editing deferred
- Non-destructive baseline reset deferred
- Price Trend still uses mock data
- Dashboard uses mock data
- Impact Cascade persistence awaits Build 1.7
- Alerts persistence awaits Build 1.8
