# Build Log

Historical record of builds for Margin IQ — Restaurant Margin Intelligence SaaS.

---

## Build 0.1 — Frontend-only Mock UI Shell

**Status:** Accepted

- UI shell with sidebar navigation, topbar, AppShell layout
- TanStack Router file-based routing for all operational pages
- Mock data layer (`src/data/mock.ts`) with demo Italian restaurant
- Pages: dashboard, ingredients, recipes, dish analysis, menu analytics, impact cascade, price log, price trend, alerts
- No backend, no auth, no Supabase

---

## Build 0.2 — Calculation Core & QA Hardening

**Status:** Accepted

- Unit of measure helpers (`src/lib/units.ts`): mass (Gr, Kg, Lb, Oz), volume (Ml, Lt, Gl), count (Ct)
- Ingredient cost helpers (`src/lib/ingredientCost.ts`): original unit cost, recipe quantity, recipe unit cost
- Recipe COGS helpers (`src/lib/cogs.ts`): line costs, cost per serving
- Margin helpers (`src/lib/margin.ts`): GP, GPM, on-target, suggested menu price
- Impact cascade helpers (`src/lib/cascade.ts`): ratio method, direct/indirect pathways
- `/qa-calculations` checks A through J: unit conversions, trim loss, blocked conversions, density, adjustment validation, zero price handling, purity

---

## Build 0.3 — Derived Intelligence Layer

**Status:** Accepted

- Derived selectors (`src/data/selectors.ts`): dashboard KPIs, menu analytics rows, impact cascade, alerts, price trends
- Dashboard KPIs: avg GPM, below-target count, ingredient spike count, profit at risk
- Alert derivation: dish below target, ingredient spike, price review needed, intermediate cost shift
- Impact cascade builder from price log + snapshots
- Snapshot mock data (`src/data/snapshots.ts`): prior unit costs, estimated monthly units sold
- `/qa-calculations` checks extended (K through R)

---

## Build 0.3C — Derived Intelligence Consistency Fixes

**Status:** Accepted

- Batch summary consistency: latest cascade summary matches batch history
- No duplicate dish double-counting in batch summary
- Impact metric labeling: per-serving vs. monthly, has_sales_data flags
- `/qa-calculations` checks S added (no duplicate dish double-counting)

---

## Build 0.4 — UX Polish & Pre-Supabase Readiness

**Status:** Accepted

- Documentation: `docs/calculation-engine.md`, `docs/derived-intelligence.md`
- UX polish across operational pages
- Accessibility improvements
- Empty states for pages without data
- `docs/pre-supabase-readiness.md`: migration readiness tracker

---

## Build 0.5A — GitHub Checkpoint

**Status:** Accepted

- Repository readiness
- Project cleanup
- Git history established

---

## Build 0.5B — Supabase Architecture Planning

**Status:** Accepted (planning only, no code changes)

- `docs/supabase-plan.md`: comprehensive phased backend plan
- Database schema design for all planned tables
- RLS policy plan
- Server-side function specifications
- Migration strategy from mock data
- Risk list (15 identified risks with mitigations)

---

## Build 1.0 — Auth + Tenant Foundation

**Status:** Implemented, stabilized through 1.0D

- **Migration 1:** `profiles`, `restaurants`, `restaurant_members`, `restaurant_settings` tables
- **Migration 2-4:** Permission cleanup and hardening for SECURITY DEFINER functions
- RLS policies on all tables
- SECURITY DEFINER helpers: `is_restaurant_member()`, `has_restaurant_role()`, `create_restaurant_with_owner()`
- Trigger: `on_auth_user_created` (auto-create profile)
- Trigger: `protect_sole_owner` (prevent last-owner removal)
- Auth UI: `/login`, `/signup`, `/auth/callback`
- Onboarding: `/onboarding/create-restaurant`
- AuthProvider context with session, profile, memberships, activeRestaurantId
- AuthGate route guard with redirect logic
- `/qa-auth` diagnostic page

---

## Build 1.0A/B/C/D — Auth Stabilization Attempts

**Status:** Partially resolved

- **1.0A:** Fixed HTTP 500 from wrong env var naming
- **1.0B:** Removed `localStorage activeRestaurantId` — now React state only
- **1.0C:** Improved signup feedback and error handling
- **1.0D:** Various auth flow fixes
- **Remaining blocker:** Session persistence — session is lost on refresh/navigation

---

## Build 1.1 — Settings/Admin Reference Data

**Status:** Implemented, pending re-acceptance after Auth fix

- **Migration 5:** `units`, `unit_conversions`, `menu_categories`, `suppliers` tables
- Default units seeded: Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl
- Unit conversions seeded: same-family pairs with correct factors
- `initialize_restaurant_reference_data()` function: seeds default categories and suppliers on restaurant creation
- Settings page with 6 tabs: General, Units & Conversions, Menu Categories, Suppliers, Alert Thresholds, Team
- Role-based access: owner can edit settings, owner/manager can manage reference data
- API layer: `src/data/api/settingsApi.ts` — CRUD for settings, units, categories, suppliers
- `/qa-settings-admin` checks A through U

**Note:** Build 1.1 is implemented. Re-acceptance (Build 1.1A) is next now that Auth works.

---

## Build 1.0E — Persistent Supabase Session Hard Fix

**Status:** Accepted (merged into 1.0F)

- Removed Proxy singleton from `src/integrations/supabase/client.ts`
- Removed explicit `storage: typeof window !== 'undefined' ? localStorage : undefined` — was passing `storage: undefined` during SSR, overriding Supabase's built-in localStorage default
- Now uses Supabase's default storage detection (localStorage in browser, in-memory on server)
- Added `detectSessionInUrl: true` explicitly
- Auth config: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

---

## Build 1.0E-A — Auth QA Loading and Route Guard Fix

**Status:** Accepted (merged into 1.0F)

- Removed `/qa-auth` from `PUBLIC_PATHS` in AuthGate
- `/qa-auth` was being treated as an auth-flow page, causing authenticated users to be redirected to `/dashboard`
- Now only `/login`, `/signup`, `/auth/callback` redirect authenticated users away
- `/qa-auth` is a protected route: unauthenticated → `/login`, authenticated → stays on page

---

## Build 1.0F — Auth Acceptance Final

**Status:** Accepted

- Build label updated to "Build 1.0F — Auth Accepted"
- Session persistence verified: survives refresh and navigation
- Sign out clears session and redirects to `/login`
- `/qa-auth` accessible as protected diagnostic route
- No `activeRestaurantId`, role, membership, or settings in localStorage
- Documentation updated
- Previous blocker resolved

