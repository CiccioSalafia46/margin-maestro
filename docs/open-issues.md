# Open Issues

Known issues and limitations for Margin IQ. Updated for Build 2.8A.

---

## Resolved

### OI-01 — Auth session lost on refresh / navigation
**Severity:** Critical · **Status:** Resolved — Build 1.0E/1.0F.

### OI-02 — /qa-auth shows sign-in required after login
**Severity:** Critical · **Status:** Resolved — Build 1.0E-A/1.0F.

### OI-03 — Settings/Admin pending re-acceptance
**Severity:** High · **Status:** Resolved — Build 1.1A.

### OI-05 — Google OAuth not enabled
**Severity:** Medium · **Status:** Resolved — Build 2.8 (implementation) and Build 2.8A (live verification on https://margin-maestro.vercel.app).

### OI-12 — Vercel deployment not configured
**Severity:** High · **Status:** Resolved — Build 2.8A.
**Resolution:** Vercel project `margin-maestro` linked, `vercel.json` + `api/server.mjs` SSR wrapper added, env vars configured for Production and Preview.

### OI-13 — Live deployment not documented
**Severity:** Medium · **Status:** Resolved — Build 2.8A.
**Resolution:** `docs/live-deployment.md` created; `docs/current-state.md` and `docs/build-log.md` refreshed.

### OI-14 — Supabase Auth redirect URLs not documented
**Severity:** Medium · **Status:** Resolved — Build 2.8A.
**Resolution:** Site URL and 16 redirect URLs configured in `supabase/config.toml [auth]` and pushed to remote. Pattern documented in `docs/live-deployment.md`.

### OI-15 — `.env` tracked in git
**Severity:** Medium · **Status:** Resolved — Build 2.8A.
**Resolution:** `.env` removed from git tracking via `git rm --cached .env`. `.gitignore` hardened (`.env`, `.env.*.local`, `.vercel`, `supabase/.temp/`). The previously committed `.env` only contained URL + anon key for a stale Lovable sandbox project (`urcijgorzjxaclfyaulc`) that is not the current backend. No service-role / Stripe / Google secrets were ever in the file.

---

## High

### OI-16 — Single Supabase backend reused for live beta (intentional)
**Severity:** Medium · **Status:** Open by intentional decision · **Planned build:** 3.2 (future optional, **not** immediate).
**Description:** The live frontend (https://margin-maestro.vercel.app) points at `margin-maestro-dev` (`atdvrdhzcbtxvzgvoxhb`). The user has explicitly decided to keep a single Supabase backend during the beta phase to avoid an additional project cost (~$10/month). Test/demo/beta data may coexist with real beta data.
**Mitigation (current phase):** stronger backup + QA discipline on `margin-maestro-dev`. Recipe import preview-before-apply, append-only audit logs, RLS on every table, and "no automatic ingredient/category creation" rules limit the blast radius of data accidents.
**Acceptance criteria for Build 3.2 (when revisited):** new `margin-maestro-prod` project created, schema migrated, Vercel env re-pointed, dev project demoted back to non-production status. Trigger conditions: wider commercial rollout, paying customers onboarded, or compliance requirement.

---

## Medium

### OI-17 — Stripe test-mode verification not complete
**Severity:** Medium · **Status:** Open · **Planned build:** 2.2B.
**Description:** Billing UI and Edge Function stubs (`create-checkout-session`, `create-customer-portal-session`, `stripe-webhook`) are present, but the Stripe test-mode flow has not been exercised end-to-end on the live Vercel URL. `/qa-billing` reports WARN.
**Acceptance criteria:** Test checkout completes against live Supabase Edge Functions; webhook updates `billing_subscriptions`; customer portal accessible.

### OI-18 — Billing production rollout not complete
**Severity:** Medium · **Status:** Open · **Depends on:** OI-17.
**Description:** Beyond test verification, production rollout (live Stripe keys, public price IDs, plan tiers in UI) is not done.

### OI-19 — Sentry provider DSN not configured
**Severity:** Medium · **Status:** Open · **Planned build:** 3.3.
**Description:** Monitoring scaffolding exists (`src/lib/monitoring.ts`, `src/lib/logger.ts`, error boundary). Without `VITE_SENTRY_DSN` the helpers are no-ops. `/qa-monitoring` reports WARN for the DSN check.
**Acceptance criteria:** Sentry DSN configured in Vercel Production env; one verified test event captured; alerting wired.

### OI-20 — Transactional invite email delivery not implemented
**Severity:** Medium · **Status:** Open · **Planned build:** 3.1.
**Description:** Team invitations create rows in `restaurant_invitations` and the inviter copies the link manually. No email is sent.
**Acceptance criteria:** New invitations trigger an email containing the accept-invite link, via Supabase email or an external provider (Resend/Postmark).

### OI-21 — Google OAuth production hardening pending
**Severity:** Medium · **Status:** Open.
**Description:** Google OAuth works on the live URL, but the OAuth consent screen, authorized domains, and verification status have not been audited for production readiness (e.g., consent screen "Testing" vs. "In production", logo/policy URLs, PII review).
**Acceptance criteria:** Google Cloud OAuth client moved to "In production" with verified domains and complete consent screen content.

### OI-06 — Restaurant switcher limited
**Severity:** Medium · **Status:** Open by design.

### OI-07 — Production session strategy
**Severity:** Medium · **Status:** Tracking — current Supabase default localStorage session works on Vercel SSR; deeper hardening (httpOnly cookies, server-rendered session) not yet pursued.

---

## Low

### OI-22 — POS / external menu publishing not implemented
**Severity:** Low · **Status:** Out of MVP scope · **Planned build:** none.
**Description:** No integration with POS systems or external menu publishing. Margin IQ remains a decision layer.

### OI-23 — XLS/XLSM import not implemented
**Severity:** Low · **Status:** Open · **Planned build:** TBD.
**Description:** Only CSV import is supported. XLS/XLSM (with formulas) is not parsed.

### OI-24 — Recipe CSV import not implemented
**Severity:** Low · **Status:** Resolved — Build 3.0.
**Resolution:** Two-file recipe CSV import implemented (`recipes` + `recipe_lines`) via `src/data/api/recipeImportApi.ts` with preview, duplicate-handling and line-handling modes. Owner/manager only. Imported dish menu prices write `source='import'` rows to `menu_price_audit_log`. Recipe import does NOT create ingredients/suppliers/categories/batches/billing rows. See `docs/recipe-csv-import.md`.

### OI-29 — Recipe CSV import is not fully atomic
**Severity:** Low · **Status:** Partially resolved — Build 3.4. Open for create path and non-price fields.
**Build 3.4 partial resolution:** Recipe import's UPDATE path for dish `menu_price` now uses `apply_dish_menu_price_with_audit` RPC (source = 'import'). The menu_price column + audit row commit or roll back together.
**Remaining open:**
- Recipe creation (`createRecipe` + audit) is still client-orchestrated.
- Non-price recipe fields (name, category, serving, etc.) on the update path are still patched via `updateRecipe` separately from the RPC.
- Phase 2 (recipe lines `replaceRecipeLines` / append) is still separate from Phase 1.
**Acceptance criteria:** A broader `apply_recipe_import_atomic(...)` SQL function wrapping create + lines + audit. Lower priority now that the menu_price column is atomic.

### OI-25 — Supplier Marketplace not implemented
**Severity:** Low · **Status:** Out of approved scope per CLAUDE.md guardrails.

### OI-26 — Multi-location advanced management not implemented
**Severity:** Low · **Status:** Open.
**Description:** Restaurant switcher works across owned/joined restaurants, but advanced cross-location operations (consolidated dashboard, shared reference data, location-aware reporting) are not implemented.

### OI-27 — Menu price audit trail not implemented
**Severity:** Low · **Status:** Resolved — Build 2.9 / accepted Build 2.9A.
**Resolution:** `menu_price_audit_log` introduced with append-only RLS (no UPDATE / no DELETE policy). Apply Price (Build 2.4) and manual dish recipe `menu_price` edits both write audit rows. Read-only history panel on `/dish-analysis/$id`. New `/qa-menu-price-audit` route. Live verified at Build 2.9A: `pg_policies` confirms only SELECT (members) and INSERT (owner/manager) policies; no UPDATE / no DELETE; Apply Price does not write ingredient_price_log / batches / billing rows. See `docs/menu-price-audit-trail.md`.

### OI-28 — Menu price audit insert is not atomic with price update
**Severity:** Low · **Status:** Resolved for Apply Price — Build 3.4 / accepted Build 3.4A. Partially resolved for Recipe CSV Import update path.
**Resolution:** SQL function `public.apply_dish_menu_price_with_audit(...)` writes both `recipes.menu_price` and `menu_price_audit_log` in a single transaction. `applyDishMenuPrice` (Menu Analytics + Dish Analysis) calls this RPC exclusively. Recipe CSV Import update path also calls it for dish `menu_price` changes (source = 'import'). See `docs/atomic-rpc-hardening.md`.
**Remaining gap → OI-30 below:** `updateRecipe` (manual recipe edit) still writes a best-effort `manual_recipe_edit` audit row after a multi-field recipe update — not atomic. Deferred to keep the recipe save flow stable.

### OI-30 — Manual recipe edit audit is not atomic with recipe-fields update
**Severity:** Low · **Status:** Open · **Planned build:** TBD (Build 3.4+).
**Description:** When `/recipes/$id` saves a dish recipe with a changed `menu_price`, `updateRecipe` patches the row (name, category, serving, price, …) via a standard UPDATE, then best-effort inserts a `manual_recipe_edit` audit row. A failure of the audit insert leaves the row updated without an audit entry. The Build 3.4 atomic RPC only covers the `menu_price` column, not arbitrary recipe-field patches.
**Acceptance criteria:** Either a broader RPC `apply_dish_recipe_patch_with_audit(...)` covering common field combinations, or splitting the manual edit save into "non-price fields via updateRecipe + price via atomic RPC".

### OI-08 — Team management placeholder
**Severity:** Low · **Status:** Resolved — Build 2.1A. (Kept here for traceability.)

### OI-09 — Suppliers not linked to ingredients
**Severity:** Low · **Status:** Resolved — Build 1.2.

### OI-10 — Custom unit management not exposed
**Severity:** Low · **Status:** Open by design.

### OI-11 — Mobile polish
**Severity:** Low · **Status:** Open.
