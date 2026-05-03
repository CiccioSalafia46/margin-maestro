# Current State

**Date:** 2026-05-03
**Build:** 1.4 — Menu Analytics
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients, Recipes, and Menu Analytics use Supabase.** Menu Analytics is derived (no new tables) from active dish recipes, recipe_lines, ingredients, ingredient_cost_state, and restaurant_settings. All other operational pages remain mock-based.

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

**Note:** No new table for Menu Analytics. It is derived from the tables above.

## What Remains Mock

Dashboard, dish analysis, impact cascade, price trend, price log, alerts.

## Next Task

**Build 1.5 — Price Log + Snapshot.**

## Known Limitations

- Menu Analytics is derived, not persisted — no snapshot deltas yet
- Dashboard uses mock data
- Dish Analysis uses mock data
- Price Log/Snapshot awaits Build 1.5
- Google OAuth not enabled
