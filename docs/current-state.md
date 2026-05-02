# Current State — Build 1.1

**Phase:** Settings/Admin reference layer is now backed by Supabase.
Operational pages (dashboard, ingredients, recipes, menu analytics, etc.)
still render from the frontend mock dataset.

**Backend scope (Supabase, live):**
- Authentication (email/password)
- `profiles`
- `restaurants`
- `restaurant_members`
- `restaurant_settings`
- `units` (global)
- `unit_conversions` (global)
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

## What changed in Build 1.1

- New tables: `units`, `unit_conversions`, `menu_categories`, `suppliers`.
- Onboarding (`create_restaurant_with_owner`) now also seeds default
  menu categories and demo suppliers via the new
  `initialize_restaurant_reference_data(p_restaurant_id)` helper.
- `/settings` is fully wired to Supabase: restaurant profile, units
  (read-only), categories, suppliers, alert thresholds, team (read-only).
- New QA route `/qa-settings-admin` (linked from Settings → Developer QA).
- Existing QA pages (`/qa-auth`, `/qa-calculations`, `/qa-data-integrity`)
  preserved.

## Sessions

- Sessions remain **in-memory only** (`persistSession: false`,
  `storage: undefined`). Production session persistence is still a future
  task.

## Operational pages (still mock)

`/dashboard`, `/ingredients`, `/recipes`, `/menu-analytics`,
`/dish-analysis`, `/impact-cascade`, `/price-trend`, `/price-log`,
`/alerts`, `/qa-calculations`, `/qa-data-integrity` continue to read from
`src/data/mock.ts`.

## Known limitations

- Ingredients, recipes, menu items, price log, snapshots, impact
  cascade, alerts, and billing have **no backend persistence**.
- Suppliers exist in Settings but are **not yet linked to ingredients**.
- Switching restaurants in the topbar updates `activeRestaurantId` only;
  mock pages do not yet re-scope.
- Custom unit management is not yet exposed; units table is read-only.
- Team management (invites, role changes) is not yet implemented.
- No multi-restaurant tenancy in mock pages.
- Google OAuth not enabled.
- Mobile is functional but not polished.