---

## Build 1.1A — Settings/Admin Acceptance

**Status:** Accepted

- Re-accepted Settings/Admin reference data layer now that Auth session persistence is stable (Build 1.0F).
- `/qa-settings-admin` checks A through U verified.
- Settings page 6 tabs verified: General, Units & Conversions, Menu Categories, Suppliers, Alert Thresholds, Team.
- Role-based access: owner can edit settings/thresholds, owner/manager can manage categories/suppliers, viewer is read-only.
- Units (Ct, Gr, Kg, Lb, Oz, Ml, Lt, Gl) and unit conversions are read-only global reference data.
- Default menu categories and suppliers seeded on restaurant creation.
- Duplicate name handling verified for categories and suppliers.
- RLS tenant scoping verified for menu_categories and suppliers.
- No service-role key exposed to client.
- No operational tables created.
- Team tab remains placeholder/read-only.
- Build label updated to "Build 1.1A — Settings/Admin Accepted".

**Known limitations:**
- Custom unit management not exposed (units are read-only).
- Suppliers not linked to ingredients yet (Build 1.2).
- Team management is placeholder — no invites or role changes.
- Restaurant switcher limited to in-memory re-pointing.
- Google OAuth not enabled.

---

## Build 1.2 — Ingredients Database

**Status:** Implemented

- **Migration:** `ingredients` and `ingredient_cost_state` tables with RLS, updated_at triggers, case-insensitive unique name index.
- **API:** `src/data/api/ingredientsApi.ts` — getIngredients, getIngredientById, createIngredient, updateIngredient, deactivateIngredient, calculateCostState, upsertIngredientCostState, getIngredientCostStates.
- **Types:** `IngredientRow`, `IngredientCostStateRow`, `IngredientWithCostState`, `IngredientInput`, `IngredientPatch` in `types.ts`.
- **Generated types:** `src/integrations/supabase/types.ts` updated with new tables.
- **Routes:** `/ingredients` and `/ingredients/$id` rewritten from mock to Supabase.
- **Add form:** Drawer with type-conditional fields (Primary/Fixed/Intermediate).
- **Cost calculation:** Uses existing pure helpers from `src/lib/ingredientCost.ts` and `src/lib/units.ts`, persists result to `ingredient_cost_state`.
- **QA:** `/qa-ingredients` with checks A–T.
- **Developer QA link:** Added to Settings → Developer QA.
- **RLS:** Members select, owner/manager insert/update. No delete policy (soft delete via `is_active`).
- Suppliers linked via FK to `suppliers` table.
- Deactivation via `is_active = false`.

**Limitations:**
- Cost state computed client-side (server-side source of truth in future build).
- Intermediate ingredient costs pending (awaiting Build 1.3 Recipes).
- Price Log/Snapshot not yet available (Build 1.5).
- Edit form not yet implemented (placeholder).
- Dashboard and other operational pages still use mock data.

---

## Build 1.2A — Ingredients Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev` (migrated from Lovable Cloud).
- All migrations (1.0 through 1.2) applied successfully to the new project.
- Primary ingredient cost state: calculated, valid.
- Fixed ingredient cost state: manual, valid.
- Intermediate ingredient cost state: pending (awaiting Build 1.3).
- `/qa-settings-admin` check U updated to accept Build 1.2 tables (ingredients, ingredient_cost_state).
- `/qa-auth` operational data warning updated to reflect partial migration.
- `/qa-ingredients` warnings clarified as manual/role-dependent, not product failures.
- Build label updated to "Build 1.2A — Ingredients Accepted".

---

## Build 1.3 — Recipes

**Status:** Implemented

- **Migration:** `recipes` and `recipe_lines` tables with RLS, updated_at triggers, case-insensitive unique name index.
- **API:** `src/data/api/recipesApi.ts` — getRecipes, getRecipeById, createRecipe, updateRecipe, deactivateRecipe, replaceRecipeLines, calculateRecipeMetrics, updateLinkedIntermediateIngredientCostState, detectCycle.
- **Types:** `RecipeRow`, `RecipeLineRow`, `RecipeWithLines`, `RecipeMetrics`, `RecipeLineCost`, `RecipeInput`, `RecipePatch`, `RecipeLineInput` in `types.ts`.
- **Generated types:** `src/integrations/supabase/types.ts` updated with recipes + recipe_lines.
- **Routes:** `/recipes` and `/recipes/$id` rewritten from mock to Supabase.
- **Recipe list:** Tabs (Dishes / Intermediates) with COGS, cost/serving, GPM, on-target.
- **Recipe detail:** Line editor (add/remove/edit ingredient lines), live totals panel, cycle detection.
- **Intermediate propagation:** Saving an intermediate recipe updates linked ingredient's cost_state.
- **Cycle detection:** Blocks circular intermediate dependencies before save.
- **QA:** `/qa-recipes` with checks A–V.
- **Developer QA link:** Added to Settings → Developer QA.
- **RLS:** Members select, owner/manager insert/update. Lines also allow delete.

**Limitations:**
- Menu Analytics (menu_items) awaits Build 1.4.
- Price Log/Snapshot awaits Build 1.5.
- Dashboard and other operational pages still use mock data.
- Full recipe edit form (name, category, serving) is future scope.

---

## Build 1.3A — Recipes Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev`.
- Dish recipes: COGS, cost/serving, GP, GPM, suggested price compute correctly.
- Intermediate recipes: cost propagation updates linked ingredient_cost_state.
- Cycle detection blocks circular intermediate dependencies.
- `/qa-recipes` checks A–V verified (PASS or acceptable WARN for role-dependent checks).
- `/qa-settings-admin` check U updated to accept Build 1.3 tables.
- `/qa-auth` operational data warning updated to reflect Build 1.3.
- Build label updated to "Build 1.3A — Recipes Accepted".

---

## Build 1.3B — Recipes Edit Complete

**Status:** Accepted

- Full recipe field editing on /recipes/$id (name, category, serving, menu price, linked ingredient, notes).
- Save updates both recipe row and recipe lines in one flow.
- Intermediate cost propagation on save.

---

## Build 1.4 — Menu Analytics

**Status:** Implemented

