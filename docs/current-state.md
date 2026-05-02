# Current State

**Date:** 2026-05-03
**Build:** 1.2A — Ingredients Accepted
**Branch:** `build-1.2-ingredients-database`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients module uses Supabase.** `/ingredients` and `/ingredients/$id` read/write real tenant-scoped data. Cost states are calculated client-side and persisted via RLS. All other operational pages remain mock-based.

**Backend migrated from Lovable Cloud to self-owned Supabase project** (`margin-maestro-dev`). All migrations (1.0 through 1.2) applied successfully.

## Accepted Baseline

**Build 1.2A — Ingredients Accepted.**

- Auth session persistence works (Build 1.0F).
- Settings/Admin reference data accepted (Build 1.1A).
- Ingredients database accepted (Build 1.2A).
- Primary ingredient cost state: calculated, valid.
- Fixed ingredient cost state: manual, valid.
- Intermediate ingredient cost state: pending (awaiting Build 1.3 Recipes).

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

## What Remains Mock

Dashboard, recipes, menu analytics, dish analysis, impact cascade, price trend, price log, alerts — all read from `src/data/mock.ts`.

## Next Task

**Build 1.3 — Recipes.** Introduce `recipes`, `recipe_lines`, `recipe_dependency_edges`.

## Known Limitations

- Cost state computed client-side (server-side in future build)
- Intermediate ingredient costs pending until Build 1.3
- Edit ingredient form is placeholder only
- Price Log/Snapshot pending until Build 1.5
- Dashboard still uses mock ingredient data
- Google OAuth not enabled
- Team management placeholder
- Restaurant switcher in-memory only
