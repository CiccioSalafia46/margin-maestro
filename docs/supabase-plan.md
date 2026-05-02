# Supabase Architecture Plan

> **Origin:** Build 0.5B (planning only). Updated 2026-05-02 with current
> implementation status.
>
> **Implemented:** Builds 1.0 (Auth + Tenant) and 1.1 (Settings/Admin).
> Tables: profiles, restaurants, restaurant_members, restaurant_settings,
> units, unit_conversions, menu_categories, suppliers.
>
> **Current blocker:** Auth session persistence (Build 1.0E).
>
> **Not yet implemented:** Ingredients through Billing (Builds 1.2–2.0).
> The schema, function, and risk sections below remain the authoritative
> plan for those future builds.

This document defines the phased path from the current frontend-only mock
to a multi-tenant, RLS-protected Supabase backend for the Restaurant Margin
Intelligence Platform.

The core domain chain is preserved end-to-end:

```
ingredients → intermediate recipes → dish recipes →
menu analytics → price log → snapshot → impact cascade → alerts
```

---

## 1. Implementation Phases

| Build | Scope | Persists | New server logic |
|---|---|---|---|
| **1.0** | Auth + tenant foundation | `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings` | `has_restaurant_role()` SECURITY DEFINER helper |
| **1.1** | Settings/Admin reference data | `units`, `unit_conversions`, `menu_categories`, `suppliers` | seed reference data |
| **1.2** | Ingredients database | `ingredients`, `ingredient_cost_state` | `recalculate_ingredient_unit_cost()` |
| **1.3** | Recipes + recipe lines | `recipes`, `recipe_lines`, `recipe_dependency_edges` | `recalculate_recipe_cogs()`, cycle guard |
| **1.4** | Menu Analytics | `menu_items`, `menu_profitability_snapshots` | `recalculate_restaurant_costs()` |
| **1.5** | Price Log + Snapshot | `ingredient_price_log`, `ingredient_snapshots`, `price_update_batches` | `initialize_restaurant_baseline()`, `reset_baseline_non_destructive()` |
| **1.6** | Recalculation cascade | (no new tables) | `run_price_update_batch()` orchestrates 1.2–1.5 |
| **1.7** | Impact Cascade | `impact_cascade_runs`, `impact_cascade_items` | `generate_impact_cascade(batch_id)` |
| **1.8** | Alerts | `alerts`, `audit_events` | `generate_alerts_for_restaurant()` |
| **1.9** | CSV import/export | (no new tables) | streaming import server functions w/ validation |
| **2.0** | Billing | Stripe-managed external; `subscriptions` mirror table | webhook server route |

Each build is independently shippable. The mock UI remains the visual
contract; selectors/services swap to Supabase reads as each domain lands.

---

## 2. Database Schema

Conventions:

- All ids: `uuid` `default gen_random_uuid()` primary key.
- Money: `numeric(14,4)`. Percentages stored as fractions (`0..1`).
- All tenant-owned tables include `restaurant_id uuid not null references restaurants(id) on delete cascade`.
- All tables: `created_at timestamptz default now()`, `updated_at timestamptz default now()` with trigger.
- Soft delete: `deleted_at timestamptz null` on entity tables, never on log tables.

Read/write columns below: **FE-R** = frontend read via RLS, **FE-W** =
frontend write via RLS, **SRV** = server-only (service role / SECURITY
DEFINER).

### Core tenancy

#### `profiles`
- **Purpose:** App-level profile mirror of `auth.users`.
- **Key fields:** `id uuid pk references auth.users(id) on delete cascade`, `display_name`, `avatar_url`, `locale`.
- **Constraints:** 1:1 with `auth.users`.
- **Indexes:** pk only.
- **RLS:** user reads/updates only own row.
- **Access:** FE-R own, FE-W own. No SRV-only rows.

#### `restaurants`
- **Purpose:** Tenant root.
- **Key fields:** `id`, `name`, `slug unique`, `created_by uuid references auth.users(id)`, `currency default 'USD'`, `locale default 'en-US'`.
- **Indexes:** unique(`slug`), idx(`created_by`).
- **RLS:** members can read; only `owner` can update; insert allowed for any signed-in user (creates membership in same transaction via server function).
- **Access:** FE-R for members, FE-W (update) for owner only.

