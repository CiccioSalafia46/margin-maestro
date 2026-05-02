# Supabase Self-Owned Migration Checklist

Migrating from Lovable Cloud to a self-owned Supabase project (`margin-maestro-dev`).

---

## Why Move Away from Lovable Cloud

- Full control over the Supabase project (settings, auth config, email templates, OAuth providers).
- Direct access to the Supabase dashboard, SQL Editor, and logs.
- Ability to run the Supabase CLI locally for `supabase db push`, type generation, and local development.
- No dependency on Lovable's managed infrastructure for the database layer.
- The app code (TanStack Start on Cloudflare Workers) is already decoupled from Lovable's backend.

---

## Migration Order

Apply these migrations **in strict chronological order** to a fresh Supabase project. Each depends on the one before it.

| # | Filename | Build | Creates |
|---|----------|-------|---------|
| 1 | `20260501221010_743fd91b-8e58-43ad-b01e-2e2ff0dc17d0.sql` | 1.0 | `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings`, RLS helper functions (`is_restaurant_member`, `has_restaurant_role`, `create_restaurant_with_owner`), triggers (`handle_new_user`, `protect_sole_owner`, `tg_set_updated_at`), all RLS policies |
| 2 | `20260501221030_3c5dbef8-3482-40bc-98ee-95e30f4dda47.sql` | 1.0 | Permission cleanup — revokes public access to internal functions |
| 3 | `20260502100348_9d2456f1-2c77-4109-9c72-03bf2779bf6e.sql` | 1.0 | Permission hardening — comprehensive revoke/grant on all functions |
| 4 | `20260502100436_07b183fb-8b85-4e75-aa1b-2f2d6154b749.sql` | 1.0 | Final permission grants — grants execute to `authenticated` role |
| 5 | `20260502154215_1b86f875-17f7-47d8-896d-18fb0a5c827b.sql` | 1.1 | `units` (8 seed rows), `unit_conversions` (seeded), `menu_categories`, `suppliers`, `initialize_restaurant_reference_data()`, updated `create_restaurant_with_owner()` |
| 6 | `20260502200000_build_1_2_ingredients.sql` | 1.2 | `ingredients`, `ingredient_cost_state`, RLS policies, triggers |

### Expected Final Table List

After applying all 6 migrations, these tables should exist:

| Table | Scope | Build |
|-------|-------|-------|
| `profiles` | per-user | 1.0 |
| `restaurants` | per-user | 1.0 |
| `restaurant_members` | per-restaurant | 1.0 |
| `restaurant_settings` | per-restaurant | 1.0 |
| `units` | global | 1.1 |
| `unit_conversions` | global | 1.1 |
| `menu_categories` | per-restaurant | 1.1 |
| `suppliers` | per-restaurant | 1.1 |
| `ingredients` | per-restaurant | 1.2 |
| `ingredient_cost_state` | per-ingredient | 1.2 |

### Tables That Should NOT Exist

- `recipes`, `recipe_lines`, `recipe_dependency_edges` (Build 1.3)
- `menu_items`, `menu_profitability_snapshots` (Build 1.4)
- `ingredient_price_log`, `ingredient_snapshots`, `price_update_batches` (Build 1.5)
- `impact_cascade_runs`, `impact_cascade_items` (Build 1.7)
- `alerts`, `audit_events` (Build 1.8)
- `subscriptions` (Build 2.0)

---

## How to Apply Migrations

### Option A: Supabase SQL Editor (Manual)

1. Open your Supabase project dashboard → **SQL Editor**.
2. Apply each migration file **one at a time**, in the order listed above.
3. Copy the full SQL content of each file into the editor.
4. Click **Run**.
5. Verify no errors in the output.
6. Proceed to the next file.

**Do not skip files or change the order.**

### Option B: Supabase CLI

```bash
# Link to your project (one-time setup)
supabase link --project-ref <YOUR_PROJECT_REF>

# Push all migrations
supabase db push
```

The CLI reads migrations from `supabase/migrations/` in filename order and applies them sequentially. It tracks which migrations have been applied and skips already-applied ones.

**Do not store your database password or service-role key in any file that gets committed.** The CLI prompts for credentials interactively or reads from environment variables that should not be checked into version control.

---

## Environment Variable Update

After creating the new Supabase project, update your `.env.local` with the new project's credentials.

