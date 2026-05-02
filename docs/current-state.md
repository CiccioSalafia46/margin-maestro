# Current State

**Date:** 2026-05-02
**Build:** 1.2 — Ingredients Database
**Branch:** `build-1.2-ingredients-database`

---

## Actual State

**Ingredients module now uses Supabase.** `/ingredients` and `/ingredients/$id` read/write real tenant-scoped data. Cost states are calculated client-side and persisted via RLS.

All other operational pages remain mock-based.

## Accepted Baseline

**Build 1.1A — Settings/Admin Accepted** is the last fully accepted build.
**Build 1.2 — Ingredients Database** is implemented and ready for acceptance.

## New in Build 1.2

- **Migration:** `ingredients` and `ingredient_cost_state` tables with RLS
- **API:** `src/data/api/ingredientsApi.ts` — CRUD + cost calculation
- **Routes:** `/ingredients` and `/ingredients/$id` rewritten to use Supabase
- **QA:** `/qa-ingredients` acceptance page (A–T checks)
- **Types:** `IngredientRow`, `IngredientCostStateRow`, `IngredientWithCostState` in `types.ts`
- **Generated types:** `src/integrations/supabase/types.ts` updated

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
| `ingredients` | 1.2 | **New** |
| `ingredient_cost_state` | 1.2 | **New** |

## What Remains Mock

Dashboard, recipes, menu analytics, dish analysis, impact cascade, price trend, price log, alerts — all read from `src/data/mock.ts`.

## Next Task

**Build 1.3 — Recipes.** Introduce `recipes`, `recipe_lines`, `recipe_dependency_edges`.

## Known Limitations

- Cost state is computed client-side (server-side in future build)
- Intermediate ingredient costs pending until Build 1.3
- Price Log/Snapshot pending until Build 1.5
- Edit form not yet implemented (placeholder button)
- Dashboard still uses mock ingredient data
- Google OAuth not enabled