#### `restaurant_members`
- **Purpose:** Membership + role per tenant.
- **Key fields:** `restaurant_id`, `user_id references auth.users(id)`, `role app_role` enum `('owner','manager','viewer')`, `invited_by`, `joined_at`.
- **Constraints:** unique(`restaurant_id`,`user_id`); each restaurant must have ≥1 owner (enforced by trigger on delete/update).
- **Indexes:** unique(`restaurant_id`,`user_id`), idx(`user_id`).
- **RLS:** members can read rows of restaurants they belong to; only `owner` can insert/update/delete; user can delete *own* row (leave restaurant) unless they are sole owner.
- **CRITICAL:** Roles **never** stored on `profiles` or `auth.users`. All role checks go through `has_restaurant_role()` SECURITY DEFINER helper to avoid RLS recursion.

#### `restaurant_settings`
- **Purpose:** Per-tenant config (target GPM, tax mode, default units).
- **Key fields:** `restaurant_id pk`, `target_gpm numeric(5,4) default 0.78`, `tax_mode text check in ('ex_tax','inc_tax') default 'ex_tax'`, `default_units text[]`, `baseline_version int default 1`.
- **RLS:** members read; `owner`/`manager` update.
- **Access:** FE-R members, FE-W owner+manager.

### Reference

#### `units`
- **Purpose:** Allowed units of measure (`Ct, Gr, Kg, Lb, Oz, Gl, Lt, Ml`).
- **Key fields:** `code pk`, `kind text check in ('mass','volume','count')`, `display_name`.
- **RLS:** public read, no write from FE. Seeded by migration.

#### `unit_conversions`
- **Purpose:** Conversion factors between units of the same kind.
- **Key fields:** `from_uom`, `to_uom`, `factor numeric(18,9)`, `kind`.
- **Constraints:** unique(`from_uom`,`to_uom`); never `Ct ↔ *`.
- **RLS:** public read, SRV-only write.

#### `menu_categories`
- **Purpose:** Tenant-defined dish categories (Pasta, Pizza, Antipasti…).
- **Key fields:** `id`, `restaurant_id`, `name`, `sort_order`.
- **Constraints:** unique(`restaurant_id`,`name`).
- **RLS:** members read; `owner`/`manager` write.

#### `suppliers`
- **Purpose:** Tenant supplier directory.
- **Key fields:** `id`, `restaurant_id`, `name`, `contact_email`, `notes`.
- **Constraints:** unique(`restaurant_id`,`lower(name)`).
- **RLS:** members read; `owner`/`manager` write.

### Ingredients

#### `ingredients`
- **Purpose:** Raw ingredient catalog (Primary, Intermediate, Fixed).
- **Key fields:** `id`, `restaurant_id`, `name`, `type text check in ('Primary','Intermediate','Fixed')`, `supplier_id null`, `original_qty numeric(14,4) check (>0)`, `original_uom`, `total_cost numeric(14,4) check (>=0)`, `recipe_uom`, `adjustment numeric(6,4) check (adjustment <> -1)`, `conversion_on bool default true`, `density_g_per_ml numeric(10,4) null`, `linked_recipe_id null` (for Intermediate), `deleted_at null`.
- **Constraints:** unique(`restaurant_id`,`lower(name)`) where `deleted_at is null`. For `Intermediate`, `linked_recipe_id` required and must reference a recipe of type `Intermediate`.
- **Indexes:** unique name, idx(`restaurant_id`,`type`), idx(`supplier_id`).
- **RLS:** members read; `owner`/`manager` write.
- **Note:** `recipe_unit_cost` is **NOT** stored here. Lives in `ingredient_cost_state`.

#### `ingredient_cost_state`
- **Purpose:** Current confirmed unit cost per ingredient (the live state Snapshot diffs against).
- **Key fields:** `ingredient_id pk`, `restaurant_id`, `recipe_unit_cost numeric(18,8)`, `last_change_pct numeric(8,4) null`, `last_change_at timestamptz null`, `baseline_version int`.
- **RLS:** members read; **SRV-only write** (only updated by `recalculate_restaurant_costs` and `run_price_update_batch`).

#### `ingredient_price_log`
- **Purpose:** Append-only history of every confirmed cost change and baseline.
- **Key fields:** `id`, `restaurant_id`, `batch_id`, `ingredient_id`, `name_at_time`, `supplier_at_time`, `old_unit_cost null`, `new_unit_cost`, `delta`, `pct_change null`, `event text check in ('baseline','change')`, `baseline_version int`, `notes`, `created_at`, `created_by`.
- **Constraints:** **append-only**. RLS allows INSERT only via SRV functions; no UPDATE policy, no DELETE policy, ever.
- **Indexes:** idx(`restaurant_id`,`ingredient_id`,`created_at desc`), idx(`batch_id`).
- **RLS:** members read; **no FE-W**. SRV inserts only.

