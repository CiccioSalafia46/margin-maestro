# Atomic RPC Hardening — Build 3.4

## Purpose

Move the most safety-critical write flow — **a dish recipe's `menu_price` change plus the corresponding `menu_price_audit_log` row** — from a client-orchestrated multi-step path into a single server-side SQL function call so that the two writes either both commit or both roll back.

Before Build 3.4:

- `applyDishMenuPrice` performed three steps in the browser (read recipe → `UPDATE recipes` → `INSERT INTO menu_price_audit_log`).
- If the audit insert failed (RLS edge, network, etc.) the price update **already** persisted. The UI surfaced a degraded "audit could not be recorded" warning, but the historical record was incomplete.

After Build 3.4:

- `applyDishMenuPrice` performs a single `supabase.rpc('apply_dish_menu_price_with_audit', { … })` call.
- Both writes happen inside the same PL/pgSQL function (same transaction). A failure at any point rolls back the price update and the audit insert together.
- Recipe CSV Import's **update path** also routes its dish `menu_price` changes through the same RPC (source = `'import'`), so imported price changes get the same atomicity guarantee on the menu_price column.

## Function

`public.apply_dish_menu_price_with_audit(p_restaurant_id uuid, p_recipe_id uuid, p_new_menu_price numeric, p_source text default 'apply_price', p_note text default null, p_context jsonb default '{}'::jsonb) RETURNS TABLE(recipe_id uuid, old_menu_price numeric, new_menu_price numeric, audit_log_id uuid, changed_at timestamptz)`

### Authorization model

- **`SECURITY INVOKER`**. The function runs as the caller, so the existing RLS policies on `recipes` and `menu_price_audit_log` are still enforced when the SQL inside the function executes.
- `set search_path = public` to avoid schema-shadowing attacks.
- Defensive checks inside the function:
  - `auth.uid()` must be non-null (else `42501 not authenticated`).
  - `p_new_menu_price > 0` (else `22023`).
  - `p_source` must be one of `apply_price | manual_recipe_edit | import | system | other` (else `22023`).
  - `public.has_restaurant_role(p_restaurant_id, array['owner','manager'])` must return true (else `42501 permission denied: requires owner or manager role`).
  - The recipe row must exist for `p_restaurant_id`, must have `kind = 'dish'`, and must have `is_active = true`.
- Grant model:
  - `REVOKE ALL ... FROM public, anon` — anon and unauthenticated roles cannot execute it.
  - `GRANT EXECUTE ... TO authenticated` — only authenticated callers can attempt it; authorization is then enforced by the role check above and by RLS.
- No dynamic SQL. No `SECURITY DEFINER` (and so no risk of role-escalation regression).

### Behavior

1. Lock the target recipe row with `SELECT ... FOR UPDATE` so concurrent updates serialize.
2. Validate `kind = 'dish'` and `is_active = true`.
3. Look up `category_name` from `menu_categories` for the audit snapshot (best-effort).
4. Apply `UPDATE recipes SET menu_price = p_new_menu_price, updated_at = now() WHERE id = p_recipe_id AND restaurant_id = p_restaurant_id`.
5. Compute deltas:
   - `delta_amount = new - old` (null when prior was null).
   - `delta_percent = delta_amount / old_price` (null when prior was null or zero — avoids `NaN`/`Infinity`).
6. Insert the audit row with `source = p_source`, `context = coalesce(p_context, '{}')`, `changed_by = auth.uid()`, `changed_at = now()`.
7. Return a single row: `{ recipe_id, old_menu_price, new_menu_price, audit_log_id, changed_at }`.

## What is now atomic

- ✅ **Apply Price from `/menu-analytics`** — single RPC call. UI toast: "Menu price updated to $X and audit entry recorded." Failure ⇒ thrown error, no partial write.
- ✅ **Apply Price from `/dish-analysis/$id`** — identical.
- ✅ **Recipe CSV Import update path** for dish `menu_price` changes — `applyRecipeImport` strips `menu_price` from the recipe patch and routes the price change through the same RPC with `source = 'import'`. The audit row is now atomic with the price update.

