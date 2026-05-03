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