#### `ingredient_snapshots`
- **Purpose:** Last-confirmed cost per ingredient per `baseline_version`. Used to derive Δ in Menu Analytics.
- **Key fields:** `id`, `restaurant_id`, `ingredient_id`, `unit_cost`, `baseline_version`, `taken_at`.
- **Constraints:** unique(`ingredient_id`,`baseline_version`).
- **RLS:** members read; **SRV-only write** (only via baseline functions).

#### `price_update_batches`
- **Purpose:** Groups a price-update session (one or more changes confirmed together).
- **Key fields:** `id`, `restaurant_id`, `label`, `created_by`, `created_at`, `status text check in ('draft','committed','failed')`, `committed_at null`.
- **Note:** Aggregate fields (`ingredients_changed`, `dishes_affected`, `total_margin_impact_usd`) are **derived**, not stored — matches current `@deprecated` policy in `src/lib/types.ts`.
- **RLS:** members read; INSERT via SRV `run_price_update_batch` only.

### Recipes

#### `recipes`
- **Purpose:** Intermediate preparations and Dishes.
- **Key fields:** `id`, `restaurant_id`, `name`, `type text check in ('Intermediate','Dish')`, `category_id null references menu_categories(id)`, `serving_qty numeric check (>0)`, `serving_uom`, `linked_ingredient_id null` (for Intermediate), `deleted_at`.
- **Constraints:** unique(`restaurant_id`,`lower(name)`) where `deleted_at is null`. Intermediate must have `linked_ingredient_id` (the Intermediate ingredient it feeds).
- **RLS:** members read; `owner`/`manager` write.

#### `recipe_lines`
- **Purpose:** Ingredient × qty × uom per recipe.
- **Key fields:** `id`, `recipe_id`, `ingredient_id`, `qty numeric check (>0)`, `uom`, `sort_order`.
- **Constraints:** uom kind must be compatible with `ingredients.recipe_uom` kind (mass/volume/count) or density present; enforced at function boundary, not as DB check (too dynamic).
- **Indexes:** idx(`recipe_id`,`sort_order`), idx(`ingredient_id`).
- **RLS:** members read; `owner`/`manager` write — but writes go through a server function so dependency edges and recipe COGS are kept consistent in one transaction.

#### `recipe_dependency_edges`
- **Purpose:** Materialized DAG of "recipe X uses ingredient Y, which is fed by recipe Z". Enables fast cascade + cycle detection.
- **Key fields:** `restaurant_id`, `parent_recipe_id`, `child_recipe_id`, `via_ingredient_id`, `depth int`.
- **Constraints:** unique(`parent_recipe_id`,`child_recipe_id`,`via_ingredient_id`); must be acyclic.
- **RLS:** members read; **SRV-only write** (rebuilt by `recalculate_recipe_cogs`).

### Menu

#### `menu_items`
- **Purpose:** Dish menu placement (price + on/off menu).
- **Key fields:** `id`, `restaurant_id`, `recipe_id` (must be `Dish`), `menu_price numeric null`, `on_menu bool default true`, `estimated_monthly_units_sold int null`.
- **Constraints:** unique(`restaurant_id`,`recipe_id`).
- **RLS:** members read; `owner`/`manager` write.

#### `menu_profitability_snapshots`
- **Purpose:** Historical GP/GPM per dish at a point in time. Used for Δ vs snapshot in Menu Analytics and historical reports.
- **Key fields:** `id`, `restaurant_id`, `menu_item_id`, `cogs`, `cost_per_serving`, `gp`, `gpm`, `menu_price`, `on_target bool`, `taken_at`, `source_batch_id null`.
- **RLS:** members read; **SRV-only write** (taken automatically after `run_price_update_batch`).

### Intelligence

#### `impact_cascade_runs`
- **Purpose:** One run per committed `price_update_batch`.
- **Key fields:** `id`, `restaurant_id`, `batch_id unique`, `created_at`, `dishes_newly_below_target int`.
- **RLS:** members read; **SRV-only write** (`generate_impact_cascade`).

#### `impact_cascade_items`
- **Purpose:** Per ingredient × dish row in a cascade.
- **Key fields:** `id`, `run_id`, `restaurant_id`, `ingredient_id`, `recipe_id`, `pathway text check in ('Direct','Indirect')`, `impact_path text[]`, `old_unit_cost`, `new_unit_cost`, `old_cogs`, `new_cogs`, `delta_cogs`, `menu_price`, `old_gpm`, `new_gpm`, `delta_gpm`, `suggested_menu_price`, `status text check in ('on_target','below_target')`.
- **Indexes:** idx(`run_id`,`recipe_id`), idx(`run_id`,`ingredient_id`).
- **RLS:** members read; **SRV-only write**.

