# Current State

**Date:** 2026-05-03
**Build:** 1.3 — Recipes
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients and Recipes now use Supabase.** `/ingredients`, `/ingredients/$id`, `/recipes`, and `/recipes/$id` read/write real tenant-scoped data. Recipe line editor with live COGS computation. Intermediate recipe cost propagation to linked ingredients. Cycle detection. All other operational pages remain mock-based.

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
| `recipes` | 1.3 | **New** |
| `recipe_lines` | 1.3 | **New** |

## What Remains Mock

Dashboard, menu analytics, dish analysis, impact cascade, price trend, price log, alerts.

## Next Task

**Build 1.4 — Menu Analytics.** Introduce `menu_items` and `menu_profitability_snapshots`.

## Known Limitations

- Cost state computed client-side (server-side in future)
- Menu Analytics awaits Build 1.4
- Price Log/Snapshot awaits Build 1.5
- Dashboard uses mock data
- Google OAuth not enabled