- **No new migration.** Menu Analytics is derived from existing tables.
- **API:** `src/data/api/menuAnalyticsApi.ts` — deriveMenuAnalyticsRows, deriveMenuAnalyticsSummary, getMenuAnalyticsData.
- **Types:** `MenuAnalyticsRow`, `MenuAnalyticsSummary`, `MenuAnalyticsStatus` in `types.ts`.
- **Route:** `/menu-analytics` rewritten from mock to Supabase-derived data.
- **KPI cards:** Average GPM, Average GP, Top/Bottom performer, Below target count.
- **Table:** Dish, Category, Menu Price, COGS/serving, GP, GPM, Target, Suggested Price, Status.
- **Filters:** Below target only, Category, Missing price / Incomplete costing.
- **QA:** `/qa-menu-analytics` with checks A–U.
- **Developer QA link:** Added to Settings → Developer QA.

**Limitations:**
- No snapshot deltas (Δ COGS, Δ GPM) — arrives in Build 1.5.
- Suggested price is informational only — no Apply action yet.
- Dashboard and other operational pages still use mock data.

---

## Build 1.4A — Menu Analytics Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev`.
- Menu Analytics derived from live Supabase data — no new tables.
- KPIs, per-dish profitability table, suggested prices verified.
- `/qa-menu-analytics` checks A–U verified (PASS or acceptable WARN).
- Build label updated to "Build 1.4A — Menu Analytics Accepted".

---

## Build 1.5 — Price Log + Snapshot Foundation

**Status:** Implemented

- **Migration:** `price_update_batches`, `ingredient_price_log`, `ingredient_snapshots` with RLS.
- **API:** `src/data/api/priceLogApi.ts` — getPriceLogEntries, getPriceUpdateBatches, getIngredientSnapshots, getSnapshotStatus, initializeBaseline.
- **Types:** `PriceUpdateBatchRow`, `IngredientPriceLogRow`, `IngredientSnapshotRow`, `SnapshotStatus` in `types.ts`.
- **Route:** `/price-log` rewritten from mock to Supabase. Baseline status card, initialize baseline button, append-only log table.
- **Append-only:** No UPDATE/DELETE policy on ingredient_price_log.
- **Baseline init:** Captures current ingredients, creates baseline log entries + snapshots.
- **QA:** `/qa-price-log-snapshot` with checks A–V.
- **Developer QA link:** Added to Settings → Developer QA.

**Limitations:**
- Non-destructive baseline reset deferred.
- Price Trend still uses mock data.
- Dashboard and other operational pages still use mock data.

---

## Build 1.5A — Price Update Batch Flow

**Status:** Implemented

- **No new migration.** Uses existing Build 1.5 tables.
- **API:** `previewPriceChanges`, `applyPriceUpdateBatch` in priceLogApi.ts.
- **UI:** Batch drawer on /price-log: select ingredients, enter new prices, preview, apply.
- **Writes:** Batch row, ingredient updates, cost_state, append-only log, snapshot updates.
- **Intermediate:** Blocked — "updated through recipes, not supplier price batches."
- **/ingredients:** "Run Price Update" button now links to /price-log.
- Batch apply is client-orchestrated (not atomic DB transaction).
- Normal ingredient edits do NOT write price log entries (by design).

---

## Build 1.5B — Price Trend Supabase-backed

**Status:** Implemented

- **No new migration.** Reads from existing ingredient_price_log.
- **API:** `src/data/api/priceTrendApi.ts` — getPriceTrendIngredients, getIngredientPriceTrend, derivePriceTrendStats, derivePriceTrendSeries.
- **Route:** `/price-trend` rewritten from mock to Supabase-backed.
- **Chart:** Recipe unit cost over time from baseline + change events.
- **KPIs:** First recorded, current, absolute change, percent change, number of changes, largest increase.
- **History table:** Timestamp, event type, old/new RUC, delta %, baseline version, note.
- **QA:** `/qa-price-trend` with checks A–S.
- **Developer QA link:** Added to Settings → Developer QA.

**Limitations:**
- Dashboard still uses mock data.
- Dish Analysis still uses mock data.
- Impact Cascade persistence deferred.
- Alerts persistence deferred.

---

## Build 1.6 — Dish Analysis Supabase-derived

**Status:** Implemented

- **No new migration.** Derived from active dish recipes, recipe_lines, ingredients, ingredient_cost_state, restaurant_settings.
- **Component:** `DishAnalysisView` rewritten from mock to Supabase.
- **COGS breakdown:** Line-by-line cost sorted by share.
- **Profitability:** GP, GPM, target comparison, suggested price.
- **Scenario modeling:** Local-only sliders for cost/price adjustments.
- **Margin Manager:** Suggested prices at multiple target GPM levels.
- **QA:** `/qa-dish-analysis` with checks A–U.
- **Developer QA link:** Added to Settings → Developer QA.

**Limitations:**
- Scenario data is local-only (React state), not persisted.
- No Apply Price action.
- Dashboard still uses mock data.

---

## Build 1.7 — Impact Cascade Foundation

**Status:** Implemented

- **Migration:** `impact_cascade_runs` and `impact_cascade_items` with RLS.
- **API:** `impactCascadeApi.ts` — generate cascade, query runs/items.
- **Routes:** `/impact-cascade` and `/impact-cascade/$batchId` rewritten from mock.
- **Generation:** Changed ingredients → affected dishes → old/new COGS/GPM → suggested prices.
- **Direct/indirect paths.** Only dish recipes as final impact items.
- **QA:** `/qa-impact-cascade` with checks A–U.
- Per-serving metrics only. Dashboard and Alerts remain mock.

---

## Build 1.8 — Alerts

**Status:** Implemented

- **Migration:** `alerts` table with RLS, updated_at trigger.
- **API:** `alertsApi.ts` — getAlerts, deriveAlertSummary, generateAlertsForRestaurant, acknowledgeAlert, resolveAlert, dismissAlert.
- **Types:** `AlertRow`, `AlertSummary`, `AlertType`, `AlertSeverity`, `AlertStatus`.
- **Route:** `/alerts` rewritten from mock to Supabase.
- **KPIs:** Open, critical, warning, resolved counts.
- **Table:** Severity, type, title, message, detected at, status + actions.
- **Generation:** Explicit "Generate Alerts" button from Menu Analytics + Impact Cascade + Price Log.
- **Status actions:** Acknowledge, resolve, dismiss.
- **Duplicate prevention:** Checks existing open alert before inserting.
- **QA:** `/qa-alerts` with checks A–Q.

**Limitations:**
- Dashboard still uses mock data.
- No automatic alert generation (manual trigger only).
- No email/push notifications.

---

## Build 1.8A — Alerts Acceptance

**Status:** Accepted