#### `alerts`
- **Purpose:** Derived operator-actionable alerts.
- **Key fields:** `id`, `restaurant_id`, `type text check in ('dish_below_target','ingredient_spike','dish_needs_price_review','intermediate_cost_shift')`, `severity text check in ('critical','warning','info')`, `status text check in ('open','acknowledged','resolved') default 'open'`, `title`, `summary`, `affected_recipe_id null`, `affected_ingredient_id null`, `source_batch_id null`, `created_at`, `acknowledged_at null`, `acknowledged_by null`, `resolved_at null`, `resolved_by null`.
- **RLS:** members read; **SRV inserts** only (`generate_alerts_for_restaurant`); status updates allowed via FE for `owner`/`manager` (acknowledge/resolve), via a tightly-scoped UPDATE policy that only permits status transition fields.

#### `audit_events`
- **Purpose:** Immutable audit trail (membership changes, baseline resets, batch commits, price overrides).
- **Key fields:** `id`, `restaurant_id`, `actor_user_id`, `event_type`, `entity_type`, `entity_id`, `payload jsonb`, `created_at`.
- **RLS:** `owner` read; **SRV-only write**. No UPDATE/DELETE.

---

## 3. Multi-Tenant Rules

- Authentication source: `auth.users` (Supabase Auth).
- App profile: `profiles` (1:1).
- Tenant: `restaurants`.
- Membership + role: `restaurant_members` with enum `app_role ∈ {owner, manager, viewer}`.
- Every tenant-owned row carries `restaurant_id` and is RLS-protected.
- A user accesses a restaurant **iff** a row exists in `restaurant_members` for `(auth.uid(), restaurant_id)`.

Role capabilities (default):

| Capability | owner | manager | viewer |
|---|:-:|:-:|:-:|
| Read everything in tenant | ✅ | ✅ | ✅ |
| Manage members + roles | ✅ | ❌ | ❌ |
| Update restaurant + settings | ✅ | ❌ | ❌ |
| CRUD ingredients/recipes/menu/categories/suppliers | ✅ | ✅ | ❌ |
| Run price update batch | ✅ | ✅ | ❌ |
| Reset baseline | ✅ | ❌ | ❌ |
| Acknowledge/resolve alerts | ✅ | ✅ | ❌ |
| Delete restaurant | ✅ (sole owner blocked unless explicit) | ❌ | ❌ |

Role checks **must** flow through:

```sql
create or replace function public.has_restaurant_role(
  _user_id uuid, _restaurant_id uuid, _role app_role
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurant_members
    where user_id = _user_id and restaurant_id = _restaurant_id
      and (role = _role
        or (_role = 'viewer'  and role in ('viewer','manager','owner'))
        or (_role = 'manager' and role in ('manager','owner')))
  )
$$;
```

This avoids the recursive-policy trap when policies on `restaurant_members`
need to consult `restaurant_members`.

---

## 4. RLS Policy Plan

Categories applied to every table:

### Reference (public read)
`units`, `unit_conversions`
- SELECT: `using (true)`.
- INSERT/UPDATE/DELETE: no policy → service role only.

### Tenant entity (member read, manager+ write)
`menu_categories`, `suppliers`, `ingredients`, `recipes`, `recipe_lines`,
`menu_items`
- SELECT: `using (has_restaurant_role(auth.uid(), restaurant_id, 'viewer'))`.
- INSERT/UPDATE: `using/with check (has_restaurant_role(auth.uid(), restaurant_id, 'manager'))`.
- DELETE: same as UPDATE, plus a referential check (e.g. cannot delete an ingredient referenced by an active `recipe_lines`) enforced by trigger or server function.

### Tenant config (member read, owner write)
`restaurants`, `restaurant_settings`, `restaurant_members`
- SELECT: members.
- INSERT/UPDATE/DELETE: `owner` only, with the sole-owner safety trigger on `restaurant_members`.
- `profiles`: SELECT/UPDATE limited to `auth.uid() = id`.

### Append-only logs
`ingredient_price_log`, `audit_events`
- SELECT: members (audit_events: owner only).
- INSERT: **no policy** → SRV functions only.
- UPDATE: **no policy ever**.
- DELETE: **no policy ever**.

### Server-managed state
`ingredient_cost_state`, `ingredient_snapshots`, `price_update_batches`,
`menu_profitability_snapshots`, `recipe_dependency_edges`,
`impact_cascade_runs`, `impact_cascade_items`
- SELECT: members.
- INSERT/UPDATE/DELETE: **no policy** → SRV functions only.