```bash
# .env.local — DO NOT COMMIT THIS FILE
VITE_SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<NEW_ANON_KEY>
SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<NEW_ANON_KEY>
```

Where to find these values:
1. Go to your Supabase project dashboard → **Settings** → **API**.
2. **Project URL** → use for both `VITE_SUPABASE_URL` and `SUPABASE_URL`.
3. **anon / public key** → use for both `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`.

### Forbidden Variables

| Variable | Rule |
|----------|------|
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | **NEVER set this.** Service-role keys must not be exposed to client code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never prefix with `VITE_`. Not needed for development. |

---

## Verification Steps After Migration

### 1. Check Tables Exist

In Supabase SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: `ingredient_cost_state`, `ingredients`, `menu_categories`, `profiles`, `restaurant_members`, `restaurant_settings`, `restaurants`, `suppliers`, `unit_conversions`, `units`.

### 2. Check RLS Is Enabled

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'profiles', 'restaurants', 'restaurant_members', 'restaurant_settings',
  'units', 'unit_conversions', 'menu_categories', 'suppliers',
  'ingredients', 'ingredient_cost_state'
);
```

All should show `rowsecurity = true`.

### 3. Check Functions Exist

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Expected: `create_restaurant_with_owner`, `handle_new_user`, `has_restaurant_role`, `initialize_restaurant_reference_data`, `is_restaurant_member`, `protect_sole_owner`, `tg_set_updated_at`.

### 4. Check Seed Data

```sql
SELECT code, label, family FROM public.units ORDER BY sort_order;
-- Expected: Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl

SELECT count(*) FROM public.unit_conversions;
-- Expected: 26+ conversion rules
```

### 5. App-Level Verification

1. Update `.env.local` with new project credentials.
2. Run `npm run dev`.
3. Open `/signup` — create a test account.
4. Complete onboarding (create restaurant).
5. Check `/qa-auth` — all auth checks should PASS.
6. Check `/qa-settings-admin` — all checks should PASS/WARN.
7. Check `/qa-ingredients` — table readable, cost state readable.
8. Check `/settings` — Units tab shows 8 units, Categories tab shows 10 defaults.
9. Check `/ingredients` — empty state for new restaurant (add one to test).

---

## Rollback Plan

If migrations fail partway through:

1. **Drop and recreate.** For a fresh project with no user data, the simplest rollback is to delete the project and create a new one, then re-apply migrations from the beginning.
2. **Partial rollback.** If only the last migration failed, you can drop the tables it created:
   ```sql
   DROP TABLE IF EXISTS public.ingredient_cost_state CASCADE;
   DROP TABLE IF EXISTS public.ingredients CASCADE;
   ```
   Then re-apply the corrected migration.

**Do not attempt partial rollbacks on a project with real user data** without a full backup.

---

## Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration 6 triggers/policies lack `DROP IF EXISTS` guards | Low | Only a problem if re-running. For a fresh project, runs cleanly once. |
| Migrations 2–4 are incremental permission tweaks | Low | Safe to run in order. Revoke/grant operations are idempotent. |
| Migration 5 modifies `create_restaurant_with_owner()` | Low | Uses `CREATE OR REPLACE`. Safe if migration 1 ran first. |
| Auth provider config differs between projects | Medium | Verify email confirmation settings, OAuth providers, and redirect URLs match the app's expectations. |
| Existing users/data from Lovable Cloud are NOT migrated | High | This checklist creates a fresh schema. User accounts and data from the old project are left behind. If data migration is needed, it must be done separately. |

---

## Security Rules

These rules apply to the new project and must be maintained:

- **No service-role key in client code.** The `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `VITE_` or imported in browser-side modules.
- **No tenant authorization from localStorage.** `activeRestaurantId`, role, membership, and settings must come from Supabase Auth + RLS + `restaurant_members`, never from client-side storage.
- **Official Supabase Auth session persistence only.** The app uses `persistSession: true` with Supabase's built-in storage default. No custom token management.
- **Database passwords and service-role keys must never be pasted into prompts, docs, commit messages, or any file that could be committed to version control.**

---

## Data Migration (Optional, Future)

This checklist creates a **fresh schema** with no user data. If you need to migrate existing users and data from the Lovable Cloud project:

1. Export data from the old project using `pg_dump` or Supabase's backup feature.
2. Import into the new project after all migrations have been applied.
3. Verify RLS policies work correctly with the imported data.
4. This is NOT covered by this checklist and should be planned separately.
