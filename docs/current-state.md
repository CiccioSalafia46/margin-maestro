# Current State

**Date:** 2026-05-02
**Branch:** `build-1.0e-auth-session-fix`

---

## Actual State

Build 1.1 (Settings/Admin Reference Data) is the most recent build implemented. The code and database tables exist. However, the **Auth session persistence is broken** (Build 1.0E), which means:

- Build 1.1 is **implemented but not fully accepted**. Re-acceptance is blocked until Auth works.
- All QA routes that require authentication (`/qa-settings-admin`, `/qa-calculations`, `/qa-data-integrity`) cannot be reliably tested.
- `/qa-auth` shows "Auth QA requires sign in" after page refresh.

## Accepted Baseline

The last fully accepted state was **Build 1.0B** (Auth stabilization). However, session persistence was explicitly documented as in-memory only at that time. Subsequent builds (1.0C, 1.0D, 1.1) were implemented on top.

## Not Yet Accepted

- **Auth session persistence** — `persistSession: true` is set in code (commit c1cede9) but sessions still do not survive page refresh.
- **Build 1.1 Settings/Admin** — Implemented but requires re-acceptance after Auth fix.

## Current Blocker

**Supabase Auth session is lost on refresh and page navigation.**

After login, the session works until the page is refreshed or a full navigation occurs. The Supabase client Proxy singleton in `src/integrations/supabase/client.ts` with conditional `typeof window` check for `storage` is the primary suspect.

## Next Task

**Build 1.0E — Persistent Supabase Session Hard Fix.**

See `docs/auth-session-debug-plan.md` for the detailed plan.

## Sessions

- Session persistence is configured as `persistSession: true` with `storage: localStorage` (conditional on `typeof window`).
- `activeRestaurantId` is React state only — NOT in localStorage.
- Role, membership, and settings come from Supabase queries, not client storage.

## Backend Scope (Supabase, live)

| Table | Build | Status |
|-------|-------|--------|
| `profiles` | 1.0 | Implemented |
| `restaurants` | 1.0 | Implemented |
| `restaurant_members` | 1.0 | Implemented |
| `restaurant_settings` | 1.0 | Implemented |
| `units` | 1.1 | Implemented |
| `unit_conversions` | 1.1 | Implemented |
| `menu_categories` | 1.1 | Implemented |
| `suppliers` | 1.1 | Implemented |

## Backend Scope (NOT yet implemented)

- ingredients, ingredient_cost_state (Build 1.2)
- recipes, recipe_lines, recipe_dependency_edges (Build 1.3)
- menu_items, menu_profitability_snapshots (Build 1.4)
- ingredient_price_log, ingredient_snapshots, price_update_batches (Build 1.5)
- impact_cascade_runs, impact_cascade_items (Build 1.7)
- alerts, audit_events (Build 1.8)
- billing / subscriptions (Build 2.0)
- CSV import/export (Build 1.9)
- Edge Functions (not planned — using TanStack Start createServerFn)

## Routes Available

### Auth/Onboarding
`/login`, `/signup`, `/auth/callback`, `/onboarding/create-restaurant`

### Operational (mock data)
`/dashboard`, `/ingredients`, `/ingredients/$id`, `/recipes`, `/recipes/$id`, `/dish-analysis`, `/dish-analysis/$id`, `/menu-analytics`, `/impact-cascade`, `/impact-cascade/$batchId`, `/price-log`, `/price-trend`, `/alerts`

### Settings (Supabase data)
`/settings` (6 tabs: General, Units, Categories, Suppliers, Thresholds, Team)

### QA
`/qa-auth`, `/qa-calculations`, `/qa-data-integrity`, `/qa-settings-admin`

## What Remains Mock

All operational pages read from `src/data/mock.ts`:
- Ingredients, recipes, recipe lines
- Menu items, menu prices
- Price batches, price log
- Cost states, snapshots
- Impact cascade
- Alerts
- Dashboard KPIs

## What Must Not Be Touched Next

- `src/data/mock.ts` — No migration to Supabase.
- `src/data/selectors.ts` — No selector logic changes.
- `src/lib/*.ts` — No calculation helper changes.
- `src/routes/qa-calculations.tsx` — No QA check modifications.
- `src/routes/qa-data-integrity.tsx` — No QA check modifications.
- `supabase/migrations/` — No new tables or schema changes in Build 1.0E.
- No ingredients, recipes, menu_items, price log, snapshots, cascade, alerts, or billing tables.

## Known Limitations

See `docs/open-issues.md` for the full list.