### Alerts (special case)
- SELECT: members.
- INSERT: SRV only.
- UPDATE: `owner`/`manager` may write **only** to `status`, `acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`. Enforced by column-grant + trigger that rejects changes to any other column.
- DELETE: none.

---

## 5. Server-Side Functions

All functions below are **TanStack Start `createServerFn` handlers** that
use the authenticated Supabase client (RLS-respecting) for reads, and
`supabaseAdmin` only where SRV-only tables must be written. Per project
conventions, **do not** use Supabase Edge Functions as the default server
layer.

Common contract:
- Inputs validated with Zod.
- Caller must be `manager` or `owner` (or `owner` where noted).
- All multi-table writes wrapped in a single PostgreSQL transaction (via
  a SECURITY DEFINER PL/pgSQL helper invoked by the server function) to
  preserve atomicity.
- All functions emit one or more `audit_events`.

### `recalculate_restaurant_costs(restaurant_id)`
- **Inputs:** `restaurant_id`.
- **Role:** `manager`.
- **Reads:** `ingredients`, `ingredient_cost_state`, `recipes`, `recipe_lines`, `menu_items`, `unit_conversions`.
- **Writes:** `ingredient_cost_state` (Intermediate ingredients), `recipe_dependency_edges` (rebuild), `menu_profitability_snapshots` (optional, when called as part of a batch).
- **Validations:** no cycles in dependency edges; conversion compatibility per line; `adjustment ≠ -1`; volume↔mass requires density.
- **Outputs:** `{ recipes_updated, ingredients_updated, warnings[] }`.
- **Errors:** `CycleDetected`, `MissingDensity`, `InvalidUnitConversion`, `InvalidAdjustment`.

### `run_price_update_batch(restaurant_id, changes[])`
- **Inputs:** `restaurant_id`, `changes: [{ ingredient_id, new_unit_cost, notes? }]`, `label?`.
- **Role:** `manager`.
- **Reads:** `ingredient_cost_state`, `ingredients`.
- **Writes (in one tx):**
  1. Insert `price_update_batches` (status=`draft`).
  2. For each change → INSERT `ingredient_price_log` (`event='change'`).
  3. UPDATE `ingredient_cost_state` (new cost, last_change_pct, baseline_version unchanged).
  4. Call `recalculate_restaurant_costs`.
  5. Take `menu_profitability_snapshots` for affected dishes.
  6. UPDATE batch `status='committed'`, `committed_at=now()`.
  7. Call `generate_impact_cascade(batch_id)`.
  8. Call `generate_alerts_for_restaurant(restaurant_id, batch_id)`.
- **Validations:** new_unit_cost ≥ 0; ingredient belongs to tenant; not soft-deleted.
- **Errors:** any step fails → tx rollback, batch `status='failed'` recorded outside tx via separate audit insert.

### `generate_impact_cascade(batch_id)`
- **Inputs:** `batch_id`.
- **Role:** SRV (called from `run_price_update_batch`); also callable by `manager` for re-run.
- **Reads:** `ingredient_price_log` (the batch), `ingredient_snapshots` (current baseline), `recipe_lines`, `recipe_dependency_edges`, `menu_items`, `restaurant_settings.target_gpm`.
- **Writes:** `impact_cascade_runs` (1 row), `impact_cascade_items` (N rows). Filters rows with |Δ| < 1e-6.
- **Validations:** batch is `committed`; cascade is idempotent per `batch_id` (unique).
- **Errors:** `BatchNotCommitted`, `BatchAlreadyHasCascade`.

### `generate_alerts_for_restaurant(restaurant_id, source_batch_id?)`
- **Inputs:** `restaurant_id`, optional `source_batch_id`.
- **Role:** SRV; also callable by `manager`.
- **Reads:** `menu_items`, recipe COGS view, `ingredient_price_log` (last batch), `ingredient_cost_state`, `restaurant_settings.target_gpm`.
- **Writes:** `alerts` (insert open alerts, dedupe by `(type, affected_*, source_batch_id)`).
- **Outputs:** `{ created_count, suppressed_count }`.

### `initialize_restaurant_baseline(restaurant_id)`
- **Inputs:** `restaurant_id`.
- **Role:** `owner`. One-shot per restaurant unless reset.
- **Reads:** `ingredients`, `ingredient_cost_state`.
- **Writes (in one tx):**
  1. Set `restaurant_settings.baseline_version = 1` (if null).
  2. Insert `ingredient_price_log` rows with `event='baseline'`, `baseline_version=1`, `old_unit_cost=null`.
  3. Insert `ingredient_snapshots` for each ingredient at `baseline_version=1`.