## What remains non-atomic (documented limitations)

- **Manual recipe edit** (`/recipes/$id` Save). `updateRecipe` still writes a best-effort `manual_recipe_edit` audit row after the multi-field recipe update. A broader RPC that mixes price and non-price patches was deemed too risky for Build 3.4 (would require splitting the recipe-save flow). Tracked as OI-30 below.
- **Recipe CSV Import create path**. A new recipe is created via `createRecipe`, then a best-effort `source = 'import'` audit row is inserted with `createMenuPriceAuditEntry`. A larger "recipe-creation-with-audit" RPC was deferred to avoid expanding scope. Tracked as OI-29.
- **Recipe CSV Import non-price fields on update path**. Name / category / serving / etc. patches still go through the standard `updateRecipe` UPDATE. Only the `menu_price` portion of the update is atomic with its audit row. Tracked as OI-29.

## Where the audit row goes

Exactly the same table as before — `public.menu_price_audit_log`. The schema is unchanged. The function builds a row that is byte-equivalent to what `createMenuPriceAuditEntry` would have produced for the same inputs. The QA route `/qa-menu-price-audit` continues to inspect that table and its append-only RLS posture.

## Migration

`supabase/migrations/20260510180000_build_3_4_atomic_rpc_hardening.sql`

- Functions only — **no new tables**, no schema changes, no RLS changes.
- `CREATE OR REPLACE FUNCTION` is re-runnable.
- `REVOKE` / `GRANT` calls are idempotent.

### Deploy

The migration is **not auto-applied**. Run `supabase db push --project-ref atdvrdhzcbtxvzgvoxhb` to deploy. Recommended: take a Supabase point-in-time recovery checkpoint immediately before, given that the live backend is intentionally shared with dev (single-Supabase-backend decision; see `docs/live-deployment.md`).

## What the function does NOT do

- ❌ Does not write `ingredient_price_log`.
- ❌ Does not create `price_update_batches`.
- ❌ Does not create `billing_*` rows.
- ❌ Does not touch `ingredient_cost_state`.
- ❌ Does not publish to a POS, marketplace, or external menu.
- ❌ Does not create new ingredients / suppliers / categories.
- ❌ Does not affect intermediate recipes' menu prices (intermediates are rejected by the `kind = 'dish'` check).

## UI changes

- **Menu Analytics + Dish Analysis apply-price flows**: success toast now reads
  *"Menu price updated to $X and audit entry recorded."* The degraded "could not be recorded" warning path was removed — with the RPC it cannot fire on a successful price update.
- **Dish Analysis audit history panel** continues to refresh after Apply Price.

## QA

- **`/qa-atomic-rpc`** (new) — 22 checks (A–V): RPC existence probe, grant model (by code review), defensive role/kind/price/source validation, atomicity guarantee, API integration, recipe-import audit atomicity status, manual-recipe-edit limitation, side-effect absence, secret + localStorage scans.
- **`/qa-apply-price`** — extended with checks T and U for the atomic-RPC path.
- **`/qa-menu-price-audit`** — check I rephrased to describe atomic RPC.
- **`/qa-recipe-import`** — check U rephrased: update path uses RPC; create path remains best-effort.
- **`/qa-mvp-readiness`** — new check AA.
- **`/qa-beta-launch`** — new check AJ.
- **Settings → Developer QA** — link to `/qa-atomic-rpc` added.

## Recommended next builds

- Build 3.4A — Atomic RPC Acceptance (live verification: deploy migration, run Apply Price, confirm via `/qa-atomic-rpc` that the function is reachable and `audit_log_id` is returned).
- Build 3.1 — Transactional Invite Emails.
- Build 2.2B — Stripe Test Verification.
- Build 3.3 — Production Monitoring Provider Setup.
- Build 3.5 — XLS/XLSM Analysis / Formula Gap Review.

Note: **Build 3.2 (separate production Supabase project)** remains future optional hardening, not a recommended next step (per intentional cost decision documented at Build 3.0A).