- Verified on self-owned Supabase project `margin-maestro-dev`.
- /alerts is Supabase-backed with generation, status actions, duplicate prevention.
- /qa-alerts checks A–Q verified (PASS or acceptable WARN).
- Full operational chain now Supabase-backed: Ingredients → Recipes → Menu Analytics → Price Log → Price Trend → Dish Analysis → Impact Cascade → Alerts.
- Dashboard remains the only mock page.
- Build label updated to "Build 1.8A — Alerts Accepted".

---

## Build 1.9 — Dashboard Supabase-backed

**Status:** Implemented

- **No new migration.** Dashboard derived from existing Supabase-backed modules.
- **API:** `dashboardApi.ts` — getDashboardData with alert summary, menu KPIs, impact cascade summary, price activity, recommended actions.
- **Route:** `/dashboard` rewritten from mock to Supabase-derived.
- **Alert-first design:** Critical alerts banner, open alerts panel, recommended actions.
- **KPI cards:** Average GPM, below target, open alerts, missing price, price changes, impacted dishes.
- **Panels:** Menu health, price activity, impact cascade, recommended actions.
- **QA:** `/qa-dashboard` with checks A–W.
- **Developer QA link:** Added to Settings → Developer QA.

**All operational pages are now Supabase-backed or Supabase-derived. No mock data in use.**

**Remaining scope:**
- Billing (Build 2.0)
- Team management
- Google OAuth
- Apply Price action
- Production hardening
- CSV import/export

---

## Build 1.9A — MVP Accepted

**Status:** Accepted

- All operational pages verified as Supabase-backed or Supabase-derived.
- No mock data is used by any operational page.
- Outdated "still mock" copy removed from QA routes.
- Build label updated to "Build 1.9A — MVP Accepted".
- Core MVP modules complete: Auth, Settings, Ingredients, Recipes, Menu Analytics, Price Log, Snapshot, Price Update Batch, Price Trend, Dish Analysis, Impact Cascade, Alerts, Dashboard.

---

## Build 2.0 — Production Hardening & Beta Readiness

**Status:** Implemented

- **No new migration.** No new tables. Documentation and QA only.
- **Security review:** `docs/security-review.md` — RLS coverage, client safety, auth/session, known limitations.
- **Deployment guide:** `docs/deployment-guide.md` — env vars, Supabase setup, pre-deploy validation, beta checklist.
- **Beta checklist:** `docs/beta-checklist.md` — manual acceptance flows for all 11 modules.
- **Production readiness:** `docs/production-readiness.md` — MVP status, pre-production requirements, known limitations.
- **Environment safety:** `.env.example` created with placeholders only.
- **QA:** `/qa-mvp-readiness` with checks A–V (tables, security, module data, documentation).
- Build label updated to "Build 2.0 — Beta Readiness".

---

## Build 2.1 — Team Management

**Status:** Implemented

- **Migration:** `restaurant_invitations` + `accept_restaurant_invitation` RPC.
- **API:** `teamApi.ts` — members, invitations, role changes, accept invite.
- **Settings Team tab:** Full UI replacing placeholder.
- **Accept invite route:** `/accept-invite?token=<token>`.
- **QA:** `/qa-team-management` with checks A–Q.
- Sole owner protection via existing trigger.

---

## Build 2.1A — Team Management Acceptance

**Status:** Accepted

- Team Management verified on margin-maestro-dev.
- RLS fixed to use JWT email claims (not auth.users from client).
- Member loading fixed (two-step query, no embedded join).
- Invite link copy-to-clipboard with clear "no email delivery" copy.
- Build label: "Build 2.1A — Team Management Accepted".

---

## Build 2.3 — Automated E2E QA

**Status:** Implemented

- **Playwright** added as dev dependency with chromium browser.
- **5 E2E specs:** smoke (10 routes), QA routes (15 routes), auth/session, settings/team, intelligence pages.
- **Helper utilities:** login, goToRoute, waitForAppReady, env management.
- **Scripts:** `test:e2e`, `test:e2e:ui`, `test:e2e:headed`.
- **No mutations by default** — safe for CI.
- Tests skip gracefully if E2E_EMAIL/E2E_PASSWORD missing.
- No service-role usage. No localStorage persistence checks.
- Documentation: `docs/e2e-testing.md`.

---

## Build 2.2 — Billing

**Status:** Implemented

- **Migration:** `billing_customers`, `billing_subscriptions`, `billing_events` with RLS.
- **API:** `billingApi.ts` — getBillingSummary, createCheckoutSession, createCustomerPortalSession.
- **Settings Billing tab:** Status, plan, period, checkout/portal (owner-only).
- **Edge Functions:** Documented stubs requiring deployment with Stripe keys.
- **QA:** `/qa-billing` with checks A–Q.
- No Stripe secrets in browser. Owner-only via RLS.

---

## Build 2.2A — Billing Stripe Test

**Status:** Implemented

- **Edge Functions:** `create-checkout-session`, `create-customer-portal-session`, `stripe-webhook` — deployable Deno functions.
- **Shared helpers:** `_shared/cors.ts`, `_shared/supabase.ts` for auth verification and admin client.
- **Webhook:** Stripe signature verification, idempotent event recording, subscription state sync.
- **Checkout:** Creates/reuses Stripe customer, creates subscription Checkout Session.
- **Portal:** Creates Billing Portal session for existing customers.
- Requires `supabase secrets set` for STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, SITE_URL.

---

## Build 2.4 — Apply Price Workflow

**Status:** Implemented

- **API:** `applyPriceApi.ts` — canApplyPrice, validateApplyPriceInput, applyDishMenuPrice.
- **Menu Analytics:** "Apply" button for below-target dishes with suggested price.
- **Dish Analysis → Margin Manager:** "Apply this price" under primary target.
- Owner/manager only. Updates `recipes.menu_price` only.
- **QA:** `/qa-apply-price` with checks A–S.

---

## Build 2.4A — Apply Price Acceptance

**Status:** Accepted

- Apply Price verified on margin-maestro-dev.
- Updates `recipes.menu_price` only — no price log, no batches, no billing, no POS.
- Owner/manager only. Viewer read-only.
- Build label: "Build 2.4A — Apply Price Accepted".

---

## Build 2.5 — CSV Import/Export

**Status:** Implemented

- **CSV utilities:** `src/lib/csv.ts` — parser, serializer, formula injection protection.
- **API:** `importExportApi.ts` — ingredient import + 5 export functions.
- **Settings Import/Export tab.** Import preview + export buttons.
- **QA:** `/qa-import-export` with checks A–V.

---

## Build 2.5A — CSV Import/Export Acceptance

**Status:** Accepted