- **Errors:** `BaselineAlreadyInitialized`.

### `reset_baseline_non_destructive(restaurant_id)`
- **Inputs:** `restaurant_id`.
- **Role:** `owner`.
- **Writes (in one tx):**
  1. `restaurant_settings.baseline_version += 1` → `v_new`.
  2. Insert new `ingredient_price_log` rows `event='baseline'`, `baseline_version=v_new`, `old_unit_cost=current cost`, `new_unit_cost=current cost`, `delta=0`.
  3. Insert new `ingredient_snapshots` at `v_new`.
  4. **Do NOT** delete or update any prior `ingredient_price_log` or `ingredient_snapshots` rows.
- **Validations:** baseline must already exist.
- **Audit:** `audit_events` row with old/new versions.

---

## 6. Migration Strategy from Mock Data

1. **Introduce a data-access layer** (`src/data/api/*.ts`) that today re-exports the existing selectors, but is the single import surface for routes and components. Routes stop importing `src/data/mock.ts` directly.
2. **Phase-by-phase swap.** As each Build (1.0 → 1.8) lands a domain in Supabase, the corresponding `src/data/api/<domain>.ts` switches its implementation from mock selectors to `createServerFn` calls. Route components do not change.
3. **Keep calculation helpers** (`src/lib/units`, `cogs`, `margin`, `cascade`, `alerts`) as **frontend preview** logic — used in Dish Analysis scenarios, optimistic UI, and form previews.
4. **Server is source of truth** for any persisted COGS, GPM, snapshots, cascades, and alerts. The browser must never write to `ingredient_cost_state`, `ingredient_snapshots`, `ingredient_price_log`, `impact_cascade_*`, or `alerts.*` (other than the alert status fields).
5. **QA pages survive.** `/qa-calculations` continues to validate the *helpers* — they remain the same pure functions. `/qa-data-integrity` is extended to hit the live backend (per-tenant) and check uniqueness, cascade path validity, alert subject integrity. Helpful for catching frontend/server drift.
6. **Seed demo restaurant.** First-run onboarding offers an "Italian demo restaurant" seed that calls a server function `seed_demo_restaurant(restaurant_id)` populating ingredients/recipes/menu/baseline/initial cascade. Same Italian dataset as today.
7. **Remove `@deprecated` mock fields** from `PriceBatch` / `ImpactCascadeRun` once Build 1.7 ships and all UI consumes derived selectors backed by real data.

---

## 7. Risk List

| # | Risk | Mitigation |
|---|---|---|
| R1 | **RLS leakage** across tenants. | Every tenant table RLS-enforced via `has_restaurant_role()`. Add a CI check that lists all tables with no RLS policies and fails the build. |
| R2 | **Recursive RLS policy** on `restaurant_members`. | All membership checks flow through SECURITY DEFINER helpers, not inline subqueries on the same table. |
| R3 | **Duplicate ingredient/recipe names** per tenant. | Partial unique indexes on `(restaurant_id, lower(name))` where `deleted_at is null`. |
| R4 | **Circular recipe dependencies** (Intermediate A→B→A). | `recalculate_recipe_cogs` rebuilds `recipe_dependency_edges` in a topological pass; aborts with `CycleDetected` and rolls back. |
| R5 | **Volume↔mass conversion without density.** | Conversion helper returns `{ ok:false }`; server function rejects the line; UI surfaces a per-line warning. |
| R6 | **`adjustment = -1`** (division by zero). | DB check `adjustment <> -1`; helper validation with friendly message. |
| R7 | **Deleting an ingredient still used in active recipes.** | Soft-delete + trigger refusing if any non-soft-deleted `recipe_lines` reference it. |
| R8 | **Price log mutation** (drift, lost history). | No UPDATE / no DELETE policy on `ingredient_price_log`. Corrections go in as new rows with `notes`. |
| R9 | **Destructive baseline reset.** | Reset is non-destructive; bumps `baseline_version` and *adds* new baseline + snapshot rows; never deletes. |
| R10 | **Frontend / server calculation drift.** | Single set of TS calculation specs; QA suite validates both. Server is canonical for persisted values; FE is preview-only. |
| R11 | **Multi-tenant role mistakes** (e.g. viewer escalating). | Roles only in `restaurant_members`; no role columns on `profiles` or `auth.users`; column-grant + trigger restricts `alerts` UPDATE to status fields only. |
| R12 | **Sole-owner removal** leaves restaurant orphaned. | Trigger on `restaurant_members` rejects last-owner removal. |
| R13 | **Long-running price update batch** times out. | Batch logic in PL/pgSQL invoked from server function in single tx; bounded by per-tenant ingredient count; cap batch size in validation. |
| R14 | **Webhook / public route abuse.** | Only `/api/public/*` for external callers; HMAC verification mandatory; no PII in responses. |
| R15 | **Service role key leakage.** | `client.server.ts` never imported in components; lint rule blocks; `SUPABASE_SERVICE_ROLE_KEY` never aliased to `VITE_*`. |

