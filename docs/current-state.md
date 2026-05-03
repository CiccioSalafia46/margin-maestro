# Current State

**Date:** 2026-05-03
**Build:** 1.3A — Recipes Accepted
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients and Recipes use Supabase.** All other operational pages remain mock-based.

## Accepted Baseline

**Build 1.3A — Recipes Accepted.**

- Auth session persistence works (Build 1.0F).
- Settings/Admin reference data accepted (Build 1.1A).
- Ingredients database accepted (Build 1.2A).
- Recipes accepted (Build 1.3A).
- Dish recipes: COGS, cost/serving, GP, GPM, suggested price.
- Intermediate recipes: cost propagation to linked ingredient.
- Cycle detection blocks circular dependencies.

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
- Team management placeholder
- Restaurant switcher in-memory only
- Full recipe edit form is future scope