- CSV import/export verified on margin-maestro-dev.
- Ingredient import with preview, validation, and apply confirmed.
- Export for 5 datasets confirmed with formula injection protection.
- Import does not write price log, create batches, or create billing records.
- Build label: "Build 2.5A — CSV Accepted".

---

## Build 2.6 — Beta Launch Prep

**Status:** Implemented

- **Docs created:** beta-release-notes.md, beta-user-guide.md, support-playbook.md, beta-launch-prep.md.
- **QA:** `/qa-beta-launch` with checks A–AB (tables, routes, features, docs, security).
- **Developer QA links:** All 19 QA routes linked under Settings → Developer QA.
- Build label: "Build 2.6 — Beta Launch Prep".
- Beta-ready MVP with full documentation.

---

## Build 2.7 — Monitoring & Error Logging

**Status:** Implemented

- **Monitoring config:** optional, config-driven via VITE_SENTRY_DSN.
- **Logger:** sanitized logging with 14+ sensitive key pattern redaction.
- **Sentry stub:** provider-neutral, activates with @sentry/react.
- **Error Boundary:** wraps root component, friendly fallback.
- **QA:** `/qa-monitoring` with checks A–T + inline redaction tests.
- No new tables, no new dependencies, no secrets exposed.

---

## Build 2.7A — Monitoring Acceptance

**Status:** Accepted

- Route error component with monitoring/captureException.
- /qa-monitoring check L PASS.

---

## Build 2.8 — Google OAuth

**Status:** Accepted (live verification — Build 2.8A)

- **Auth API:** `signInWithGoogle()` via Supabase `signInWithOAuth({ provider: 'google' })`.
- **Login:** "Continue with Google" button added.
- **Signup:** "Continue with Google" button added.
- **Email/password** remains available.
- Google provider must be configured manually in Supabase Dashboard.
- No Google client secret in frontend. No provider tokens stored.
- Invitation acceptance works with Google email via JWT claim matching.
- **/qa-auth** Google OAuth check updated from WARN to PASS.

---

## Build 2.8A — Google OAuth + Live Accepted

**Status:** Accepted

- **Live deploy:** Vercel project `margin-maestro` at https://margin-maestro.vercel.app.
- **Build adapter:** Cloudflare plugin disabled in `vite.config.ts`; SSR output bundled into a Vercel Node.js Function via `api/server.mjs` + `vercel.json:functions.includeFiles=dist/server/**`.
- **Routing:** `vercel.json:rewrites` sends every path that is not `/api/...`, `/assets/...`, `favicon.ico`, or `robots.txt` to the SSR function.
- **Vercel env (names only):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. No service-role / Stripe / Google secret in browser env.
- **Supabase Auth URL configuration** pushed via `supabase config push` from `supabase/config.toml [auth]`. Site URL = live Vercel domain; 16 redirect URLs covering prod, Vercel preview wildcard, local dev (8085, 8082), plus explicit `/dashboard`, `/login`, `/signup`, `/accept-invite`, `/auth/callback`.
- **Google OAuth manually verified on live URL.** Email/password sign-in remains available.
- **`.env`** removed from git tracking (was previously committed to a stale Lovable sandbox project ref). `.gitignore` hardened: `.env`, `.env.*.local`, `.vercel`, `supabase/.temp/`.
- **`supabase/config.toml`** project_id corrected from stale Lovable ref `urcijgorzjxaclfyaulc` to live `atdvrdhzcbtxvzgvoxhb`.
- **/qa-google-oauth** check N added (live manual verification PASS), check O added (production hardening WARN).
- **/qa-mvp-readiness** checks W (live deployment PASS) + X (separate prod project recommended WARN) added.
- **/qa-beta-launch** checks AC–AG added (live deploy, vercel config, auth URLs, manual OAuth verification, dev-as-prod WARN).
- **/qa-live-deployment** added — checks A through O.
- **Settings → Developer QA** updated with link to `/qa-live-deployment`.
- **Docs:** `docs/live-deployment.md` created. `docs/current-state.md`, `docs/build-log.md`, `docs/roadmap.md`, `docs/open-issues.md`, `docs/google-oauth.md`, `docs/deployment-guide.md`, `docs/production-readiness.md`, `docs/security-review.md` updated.
- **No migrations.** No new tables. No RLS or schema changes. Stripe and Sentry remain deferred.
- Build label: "Build 2.8A — Google OAuth + Live Accepted".

**Known live limitations**

- Dev Supabase project is reused as the live backend by explicit user choice. Migration to `margin-maestro-prod` is recommended before wider production rollout.
- Stripe verification deferred.
- Sentry DSN optional / not configured.
- Google OAuth production hardening (consent screen + authorized domains final review) pending.

---

## Build 2.9 — Menu Price Audit Trail

**Status:** Accepted (Build 2.9A — live verification).

- **Migration:** `supabase/migrations/20260510170000_build_2_9_menu_price_audit_trail.sql` (not auto-applied; deploy with `supabase db push`).
- **New table:** `menu_price_audit_log` (id, restaurant_id, recipe_id, recipe_name_at_time, recipe_kind_at_time, category_name_at_time, old_menu_price, new_menu_price, delta_amount, delta_percent, source, context, note, changed_by, changed_at, created_at). CHECK `new_menu_price > 0` and `recipe_kind_at_time = 'dish'`. CHECK source in (`apply_price`, `manual_recipe_edit`, `import`, `system`, `other`).
- **Indexes:** `restaurant_id`, `recipe_id`, `changed_at desc`, `source`, `changed_by`.
- **RLS:** SELECT for restaurant members; INSERT for owner/manager only; no UPDATE; no DELETE (append-only).
- **API:** `src/data/api/menuPriceAuditApi.ts` — `getMenuPriceAuditLog`, `getMenuPriceAuditForRecipe`, `createMenuPriceAuditEntry`, `deriveMenuPriceAuditSummary`, `validateMenuPriceAuditInput`. Browser client + RLS only. Errors sanitized via `toApiError`.
- **Apply Price integration:** `applyDishMenuPrice` reads current recipe (name, kind, is_active, menu_price, category), updates `recipes.menu_price`, then best-effort inserts an audit row with `source='apply_price'` and a `context` object (`origin`, `target_gpm`, `cost_per_serving`, `suggested_price`, `reason`). Returns `ApplyPriceResult { audit_recorded, audit_error, old_menu_price, new_menu_price }`. UI shows different toast copy based on result. **Does not write `ingredient_price_log`, `price_update_batches`, or billing rows. No POS publishing.**
- **Manual recipe edit integration:** `updateRecipe` reads prior `menu_price` and `kind` when the patch includes `menu_price`, then — after a successful update — best-effort inserts an audit row with `source='manual_recipe_edit'` if the recipe is a dish and the price actually changed. Intermediate recipes are skipped.
- **UI — Dish Analysis:** read-only "Menu price audit history" panel on `/dish-analysis/$id` listing up to 25 most recent entries (changed_at, source label, old price, new price, Δ, Δ%). Empty state explains Apply Price + manual edits will populate it. Audit reloads after Apply Price.
- **UI — Menu Analytics:** Apply Price success toast distinguishes between full success and audit-failed degraded path.
- **QA — `/qa-menu-price-audit`:** new automated QA route with checks A–U (auth, RLS scope, append-only design, dish-only, finite deltas, Apply-Price side-effect absence, secret exposure, localStorage). Linked from Settings → Developer QA.
- **QA — `/qa-mvp-readiness`:** `EXPECTED_TABLES` extended to include `menu_price_audit_log`; new check Y.
- **QA — `/qa-beta-launch`:** `EXPECTED_TABLES` extended; new check AH.
- **QA — `/qa-auth`:** footer references Build 2.9.
- **E2E:** `tests/e2e/qa-routes.spec.ts` includes `/qa-menu-price-audit`. Apply Price mutation tests stay opt-in (no default mutation).
- **Docs:** `docs/menu-price-audit-trail.md` created. `docs/current-state.md`, `docs/roadmap.md`, `docs/open-issues.md`, `docs/apply-price.md`, `docs/dish-analysis.md`, `docs/menu-analytics.md`, `docs/qa-checklists.md`, `docs/beta-checklist.md`, `docs/live-deployment.md` updated. CLAUDE.md table-build mapping updated.
- Build label: "Build 2.9 — Menu Price Audit Trail".