---

## 8. Build 1.0 Prompt (proposed)

> Below is the exact prompt to run when you're ready. **Do not run it as
> part of Build 0.5B.** Build 0.5B is planning only.

```
Implement Build 1.0 — Auth + Tenant Foundation.

Use the current Build 0.5A frontend mock as the baseline, plus the plan in
docs/supabase-plan.md.

Important guardrails:
- Enable Lovable Cloud (Supabase under the hood). Do not mention Supabase in user-facing copy.
- Implement ONLY auth + tenant foundation. No ingredients, no recipes, no menu, no price log, no snapshots, no cascade, no alerts, no billing, no CSV.
- Do not touch existing /qa-calculations or /qa-data-integrity logic; they continue to operate against the mock data layer for now.
- Do not break the existing mock routes. They keep working against mock data behind a data-access layer.
- Do not implement Edge Functions. Use TanStack Start `createServerFn` for any server logic. Server routes only for webhooks under /api/public/*.
- Do not use SUPABASE_SERVICE_ROLE_KEY in client code. Do not import client.server.ts into components.

Scope:

1. Enable Lovable Cloud and wire up the generated Supabase clients
   (src/integrations/supabase/{client,client.server,auth-middleware}.ts).

2. Auth UI:
   - /login (email+password sign-in, plus "Sign in with Google").
   - /signup (email+password sign-up; on success, redirect to onboarding).
   - /logout action.
   - Auth state listener wired in the root provider; redirect unauthenticated
     users away from app routes to /login. Demo mock pages remain accessible
     under /demo/* (rename existing routes into /demo/* OR gate them behind
     a "demo mode" flag — choose the lighter touch).

3. Schema (one migration, all with RLS enabled):
   - app_role enum ('owner','manager','viewer')
   - profiles (1:1 with auth.users; trigger on auth.users insert creates row)
   - restaurants
   - restaurant_members (unique (restaurant_id, user_id))
   - restaurant_settings (1:1 with restaurants; defaults: target_gpm 0.78,
     tax_mode 'ex_tax', baseline_version 1)

4. SECURITY DEFINER helper:
   - public.has_restaurant_role(_user_id uuid, _restaurant_id uuid, _role app_role)
   - Use it in every membership/role-gated policy (no recursive subqueries
     against restaurant_members).

5. RLS policies per the plan:
   - profiles: self read/update.
   - restaurants: members read; owner update; insert allowed for any signed-in
     user but only via createServerFn `createRestaurant` which inserts the
     row AND the owner membership in one transaction.
   - restaurant_members: members read; owner write; trigger blocks last-owner
     removal; users may delete their own non-sole-owner row.
   - restaurant_settings: members read; owner+manager update.

6. Server functions (createServerFn, all with requireSupabaseAuth):
   - createRestaurant({ name, slug? }) → inserts restaurants + restaurant_members(owner) + default restaurant_settings, returns restaurant.
   - listMyRestaurants() → restaurants the current user belongs to.
   - getCurrentRestaurant(restaurant_id) → membership-checked detail.
   - inviteMember({ restaurant_id, email, role }) → STUB only; insert
     pending row OR no-op with toast. Do not send emails yet.
   - updateRestaurantSettings({ restaurant_id, patch }) → owner+manager.

7. Onboarding flow:
   - After first sign-in with no memberships → /onboarding/create-restaurant.
   - Form: name, target_gpm (default 0.78), tax_mode (default 'ex_tax').
   - On submit → createRestaurant → setActiveRestaurant → redirect /dashboard.

8. Restaurant switcher placeholder:
   - Topbar gains a small dropdown listing user's restaurants with a check
     mark on the active one. Selecting one updates a client-side
     activeRestaurantId (in-memory + URL search param ?r=…). No persistence
     beyond URL is required in Build 1.0.

9. Data-access abstraction:
   - Create src/data/api/ as the import surface for routes. For now it
     re-exports the existing mock selectors. Routes/components must import
     from src/data/api/* (not src/data/mock.ts). This sets up the swap path
     for Builds 1.1+.

10. QA:
    - /qa-calculations and /qa-data-integrity continue to pass against mock.
    - Add /qa-auth diagnostic page (signed-in user id, current restaurant id,
      role on current restaurant). Hidden from sidebar; linked from Settings →
      Developer QA.

11. Docs:
    - Update docs/current-state.md → "Build 1.0 — Auth + Tenant Foundation".
    - Add docs/auth-and-tenancy.md (sign-in flow, role table, helper function,
      onboarding, switcher).

Out of scope for Build 1.0:
- No ingredients/recipes/menu/price log tables.
- No Edge Functions.
- No billing.
- No real email invites.
- No CSV.
- No baseline / cascade / alerts logic.

Run typecheck. Fix TypeScript errors. Verify all main routes still render
(behind auth) and QA routes still pass.

After implementation, report:
1. Files created/changed.
2. Tables created and their RLS status.
3. Server functions added.
4. Auth flows tested (sign up, sign in, sign out, onboarding, switch).
5. Confirmation that helpers / mock selectors / QA still work.
6. Confirmation that no Edge Functions, no payments, no CSV, no ingredient
   /recipe/price tables, and no service-role key in client code were added.
7. Remaining limitations and what Build 1.1 will tackle.
```

