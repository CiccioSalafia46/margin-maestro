# Current State

**Date:** 2026-05-10
**Build:** 2.9 — Menu Price Audit Trail
**Branch:** `build-2.9-menu-price-audit`
**Backend:** Self-owned Supabase project `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`) — currently reused as live backend by explicit user choice.
**Frontend hosting:** Vercel project `margin-maestro` — https://margin-maestro.vercel.app

---

## Actual State

**Beta live on Vercel.** Email/password + Google OAuth sign-in, both verified on the live URL. All 22 expected public tables present (23 once Build 2.9 migration is applied), RLS enforced. Operational chain Supabase-backed end-to-end. Apply Price and manual dish recipe edits now write to an append-only `menu_price_audit_log`.

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

## Next Steps

1. Run `supabase db push` to deploy Build 2.9 migration to the live backend.
2. Build 2.9A — Menu Price Audit Acceptance (QA on live).
3. Build 2.2B — Stripe Test Verification.
4. Build 3.0 — Recipe CSV Import.
5. Build 3.1 — Transactional Invite Emails.
6. Build 3.2 — Separate Production Supabase Migration.
7. Build 3.3 — Production Monitoring Provider Setup.
