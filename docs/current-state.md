# Current State — Build 1.1A

**Phase:** Settings/Admin reference layer is **accepted**. Reference data
is verified, role permissions are reflected in the UI, and the QA
acceptance pass at `/qa-settings-admin` is in place. Operational pages
(dashboard, ingredients, recipes, menu analytics, etc.) still render
from the frontend mock dataset.

**Backend scope (Supabase, live):**
- Authentication (email/password)
- `profiles`
- `restaurants`
- `restaurant_members`
- `restaurant_settings`
- `units` (global, read-only)
- `unit_conversions` (global, read-only)
- `menu_categories` (per-restaurant)
- `suppliers` (per-restaurant)

**Backend scope (NOT yet implemented):**
- ingredients
- recipes / recipe lines
- menu_items
- price log
- ingredient snapshots
- impact cascade persistence
- alerts persistence
- billing / subscriptions
- CSV import/export
- Edge Functions

## What changed in Build 1.1A

- Build label updated to **Build 1.1A — Settings/Admin Accepted**
  (sidebar + dashboard).
- `/qa-settings-admin` expanded into a true acceptance dashboard:
  - Overall status (Pass / Warning / Fail) + per-section breakdown
    (Auth/Tenant, Settings, Reference data, RLS/Security, Role behavior).
  - Verifies required units (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl), unit
    families, and conversion factors (Kg=1000, Lb=453.592, Oz=28.3495,
    Lt=1000, Gl=3785.411784).
  - Verifies same-family conversions, Ct↔Ct only, and the absence of
    silent mass↔volume rules without `requires_density`.
  - Verifies `menu_categories` and `suppliers` are tenant-scoped via
    cross-tenant probe.
  - Verifies no operational tables (`ingredients`, `recipes`,
    `menu_items`, `ingredient_price_log`) have been created.
  - Verifies no service-role key in client env.
  - Manual no-op write smoke test for owners.
  - Static manual acceptance checklist (12 items).
- Documentation refreshed (this file + `docs/settings-admin-reference.md`).

## Sessions

- Sessions remain **in-memory only** (`persistSession: false`,
  `storage: undefined`). Production session persistence remains a future
  task.
- No `localStorage activeRestaurantId` is used. Active restaurant is
  selected by `AuthProvider` from `restaurant_members`.

## Operational pages (still mock)

`/dashboard`, `/ingredients`, `/recipes`, `/menu-analytics`,
`/dish-analysis`, `/impact-cascade`, `/price-trend`, `/price-log`,
`/alerts`, `/qa-calculations`, `/qa-data-integrity` continue to read from
`src/data/mock.ts`.

## Next build

**Build 1.2 — Ingredients Database** is the next planned build. It will
introduce the `ingredients` table, RLS, supplier linkage, and migration
of the `/ingredients` page from mock to Supabase.

## Known limitations

- Ingredients, recipes, menu items, price log, snapshots, impact
  cascade, alerts, and billing have **no backend persistence**.
- Suppliers exist in Settings but are **not yet linked to ingredients**.
- Switching restaurants in the topbar updates the active restaurant
  in memory only; mock pages do not yet re-scope.
- Custom unit management is not yet exposed; units table is read-only.
- Team management (invites, role changes) is not yet implemented.
- Role-specific RLS write tests in `/qa-settings-admin` are marked
  **Warning** when the current session's role can't exercise them.
- Google OAuth not enabled.
- Mobile is functional but not polished.
