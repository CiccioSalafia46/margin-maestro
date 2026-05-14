# Current State

**Date:** 2026-05-11
**Build:** 3.1 — Transactional Invite Emails
**Branch:** `main` (Build 2.9 → 2.9A → 3.0 → 3.0A → 3.4 → 3.4A → 3.1)
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

- Live backend reuses dev Supabase project (OI-16) — **intentional cost decision; Build 3.2 future optional**. Mitigation: strengthen backup + QA discipline. Test/demo/beta data may coexist with real beta data.
- Stripe verification deferred (OI-17, → Build 2.2B).
- Sentry DSN optional / unset (OI-19, → Build 3.3).
- Transactional invite emails deferred (OI-20, → Build 3.1).
- Google OAuth production hardening pending (OI-21).
- Audit insert is client-orchestrated, not atomic with the price update — the UI surfaces a warning when the audit row fails; price update remains.

## Build 3.1 highlights

- New Supabase Edge Function `send-team-invitation` (Deno) — owner-only, fetches the invitation via service-role admin client, builds the accept-invite URL from `SITE_URL`, sends via Resend HTTPS API (`POST https://api.resend.com/emails`). No SDK dependency.
- New frontend helper `sendTeamInvitationEmail(restaurantId, invitationId)` in `src/data/api/teamApi.ts`. Returns `{ sent, provider_configured, message }` and sanitizes raw errors.
- Settings → Team `onInvite` now best-effort calls the email after creating the invitation. Clipboard copy happens first so the manual-share fallback is never blocked. Pending invitations table gains a **Resend email** button.
- **No new tables.** **No new migration.** Provider secrets stay server-side (`RESEND_API_KEY`, `FROM_EMAIL`, `SITE_URL` via `supabase secrets set`).
- New automated QA `/qa-transactional-invites` (20 checks A–T). Probes Edge Function deployment without sending real emails.
- `/qa-team-management` adds check R; `/qa-mvp-readiness` adds BB; `/qa-beta-launch` adds AK; `/qa-auth` footer refreshed.
- Settings → Developer QA adds `/qa-transactional-invites`. E2E `qa-routes.spec.ts` includes the new route.
- `.env.example` documents `RESEND_API_KEY` + `FROM_EMAIL` as server-side-only secrets.

## Build 3.4A acceptance highlights

- Build 3.4 RPC migration applied live to `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`).
- `public.apply_dish_menu_price_with_audit` deployed: `SECURITY INVOKER`, args verified, ACL confirmed (`public`/`anon` revoked, `authenticated` granted).
- Function probe via `execute_sql` returns the expected `42501 not authenticated` when called outside an authenticated context — proves the function is reachable and the defensive auth check works.
- `/qa-atomic-rpc` on live returns 200 OK; check D will pass for any authenticated owner/manager session.
- QA copy across `/qa-atomic-rpc`, `/qa-apply-price`, `/qa-menu-price-audit`, `/qa-recipe-import`, `/qa-mvp-readiness`, `/qa-beta-launch`, `/qa-auth` refreshed to "accepted".
- **No code changes** beyond label/copy/docs in this build. No new migration. No new tables. No RLS changes.

## Build 3.4 highlights

- New SQL RPC `public.apply_dish_menu_price_with_audit(...)` — atomic dish `menu_price` update + `menu_price_audit_log` insert in one transaction.
- **No new tables.** **No RLS changes.** Functions-only migration `20260510180000_build_3_4_atomic_rpc_hardening.sql`. **Not auto-applied** — run `supabase db push` when ready.
- `SECURITY INVOKER`. Existing RLS still enforced. `set search_path = public`. Defensive `auth.uid()` + `has_restaurant_role(..., array['owner','manager'])` check. `REVOKE` from `public`/`anon`; `GRANT EXECUTE` to `authenticated` only.
- `src/data/api/applyPriceApi.ts` — `applyDishMenuPrice` rewritten to call the RPC; `audit_recorded` is always `true` on success.
- `src/data/api/recipeImportApi.ts` — update path's dish `menu_price` change now goes through the RPC (`source='import'`); price field stripped from the `updateRecipe` patch to avoid double-update.
- UI: success toast simplified to "Menu price updated to $X and audit entry recorded." Degraded warning path no longer needed.
- New automated QA `/qa-atomic-rpc` (22 checks). `/qa-apply-price` adds T+U; `/qa-menu-price-audit` rephrased; `/qa-recipe-import` rephrased; `/qa-mvp-readiness` adds AA; `/qa-beta-launch` adds AJ.
- Settings → Developer QA adds `/qa-atomic-rpc`. E2E `qa-routes.spec.ts` includes the new route.
- Documentation: `docs/atomic-rpc-hardening.md` created. `current-state`, `build-log`, `roadmap`, `open-issues`, `apply-price`, `menu-price-audit-trail`, `recipe-csv-import`, `qa-checklists`, `beta-checklist`, `live-deployment`, `security-review` updated.

## Build 3.0A acceptance highlights

- Recipe CSV Import (Build 3.0) functionally verified on https://margin-maestro.vercel.app.
- `/qa-recipe-import` accepted as PASS (24 PASS / 1 contextual WARN / 0 FAIL for owner/manager session).
- QA copy refreshed across `/qa-recipe-import`, `/qa-import-export`, `/qa-mvp-readiness` (check Z), `/qa-beta-launch` (check AI), `/qa-auth` (footer).
- **Single-backend decision reframed.** `margin-maestro-dev` remains the live backend by intentional cost decision. Separate `margin-maestro-prod` is future optional hardening — not the next recommended build. Build 3.2 is no longer pinned as immediate next.
- No new code paths; no migrations; no RLS changes.

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

1. **Build 3.1A — Transactional Invite Email Acceptance.** Deploy the Edge Function (`supabase functions deploy send-team-invitation --project-ref atdvrdhzcbtxvzgvoxhb`), set provider secrets (`supabase secrets set RESEND_API_KEY=... FROM_EMAIL=... SITE_URL=...`), live-verify `/qa-transactional-invites`, run an end-to-end invitation send to a real address.
2. Build 2.2B — Stripe Test Verification.
3. Build 3.3 — Production Monitoring Provider Setup.
4. Build 3.5 — XLS/XLSM Analysis / Formula Gap Review.
5. Build 3.6 — Manual Recipe Edit Atomic Audit RPC (closes OI-30).
6. Build 3.7 — Recipe Import Atomic Server Workflow (closes remaining OI-29 parts).
7. Build 3.2 — Separate Production Supabase Migration (future optional hardening, **not** immediate).