**Known limitations:**
- Client-orchestrated price-update + audit insert (not atomic). When audit insert fails, the price update remains; UI surfaces a clear warning. A server-side SQL wrapper could make this atomic in a future build.
- No menu price approval workflow.
- No POS / external menu publishing (intentional, per CLAUDE.md guardrails).
- `source='import'` is reserved but not exercised in this build.

---

## Build 2.9A — Menu Price Audit Accepted

**Status:** Accepted.

- **Migration applied** to live Supabase (`atdvrdhzcbtxvzgvoxhb`) successfully after a one-line RLS fix: `has_restaurant_role(restaurant_id, 'owner') OR has_restaurant_role(restaurant_id, 'manager')` was incompatible with the project-wide `has_restaurant_role(uuid, text[])` signature. Patched to `has_restaurant_role(restaurant_id, array['owner','manager'])`. Migration is now re-runnable (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`).
- **Live verification (`pg_policies` query):** policies present and correct:

  | policyname | cmd |
  |---|---|
  | `menu_price_audit_log_insert_owner_manager` | INSERT |
  | `menu_price_audit_log_select_members` | SELECT |

  No UPDATE, no DELETE policy → append-only confirmed at the database level.
- **Apply Price audit verified live.** Dish menu price changes via `/menu-analytics` and `/dish-analysis/$id` insert rows into `menu_price_audit_log` with `source='apply_price'` and the structured `context` payload. UI distinguishes success and degraded-audit paths in the toast.
- **Manual recipe edit audit verified live.** Saving a dish recipe with a changed `menu_price` writes a `source='manual_recipe_edit'` audit row. Intermediate recipes do not produce menu price audit rows. Non-price recipe edits do not produce audit rows.
- **Apply Price side-effects checked:**
  - Does **not** write `ingredient_price_log`.
  - Does **not** create `price_update_batches`.
  - Does **not** create `billing_*` rows.
  - Does **not** publish to a POS or external menu.
- **Dish Analysis audit panel:** recent 25 entries with friendly source labels, MoneyCell / PercentCell formatting, no raw user IDs, no raw JSON, append-only subtitle.
- **QA copy refreshed:** `/qa-menu-price-audit`, `/qa-mvp-readiness` (check Y → "accepted"), `/qa-beta-launch` (check AH → "accepted"), `/qa-auth` (footer note).
- **Docs updated:** `current-state.md`, `build-log.md`, `roadmap.md`, `open-issues.md`, `menu-price-audit-trail.md`, `apply-price.md`, `dish-analysis.md`, `menu-analytics.md`, `dashboard.md`, `qa-checklists.md`, `beta-checklist.md`, `live-deployment.md`.
- **No new tables.** **No RLS changes.** **No schema changes.** No new dependencies.
- Build label: "Build 2.9A — Menu Price Audit Accepted".

**Known remaining limitations (carried forward):**
- OI-28 — client-orchestrated price update + audit insert is not atomic.
- OI-16/17/18/19/20/21 — separate prod project, Stripe verification, billing rollout, Sentry DSN, transactional invite emails, OAuth production hardening.

---

## Build 3.0 — Recipe CSV Import

**Status:** Implemented (acceptance pending — Build 3.0A).

- **No migration.** No new tables. No RLS changes.
- **New API file** `src/data/api/recipeImportApi.ts` exposing:
  - `getRecipeImportTemplate()`, `getRecipeLinesImportTemplate()`, `downloadRecipeImportTemplate()`, `downloadRecipeLinesImportTemplate()`.
  - `parseRecipeCsv(text)` / `parseRecipeLinesCsv(text)` — wraps `parseCsv` + `normalizeCsvHeader`.
  - `validateRecipeImportRows(rows, ctx)` / `validateRecipeLineImportRows(rows, ctx)` — synchronous client-side validation.
  - `previewRecipeImport(restaurantId, recipesCsv, linesCsv, options)` — fetches existing recipes / ingredients / categories and returns `RecipeImportPreview` (counts + per-row messages). **Read-only.**
  - `applyRecipeImport(restaurantId, preview, options)` — orchestrates `createRecipe` / `updateRecipe` / `replaceRecipeLines` (or direct line inserts) and writes `menu_price_audit_log` rows with `source = 'import'`. Returns `RecipeImportApplyResult` with counts + errors + audit success/fail counters.
  - `exportRecipeLinesCsv(restaurantId)` — joins recipes + ingredients to produce a lines CSV.
  - `canImportRecipes(role)` — owner/manager only.
- **New types** in `src/data/api/types.ts`:
  - `RecipeImportStatus`, `RecipeImportAction`, `RecipeImportDuplicateMode` (`skip` | `update` | `block`), `RecipeImportLineMode` (`append` | `replace`).
  - `RecipeImportRecipeRow`, `RecipeImportLineRow`, `RecipeImportPreview`, `RecipeImportOptions`, `RecipeImportApplyResult`.
- **UI — Settings → Import / Export → Import Recipes** (`RecipeImportCard`):
  - Owner/manager only (rendered behind `canManage`).
  - Two file inputs (Recipes CSV + Recipe Lines CSV) — operators can upload either or both.
  - Duplicate handling (`skip existing`/`update existing`/`block duplicates`) and Line handling (`append`/`replace`) selectors.
  - Preview shows per-row error/warning messages and counts (recipes, lines, create, update, skip, errors).
  - Apply button disabled while errors exist; replace mode triggers a `window.confirm` warning.
  - Static legal block clarifies what recipe import does NOT do (no ingredient creation, no batches, no price log writes, no billing rows, no POS publishing).
- **Export Recipe Lines** added to the Export Data card.
- **Menu price audit (Build 2.9 integration):** for each imported dish whose `menu_price` was set or changed, an append-only audit row is added with `source = 'import'` and `context = { origin: "recipe-csv-import", action: "create" | "update", row_number }`. `audit_recorded` and `audit_failed` counts are surfaced in the apply result toast.
- **Cycle detection (best-effort):** before writing lines, `detectCycle(recipeId, projectedIngredientIds, allRecipes, allIngredients)` is called per recipe. Recipes that would introduce a cycle are skipped with an explicit error message in the apply result.
- **/qa-recipe-import** (Build 3.0): 25 checks (A–Y) — auth, parser, validators (synthetic in-memory rows), no-mutation guarantee, role gating, side-effect absence (no ingredient creation, no `ingredient_price_log`, no `price_update_batches`, no `billing_*`), `menu_price_audit_log` source = import behaviour, `menu_items` absence, secret exposure, localStorage persistence.
- **/qa-mvp-readiness** check Z added.
- **/qa-beta-launch** check AI added.
- **/qa-import-export** checks W–X added.
- **/qa-auth** footer reflects Build 3.0.
- **Settings → Developer QA** gains link to `/qa-recipe-import`.
- **E2E:** `tests/e2e/qa-routes.spec.ts` includes `/qa-recipe-import`. No mutating tests added by default.
- **Docs:** `docs/recipe-csv-import.md` created (full spec). `docs/current-state.md`, `docs/build-log.md`, `docs/roadmap.md`, `docs/open-issues.md`, `docs/csv-import-export.md`, `docs/recipes.md`, `docs/menu-price-audit-trail.md`, `docs/qa-checklists.md`, `docs/beta-checklist.md`, `docs/live-deployment.md` updated.
- Build label: "Build 3.0 — Recipe CSV Import".

**Known limitations:**

- Apply phase is **client-orchestrated, not atomic.** A failure in Phase 2 (lines) or Phase 3 (audit) does not roll back Phase 1 (recipe header writes). The UI reports partial counts. Build 3.4 will introduce a server-side RPC.
- Cycle detection runs against the projected post-import line set captured during apply; subsequent imports against the same data should re-run.
- `target_gpm` is read but not stored per-recipe (the schema stores it in `restaurant_settings`).
- Categories, ingredients, suppliers are **never auto-created**.
- No XLS / XLSX / XLSM support (CSV only).
- No POS / external menu publishing (intentional).

---

## Build 3.0A — Recipe CSV Import Accepted

**Status:** Accepted.

- Recipe CSV Import (Build 3.0) functionally verified on the live URL https://margin-maestro.vercel.app.
- **No code changes** beyond label/copy/docs. No migration. No new tables. No RLS changes.
- Build label: "Build 3.0A — Recipe CSV Import Accepted".
- `/qa-recipe-import`: description + footer bumped to 3.0A.
- `/qa-mvp-readiness`: check Z reads "Recipe CSV Import accepted"; check X reframed to "Single Supabase backend reused for live beta — intentional decision". Footer + description bumped.
- `/qa-beta-launch`: check AI reads "Recipe CSV Import accepted"; check AG reframed to "Single Supabase backend reused for live beta — intentional decision". Footer + description bumped.
- `/qa-import-export`: checks W–X bumped to 3.0A; new check Y notes XLS/XLSM remains future.
- `/qa-auth`: footer reflects 3.0A and the intentional single-backend decision.
- **Strategic reframing.** Separate `margin-maestro-prod` project is no longer the "recommended next" — it remains future optional hardening. The pragmatic mitigation for the current beta phase is stronger backup + QA discipline on `margin-maestro-dev`.
- Roadmap reordered: **Build 3.4 — Atomic RPC Hardening** moves up to the recommended next build; Build 3.2 demoted to optional future hardening.
- Docs updated: `current-state.md`, `build-log.md`, `roadmap.md`, `open-issues.md`, `recipe-csv-import.md`, `menu-price-audit-trail.md` (light), `csv-import-export.md` (light), `recipes.md` (light), `live-deployment.md` (reframe single-backend), `production-readiness.md`, `deployment-guide.md` (light), `qa-checklists.md` (light), `beta-checklist.md` (light).

**Known remaining limitations (carried forward):**
- OI-28 — Apply Price + audit not atomic.
- OI-29 — Recipe import not atomic.
- OI-16 — single Supabase backend reused for live beta (intentional; mitigation: backup + QA discipline).
- OI-17/18 — Stripe verification + billing rollout deferred.
- OI-19 — Sentry DSN optional.
- OI-20 — Transactional invite emails not implemented.
- OI-21 — Google OAuth production hardening pending.
- No XLS/XLSM. No POS/marketplace publishing.

---

## Build 3.4 — Atomic RPC Hardening

**Status:** Implemented (acceptance pending — Build 3.4A).

- **Migration** `supabase/migrations/20260510180000_build_3_4_atomic_rpc_hardening.sql` — functions only, **no new tables**, no RLS changes, no schema changes. Not auto-applied; deploy with `supabase db push`.
- **New SQL function** `public.apply_dish_menu_price_with_audit(p_restaurant_id, p_recipe_id, p_new_menu_price, p_source default 'apply_price', p_note default null, p_context default '{}'::jsonb)` returns `(recipe_id, old_menu_price, new_menu_price, audit_log_id, changed_at)`.
  - `SECURITY INVOKER`. `SET search_path = public`. No dynamic SQL.
  - Defensive checks: `auth.uid()` non-null, `p_new_menu_price > 0`, `p_source ∈ {apply_price, manual_recipe_edit, import, system, other}`, `has_restaurant_role(p_restaurant_id, array['owner','manager'])`.
  - Reads recipe `FOR UPDATE`, validates `kind = 'dish'` and `is_active = true`, looks up category name, updates `recipes.menu_price` + `updated_at`, computes `delta_amount` / `delta_percent` safely (null for null/zero old), inserts `menu_price_audit_log` row with `changed_by = auth.uid()`, `changed_at = now()`.
  - `REVOKE ALL ... FROM public, anon`; `GRANT EXECUTE ... TO authenticated`.
- **`src/data/api/applyPriceApi.ts`** rewritten: `applyDishMenuPrice` now performs a single `supabase.rpc('apply_dish_menu_price_with_audit', ...)` call. Returns `ApplyPriceResult { audit_recorded: true, old_menu_price, new_menu_price, audit_log_id, changed_at }` on success. On RPC failure, throws — no client-side fallback writes the price.
- **`src/data/api/recipeImportApi.ts`** update path: for dish recipes whose imported `menu_price` differs from prior, the price column is stripped from the `updateRecipe` patch and a separate `supabase.rpc('apply_dish_menu_price_with_audit', { ..., p_source: 'import' })` call handles the price update + audit atomically. Other recipe fields still go through `updateRecipe`. Create path remains best-effort (`createRecipe` + `createMenuPriceAuditEntry`).
- **UI toast copy** in `/menu-analytics` and `/dish-analysis/$id` simplified to "Menu price updated to $X and audit entry recorded." The degraded "audit could not be recorded" path was removed (cannot fire with atomic RPC).
- **`integrations/supabase/types.ts`** — added `Functions.apply_dish_menu_price_with_audit` typing.
- **New QA route** `/qa-atomic-rpc` (22 checks A–V): RPC reachability probe with intentionally-invalid args, grant model documentation, defensive role/kind/price/source validation, atomicity guarantee, API integration, recipe-import audit atomicity status, manual-recipe-edit limitation, side-effect absence, secret + localStorage scans.
- **`/qa-apply-price`** extended with checks T (atomic via RPC) and U (no partial price update on RPC failure). Description + footer bumped to 3.4.
- **`/qa-menu-price-audit`** check I rephrased to describe atomic RPC. Description + footer bumped to 3.4.
- **`/qa-recipe-import`** check U rephrased to "update path uses RPC; create path best-effort". Description + footer bumped to 3.4.
- **`/qa-mvp-readiness`** new check AA; description + footer bumped to 3.4.
- **`/qa-beta-launch`** new check AJ; description + footer bumped to 3.4.
- **`/qa-auth`** footer bumped to 3.4.
- **Settings → Developer QA** adds link to `/qa-atomic-rpc`.
- **E2E** `tests/e2e/qa-routes.spec.ts` includes `/qa-atomic-rpc`. No mutating tests added.
- **Docs** created `docs/atomic-rpc-hardening.md`; updated `current-state`, `build-log`, `roadmap`, `open-issues` (OI-28 resolved on Apply Price front; OI-29 partially mitigated), `apply-price`, `menu-price-audit-trail`, `recipe-csv-import`, `qa-checklists`, `beta-checklist`, `live-deployment`, `security-review`.
- Build label: "Build 3.4 — Atomic RPC Hardening".

**Known limitations:**
- Manual recipe edit (`updateRecipe`) still writes a best-effort `manual_recipe_edit` audit row — not atomic with the recipe-fields update. Splitting that path was deemed too risky for this build.
- Recipe CSV Import **create** path still does `createRecipe` + best-effort audit insert. A "create-recipe-with-audit" RPC was deferred.
- Recipe CSV Import update path: non-price recipe fields (name, category, serving, etc.) are still patched via `updateRecipe` — only the `menu_price` column + audit row are atomic with each other.
- Single Supabase backend remains intentional for live beta — recommend taking a PITR checkpoint before applying the migration to the shared backend.

---

## Build 3.4A — Atomic RPC Accepted

**Status:** Accepted.

- Build 3.4 RPC migration applied to live Supabase (`atdvrdhzcbtxvzgvoxhb`) via MCP `apply_migration` — `{"success": true}`.
- Live verification:
  - `pg_proc` shows the function with `security = INVOKER`, correct argument signature, and ACL `postgres=X, authenticated=X, service_role=X` (no `public` or `anon` grant) → grant model confirmed.
  - Probe call `select * from public.apply_dish_menu_price_with_audit('00000000-...', '00000000-...', 10.0, 'apply_price')` (outside authenticated session) returns `42501 not authenticated` from the defensive auth check inside the function. Function is reachable and the auth gate works.
  - Migration history shows `build_3_4_atomic_rpc_hardening` (version `20260510212325`).
- Live Vercel routes — all 200 OK: `/qa-atomic-rpc`, `/qa-apply-price`, `/qa-menu-price-audit`, `/qa-recipe-import`.
- **No code changes** beyond label/copy/docs in this build.
- Build label: "Build 3.4A — Atomic RPC Accepted".
- `/qa-atomic-rpc` description + footer bumped to 3.4A.
- `/qa-apply-price`, `/qa-menu-price-audit`, `/qa-recipe-import`, `/qa-mvp-readiness` (check AA), `/qa-beta-launch` (check AJ), `/qa-auth` footer all bumped to 3.4A.
- Docs updated: `current-state`, `build-log` (this entry), `roadmap` (Build 3.4 accepted; next list reordered with Build 3.1 first), `open-issues` (OI-28 fully resolved for Apply Price; OI-30 carried as recipe-edit follow-up), `atomic-rpc-hardening`, `apply-price`, `menu-price-audit-trail`, `recipe-csv-import`, `qa-checklists`, `beta-checklist`, `live-deployment`, `security-review`.

**Known remaining limitations (carried forward):**
- OI-30 — Manual recipe edit audit not atomic.
- OI-29 (reduced) — Recipe import create path + non-price update fields not atomic.
- OI-16 — Single Supabase backend reused for live beta (intentional cost decision).
- OI-17/18 — Stripe verification + billing rollout deferred.
- OI-19 — Sentry DSN optional / unset.
- OI-20 — Transactional invite emails not implemented.
- OI-21 — Google OAuth production hardening pending.
- No XLS/XLSM. No POS/marketplace publishing.

---

## Build 2.7A — Monitoring Acceptance

**Status:** Accepted

- Route error component upgraded with monitoring/captureException integration.
- Dev mode shows sanitized error message; production shows friendly fallback only.
- /qa-monitoring check L now PASS (custom route error component wired).
- Sentry remains optional — WARN if DSN not configured.
- Build label: "Build 2.7A — Monitoring Accepted".
