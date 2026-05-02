# Current State

**Date:** 2026-05-02
**Build:** 1.1A — Settings/Admin Accepted
**Branch:** `build-1.1a-settings-admin-acceptance`

---

## Actual State

**Auth session persistence works** (fixed in Build 1.0E/1.0F). **Settings/Admin reference data is accepted** (Build 1.1A).

All 8 Supabase tables are live. All QA routes pass. Operational pages remain mock-based.

## Accepted Baseline

**Build 1.1A — Settings/Admin Accepted.**

- Auth session persists across refresh and navigation.
- Settings page reads/writes real Supabase tenant-scoped data.
- Units and unit conversions are read-only global reference data.
- Menu categories and suppliers support add/rename/activate/deactivate.
- Role-based access enforced: owner can edit settings/thresholds, owner/manager can manage categories/suppliers, viewer is read-only.
- RLS tenant scoping verified.
- `/qa-settings-admin` checks A through U pass (or warn for non-critical/role-specific items).

## Sessions

- Supabase Auth session persistence: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.
- Storage: Supabase's built-in default (localStorage in browser, in-memory on server).
- `activeRestaurantId` is React state only — NOT in localStorage.
- Role, membership, and settings come from Supabase queries, not client storage.

## Next Task

**Build 1.2 — Ingredients Database.**

Introduce `ingredients` and `ingredient_cost_state` tables, supplier linkage, and swap `/ingredients` page from mock to Supabase.

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

## Backend Scope (NOT yet implemented)

- ingredients, ingredient_cost_state (Build 1.2)
- recipes, recipe_lines, recipe_dependency_edges (Build 1.3)
- menu_items, menu_profitability_snapshots (Build 1.4)
- ingredient_price_log, ingredient_snapshots, price_update_batches (Build 1.5)
- impact_cascade_runs, impact_cascade_items (Build 1.7)
- alerts, audit_events (Build 1.8)
- billing / subscriptions (Build 2.0)

## Routes Available

### Auth/Onboarding
`/login`, `/signup`, `/auth/callback`, `/onboarding/create-restaurant`

### Operational (mock data)
`/dashboard`, `/ingredients`, `/ingredients/$id`, `/recipes`, `/recipes/$id`, `/dish-analysis`, `/dish-analysis/$id`, `/menu-analytics`, `/impact-cascade`, `/impact-cascade/$batchId`, `/price-log`, `/price-trend`, `/alerts`

### Settings (Supabase data)
`/settings` (6 tabs: General, Units, Categories, Suppliers, Thresholds, Team)

### QA (protected)
`/qa-auth`, `/qa-calculations`, `/qa-data-integrity`, `/qa-settings-admin`

## What Remains Mock

All operational pages read from `src/data/mock.ts`.

## What Must Not Be Touched Next

- `src/data/mock.ts` — No migration to Supabase.
- `src/data/selectors.ts` — No selector logic changes.
- `src/lib/*.ts` — No calculation helper changes.
- `src/routes/qa-calculations.tsx` — No QA check modifications.
- `src/routes/qa-data-integrity.tsx` — No QA check modifications.
- No operational tables until their designated build.

## Known Limitations

- Google OAuth not enabled
- Operational data still mock
- Restaurant switcher limited (in-memory only)
- Team management placeholder
- Suppliers not linked to ingredients yet (Build 1.2)
- Custom unit management not exposed
