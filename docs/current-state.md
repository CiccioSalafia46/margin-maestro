# Current State

**Date:** 2026-05-03
**Build:** 1.8A — Alerts Accepted
**Branch:** `build-1.8-alerts`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Full operational chain Supabase-backed.** Ingredients → Recipes → Menu Analytics → Price Log → Price Trend → Dish Analysis → Impact Cascade → Alerts. Dashboard remains the only mock page.

## Accepted Baseline

**Build 1.8A — Alerts Accepted.**

- Auth session persistence (1.0F).
- Settings/Admin (1.1A).
- Ingredients (1.2A).
- Recipes with line editor, intermediate propagation, cycle detection (1.3A/B).
- Menu Analytics derived (1.4A).
- Price Log + Snapshot + Price Update Batch (1.5/1.5A).
- Price Trend (1.5B).
- Dish Analysis with scenario modeling (1.6).
- Impact Cascade (1.7).
- Alerts with generation, status actions, duplicate prevention (1.8A).

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

**Derived (no table):** Menu Analytics (1.4), Price Trend (1.5B), Dish Analysis (1.6).

## What Remains Mock

Dashboard only.

## Next Task

**Build 1.9 — Dashboard Supabase-backed.**
