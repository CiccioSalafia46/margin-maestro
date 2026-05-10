# Menu Price Audit Trail — Build 2.9

## Purpose

Margin IQ records every change to a dish recipe's `menu_price` in an append-only audit log so operators can:

- Reconstruct **who** changed **what** and **when**.
- See **how the price moved** (old → new, absolute and percent delta).
- Distinguish whether a change came from the **Apply Price** workflow or a **manual recipe edit**.
- Roll back conceptually (the old price is captured at the time of change), even though Margin IQ does not auto-revert.

This is **not** the ingredient price log. It does **not** publish prices to a POS or external menu. It does **not** create batches, alerts, or billing rows. It records the dish's menu price only.

## Distinction from other history surfaces

| Surface | Tracks | Build |
|---|---|---|
| `ingredient_price_log` | Supplier / ingredient cost changes | 1.5 |
| `ingredient_snapshots` | Ingredient cost baseline state | 1.5 |
| `price_update_batches` | Grouping of supplier-price updates | 1.5 |
| `impact_cascade_runs` / `impact_cascade_items` | Downstream impact of supplier-price batches | 1.7 |
| `alerts` | Operational signals (below target, spike, etc.) | 1.8 |
| **`menu_price_audit_log`** | **Dish menu price changes** | **2.9** |

Menu price changes do **not** write to any of the other tables.

## Table

