# Settings/Admin Reference Layer — Build 1.1

This document describes the reference data layer added in Build 1.1. The
goal is to make the Settings/Admin area real and tenant-scoped while the
rest of the app keeps using mock operational data.

## Tables added

### `public.units` (global)

Catalog of supported units of measure. Read-only for clients.

| Column | Type | Notes |
| --- | --- | --- |
| `code` | text PK | e.g. `Gr`, `Kg`. |
| `label` | text | Display name. |
| `family` | text | `mass` \| `volume` \| `count`. |
| `base_unit_code` | text | The base unit within the family. |
| `to_base_factor` | numeric | Multiplier from this unit to its base unit. |
| `is_active` | boolean | Reserved for future toggling. |
| `sort_order` | integer | UI ordering. |

**Seeded units:** `Ct`, `Gr`, `Kg`, `Lb`, `Oz`, `Ml`, `Lt`, `Gl`.

### `public.unit_conversions` (global)

Explicit conversion rules. Read-only for clients.

- All same-family pairs are seeded (mass↔mass, volume↔volume, count↔count)
  with `factor = from.to_base_factor / to.to_base_factor`,
  `requires_density = false`.
- **Cross-family conversions are not seeded.** Mass↔volume requires
  ingredient density and must be modeled with `requires_density = true`
  when introduced.
- `Ct` only converts to `Ct`.

### `public.menu_categories` (per-restaurant)

Configurable, soft-deletable menu categories scoped to a restaurant.

- Unique on `(restaurant_id, lower(name))`.
- Soft delete via `is_active = false` (no hard-delete RLS policy).

### `public.suppliers` (per-restaurant)

Supplier directory scoped to a restaurant. Not yet linked to ingredients.

- Unique on `(restaurant_id, lower(name))`.
- Soft delete via `is_active = false`.

## Default data on restaurant creation

`create_restaurant_with_owner(p_name)` now (in addition to creating the
restaurant, owner membership, and default settings) calls
`initialize_restaurant_reference_data(p_restaurant_id)` to seed:

- **Menu categories** — Appetizers & Salads, The Classics, Signature
  Dishes, Specials, Desserts, Pizzeria, Wine, Beer, Non-alcoholic
  beverages, Intermediate.
- **Demo suppliers** — Mediterraneo Imports, Local Greens Co.,
  Dairy & Oil Co., House Prep.

Both inserts use the unique indexes above so re-runs are idempotent.

A one-time backfill in the migration also seeded these defaults for any
restaurants that existed before Build 1.1.

## RLS / role permissions

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `units` | authenticated | — | — | — |
| `unit_conversions` | authenticated | — | — | — |
| `menu_categories` | members | owner, manager | owner, manager | — (soft delete) |
| `suppliers` | members | owner, manager | owner, manager | — (soft delete) |
| `restaurant_settings` | members | — | **owner only** | — |

Membership and role checks reuse the Build 1.0 helpers
`is_restaurant_member(uuid)` and `has_restaurant_role(uuid, text[])`.

## SQL functions / triggers

- `initialize_restaurant_reference_data(uuid)` — `SECURITY DEFINER`,
  `SET search_path = public`. Validates that `auth.uid()` is a member of
  the target restaurant before seeding. EXECUTE revoked from
  `PUBLIC`/`anon`, granted to `authenticated`.
- `create_restaurant_with_owner(text)` — extended to call the helper.
- `tg_set_updated_at()` triggers on `menu_categories` and `suppliers`.

## Settings UI behavior

`/settings` tabs (now backed by Supabase):

| Tab | Owner | Manager | Viewer |
| --- | --- | --- | --- |
| General (restaurant profile + currency/locale/timezone/tax mode/target GPM) | edit | read-only | read-only |
| Units & Conversions | read-only (global) | read-only | read-only |
| Menu Categories | add / rename / activate-deactivate | add / rename / activate-deactivate | read-only |
| Suppliers | add / rename / activate-deactivate | add / rename / activate-deactivate | read-only |
| Alert Thresholds | edit | read-only | read-only |
| Team | read-only placeholder | read-only placeholder | read-only placeholder |

UI safety:
- Loading + error states on every panel.
- Success toasts on save.
- Required-field validation client-side; duplicate-name errors mapped to
  a friendly toast.
- Form fields disabled when the role lacks permission.
- No raw SQL errors are surfaced.

## API layer

All calls go through `src/data/api/settingsApi.ts` using the browser
Supabase client (RLS enforced). No service role is used in the client.

Errors are normalized to `ApiError` with codes `auth`, `permission`,
`duplicate`, `validation`, `not_found`, `unknown`.

Functions:
`getRestaurantSettings`, `updateRestaurantSettings`, `updateRestaurantName`,
`getUnits`, `getUnitConversions`,
`getMenuCategories`, `createMenuCategory`, `updateMenuCategory`,
`getSuppliers`, `createSupplier`, `updateSupplier`,
`initializeRestaurantReferenceData`.

## Known limitations

- Custom unit management not yet exposed.
- Suppliers not yet linked to ingredients.
- Reorder UI for menu categories not yet implemented (uses raw
  `sort_order`).
- Hard-delete is intentionally not enabled — soft delete only.
- Team management remains a placeholder.
- All operational data (ingredients, recipes, etc.) is still mock.

## Linter notes

The Supabase linter reports `WARN` entries
(`0029_authenticated_security_definer_function_executable`) for the
SECURITY DEFINER helpers. These are **intentional and accepted**: signed-in
users must be able to call `is_restaurant_member`, `has_restaurant_role`,
`create_restaurant_with_owner`, and
`initialize_restaurant_reference_data` for RLS and onboarding to work.
EXECUTE is restricted to the `authenticated` role and each function
performs its own membership/auth checks where applicable.
