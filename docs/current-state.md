# Current State

**Date:** 2026-05-03
**Build:** 1.5A — Price Update Batch
**Branch:** `build-1.3-recipes`
**Backend:** Self-owned Supabase project `margin-maestro-dev`

---

## Actual State

**Ingredients, Recipes, Menu Analytics, Price Log, Snapshots, and Price Update Batches use Supabase.** The controlled Price Update Batch flow allows owner/manager to update supplier prices, preview cost impact, and apply append-only log entries. Dashboard, Dish Analysis, Impact Cascade, Price Trend, and Alerts remain mock-based.

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

## What Remains Mock

Dashboard, dish analysis, impact cascade, price trend, alerts.

## Next Task

**Build 1.5B — Price Trend Supabase-backed** or **Build 1.7 — Impact Cascade.**

## Known Limitations

- Batch apply is client-orchestrated (not an atomic DB transaction)
- Non-destructive baseline reset deferred
- Price Trend still uses mock data
- Dashboard uses mock data
- Impact Cascade persistence awaits Build 1.7
- Alerts persistence awaits Build 1.8
- Normal ingredient edits do NOT write price log entries (by design)