`public.menu_price_audit_log` (Build 2.9 migration `20260510170000_build_2_9_menu_price_audit_trail.sql`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | default `gen_random_uuid()` |
| `restaurant_id` | `uuid not null` | FK → `restaurants.id` ON DELETE CASCADE |
| `recipe_id` | `uuid` | FK → `recipes.id` ON DELETE SET NULL |
| `recipe_name_at_time` | `text not null` | snapshot of dish name at the moment of change |
| `recipe_kind_at_time` | `text not null default 'dish'` | constrained to `'dish'` |
| `category_name_at_time` | `text` | snapshot of menu category name (best-effort) |
| `old_menu_price` | `numeric(18,6)` | nullable when the dish had no previous price |
| `new_menu_price` | `numeric(18,6) not null` | check `> 0` |
| `delta_amount` | `numeric(18,6)` | derived (new − old) |
| `delta_percent` | `numeric(18,8)` | derived (delta / old) when `old > 0` |
| `source` | `text not null` | one of `apply_price`, `manual_recipe_edit`, `import`, `system`, `other` |
| `context` | `jsonb` | structured origin (route, target_gpm, suggested_price, reason, etc.) |
| `note` | `text` | free-form note |
| `changed_by` | `uuid` | FK → `auth.users.id` ON DELETE SET NULL |
| `changed_at` | `timestamptz not null default now()` | |
| `created_at` | `timestamptz not null default now()` | |

Indexes on `restaurant_id`, `recipe_id`, `changed_at desc`, `source`, `changed_by`.

## RLS

- **SELECT** — `is_restaurant_member(restaurant_id)`. All members can read their restaurant's audit history.
- **INSERT** — `has_restaurant_role(restaurant_id, 'owner') or has_restaurant_role(restaurant_id, 'manager')`. Viewers cannot insert.
- **UPDATE** — no policy. Rows are immutable.
- **DELETE** — no policy. Rows are append-only.

No service-role usage in the browser. No cross-tenant reads. No broad `authenticated`-can-read-all policy.

## Where audit rows come from

### 1. Apply Price (`source = 'apply_price'`)

`src/data/api/applyPriceApi.ts:applyDishMenuPrice` (Build 2.4 + 2.9):

1. Validate role (owner/manager via `canApplyPrice`).
2. Read current recipe (name, kind, is_active, menu_price, category id).
3. Update `recipes.menu_price`.
4. Best-effort insert into `menu_price_audit_log` with:
   - `source = 'apply_price'`
   - `recipe_name_at_time`, `category_name_at_time`
   - `old_menu_price`, `new_menu_price`, derived `delta_amount` / `delta_percent`
   - `changed_by = auth.uid()`
   - `context = { origin, target_gpm, cost_per_serving, suggested_price, reason }`
5. Returns an `ApplyPriceResult` indicating whether the audit was recorded. The UI shows different copy:
   - success: *"Menu price updated to $X. Audit entry recorded."*
   - degraded: *"Price updated to $X, but audit entry could not be recorded. Please review later."*

Apply Price does **not** write `ingredient_price_log`, **not** create `price_update_batches`, **not** create billing rows, **not** trigger POS publishing.

### 2. Manual recipe edit (`source = 'manual_recipe_edit'`)

`src/data/api/recipesApi.ts:updateRecipe` (extended in Build 2.9):

When the patch includes `menu_price`, the function reads the recipe's prior `menu_price` and `kind` first, performs the update, and — if the recipe is a `dish`, the price actually changed, and the new price is `> 0` — best-effort inserts an audit row with `source = 'manual_recipe_edit'`. Failures are silent (the recipe save already committed).

Intermediate recipes never produce menu price audit rows (their `menu_price` is irrelevant).

### 3. Import / System / Other

The `source` field also accepts `'import'`, `'system'`, and `'other'` for future bulk-import or automated-process integrations. None of these are wired in Build 2.9.

## API helpers

`src/data/api/menuPriceAuditApi.ts`:

- `getMenuPriceAuditLog(restaurantId, filters?)` — list with optional filter by recipe, source, date range, limit. Sorted `changed_at desc`.
- `getMenuPriceAuditForRecipe(restaurantId, recipeId, limit = 50)` — convenience wrapper for the dish detail panel.
- `createMenuPriceAuditEntry(input)` — validation + delta computation + insert. Used by `applyPriceApi` and `recipesApi`. RLS enforces caller permissions.
- `validateMenuPriceAuditInput(input)` — synchronous client-side checks before insert.
- `deriveMenuPriceAuditSummary(entries)` — compute total + last-change snapshot for headers.

All errors pass through `toApiError(...)` so raw DB errors never surface in the UI.

## UI

- **`/dish-analysis/$id`** — read-only "Menu price audit history" panel listing the most recent 25 entries for the active dish (changed at, source label, old / new price, Δ, Δ%). Empty state explains that Apply Price + manual edits will populate it.
- **`/menu-analytics`** — Apply Price toast confirms whether the audit row was written.
- **`/qa-menu-price-audit`** — automated QA route (checks A–U). Linked from Settings → Developer QA. Not added to the main sidebar.
- **`/qa-mvp-readiness`** — adds the new table to `EXPECTED_TABLES` and a new check `Y` confirming Build 2.9 implementation.
- **`/qa-beta-launch`** — adds the new table and a new check `AH`.
- **`/qa-auth`** — footer mentions Build 2.9 and the audit guarantee.

## Append-only design

- No UPDATE policy on the table.
- No DELETE policy on the table.
- The Insert path computes the delta server-roundtripped numbers, but the DB is the source of truth: a CHECK ensures `new_menu_price > 0` and `recipe_kind_at_time = 'dish'`.

This guarantees that historical entries cannot silently drift even if the application code is changed in the future.

## Limitations

1. **Client-orchestrated, not atomic.** The price update and the audit insert are two separate statements. If the audit insert fails after the price update succeeds, the price change persists without an audit entry — the UI surfaces a clear warning to the operator. A future build can wrap this in a server-side function for atomicity.
2. **No approval workflow.** Apply Price still applies immediately when the operator confirms. There is no "pending approval" stage.
3. **No POS publishing.** Margin IQ does not push price changes to any POS, marketplace, or external menu. That is intentionally out of scope.
4. **No bulk imports.** The `source = 'import'` value exists for forward compatibility but is not yet exercised. Build 3.0 (Recipe CSV Import) may use it.
5. **`changed_by` is a user UUID.** Display in the UI requires joining with `profiles` if you want the human name; the audit panel currently does not display the actor.

## Recommended follow-ups

- **Build 2.9A — Menu Price Audit Acceptance.** Verify on a real dish on the live URL, confirm RLS scoping, confirm append-only nature, capture acceptance copy.
- **Build 2.2B — Stripe Test Verification.** Independent of audit work but next on the live readiness backlog.
- **Build 3.0 — Recipe CSV Import.** Will use `source = 'import'` for any menu-price-bearing import.
- **Server-side atomic wrapper.** A SQL function `apply_dish_menu_price_with_audit(...)` could remove the client-orchestration limitation.
