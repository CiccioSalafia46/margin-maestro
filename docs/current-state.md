# Current State

**Date:** 2026-05-03
**Build:** 1.9 — Dashboard
**Branch:** `build-1.9-dashboard`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**All operational pages are Supabase-backed or Supabase-derived.** The full core chain is live: Ingredients → Recipes → Menu Analytics → Price Log → Price Trend → Dish Analysis → Impact Cascade → Alerts → Dashboard.

No mock data is used by any operational page.

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
| `price_update_batches` | 1.5 | Accepted |
| `ingredient_price_log` | 1.5 | Accepted |
| `ingredient_snapshots` | 1.5 | Accepted |
| `impact_cascade_runs` | 1.7 | Accepted |
| `impact_cascade_items` | 1.7 | Accepted |
| `alerts` | 1.8 | Accepted |

**Derived (no table):** Menu Analytics, Price Trend, Dish Analysis, Dashboard.

## What Remains

- Billing (Build 2.0)
- Team management
- Google OAuth
- Apply Price action
- Production hardening
- CSV import/export
- Automated tests

## Next Task

**Build 1.9A — Dashboard Acceptance & MVP Readiness.**
