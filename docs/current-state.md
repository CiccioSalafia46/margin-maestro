# Current State

**Date:** 2026-05-03
**Build:** 1.4A — Menu Analytics Accepted
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients, Recipes, and Menu Analytics use Supabase.** Menu Analytics is derived (no new tables) from active dish recipes, recipe_lines, ingredients, ingredient_cost_state, and restaurant_settings. All other operational pages remain mock-based.

## Accepted Baseline

**Build 1.4A — Menu Analytics Accepted.**

- Auth session persistence (Build 1.0F).
- Settings/Admin reference data (Build 1.1A).
- Ingredients database (Build 1.2A).
- Recipes with line editor, intermediate propagation, cycle detection (Build 1.3A/B).
- Menu Analytics derived from live Supabase data (Build 1.4A).

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

**Note:** Menu Analytics is derived — no table.

## What Remains Mock

Dashboard, dish analysis, impact cascade, price trend, price log, alerts.

## Next Task

**Build 1.5 — Price Log + Snapshot.**

## Known Limitations

- No snapshot deltas yet (Build 1.5)
- Suggested price is informational only — no Apply action
- Dashboard uses mock data
- Dish Analysis uses mock data
- Price Log/Snapshot awaits Build 1.5
- Google OAuth not enabled
- Team management placeholder
