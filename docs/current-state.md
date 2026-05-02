# Current State

**Date:** 2026-05-02
**Build:** 1.0F — Auth Accepted
**Branch:** `build-1.0e-auth-session-fix`

---

## Actual State

**Auth session persistence is fixed and accepted.** Supabase Auth sessions now survive page refresh and navigation. The Supabase client uses the library's built-in localStorage default for session storage.

Build 1.1 (Settings/Admin Reference Data) is implemented in code and database. It needs manual re-acceptance (Build 1.1A) now that Auth works.

## Accepted Baseline

**Build 1.0F — Auth Accepted.**

- Login, signup, onboarding work end-to-end.
- Session persists across refresh and navigation.
- Sign out clears the session.
- `/qa-auth` is accessible as a protected diagnostic route.
- `/qa-auth` shows authenticated diagnostics after login.

## What Was Fixed in Build 1.0E/1.0F

- **Supabase client** (`src/integrations/supabase/client.ts`): Removed the Proxy singleton and the explicit `storage: typeof window !== 'undefined' ? localStorage : undefined` option. The previous code passed `storage: undefined` during SSR, overriding Supabase's built-in localStorage default. Now the client uses Supabase's default storage detection.
- **AuthGate** (`src/auth/AuthGate.tsx`): Removed `/qa-auth` from `PUBLIC_PATHS`. It was being treated as an auth-flow page, causing authenticated users to be redirected to `/dashboard`. Now only `/login`, `/signup`, and `/auth/callback` redirect authenticated users away.

## Sessions

- Supabase Auth session persistence: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.
- Storage: Supabase's built-in default (localStorage in browser, in-memory on server).
- `activeRestaurantId` is React state only — NOT in localStorage.
- Role, membership, and settings come from Supabase queries, not client storage.

## Next Task

**Build 1.1A — Settings/Admin Re-acceptance.**

Re-verify Settings/Admin reference data layer now that Auth session persistence works. Run `/qa-settings-admin` full suite.

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

### QA (protected)
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
- `supabase/migrations/` — No new tables or schema changes.
- No ingredients, recipes, menu_items, price log, snapshots, cascade, alerts, or billing tables.

## Known Limitations

See `docs/open-issues.md` for the full list.