---

## 9. Current Implementation Status (2026-05-02)

### Implemented

| Build | Tables | Functions | Status |
|-------|--------|-----------|--------|
| 1.0 | profiles, restaurants, restaurant_members, restaurant_settings | is_restaurant_member, has_restaurant_role, create_restaurant_with_owner, on_auth_user_created trigger, protect_sole_owner trigger | Implemented, session persistence broken |
| 1.1 | units, unit_conversions, menu_categories, suppliers | initialize_restaurant_reference_data | Implemented, pending re-acceptance |

### Not yet implemented

| Build | Tables | Functions |
|-------|--------|-----------|
| 1.2 | ingredients, ingredient_cost_state | recalculate_ingredient_unit_cost |
| 1.3 | recipes, recipe_lines, recipe_dependency_edges | recalculate_recipe_cogs, cycle guard |
| 1.4 | menu_items, menu_profitability_snapshots | recalculate_restaurant_costs |
| 1.5 | ingredient_price_log, ingredient_snapshots, price_update_batches | initialize_restaurant_baseline, reset_baseline_non_destructive |
| 1.6 | (none) | run_price_update_batch orchestrator |
| 1.7 | impact_cascade_runs, impact_cascade_items | generate_impact_cascade |
| 1.8 | alerts, audit_events | generate_alerts_for_restaurant |
| 1.9 | (none) | CSV import/export server functions |
| 2.0 | subscriptions | Billing webhook server routes |

### Server-side implementation approach

The project currently uses:
- **PL/pgSQL SECURITY DEFINER functions** for transactional operations (create_restaurant_with_owner, initialize_restaurant_reference_data)
- **TanStack Start createServerFn**: Not yet used for business operations (auth-middleware.ts exists but no server functions consume it)
- **Edge Functions**: Not used. Per project conventions, TanStack Start `createServerFn` is preferred.

Future server-side operations (Builds 1.2+) will use `createServerFn` handlers backed by PL/pgSQL helpers for multi-table transactional writes.

### Risks — current status

| Risk | Status |
|------|--------|
| R1: RLS leakage | Mitigated — all tenant tables have RLS via SECURITY DEFINER helpers |
| R2: Recursive RLS | Mitigated — membership checks via helpers, not inline subqueries |
| R3: Duplicate names | Not yet applicable — ingredients/recipes not in Supabase |
| R4: Circular dependencies | Not yet applicable — recipes not in Supabase |
| R5: Volume↔mass without density | Frontend helpers enforce — server enforcement in Build 1.2 |
| R6: adjustment = -1 | Frontend helpers enforce — server enforcement in Build 1.2 |
| R7: Delete ingredient in use | Not yet applicable |
| R8: Price log mutation | Not yet applicable — price log not in Supabase |
| R9: Destructive baseline | Not yet applicable |
| R10: FE/server drift | Not yet applicable — no server calculations |
| R11: Role mistakes | Mitigated — roles only in restaurant_members |
| R12: Sole-owner removal | Mitigated — trigger enforced |
| R13: Long batch timeout | Not yet applicable |
| R14: Webhook abuse | Not yet applicable |
| R15: Service key leakage | Mitigated — no VITE_* alias, client.server.ts not imported in components |
```
