# Current State

**Date:** 2026-05-10
**Build:** 3.0 — Recipe CSV Import
**Branch:** `build-2.9-menu-price-audit` (3.0 implemented on top of 2.9A)
**Backend:** Self-owned Supabase project `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`) — currently reused as live backend by explicit user choice.
**Frontend hosting:** Vercel project `margin-maestro` — https://margin-maestro.vercel.app

---

## Actual State

**Beta live on Vercel.** Email/password + Google OAuth sign-in, both verified on the live URL. All 23 expected public tables present (Build 2.9 migration applied; Build 3.0 adds **no** new tables), RLS enforced. Operational chain Supabase-backed end-to-end. Apply Price + manual dish recipe edits + recipe CSV import (Build 3.0) all write to an append-only `menu_price_audit_log`. Recipe CSV Import (two-file: recipes + lines) is now available in Settings → Import / Export.

## Build 2.9 highlights

- New table `menu_price_audit_log` (migration `20260510170000_build_2_9_menu_price_audit_trail.sql`) — **migration not auto-applied; run `supabase db push` to deploy**.
- New API: `src/data/api/menuPriceAuditApi.ts` (5 functions).
- Apply Price (`applyDishMenuPrice`) now records `source='apply_price'` audit entries, returns `ApplyPriceResult { audit_recorded, audit_error, old_menu_price, new_menu_price }`.
- Manual dish recipe edits (`updateRecipe` with `menu_price` patch) now record `source='manual_recipe_edit'` audit entries when the price actually changes.
- New read-only audit history panel on `/dish-analysis/$id`.
- New automated QA route `/qa-menu-price-audit` (checks A–U).
- `/qa-mvp-readiness` and `/qa-beta-launch` updated with the new expected table and Build 2.9 status checks.
- Settings → Developer QA includes link to `/qa-menu-price-audit`.
- E2E `qa-routes.spec.ts` includes the new QA route.

## Live deployment summary

- Live URL: https://margin-maestro.vercel.app
- Vercel project `margin-maestro` (auto-deploy on push to `main`)
- SSR via `api/server.mjs` (TanStack Start fetch handler wrapper)
- Supabase Auth Site URL + Redirect URLs configured (`supabase/config.toml [auth]`)
- Vercel env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, plus non-prefixed fallbacks. No service role / Stripe / Google secret in browser env.

## Known live limitations / risks

- Live backend reuses dev Supabase project (OI-16, → Build 3.2).
- Stripe verification deferred (OI-17, → Build 2.2B).
- Sentry DSN optional / unset (OI-19, → Build 3.3).
- Transactional invite emails deferred (OI-20, → Build 3.1).
- Google OAuth production hardening pending (OI-21).
- Audit insert is client-orchestrated, not atomic with the price update — the UI surfaces a warning when the audit row fails; price update remains.

## Build 3.0 highlights

- **No migration** — no new tables, no schema changes, no RLS changes.
- New API: `src/data/api/recipeImportApi.ts` (templates, parsers, validators, preview, apply, recipe-lines export).
- New types: `RecipeImportRecipeRow`, `RecipeImportLineRow`, `RecipeImportPreview`, `RecipeImportOptions`, `RecipeImportApplyResult`.
- Settings → Import / Export gains an "Import Recipes" card with two CSV uploads, duplicate-handling selector, line-handling selector, preview, and apply (gated to owner/manager).
- Export Recipe Lines added to the Export list.
- Apply phase orchestrates: `createRecipe` / `updateRecipe` → cycle-checked `replaceRecipeLines` or direct insert → `menu_price_audit_log` row with `source = 'import'` for dish menu prices.
- New automated QA route `/qa-recipe-import` (checks A–Y).
- `/qa-mvp-readiness` adds check Z; `/qa-beta-launch` adds check AI; `/qa-import-export` adds checks W–X.
- E2E spec includes `/qa-recipe-import` (no mutating tests by default).

## Build 2.9A acceptance highlights

- `menu_price_audit_log` migration applied to live Supabase (`atdvrdhzcbtxvzgvoxhb`).
- Live verification confirmed:
  - Table exists, RLS enabled.
  - SELECT policy for restaurant members.
  - INSERT policy for owner/manager (using `has_restaurant_role(restaurant_id, array['owner','manager'])`).
  - **No UPDATE policy. No DELETE policy.** Append-only.
  - Apply Price writes audit rows.
  - Apply Price does **not** write `ingredient_price_log`, **not** create `price_update_batches`, **not** create billing records.
  - Dish Analysis audit panel shows recent entries.
- Build label updated to "Build 2.9A — Menu Price Audit Accepted".
- Migration RLS check signature was patched mid-build to use the project-wide `array['owner','manager']` form (matching builds 1.2/1.3/1.5/1.7/1.8). Migration is now safe to re-run after partial failures.

## Next Steps

1. Build 3.0A — Recipe CSV Import Acceptance (live verification).
2. Build 3.2 — Separate Production Supabase Migration.
3. Build 2.2B — Stripe Test Verification.
4. Build 3.1 — Transactional Invite Emails.
5. Build 3.3 — Production Monitoring Provider Setup.
6. Build 3.4 — Menu Price Audit / Recipe Import Atomic RPC (closes OI-28).
